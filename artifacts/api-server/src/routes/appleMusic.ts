import { Router } from "express";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";

const router = Router();

// ── Developer token (ES256 JWT signed with the MusicKit .p8 key) ──────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Normalize a MusicKit .p8 private key that may have been mangled when pasted
 * (lost newlines, literal \n sequences, or lookalike-character corruption in
 * the non-essential DER fields). Strategy:
 *   1. Rebuild a canonical PEM from the base64 body and try to parse it.
 *   2. If parsing fails, extract the raw P-256 private scalar from the DER
 *      (the 32 bytes following the `04 20` octet-string header), derive the
 *      public key from it, and rebuild a clean PKCS#8 key via JWK. This
 *      recovers keys whose curve-OID or embedded-public-key bytes were
 *      corrupted, as long as the scalar itself survived.
 */
function normalizePrivateKey(raw: string): string {
  const body = raw
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");

  const pem =
    "-----BEGIN PRIVATE KEY-----\n" +
    (body.match(/.{1,64}/g) ?? []).join("\n") +
    "\n-----END PRIVATE KEY-----\n";

  try {
    crypto.createPrivateKey(pem);
    return pem;
  } catch {
    // Fall through to scalar-based recovery
  }

  const der = Buffer.from(body, "base64");
  const hex = der.toString("hex");
  // PKCS#8-wrapped SEC1 EC key: scalar is the 32 bytes after `020101 0420`
  const marker = "0201010420";
  const idx = hex.indexOf(marker);
  if (idx === -1) {
    throw new Error(
      "APPLE_MUSICKIT_PRIVATE_KEY could not be parsed. Re-paste the .p8 file contents exactly."
    );
  }
  const scalarHex = hex.slice(idx + marker.length, idx + marker.length + 64);
  const scalar = Buffer.from(scalarHex, "hex");
  if (scalar.length !== 32) {
    throw new Error("APPLE_MUSICKIT_PRIVATE_KEY is truncated. Re-paste the .p8 file contents.");
  }

  const ecdh = crypto.createECDH("prime256v1");
  ecdh.setPrivateKey(scalar);
  const pub = ecdh.getPublicKey();
  const b64u = (b: Buffer) => b.toString("base64url");
  const keyObj = crypto.createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      d: b64u(scalar),
      x: b64u(pub.subarray(1, 33)),
      y: b64u(pub.subarray(33, 65)),
    },
    format: "jwk",
  });
  return keyObj.export({ format: "pem", type: "pkcs8" }).toString();
}

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

  privateKey = normalizePrivateKey(privateKey);

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

/**
 * GET /api/apple-music/artist?name=...
 * Searches the Apple Music catalog for an artist and returns display info.
 * Apple's public catalog API exposes name, artwork, genres, and the artist
 * URL — it does NOT expose listener counts, follower stats, or bios, so the
 * client should present those as unavailable.
 */
router.get("/apple-music/artist", async (req, res) => {
  const name = String(req.query.name ?? "").trim();
  if (!name) return void res.status(400).json({ error: "Missing artist name." });

  try {
    const response = await appleFetch(
      `/catalog/${STOREFRONT}/search?types=artists&limit=5&term=${encodeURIComponent(name)}`
    );
    if (!response.ok) {
      return void res
        .status(502)
        .json({ error: `Apple Music API returned HTTP ${response.status}.` });
    }
    const json = (await response.json()) as any;
    const artists = (json?.results?.artists?.data ?? []) as any[];
    // Prefer an exact (case-insensitive) name match over Apple's first hit
    const lower = name.toLowerCase();
    const hit =
      artists.find((ar) => String(ar?.attributes?.name ?? "").toLowerCase() === lower) ??
      artists[0];
    if (!hit) return void res.status(404).json({ error: "Artist not found." });

    const a = hit.attributes ?? {};
    res.json({
      id: String(hit.id),
      name: a.name ?? name,
      imageUrl: resolveArtwork(a.artwork?.url, 600),
      genres: Array.isArray(a.genreNames) ? a.genreNames : [],
      url: a.url ?? null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});

/**
 * GET /api/apple-music/album-tracks?album=...&artist=...
 * Searches the Apple Music catalog for the album and returns its full track
 * listing (track number, title, duration, catalog id). The release type
 * (album / ep / single) is inferred from track count.
 */
router.get("/apple-music/album-tracks", async (req, res) => {
  const albumName = String(req.query.album ?? "").trim();
  const artistName = String(req.query.artist ?? "").trim();
  if (!albumName) return void res.status(400).json({ error: "Missing album name." });

  try {
    // Search for albums matching name + artist
    const term = artistName ? `${albumName} ${artistName}` : albumName;
    const searchRes = await appleFetch(
      `/catalog/${STOREFRONT}/search?types=albums&limit=10&term=${encodeURIComponent(term)}`
    );
    if (!searchRes.ok) {
      return void res.status(502).json({ error: `Apple Music API returned HTTP ${searchRes.status}.` });
    }
    const searchJson = (await searchRes.json()) as any;
    const albums: any[] = searchJson?.results?.albums?.data ?? [];

    // Prefer exact album name match (case-insensitive) from the right artist
    const lowerAlbum = albumName.toLowerCase();
    const lowerArtist = artistName.toLowerCase();
    let hit =
      albums.find(a => {
        const attr = a?.attributes ?? {};
        return String(attr.name ?? "").toLowerCase() === lowerAlbum &&
               (!lowerArtist || String(attr.artistName ?? "").toLowerCase().includes(lowerArtist));
      }) ??
      albums.find(a => String(a?.attributes?.name ?? "").toLowerCase() === lowerAlbum) ??
      albums[0];

    if (!hit) return void res.status(404).json({ error: "Album not found in Apple Music catalog." });

    const albumId = String(hit.id);

    // Fetch full album with all tracks
    const albumRes = await appleFetch(
      `/catalog/${STOREFRONT}/albums/${albumId}?include=tracks&limit=300`
    );
    if (!albumRes.ok) {
      return void res.status(502).json({ error: `Apple Music API returned HTTP ${albumRes.status}.` });
    }
    const albumJson = (await albumRes.json()) as any;
    const albumData = albumJson?.data?.[0] ?? {};
    const attr = albumData?.attributes ?? {};
    const tracks: any[] = albumData?.relationships?.tracks?.data ?? [];

    const trackCount = attr.trackCount ?? tracks.length;
    const releaseType: "album" | "ep" | "single" =
      trackCount === 1 ? "single" : trackCount <= 6 ? "ep" : "album";

    res.json({
      albumId,
      name: attr.name ?? albumName,
      artistName: attr.artistName ?? artistName,
      artworkUrl: resolveArtwork(attr.artwork?.url, 600),
      releaseDate: attr.releaseDate ?? null,
      releaseType,
      trackCount,
      tracks: tracks.map((t: any, idx: number) => {
        const ta = t?.attributes ?? {};
        return {
          trackNumber: ta.trackNumber ?? idx + 1,
          discNumber: ta.discNumber ?? 1,
          catalogId: String(t.id),
          title: ta.name ?? "Unknown",
          durationMs: ta.durationInMillis ?? 0,
          artworkUrl: resolveArtwork(ta.artwork?.url, 300),
        };
      }).sort((a: any, b: any) => (a.discNumber - b.discNumber) || (a.trackNumber - b.trackNumber)),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Replace {w}/{h} template vars from Apple's artwork URL format */
function resolveArtwork(url: string | undefined, size = 300): string | null {
  if (!url || typeof url !== "string") return null;
  return url
    .replace("{w}", String(size))
    .replace("{h}", String(size))
    .replace("{f}", "jpg");
}

function mapSong(s: any) {
  const a = s?.attributes ?? {};
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
}

// ── Playlist import ────────────────────────────────────────────────────────────

/**
 * GET /api/apple-music/playlist?url=<Apple Music playlist URL>
 *
 * Resolves a music.apple.com playlist link through the official Apple Music
 * API (paginating through all tracks) and returns:
 *   { name: string, songs: NormalizedSong[] }
 *
 * Works for any public/catalog playlist (pl.xxx) and shared user playlists
 * (pl.u-xxx).
 */
router.get("/apple-music/playlist", async (req, res) => {
  const url = String(req.query.url ?? "").trim();

  // Strict validation: https, exact host, no credentials (SSRF-safe), and a
  // playlist id we can hand to the Apple API.
  let playlistId: string | null = null;
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === "https:" &&
      parsed.hostname === "music.apple.com" &&
      parsed.username === "" &&
      parsed.password === ""
    ) {
      const match = parsed.pathname.match(/(pl\.u-[A-Za-z0-9]+|pl\.[A-Za-z0-9-]+)/);
      playlistId = match?.[1] ?? null;
    }
  } catch {
    /* handled below */
  }
  if (!playlistId) {
    return void res.status(400).json({
      error:
        "Provide a valid music.apple.com playlist link (it should contain a 'pl.…' id).",
    });
  }

  try {
    const metaRes = await appleFetch(`/catalog/${STOREFRONT}/playlists/${playlistId}`);
    if (metaRes.status === 404) {
      return void res.status(404).json({
        error: "Playlist not found. Make sure it's public and shared from Apple Music.",
      });
    }
    if (!metaRes.ok) {
      return void res
        .status(502)
        .json({ error: `Apple Music API returned HTTP ${metaRes.status}.` });
    }
    const meta = (await metaRes.json()) as any;
    const name = meta?.data?.[0]?.attributes?.name ?? "Apple Music Playlist";

    // Paginate through all tracks (100 per page, capped at 1000 for safety)
    const songs: any[] = [];
    let offset = 0;
    for (let page = 0; page < 10; page++) {
      const trackRes = await appleFetch(
        `/catalog/${STOREFRONT}/playlists/${playlistId}/tracks?limit=100&offset=${offset}`
      );
      if (!trackRes.ok) break;
      const json = (await trackRes.json()) as any;
      const batch = (json?.data ?? []).filter((t: any) => t?.type === "songs");
      songs.push(...batch.map(mapSong));
      if (!json?.next || (json?.data ?? []).length === 0) break;
      offset += 100;
    }

    if (!songs.length) {
      return void res.status(422).json({
        error: "No songs found in this playlist.",
      });
    }

    res.json({ name, songs });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});

export default router;
