const { drizzle } = require("drizzle-orm/mysql2");
const mysql = require("mysql2/promise");
const { media, users } = require("./schema");
const { eq } = require("drizzle-orm");
const { v4: uuidv4 } = require("uuid");

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "mydb",
});

const db = drizzle(pool, { schema: { media, users }, mode: "default" });

// Auto-increment handles IDs, but we keep newId() for compatibility
function newId() {
  return undefined; // let MySQL auto-increment handle it
}

async function getMediaData() {
  return db.select().from(media);
}

async function getMediaById(id) {
 
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

// User functions
async function getUsersData() {
  return db.select().from(users);
}

async function getUserById(id) {
  const rows = await db.select().from(users).where(eq(users.id, Number(id)));
  return rows[0] ?? null;
}

async function getUserByEmail(email) {
  const rows = await db.select().from(users).where(eq(users.email, email));
  return rows[0] ?? null;
}

async function insertUser({ name, email, password, role = 'user' }) {
  const result = await db.insert(users).values({
    uuid: uuidv4(),
    name,
    email,
    password,
    role,
  });
  const insertId = result[0]?.insertId;
  return getUserById(insertId);
}

async function updateUserById(id, fields) {
  await db.update(users).set(fields).where(eq(users.id, Number(id)));
  return getUserById(id);
}

async function deleteUserById(id) {
  return db.delete(users).where(eq(users.id, Number(id)));
}

module.exports = {
  db,
  newId,
  getMediaData,
  getMediaById,
  insertMedia,
  updateMediaById,
  deleteMediaById,
  getUsersData,
  getUserById,
  getUserByEmail,
  insertUser,
  updateUserById,
  deleteUserById
};