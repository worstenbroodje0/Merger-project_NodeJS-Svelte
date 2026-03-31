const { mysqlTable, int, varchar, float, bigint, timestamp, json, mysqlEnum } = require("drizzle-orm/mysql-core");
const { v4: uuidv4 } = require("uuid");

const media = mysqlTable("media", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  path: varchar("path", { length: 500 }).notNull(),
  duration: float("duration").default(0),
  format: varchar("format", { length: 50 }).default("mp4"),
  size: bigint("size", { mode: "number" }).default(0),
  tags: json("tags").default([]),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  uuid: varchar("uuid", { length: 255 }).notNull().unique().default(() => uuidv4()),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  password: varchar("password", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user"),
  createdAt: timestamp("created_at").defaultNow(),
});

module.exports = { media, users };