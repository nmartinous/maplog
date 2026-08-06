import { Zip, ZipPassThrough, Unzip, UnzipInflate, strToU8 } from 'fflate';

/**
 * Streaming zip/unzip helpers for backups. Pure (no localStorage/IndexedDB)
 * so they can be unit-tested in Node — see scripts/test-backup-stream.mjs.
 *
 * Memory model: bytes only live on the JS heap in bounded windows.
 * - Input is read in CHUNK_SIZE slices of the source Blob/File.
 * - Output (zip parts on export, entry contents on import) is folded into a
 *   Blob every FLUSH_BYTES. Browsers back Blobs outside the JS heap (and can
 *   page them to disk), so a multi-GB backup never accumulates as raw
 *   Uint8Arrays — the failure mode that froze iOS Safari with zipSync.
 */

/** Read/process blobs in 4 MiB slices so memory stays bounded. */
export const CHUNK_SIZE = 4 * 1024 * 1024;

/** Fold accumulated Uint8Array chunks into a Blob once they exceed this. */
export const FLUSH_BYTES = 16 * 1024 * 1024;

/**
 * Hard cap for a backup zip. The classic zip format (and fflate's streaming
 * writer) tops out at 4 GiB offsets; past that the archive silently corrupts,
 * so refuse with a clear message instead.
 */
export const MAX_BACKUP_BYTES = 4 * 1024 * 1024 * 1024 - 64 * 1024 * 1024; // ~3.94 GiB

/** Above this size the UI surfaces a "this is getting big" warning. */
export const BACKUP_SIZE_WARN_BYTES = 1024 * 1024 * 1024; // 1 GiB

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (n >= 1024 * 1024) return `${Math.round(n / (1024 * 1024))} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Throws a user-readable error when a planned backup exceeds the zip cap. */
export function assertWithinZipCap(totalBytes: number, what = 'Your card media'): void {
  if (totalBytes > MAX_BACKUP_BYTES) {
    throw new Error(
      `${what} adds up to ${formatBytes(totalBytes)}, which is more than a backup file can hold (${formatBytes(MAX_BACKUP_BYTES)}). Remove some large videos and try again.`
    );
  }
}

/** Yield a blob's bytes in bounded-size chunks. */
export async function* blobChunks(blob: Blob, chunkSize = CHUNK_SIZE): AsyncGenerator<Uint8Array> {
  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    yield new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer());
  }
}

/** Accumulates Uint8Array chunks, folding them into a Blob every flushBytes. */
class BlobAccumulator {
  private parts: (Blob | Uint8Array)[] = [];
  private buffered = 0;
  /** How many times chunks were folded into a Blob (exposed for tests). */
  flushes = 0;

  constructor(private flushBytes = FLUSH_BYTES) {}

  push(chunk: Uint8Array): void {
    if (!chunk.length) return;
    this.parts.push(chunk);
    this.buffered += chunk.length;
    if (this.buffered >= this.flushBytes) {
      // Fold everything so far into one Blob part: raw chunks leave the JS
      // heap and become browser-managed (possibly disk-backed) storage.
      this.parts = [new Blob(this.parts as BlobPart[])];
      this.buffered = 0;
      this.flushes++;
    }
  }

  toBlob(type?: string): Blob {
    return new Blob(this.parts as BlobPart[], type ? { type } : undefined);
  }
}

export interface ZipEntrySource {
  /** Path inside the zip, e.g. "media/0" or "manifest.json". */
  path: string;
  /** Entry contents. */
  blob: Blob;
}

export interface StreamOptions {
  chunkSize?: number;
  flushBytes?: number;
  /** Called between chunks; return a promise to pace work (UI yielding). */
  onChunk?: () => Promise<void> | void;
}

export interface UnzipLimits {
  /** Cumulative decompressed-byte cap across all entries (zip-bomb guard). */
  maxTotalBytes?: number;
  /** Maximum number of entries accepted. */
  maxEntries?: number;
}

/** Default entry-count cap — far beyond any real backup (manifest + media). */
export const MAX_UNZIP_ENTRIES = 4096;

/**
 * Build a zip from entry sources, streaming each entry's bytes in bounded
 * chunks and folding output into Blobs. Entries are stored (not deflated) —
 * card media is already-compressed jpg/mp4, so this is fast and light.
 */
export async function streamZip(
  manifestJson: string,
  entries: ZipEntrySource[],
  opts: StreamOptions = {},
): Promise<Blob> {
  const out = new BlobAccumulator(opts.flushBytes);
  let finish!: () => void;
  let fail!: (err: unknown) => void;
  const done = new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; });
  // Attach a no-op handler immediately: rejection can fire while chunk reads
  // are still awaiting, before the caller reaches `await done`, and an
  // unhandled-rejection crash would otherwise result.
  done.catch(() => {});
  const zip = new Zip((err, chunk, final) => {
    if (err) { fail(err); return; }
    out.push(chunk);
    if (final) finish();
  });

  try {
    const manifestFile = new ZipPassThrough('manifest.json');
    zip.add(manifestFile);
    manifestFile.push(strToU8(manifestJson), true);

    for (const entry of entries) {
      const file = new ZipPassThrough(entry.path);
      zip.add(file);
      for await (const chunk of blobChunks(entry.blob, opts.chunkSize)) {
        file.push(chunk);
        // Yield to the event loop between chunks so the UI stays responsive.
        await (opts.onChunk?.() ?? new Promise(r => setTimeout(r, 0)));
      }
      file.push(new Uint8Array(0), true);
    }
    zip.end();
  } catch (err) {
    fail(err);
  }

  await done;
  return out.toBlob('application/zip');
}

/**
 * Streaming unzip: feed the file in chunks; collect each entry as a Blob,
 * folding decompressed chunks off the JS heap as they arrive. Rejects on
 * corrupt or truncated archives, and enforces decompressed-size and
 * entry-count caps so a small "zip bomb" cannot expand into unbounded
 * storage during import.
 */
export async function unzipToBlobs(
  file: Blob,
  opts: StreamOptions & UnzipLimits = {},
): Promise<Record<string, Blob>> {
  const maxTotalBytes = opts.maxTotalBytes ?? MAX_BACKUP_BYTES;
  const maxEntries = opts.maxEntries ?? MAX_UNZIP_ENTRIES;
  const files: Record<string, Blob> = {};
  let totalBytes = 0;
  let entriesSeen = 0;
  let pendingEntries = 0;
  let inputDone = false;
  let failed: unknown = null;
  let finish!: () => void;
  let fail!: (err: unknown) => void;
  const done = new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; });
  // Attach a no-op handler immediately: rejection can fire while chunk reads
  // are still awaiting, before the caller reaches `await done`, and an
  // unhandled-rejection crash would otherwise result.
  done.catch(() => {});
  // Entry finals fire synchronously as bytes are pushed, so once the input is
  // fully fed any still-pending entry means the zip is truncated — reject
  // rather than hanging forever.
  const settle = () => {
    if (!inputDone || failed) return;
    if (entriesSeen === 0) { failed = new Error('Not a zip archive'); fail(failed); return; }
    if (pendingEntries === 0) finish();
    else { failed = new Error('Truncated zip'); fail(failed); }
  };

  const unzipper = new Unzip(entry => {
    if (failed) return;
    entriesSeen++;
    if (entriesSeen > maxEntries) {
      failed = new Error('Too many entries in archive');
      fail(failed);
      return;
    }
    pendingEntries++;
    const acc = new BlobAccumulator(opts.flushBytes);
    entry.ondata = (err, chunk, final) => {
      if (failed) return;
      if (err) { failed = err; fail(err); return; }
      if (chunk) {
        totalBytes += chunk.length;
        if (totalBytes > maxTotalBytes) {
          failed = new Error('Archive expands beyond the allowed size');
          fail(failed);
          return;
        }
        acc.push(chunk);
      }
      if (final) {
        files[entry.name] = acc.toBlob();
        pendingEntries--;
        settle();
      }
    };
    try {
      entry.start();
    } catch (err) {
      failed = err; fail(err);
    }
  });
  unzipper.register(UnzipInflate);

  try {
    for await (const chunk of blobChunks(file, opts.chunkSize)) {
      if (failed) break;
      unzipper.push(chunk, false);
      await (opts.onChunk?.() ?? new Promise(r => setTimeout(r, 0)));
    }
    unzipper.push(new Uint8Array(0), true);
  } catch (err) {
    failed = err; fail(err);
  }
  inputDone = true;
  settle();

  await done;
  return files;
}
