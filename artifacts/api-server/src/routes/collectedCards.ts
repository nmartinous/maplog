import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, collectedCardsTable, rarityTypesTable } from "@workspace/db";
import {
  CreateCollectedCardBody,
  UpdateCollectedCardBody,
  UpdateCollectedCardParams,
  DeleteCollectedCardParams,
  ListCollectedCardsQueryParams,
  ListCollectedCardsResponse,
  ListCollectedCardsResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function fetchCardsWithRarityType(where: Parameters<typeof db.select>[0] extends void ? undefined : any) {
  return db
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
    .innerJoin(rarityTypesTable, eq(collectedCardsTable.rarityTypeId, rarityTypesTable.id));
}

router.get("/collected-cards", async (req, res): Promise<void> => {
  const parsed = ListCollectedCardsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { songId, rarityTypeId, category, limit = 50, offset = 0 } = parsed.data;

  const conditions = [];
  if (songId) conditions.push(eq(collectedCardsTable.songId, songId));
  if (rarityTypeId) conditions.push(eq(collectedCardsTable.rarityTypeId, rarityTypeId));
  if (category) conditions.push(eq(rarityTypesTable.category, category));

  const query = db
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
    .innerJoin(rarityTypesTable, eq(collectedCardsTable.rarityTypeId, rarityTypesTable.id));

  const cards = conditions.length
    ? await query.where(and(...conditions)).limit(limit).offset(offset)
    : await query.limit(limit).offset(offset);

  res.json(ListCollectedCardsResponse.parse(cards));
});

router.post("/collected-cards", async (req, res): Promise<void> => {
  const parsed = CreateCollectedCardBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [card] = await db.insert(collectedCardsTable).values(parsed.data).returning();
  const [withType] = await db
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
    .where(eq(collectedCardsTable.id, card.id));

  res.status(201).json(ListCollectedCardsResponseItem.parse(withType));
});

router.patch("/collected-cards/:id", async (req, res): Promise<void> => {
  const params = UpdateCollectedCardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCollectedCardBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db
    .update(collectedCardsTable)
    .set(parsed.data)
    .where(eq(collectedCardsTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Collected card not found" });
    return;
  }
  const [withType] = await db
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
    .where(eq(collectedCardsTable.id, updated.id));

  res.json(ListCollectedCardsResponseItem.parse(withType));
});

router.delete("/collected-cards/:id", async (req, res): Promise<void> => {
  const params = DeleteCollectedCardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(collectedCardsTable).where(eq(collectedCardsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
