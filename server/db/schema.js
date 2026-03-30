const { mysqlTable, int, varchar, float, bigint, timestamp, json } = require("drizzle-orm/mysql-core");

const media = mysqlTable("media", {
  id:         int("id").autoincrement().primaryKey(),
  name:       varchar("name", { length: 255 }).notNull(),
  path:       varchar("path", { length: 500 }).notNull(),
  duration:   float("duration").default(0),
  format:     varchar("format", { length: 50 }).default("mp4"),
  size:       bigint("size", { mode: "number" }).default(0),
  tags:       json("tags").default([]),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

module.exports = { media };