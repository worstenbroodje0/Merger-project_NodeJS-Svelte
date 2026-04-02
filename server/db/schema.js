const { mysqlTable, int, varchar, float, bigint, timestamp, json } = require("drizzle-orm/mysql-core");
const { v4: uuidv4 } = require("uuid");

const roles = mysqlTable("roles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
});

const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  uuid: varchar("uuid", { length: 255 }).notNull().unique().default(() => uuidv4()),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  role_id: int("role_id").references(() => roles.id),
  reset_token: varchar("reset_token", { length: 255 }).default(null),
  reset_token_expires: timestamp("reset_token_expires").default(null),
  created_at: timestamp("created_at").defaultNow(),
});

const media = mysqlTable("media", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  path: varchar("path", { length: 500 }).notNull(),
  duration: float("duration").default(0),
  format: varchar("format", { length: 50 }).default("mp4"),
  size: bigint("size", { mode: "number" }).default(0),
  tags: json("tags").default([]),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  user_id: int("user_id").references(() => users.id),
});

const merged_media = mysqlTable("merged_media", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  path: varchar("path", { length: 500 }).notNull(),
  duration: float("duration").default(0),
  format: varchar("format", { length: 50 }).default("mp4"),
  size: bigint("size", { mode: "number" }).default(0),
  tags: json("tags").default([]),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  user_id: int("user_id").references(() => users.id),
});

module.exports = { media, users, roles, merged_media };