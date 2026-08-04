import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { songsTable } from "./songs";
import { rarityTypesTable } from "./rarityTypes";

export const collectedCardsTable = pgTable("collected_cards", {
  id: serial("id").primaryKey(),
  songId: integer("song_id").notNull().references(() => songsTable.id, { onDelete: "cascade" }),
  rarityTypeId: integer("rarity_type_id").notNull().references(() => rarityTypesTable.id),
  variantLabel: text("variant_label"),
  artworkUrl: text("artwork_url"),
  notes: text("notes"),
  collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCollectedCardSchema = createInsertSchema(collectedCardsTable).omit({ id: true, collectedAt: true });
export type InsertCollectedCard = z.infer<typeof insertCollectedCardSchema>;
export type CollectedCard = typeof collectedCardsTable.$inferSelect;
