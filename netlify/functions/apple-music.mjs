/**
 * Netlify Function: handles all /api/apple-music/* routes.
 *
 * Generates Apple MusicKit developer tokens via Web Crypto (no external deps)
 * and proxies catalog lookups to the Apple Music API.
 *
 * Required env vars (set in Netlify → Site settings → Environment variables):
 *   APPLE_TEAM_ID
 *   APPLE_MUSICKIT_KEY_ID
 *   APPLE_MUSICKIT_PRIVATE_KEY   (full .p8 contents, \n ok)
 */

const APPLE_API = 'https://api.music.apple.com/v1';
const STOREFRONT = 'us';

// In-memory cache (survives warm invocations; cold starts regenerate the token)
let cachedToken = null;

// ── Key helpers ───────────────────────────────────────────────────────────────

function normalizePem(raw) {
  const body = raw
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  return (
    '-----BEGIN PRIVATE KEY-----\n' +
    (body.match(/.{1,64}/g) ?? []).join('\n') +
    '\n-----END PRIVATE KEY-----'
  );
}

async function getDeveloperToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.exp > now + 60_000) return cachedToken.token;

  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_MUSICKIT_KEY_ID;
  const rawKey = process.env.APPLE_MUSICKIT_PRIVATE_KEY;

  if (!teamId || !keyId || !rawKey) {
    throw new Error(
      'Apple MusicKit credentials not configured. Set APPLE_TEAM_ID, APPLE_MUSICKIT_KEY_ID, and APPLE_MUSICKIT_PRIVATE_KEY in Netlify environment variables.',
    );
  }

  const pem = normalizePem(rawKey);
  const pemBody = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');

  const der = Buffer.from(pemBody, 'base64');

  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const iat = Math.floor(now / 1000);
  const exp = iat + 60 * 60 * 24 * 30; // 30 days

  const b64url = (s) => Buffer.from(s).toString('base64url');
  const b64urlBuf = (b) => Buffer.from(b).toString('base64url');

  const header = { alg: 'ES256', typ: 'JWT', kid: keyId };
  const payload = { iss: teamId, iat, exp };

  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(payload));
  const sigInput = `${headerB64}.${payloadB64}`;

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(sigInput),
  );

  const token = `${sigInput}.${b64urlBuf(sig)}`;
  cachedToken = { token, exp: exp * 1000 };
  return token;
}

async function appleFetch(path) {
  const token = await getDeveloperToken();
  return fetch(`${APPLE_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveArtwork(url, size = 300) {
  if (!url || typeof url !== 'string') return null;
  return url
    .replace('{w}', String(size))
    .replace('{h}', String(size))
    .replace('{f}', 'jpg');
}

function mapSong(s) {
  const a = s?.attributes ?? {};
  const albumId = s?.relationships?.albums?.data?.[0]?.id ?? null;
  return {
    id: String(s.id),
    title: a.name ?? 'Unknown',
    artist: a.artistName ?? 'Unknown Artist',
    album: a.albumName ?? '',
    genre: Array.isArray(a.genreNames) ? (a.genreNames[0] ?? null) : null,
    durationMs: a.durationInMillis ?? 0,
    artworkUrl: resolveArtwork(a.artwork?.url, 1000) ?? '',
    previewUrl: a.previews?.[0]?.url ?? null,
    releaseDate: a.releaseDate ?? null,
    trackNumber: a.trackNumber ?? null,
    discNumber: a.discNumber ?? null,
    albumId: albumId !== null ? String(albumId) : null,
  };
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

// ── Router ────────────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const url = new URL(req.url);
  const path = url.pathname;
  const params = url.searchParams;

  try {
    // ── GET /api/apple-music/token ─────────────────────────────────────────
    if (path.endsWith('/token')) {
      const token = await getDeveloperToken();
      return jsonRes({ token });
    }

    // ── GET /api/apple-music/search?q=...&limit=25 ─────────────────────────
    if (path.endsWith('/search')) {
      const q = (params.get('q') ?? '').trim();
      const limit = Math.min(Number(params.get('limit') ?? '25'), 25);
      if (!q) return jsonRes({ data: [] });

      const res = await appleFetch(
        `/catalog/${STOREFRONT}/search?types=songs&limit=${limit}&term=${encodeURIComponent(q)}`,
      );
      if (!res.ok) return jsonRes({ error: `Apple Music API returned HTTP ${res.status}.` }, 502);

      const json = await res.json();
      const songs = (json?.results?.songs?.data ?? []).map((s) => {
        const a = s.attributes ?? {};
        return {
          id: String(s.id),
          title: a.name ?? 'Unknown',
          artist: a.artistName ?? 'Unknown Artist',
          album: a.albumName ?? '',
          genre: Array.isArray(a.genreNames) ? (a.genreNames[0] ?? null) : null,
          durationMs: a.durationInMillis ?? 0,
          artworkUrl: resolveArtwork(a.artwork?.url, 1000) ?? '',
          previewUrl: a.previews?.[0]?.url ?? null,
          releaseDate: a.releaseDate ?? null,
        };
      });
      return jsonRes({ data: songs });
    }

    // ── GET /api/apple-music/song/:id ──────────────────────────────────────
    const songMatch = path.match(/\/apple-music\/song\/([0-9]+)$/);
    if (songMatch) {
      const id = songMatch[1];
      const res = await appleFetch(`/catalog/${STOREFRONT}/songs/${id}`);
      if (!res.ok) {
        return jsonRes(
          { error: `Apple Music API returned HTTP ${res.status}.` },
          res.status === 404 ? 404 : 502,
        );
      }
      const json = await res.json();
      const a = json?.data?.[0]?.attributes ?? {};
      return jsonRes({
        album: { title: a.albumName ?? '' },
        release_date: a.releaseDate ?? null,
        duration: Math.round((a.durationInMillis ?? 0) / 1000),
        bpm: null,
        genre: Array.isArray(a.genreNames) ? (a.genreNames[0] ?? null) : null,
      });
    }

    // ── GET /api/apple-music/artist?name=... ───────────────────────────────
    if (path.endsWith('/artist')) {
      const name = (params.get('name') ?? '').trim();
      if (!name) return jsonRes({ error: 'Missing artist name.' }, 400);

      const res = await appleFetch(
        `/catalog/${STOREFRONT}/search?types=artists&limit=5&term=${encodeURIComponent(name)}`,
      );
      if (!res.ok) return jsonRes({ error: `Apple Music API returned HTTP ${res.status}.` }, 502);

      const json = await res.json();
      const artists = json?.results?.artists?.data ?? [];
      const lower = name.toLowerCase();
      const hit =
        artists.find(
          (ar) => String(ar?.attributes?.name ?? '').toLowerCase() === lower,
        ) ?? artists[0];
      if (!hit) return jsonRes({ error: 'Artist not found.' }, 404);

      const a = hit.attributes ?? {};
      return jsonRes({
        id: String(hit.id),
        name: a.name ?? name,
        imageUrl: resolveArtwork(a.artwork?.url, 600),
        genres: Array.isArray(a.genreNames) ? a.genreNames : [],
        url: a.url ?? null,
      });
    }

    // ── GET /api/apple-music/album-tracks?album=...&artist=... ────────────
    if (path.endsWith('/album-tracks')) {
      const albumName = (params.get('album') ?? '').trim();
      const artistName = (params.get('artist') ?? '').trim();
      if (!albumName) return jsonRes({ error: 'Missing album name.' }, 400);

      const term = artistName ? `${albumName} ${artistName}` : albumName;
      const searchRes = await appleFetch(
        `/catalog/${STOREFRONT}/search?types=albums&limit=10&term=${encodeURIComponent(term)}`,
      );
      if (!searchRes.ok) {
        return jsonRes({ error: `Apple Music API returned HTTP ${searchRes.status}.` }, 502);
      }

      const searchJson = await searchRes.json();
      const albums = searchJson?.results?.albums?.data ?? [];
      const lowerAlbum = albumName.toLowerCase();
      const lowerArtist = artistName.toLowerCase();

      const hit =
        albums.find((a) => {
          const attr = a?.attributes ?? {};
          return (
            String(attr.name ?? '').toLowerCase() === lowerAlbum &&
            (!lowerArtist ||
              String(attr.artistName ?? '').toLowerCase().includes(lowerArtist))
          );
        }) ??
        albums.find((a) => String(a?.attributes?.name ?? '').toLowerCase() === lowerAlbum) ??
        albums[0];

      if (!hit) return jsonRes({ error: 'Album not found in Apple Music catalog.' }, 404);

      const albumId = String(hit.id);
      const albumRes = await appleFetch(
        `/catalog/${STOREFRONT}/albums/${albumId}?include=tracks&limit=300`,
      );
      if (!albumRes.ok) {
        return jsonRes({ error: `Apple Music API returned HTTP ${albumRes.status}.` }, 502);
      }

      const albumJson = await albumRes.json();
      const albumData = albumJson?.data?.[0] ?? {};
      const attr = albumData?.attributes ?? {};
      const tracks = albumData?.relationships?.tracks?.data ?? [];
      const trackCount = attr.trackCount ?? tracks.length;
      const releaseType =
        trackCount === 1 ? 'single' : trackCount <= 6 ? 'ep' : 'album';

      return jsonRes({
        albumId,
        name: attr.name ?? albumName,
        artistName: attr.artistName ?? artistName,
        artworkUrl: resolveArtwork(attr.artwork?.url, 600),
        releaseDate: attr.releaseDate ?? null,
        releaseType,
        trackCount,
        tracks: tracks
          .map((t, idx) => {
            const ta = t?.attributes ?? {};
            return {
              trackNumber: ta.trackNumber ?? idx + 1,
              discNumber: ta.discNumber ?? 1,
              catalogId: String(t.id),
              title: ta.name ?? 'Unknown',
              durationMs: ta.durationInMillis ?? 0,
              artworkUrl: resolveArtwork(ta.artwork?.url, 300),
            };
          })
          .sort(
            (a, b) =>
              (a.discNumber - b.discNumber) || (a.trackNumber - b.trackNumber),
          ),
      });
    }

    // ── GET /api/apple-music/playlist?url=... ─────────────────────────────
    if (path.endsWith('/playlist')) {
      const urlParam = (params.get('url') ?? '').trim();

      let playlistId = null;
      try {
        const parsed = new URL(urlParam);
        if (
          parsed.protocol === 'https:' &&
          parsed.hostname === 'music.apple.com' &&
          !parsed.username &&
          !parsed.password
        ) {
          const match = parsed.pathname.match(/(pl\.u-[A-Za-z0-9]+|pl\.[A-Za-z0-9-]+)/);
          playlistId = match?.[1] ?? null;
        }
      } catch {
        /* invalid URL */
      }

      if (!playlistId) {
        return jsonRes(
          {
            error:
              "Provide a valid music.apple.com playlist link (it should contain a 'pl.…' id).",
          },
          400,
        );
      }

      const metaRes = await appleFetch(`/catalog/${STOREFRONT}/playlists/${playlistId}`);
      if (metaRes.status === 404) {
        return jsonRes(
          { error: "Playlist not found. Make sure it's public and shared from Apple Music." },
          404,
        );
      }
      if (!metaRes.ok) {
        return jsonRes({ error: `Apple Music API returned HTTP ${metaRes.status}.` }, 502);
      }

      const meta = await metaRes.json();
      const name = meta?.data?.[0]?.attributes?.name ?? 'Apple Music Playlist';

      const songs = [];
      let offset = 0;
      for (let page = 0; page < 10; page++) {
        const trackRes = await appleFetch(
          `/catalog/${STOREFRONT}/playlists/${playlistId}/tracks?limit=100&offset=${offset}&include=albums`,
        );
        if (!trackRes.ok) break;
        const json = await trackRes.json();
        const batch = (json?.data ?? []).filter((t) => t?.type === 'songs');
        songs.push(...batch.map(mapSong));
        if (!json?.next || (json?.data ?? []).length === 0) break;
        offset += 100;
      }

      if (!songs.length) {
        return jsonRes({ error: 'No songs found in this playlist.' }, 422);
      }
      return jsonRes({ name, songs });
    }

    return jsonRes({ error: 'Not found.' }, 404);
  } catch (err) {
    return jsonRes({ error: err?.message ?? 'Internal server error.' }, 500);
  }
}

export const config = {
  path: '/api/apple-music/*',
};
