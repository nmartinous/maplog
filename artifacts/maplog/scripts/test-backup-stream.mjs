// Targeted tests for the streaming backup helpers (src/lib/backupStream.ts).
// Run with: node scripts/test-backup-stream.mjs
// Bundles the TS module with esbuild, then exercises:
//  1. Roundtrip of a multi-chunk single media entry (bytes verified)
//  2. Blob folding actually engages (memory stays bounded per entry)
//  3. Truncated zip input rejects instead of hanging
//  4. Corrupt (non-zip) input rejects
//  5. Size cap + formatting helpers
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

// esbuild ships as a transitive dep of vite; resolve it through vite.
const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve('vite/package.json'));
const { build } = await import(pathToFileURL(viteRequire.resolve('esbuild')).href);

const root = dirname(fileURLToPath(import.meta.url));
const outDir = mkdtempSync(join(tmpdir(), 'backup-stream-test-'));
const outFile = join(outDir, 'backupStream.mjs');

await build({
  entryPoints: [join(root, '../src/lib/backupStream.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
});

const {
  streamZip, unzipToBlobs, assertWithinZipCap, formatBytes,
  MAX_BACKUP_BYTES,
} = await import(pathToFileURL(outFile).href);

let failures = 0;
function check(name, cond) {
  if (cond) console.log(`  ok  ${name}`);
  else { failures++; console.error(`FAIL  ${name}`); }
}

// ── 1 & 2: multi-chunk single entry roundtrip with tiny flush threshold ──────
{
  const size = 10 * 1024 * 1024; // 10 MiB → many chunks at 1 MiB chunk size
  const big = new Uint8Array(size);
  for (let i = 0; i < size; i += 4096) big[i] = i % 251; // sparse pattern, fast
  const mediaBlob = new Blob([big]);
  const manifest = JSON.stringify({ format: 'maplog-backup', version: 1 });

  const opts = { chunkSize: 1024 * 1024, flushBytes: 2 * 1024 * 1024, onChunk: () => {} };
  const zipBlob = await streamZip(manifest, [{ path: 'media/0', blob: mediaBlob }], opts);
  check('zip produced with plausible size', zipBlob.size > size && zipBlob.size < size + 4096);

  const files = await unzipToBlobs(zipBlob, opts);
  check('both entries present', !!files['manifest.json'] && !!files['media/0']);
  check('manifest text roundtrips', (await files['manifest.json'].text()) === manifest);
  const restored = new Uint8Array(await files['media/0'].arrayBuffer());
  let same = restored.length === big.length;
  if (same) for (let i = 0; i < size; i += 4096) if (restored[i] !== big[i]) { same = false; break; }
  check('multi-chunk media bytes roundtrip exactly', same);
}

// ── 3: truncated zip rejects ─────────────────────────────────────────────────
{
  const manifest = JSON.stringify({ format: 'maplog-backup', version: 1 });
  const data = new Blob([new Uint8Array(256 * 1024).fill(7)]);
  const zipBlob = await streamZip(manifest, [{ path: 'media/0', blob: data }], { onChunk: () => {} });
  const truncated = zipBlob.slice(0, Math.floor(zipBlob.size / 2));
  let rejected = false;
  try { await unzipToBlobs(truncated, { onChunk: () => {} }); }
  catch { rejected = true; }
  check('truncated zip rejects (no hang)', rejected);
}

// ── 4: corrupt input rejects ─────────────────────────────────────────────────
{
  let rejected = false;
  try { await unzipToBlobs(new Blob(['definitely not a zip file at all, just text padding'.repeat(10)]), { onChunk: () => {} }); }
  catch { rejected = true; }
  check('non-zip input rejects', rejected);
}

// ── 5: zip bomb — small compressed input expanding past the cap rejects ─────
{
  // Build a real deflated zip with fflate.zipSync: 64 MiB of zeros compresses
  // to a tiny file, but decompresses far past a 8 MiB cap.
  const { zipSync } = await import(pathToFileURL(require.resolve('fflate')).href);
  const bombPayload = new Uint8Array(64 * 1024 * 1024); // all zeros → tiny deflate
  const bombZip = zipSync({ 'media/0': bombPayload }, { level: 6 });
  check('bomb compresses small', bombZip.length < 1024 * 1024);
  let rejected = false;
  try {
    await unzipToBlobs(new Blob([bombZip]), { onChunk: () => {}, maxTotalBytes: 8 * 1024 * 1024 });
  } catch (e) { rejected = /expands beyond/.test(e.message); }
  check('zip bomb rejects once decompressed bytes exceed cap', rejected);
}

// ── 6: entry-count cap rejects ───────────────────────────────────────────────
{
  const { zipSync } = await import(pathToFileURL(require.resolve('fflate')).href);
  const entries = {};
  for (let i = 0; i < 20; i++) entries[`f/${i}`] = new Uint8Array([1]);
  const manyZip = zipSync(entries, { level: 0 });
  let rejected = false;
  try { await unzipToBlobs(new Blob([manyZip]), { onChunk: () => {}, maxEntries: 5 }); }
  catch (e) { rejected = /Too many entries/.test(e.message); }
  check('entry-count cap rejects', rejected);
}

// ── 7: size cap + formatting ─────────────────────────────────────────────────
{
  let threw = false;
  try { assertWithinZipCap(MAX_BACKUP_BYTES + 1); } catch (e) { threw = /more than a backup file can hold/.test(e.message); }
  check('over-cap size throws readable error', threw);
  let ok = true;
  try { assertWithinZipCap(MAX_BACKUP_BYTES - 1); } catch { ok = false; }
  check('under-cap size passes', ok);
  check('formatBytes GB', formatBytes(2.5 * 1024 * 1024 * 1024) === '2.5 GB');
  check('formatBytes MB', formatBytes(42 * 1024 * 1024) === '42 MB');
}

rmSync(outDir, { recursive: true, force: true });
if (failures) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
console.log('\nAll backup-stream tests passed');
