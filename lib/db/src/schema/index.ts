// Export your models here. Add one export per file
// export * from "./posts";
//
// Each model/table should ideally be split into different files.
// Each model/table should define a Drizzle table, insert schema, and types:
//
//   import { pgTable, text, serial } from "drizzle-orm/pg-core";
//   import { createInsertSchema } from "drizzle-zod";
//   import { z } from "zod/v4";
//
//   export const postsTable = pgTable("posts", {
//     id: serial("id").primaryKey(),
//     title: text("title").notNull(),
//   });
//
//   export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true });
//   export type InsertPost = z.infer<typeof insertPostSchema>;
//   export type Post = typeof postsTable.$inferSelect;

import { boolean, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';

export const pushDevices = pgTable('push_devices', {
	deviceId: text('device_id').primaryKey(),
	endpoint: text('endpoint').notNull().unique(),
	p256dh: text('p256dh').notNull(),
	auth: text('auth').notNull(),
	masterEnabled: boolean('master_enabled').notNull().default(false),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mealReminders = pgTable('meal_reminders', {
	id: text('id').primaryKey(),
	deviceId: text('device_id').notNull().references(() => pushDevices.deviceId, { onDelete: 'cascade' }),
	mealId: text('meal_id').notNull(),
	weekday: text('weekday').notNull(),
	time: text('time').notNull(),
	title: text('title').notNull(),
	foods: text('foods').notNull(),
	icon: text('icon').notNull().default('🥘'),
	enabled: boolean('enabled').notNull().default(false),
	lastSentDate: text('last_sent_date'),
	lastSentTime: text('last_sent_time'),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
	deviceMeal: unique('meal_reminders_device_meal').on(table.deviceId, table.mealId),
}));