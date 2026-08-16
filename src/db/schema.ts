import { pgTable, serial, text, doublePrecision, timestamp, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  firstName: text('first_name').notNull().default(''),
  lastName: text('last_name').notNull().default(''),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  preferredUnit: text('preferred_unit').notNull().default('acre'),
  exportDefault: text('export_default').notNull().default('pdf'),
  plan: text('plan').notNull().default('free'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const fields = pgTable('fields', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  method: text('method').notNull(),
  areaAcres: doublePrecision('area_acres').notNull(),
  perimeterMeters: doublePrecision('perimeter_meters').notNull(),
  pointsJson: text('points_json').notNull().default('[]'),
  locationLabel: text('location_label').notNull().default(''),
  accentColor: text('accent_color').notNull().default('#256b5a'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const shareLinks = pgTable('share_links', {
  id: serial('id').primaryKey(),
  fieldId: integer('field_id').notNull().references(() => fields.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
});