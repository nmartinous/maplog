import { Router } from "express";
import jwt from "jsonwebtoken";

const router = Router();

// ── Developer token (ES256 JWT signed with the MusicKit .p8 key) ──────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

function getDeveloperToken(): string {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - now > 60 * 60 * 1000) {
    return cachedToken.token;
  }

  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_MUSICKIT_KEY_ID;
  let privateKey = process.env.APPLE_MUSICKIT_PRIVATE_KEY;

  if (!teamId || !keyId || !privateKey) {
    throw new Error(
      "Apple MusicKit credentials are not configured (APPLE_TEAM_ID, APPLE_MUSICKIT_KEY_ID, APPLE_MUSICKIT_PRIVATE_KEY)."
    );
  }

  // Secrets pasted through UIs often lose newlines or contain literal \n
  // sequences. Rebuild a canonical PEM from the base64 body.
  privateKey = privateKey.replace(/\\n/g, "\n").trim();
  const body = privateKey
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  privateKey =
    "-----BEGIN PRIVATE KEY-----\n" +
    (body.match(/.{1,64}/g) ?? []).join("\n") +
    "\n-----END PRIVATE KEY-----\n";

  const expiresInSeconds = 60 * 60 * 24 * 30; // 30 days (Apple max is 6 months)
  const token = jwt.sign({}, privateKey, {
    algorithm: "ES256",
    issuer: teamId,
    expiresIn: expiresInSeconds,
    keyid: keyId,
  });

  cachedToken = { token, expiresAt: now + expiresInSeconds * 1000 };
  return token;
}

/**
 * GET /api/apple-music/token
 * Returns the signed developer token for MusicKit JS configuration.
 */
router.get("/apple-music/token", (_req, res) => {
  try {
    res.json({ token: getDeveloperToken() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── Apple Music catalog proxy (server-side, uses the developer token) ─────────

const APPLE_API = "https://api.music.apple.com/v1";
const STOREFRONT = "us";

async function appleFetch(path: string): Promise<Response> {
  return fetch(`${APPLE_API}${path}`, {
    headers: { Authorization: `Bearer ${getDeveloperToken()}` },
  });
}

/**
 * GET /api/apple-music/search?q=...&limit=25
 * Searches the Apple Music catalog for songs. Returns { data: Song[] } where
 * each song is normalized for the frontend.
 */
router.get("/apple-music/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const limit = Math.min(Number(req.query.limit) || 25, 25);
  if (!q) return void res.json({ data: [] });

  try {
    const response = await appleFetch(
      `/catalog/${STOREFRONT}/search?types=songs&limit=${limit}&term=${encodeURIComponent(q)}`
    );
    if (!response.ok) {
      return void res
        .status(502)
        .json({ error: `Apple Music API returned HTTP ${response.status}.` });
    }
    const json = (await response.json()) as any;
    const songs = (json?.results?.songs?.data ?? []).map((s: any) => {
      const a = s.attributes ?? {};
      return {
        id: String(s.id),
        title: a.name ?? "Unknown",
        artist: a.artistName ?? "Unknown Artist",
        album: a.albumName ?? "",
        genre: Array.isArray(a.genreNames) ? a.genreNames[0] ?? null : null,
        durationMs: a.durationInMillis ?? 0,
        artworkUrl: resolveArtwork(a.artwork?.url, 1000) ?? "",
        previewUrl: a.previews?.[0]?.url ?? null,
        releaseDate: a.releaseDate ?? null,
      };
    });
    res.json({ data: songs });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});

/**
 * GET /api/apple-music/song/:id
 * Fetches catalog details for one song (used by the card-back info panel).
 */
router.get("/apple-music/song/:id", async (req, res) => {
  const id = String(req.params.id).replace(/[^0-9]/g, "");
  if (!id) return void res.status(400).json({ error: "Invalid song id." });

  try {
    const response = await appleFetch(`/catalog/${STOREFRONT}/songs/${id}`);
    if (!response.ok) {
      return void res
        .status(response.status === 404 ? 404 : 502)
        .json({ error: `Apple Music API returned HTTP ${response.status}.` });
    }
    const json = (await response.json()) as any;
    const a = json?.data?.[0]?.attributes ?? {};
    res.json({
      album: { title: a.albumName ?? "" },
      release_date: a.releaseDate ?? null,
      duration: Math.round((a.durationInMillis ?? 0) / 1000),
      bpm: null,
      genre: Array.isArray(a.genreNames) ? a.genreNames[0] ?? null : null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});

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
