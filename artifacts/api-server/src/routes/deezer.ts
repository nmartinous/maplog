import { Router } from "express";

const router = Router();
const DEEZER_BASE = "https://api.deezer.com";

/** Proxy: GET /api/deezer/search?q=... */
router.get("/deezer/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const limit = Math.min(Number(req.query.limit ?? 25), 50);
  if (!q) return void res.json({ data: [] });

  try {
    const url = `${DEEZER_BASE}/search?q=${encodeURIComponent(q)}&limit=${limit}`;
    const upstream = await fetch(url);
    const data = await upstream.json();
    res.json(data);
  } catch {
    res.status(502).json({ error: "Deezer search unavailable" });
  }
});

/** Proxy: GET /api/deezer/track/:id */
router.get("/deezer/track/:id", async (req, res) => {
  try {
    const upstream = await fetch(`${DEEZER_BASE}/track/${req.params.id}`);
    const data = await upstream.json();
    res.json(data);
  } catch {
    res.status(502).json({ error: "Deezer track unavailable" });
  }
});

export default router;
