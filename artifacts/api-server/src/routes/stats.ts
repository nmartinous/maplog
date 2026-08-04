import { Router, type IRouter } from "express";
import { sql, desc, inArray } from "drizzle-orm";
import { db, songsTable, collectedCardsTable, rarityTypesTable, playlistsTable } from "@workspace/db";
import { GetStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const [[totalSongsRow], [totalCardsRow], [totalPlaylistsRow]] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(songsTable),
    db.select({ count: sql<number>`count(*)::int` }).from(collectedCardsTable),
    db.select({ count: sql<number>`count(*)::int` }).from(playlistsTable),
  ]);

  const byCategory = await db
    .select({
      category: rarityTypesTable.category,
      tier: sql<number>`max(${rarityTypesTable.tier})::int`,
      count: sql<number>`count(${collectedCardsTable.id})::int`,
    })
    .from(collectedCardsTable)
    .innerJoin(rarityTypesTable, sql`${collectedCardsTable.rarityTypeId} = ${rarityTypesTable.id}`)
    .groupBy(rarityTypesTable.category)
    .orderBy(sql`max(${rarityTypesTable.tier}) desc`);

  const recentSongs = await db.select().from(songsTable).orderBy(desc(songsTable.createdAt)).limit(5);
  const recentIds = recentSongs.map((s) => s.id);
  const counts = recentIds.length
    ? await db
        .select({ songId: collectedCardsTable.songId, count: sql<number>`count(*)::int` })
        .from(collectedCardsTable)
        .where(inArray(collectedCardsTable.songId, recentIds))
        .groupBy(collectedCardsTable.songId)
    : [];
  const countMap = new Map(counts.map((c) => [c.songId, c.count]));
  const recentlyAdded = recentSongs.map((s) => ({ ...s, cardCount: countMap.get(s.id) ?? 0 }));

  res.json(
    GetStatsResponse.parse({
      totalSongs: totalSongsRow?.count ?? 0,
      totalCards: totalCardsRow?.count ?? 0,
      totalPlaylists: totalPlaylistsRow?.count ?? 0,
      byCategory,
      recentlyAdded,
    }),
  );
});

export default router;
