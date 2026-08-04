import { Router, type IRouter } from "express";
import { eq, ilike, sql, desc, and, inArray } from "drizzle-orm";
import { db, songsTable, collectedCardsTable, rarityTypesTable } from "@workspace/db";
import {
  CreateSongBody,
  UpdateSongBody,
  GetSongParams,
  UpdateSongParams,
  DeleteSongParams,
  ListSongsQueryParams,
  ListSongsResponseItem,
  ListSongsResponse,
  GetSongResponse,
  ListRecentSongsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getSongWithCardCount(id: number) {
  const [song] = await db.select().from(songsTable).where(eq(songsTable.id, id));
  if (!song) return null;
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(collectedCardsTable)
    .where(eq(collectedCardsTable.songId, id));
  return { ...song, cardCount: countRow?.count ?? 0 };
}

async function getSongsWithCardCounts(songIds: number[]) {
  if (songIds.length === 0) return [];
  const songs = await db.select().from(songsTable).where(inArray(songsTable.id, songIds));
  const counts = await db
    .select({ songId: collectedCardsTable.songId, count: sql<number>`count(*)::int` })
    .from(collectedCardsTable)
    .where(inArray(collectedCardsTable.songId, songIds))
    .groupBy(collectedCardsTable.songId);
  const countMap = new Map(counts.map((c) => [c.songId, c.count]));
  return songs.map((s) => ({ ...s, cardCount: countMap.get(s.id) ?? 0 }));
}

router.get("/songs", async (req, res): Promise<void> => {
  const parsed = ListSongsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, artist, rarityCategory, limit = 50, offset = 0 } = parsed.data;

  let songIds: number[] | null = null;

  if (rarityCategory) {
    const cards = await db
      .select({ songId: collectedCardsTable.songId })
      .from(collectedCardsTable)
      .innerJoin(rarityTypesTable, eq(collectedCardsTable.rarityTypeId, rarityTypesTable.id))
      .where(ilike(rarityTypesTable.category, rarityCategory));
    songIds = [...new Set(cards.map((c) => c.songId))];
    if (songIds.length === 0) {
      res.json([]);
      return;
    }
  }

  let query = db.select().from(songsTable).$dynamic();
  const conditions = [];
  if (search) conditions.push(ilike(songsTable.title, `%${search}%`));
  if (artist) conditions.push(ilike(songsTable.artist, `%${artist}%`));
  if (songIds !== null) conditions.push(inArray(songsTable.id, songIds));
  if (conditions.length > 0) query = query.where(and(...conditions));
  const songs = await query.orderBy(desc(songsTable.createdAt)).limit(limit).offset(offset);

  const ids = songs.map((s) => s.id);
  const counts = ids.length
    ? await db
        .select({ songId: collectedCardsTable.songId, count: sql<number>`count(*)::int` })
        .from(collectedCardsTable)
        .where(inArray(collectedCardsTable.songId, ids))
        .groupBy(collectedCardsTable.songId)
    : [];
  const countMap = new Map(counts.map((c) => [c.songId, c.count]));
  const result = songs.map((s) => ({ ...s, cardCount: countMap.get(s.id) ?? 0 }));
  res.json(ListSongsResponse.parse(result));
});

router.get("/songs/recently-added", async (_req, res): Promise<void> => {
  const songs = await db.select().from(songsTable).orderBy(desc(songsTable.createdAt)).limit(20);
  const ids = songs.map((s) => s.id);
  const counts = ids.length
    ? await db
        .select({ songId: collectedCardsTable.songId, count: sql<number>`count(*)::int` })
        .from(collectedCardsTable)
        .where(inArray(collectedCardsTable.songId, ids))
        .groupBy(collectedCardsTable.songId)
    : [];
  const countMap = new Map(counts.map((c) => [c.songId, c.count]));
  const result = songs.map((s) => ({ ...s, cardCount: countMap.get(s.id) ?? 0 }));
  res.json(ListRecentSongsResponse.parse(result));
});

router.post("/songs", async (req, res): Promise<void> => {
  const parsed = CreateSongBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [song] = await db.insert(songsTable).values(parsed.data).returning();
  res.status(201).json(ListSongsResponseItem.parse({ ...song, cardCount: 0 }));
});

router.get("/songs/:id", async (req, res): Promise<void> => {
  const params = GetSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const song = await getSongWithCardCount(params.data.id);
  if (!song) {
    res.status(404).json({ error: "Song not found" });
    return;
  }
  const cards = await db
    .select({
      id: collectedCardsTable.id,
      songId: collectedCardsTable.songId,
      rarityTypeId: collectedCardsTable.rarityTypeId,
      variantLabel: collectedCardsTable.variantLabel,
      artworkUrl: collectedCardsTable.artworkUrl,
      notes: collectedCardsTable.notes,
      collectedAt: collectedCardsTable.collectedAt,
      rarityType: {
        id: rarityTypesTable.id,
        slug: rarityTypesTable.slug,
        name: rarityTypesTable.name,
        category: rarityTypesTable.category,
        tier: rarityTypesTable.tier,
        themeConfig: rarityTypesTable.themeConfig,
      },
    })
    .from(collectedCardsTable)
    .innerJoin(rarityTypesTable, eq(collectedCardsTable.rarityTypeId, rarityTypesTable.id))
    .where(eq(collectedCardsTable.songId, params.data.id))
    .orderBy(desc(rarityTypesTable.tier));

  res.json(GetSongResponse.parse({ ...song, cards }));
});

router.patch("/songs/:id", async (req, res): Promise<void> => {
  const params = UpdateSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSongBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db
    .update(songsTable)
    .set(parsed.data)
    .where(eq(songsTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Song not found" });
    return;
  }
  const song = await getSongWithCardCount(updated.id);
  res.json(ListSongsResponseItem.parse(song));
});

router.delete("/songs/:id", async (req, res): Promise<void> => {
  const params = DeleteSongParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(songsTable).where(eq(songsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
