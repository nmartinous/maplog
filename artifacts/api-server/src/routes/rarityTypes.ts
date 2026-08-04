import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, rarityTypesTable } from "@workspace/db";
import {
  CreateRarityTypeBody,
  UpdateRarityTypeBody,
  UpdateRarityTypeParams,
  DeleteRarityTypeParams,
  ListRarityTypesQueryParams,
  ListRarityTypesResponse,
  ListRarityTypesResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/rarity-types", async (req, res): Promise<void> => {
  const parsed = ListRarityTypesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  let query = db.select().from(rarityTypesTable).$dynamic();
  if (parsed.data.category) {
    query = query.where(eq(rarityTypesTable.category, parsed.data.category));
  }
  const types = await query.orderBy(rarityTypesTable.tier);
  res.json(ListRarityTypesResponse.parse(types));
});

router.post("/rarity-types", async (req, res): Promise<void> => {
  const parsed = CreateRarityTypeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [type] = await db.insert(rarityTypesTable).values(parsed.data).returning();
  res.status(201).json(ListRarityTypesResponseItem.parse(type));
});

router.patch("/rarity-types/:id", async (req, res): Promise<void> => {
  const params = UpdateRarityTypeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateRarityTypeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db
    .update(rarityTypesTable)
    .set(parsed.data)
    .where(eq(rarityTypesTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Rarity type not found" });
    return;
  }
  res.json(ListRarityTypesResponseItem.parse(updated));
});

router.delete("/rarity-types/:id", async (req, res): Promise<void> => {
  const params = DeleteRarityTypeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(rarityTypesTable).where(eq(rarityTypesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
