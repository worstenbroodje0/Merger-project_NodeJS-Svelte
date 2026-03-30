const { drizzle } = require("drizzle-orm/mysql2");
const mysql = require("mysql2/promise");
const { media } = require("./schema");
const { eq } = require("drizzle-orm");

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "mydb",
});

const db = drizzle(pool, { schema: { media }, mode: "default" });

// Auto-increment handles IDs, but we keep newId() for compatibility
function newId() {
  return undefined; // let MySQL auto-increment handle it
}

async function getMediaData() {
  return db.select().from(media);
}

async function getMediaById(id) {
  console.log('[getMediaById] called with:', id, '| type:', typeof id, '| stack:', new Error().stack.split('\n')[2]);
  const rows = await db.select().from(media).where(eq(media.id, parseInt(id, 10)));
  return rows[0] ?? null;
}

async function insertMedia({ name, path, duration, format, size, tags, uploadedAt }) {
  const result = await db.insert(media).values({
    name,
    path,
    duration,
    format,
    size,
    tags,
    uploadedAt: uploadedAt ? new Date(uploadedAt) : new Date(),
  });
  console.log('[insertMedia] raw result:', JSON.stringify(result));
  const insertId = result[0]?.insertId;
  console.log('[insertMedia] insertId:', insertId);
  return getMediaById(insertId);
}

async function updateMediaById(id, fields) {
  await db.update(media).set(fields).where(eq(media.id, Number(id)));
  return getMediaById(id);
}

async function deleteMediaById(id) {
  return db.delete(media).where(eq(media.id, Number(id)));
}

module.exports = { db, newId, getMediaData, getMediaById, insertMedia, updateMediaById, deleteMediaById };