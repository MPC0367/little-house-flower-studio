import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const demoState = sqliteTable("demo_state", {
  id: text("id").primaryKey(),
  version: integer("version").notNull(),
  payload: text("payload").notNull(),
});
