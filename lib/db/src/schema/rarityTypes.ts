import { pgTable, text, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rarityTypesTable = pgTable("rarity_types", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  tier: integer("tier").notNull().default(0),
  themeConfig: jsonb("theme_config").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRarityTypeSchema = createInsertSchema(rarityTypesTable).omit({ id: true, createdAt: true });
export type InsertRarityType = z.infer<typeof insertRarityTypeSchema>;
export type RarityType = typeof rarityTypesTable.$inferSelect;
