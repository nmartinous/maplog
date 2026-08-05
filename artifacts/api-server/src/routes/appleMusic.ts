import { Router } from "express";

const router = Router();

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AppleTrack {
  title: string;
  artist: string;
  album: string;
  artworkUrl: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Replace {w}/{h} template vars from Apple's artwork URL format */
function resolveArtwork(url: string | undefined, size = 300): string | null {
  if (!url || typeof url !== "string") return null;
  return url
    .replace("{w}", String(size))
    .replace("{h}", String(size))
    .replace("{f}", "jpg");
}

/**
 * Walk any parsed JSON blob and collect objects that look like Apple Music tracks:
 * they must have a non-empty `name` string + a non-empty `artistName` string.
 * Limits depth to avoid runaway recursion on deeply nested structures.
 */
function extractTracks(obj: unknown, depth = 0, seen = new WeakSet()): AppleTrack[] {
  if (depth > 25 || obj === null || typeof obj !== "object") return [];
  if (seen.has(obj as object)) return [];
  seen.add(obj as object);

  const tracks: AppleTrack[] = [];
  const o = obj as Record<string, unknown>;

  // Check if this node IS a track (attributes-wrapped or flat)
  const attrs = (o.attributes ?? o) as Record<string, unknown>;
  const name = attrs.name;
  const artistName = attrs.artistName;

  if (
    typeof name === "string" && name.length > 0 &&
    typeof artistName === "string" && artistName.length > 0
  ) {
    const artwork = attrs.artwork as Record<string, unknown> | undefined;
    tracks.push({
      title: name,
      artist: artistName,
      album: typeof attrs.albumName === "string" ? attrs.albumName : "",
      artworkUrl: resolveArtwork(artwork?.url as string | undefined),
    });
    // Don't recurse further into a track node
    return tracks;
  }

  // Recurse into arrays and plain-object values
  if (Array.isArray(obj)) {
    for (const item of obj) {
      for (const t of extractTracks(item, depth + 1, seen)) tracks.push(t);
    }
  } else {
    for (const val of Object.values(o)) {
      for (const t of extractTracks(val, depth + 1, seen)) tracks.push(t);
    }
  }

  return tracks;
}

function deduplicateTracks(tracks: AppleTrack[]): AppleTrack[] {
  const seen = new Set<string>();
  return tracks.filter((t) => {
    const key = `${t.artist.toLowerCase()}::${t.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Pull the playlist/album display name from the page <title> or og:title */
function extractPageTitle(html: string): string {
  const og = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
  if (og?.[1]) return og[1];
  const title = html.match(/<title>([^<]+)<\/title>/i);
  if (title?.[1]) {
    return title[1]
      .replace(/\s*[|–-]\s*Apple Music\s*$/i, "")
      .trim();
  }
  return "Apple Music Playlist";
}

// ── Route ──────────────────────────────────────────────────────────────────────

/**
 * GET /api/apple-music/playlist?url=<encoded Apple Music playlist URL>
 *
 * Fetches a public Apple Music playlist page server-side (bypassing CORS),
 * parses the embedded JSON to extract the track list, and returns:
 *   { name: string, tracks: AppleTrack[] }
 *
 * No Apple developer token required — only works for publicly shared playlists.
 */
router.get("/apple-music/playlist", async (req, res) => {
  const url = String(req.query.url ?? "").trim();

  if (!url || !url.includes("music.apple.com")) {
    return void res
      .status(400)
      .json({ error: "Provide a valid music.apple.com playlist URL." });
  }

  let html: string;
  try {
    const response = await fetch(url, {
      headers: {
        // Realistic browser headers so Apple serves the full SSR HTML
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/124.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
    });
    if (!response.ok) {
      return void res
        .status(502)
        .json({ error: `Apple Music returned HTTP ${response.status}.` });
    }
    html = await response.text();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return void res.status(502).json({ error: `Fetch failed: ${msg}` });
  }

  // ── Extract the embedded JSON ──────────────────────────────────────────────

  let allTracks: AppleTrack[] = [];

  // Strategy 1 — the main SSR data blob Apple embeds in every page
  const serverDataMatch = html.match(
    /<script[^>]+id="serialized-server-data"[^>]*>([\s\S]*?)<\/script>/i
  );
  if (serverDataMatch?.[1]) {
    try {
      const parsed = JSON.parse(serverDataMatch[1]);
      allTracks = extractTracks(parsed);
    } catch {
      /* JSON parse failed — fall through */
    }
  }

  // Strategy 2 — any other application/json script blocks
  if (!allTracks.length) {
    const jsonBlocks = html.matchAll(
      /<script[^>]+type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi
    );
    for (const block of jsonBlocks) {
      try {
        const parsed = JSON.parse(block[1]);
        const found = extractTracks(parsed);
        if (found.length > allTracks.length) allTracks = found;
      } catch {
        /* skip malformed blocks */
      }
    }
  }

  const tracks = deduplicateTracks(allTracks);

  if (!tracks.length) {
    return void res.status(422).json({
      error:
        "No tracks found. Make sure the playlist is public and the URL is " +
        "a direct music.apple.com playlist link (not a short link).",
    });
  }

  const name = extractPageTitle(html);
  res.json({ name, tracks });
});

export default router;
