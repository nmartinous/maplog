import { Router, type IRouter } from "express";
import { eq, sql, desc, and, inArray } from "drizzle-orm";
import { db, playlistsTable, playlistSongsTable, songsTable, collectedCardsTable } from "@workspace/db";
import {
  CreatePlaylistBody,
  UpdatePlaylistBody,
  UpdatePlaylistParams,
  DeletePlaylistParams,
  GetPlaylistParams,
  AddSongToPlaylistParams,
  AddSongToPlaylistBody,
  RemoveSongFromPlaylistParams,
  ListPlaylistsResponse,
  ListPlaylistsResponseItem,
  GetPlaylistResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getPlaylistWithSongs(playlistId: number) {
  const [playlist] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, playlistId));
  if (!playlist) return null;

  const playlistSongs = await db
    .select({ songId: playlistSongsTable.songId, position: playlistSongsTable.position })
    .from(playlistSongsTable)
    .where(eq(playlistSongsTable.playlistId, playlistId))
    .orderBy(playlistSongsTable.position);

  const songIds = playlistSongs.map((ps) => ps.songId);
  let songs: any[] = [];
  if (songIds.length > 0) {
    const rawSongs = await db.select().from(songsTable).where(inArray(songsTable.id, songIds));
    const counts = await db
      .select({ songId: collectedCardsTable.songId, count: sql<number>`count(*)::int` })
      .from(collectedCardsTable)
      .where(inArray(collectedCardsTable.songId, songIds))
      .groupBy(collectedCardsTable.songId);
    const countMap = new Map(counts.map((c) => [c.songId, c.count]));
    const songMap = new Map(rawSongs.map((s) => [s.id, s]));
    songs = playlistSongs
      .map((ps) => {
        const s = songMap.get(ps.songId);
        return s ? { ...s, cardCount: countMap.get(s.id) ?? 0 } : null;
      })
      .filter(Boolean);
  }

  return { ...playlist, songCount: songIds.length, songs };
}

router.get("/playlists", async (_req, res): Promise<void> => {
  const playlists = await db.select().from(playlistsTable).orderBy(desc(playlistsTable.createdAt));
  const ids = playlists.map((p) => p.id);
  const counts = ids.length
    ? await db
        .select({ playlistId: playlistSongsTable.playlistId, count: sql<number>`count(*)::int` })
        .from(playlistSongsTable)
        .where(inArray(playlistSongsTable.playlistId, ids))
        .groupBy(playlistSongsTable.playlistId)
    : [];
  const countMap = new Map(counts.map((c) => [c.playlistId, c.count]));
  const result = playlists.map((p) => ({ ...p, songCount: countMap.get(p.id) ?? 0 }));
  res.json(ListPlaylistsResponse.parse(result));
});

router.post("/playlists", async (req, res): Promise<void> => {
  const parsed = CreatePlaylistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [playlist] = await db.insert(playlistsTable).values(parsed.data).returning();
  res.status(201).json(ListPlaylistsResponseItem.parse({ ...playlist, songCount: 0 }));
});

router.get("/playlists/:id", async (req, res): Promise<void> => {
  const params = GetPlaylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const result = await getPlaylistWithSongs(params.data.id);
  if (!result) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }
  res.json(GetPlaylistResponse.parse(result));
});

router.patch("/playlists/:id", async (req, res): Promise<void> => {
  const params = UpdatePlaylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdatePlaylistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db
    .update(playlistsTable)
    .set(parsed.data)
    .where(eq(playlistsTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(playlistSongsTable)
    .where(eq(playlistSongsTable.playlistId, updated.id));
  res.json(ListPlaylistsResponseItem.parse({ ...updated, songCount: countRow?.count ?? 0 }));
});

router.delete("/playlists/:id", async (req, res): Promise<void> => {
  const params = DeletePlaylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(playlistsTable).where(eq(playlistsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/playlists/:id/songs", async (req, res): Promise<void> => {
  const params = AddSongToPlaylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AddSongToPlaylistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(playlistSongsTable)
    .where(eq(playlistSongsTable.playlistId, params.data.id));
  await db.insert(playlistSongsTable).values({
    playlistId: params.data.id,
    songId: parsed.data.songId,
    position: (countRow?.count ?? 0),
  });
  const result = await getPlaylistWithSongs(params.data.id);
  res.status(201).json(GetPlaylistResponse.parse(result));
});

router.delete("/playlists/:id/songs/:songId", async (req, res): Promise<void> => {
  const params = RemoveSongFromPlaylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .delete(playlistSongsTable)
    .where(
      and(
        eq(playlistSongsTable.playlistId, params.data.id),
        eq(playlistSongsTable.songId, params.data.songId),
      ),
    );
  res.sendStatus(204);
});

export default router;
