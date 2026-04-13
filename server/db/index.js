require('dotenv').config();
const { drizzle } = require("drizzle-orm/mysql2");
const mysql = require("mysql2/promise");
const { media, users, roles, merged_media } = require("./schema");
const { eq } = require("drizzle-orm");
const { v4: uuidv4 } = require("uuid");

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "mydb",
});

const db = drizzle(pool, { schema: { media, users, roles, merged_media }, mode: "default" });

function newId() {
  return undefined;
}

// ── Media ─────────────────────────────────────────────────────────────────────


async function getMediaData() {
  return db.select().from(media);
}

async function getMediaById(id) {
  const rows = await db.select().from(media).where(eq(media.id, parseInt(id, 10)));
  return rows[0] ?? null;
}

async function insertMedia({ name, path, duration, format, size, tags, uploadedAt, user_id }) {
  const result = await db.insert(media).values({
    name,
    path,
    duration,
    format,
    size,
    tags,
    uploadedAt: uploadedAt ? new Date(uploadedAt) : new Date(),
    user_id: user_id ?? null,
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

// ── Users ─────────────────────────────────────────────────────────────────────

/**
 * Drizzle 0.45 flattens JOIN results into a single object, so if both tables
 * have `id` and `name` columns the role columns silently overwrite the user
 * columns (or vice-versa) and you end up with nulls.
 *
 * Fix: alias the role columns to unique keys, then re-nest them in shapeUser().
 */
function userQuery() {
  return db
    .select({
      id: users.id,
      uuid: users.uuid,
      name: users.name,
      email: users.email,
      password: users.password,
      role_id: users.role_id,
      reset_token: users.reset_token,
      reset_token_expires: users.reset_token_expires,
      created_at: users.created_at,
      // Aliased to avoid collision with users.id / users.name
      _role_id: roles.id,
      _role_name: roles.name,
    })
    .from(users)
    .leftJoin(roles, eq(users.role_id, roles.id));
}

/** Re-nest the aliased role columns into { role: { id, name } | null } */
function shapeUser(row) {
  if (!row) return null;
  const { _role_id, _role_name, ...user } = row;
  return {
    ...user,
    role: _role_id != null ? { id: _role_id, name: _role_name } : null,
  };
}

async function getUsersData() {
  const rows = await userQuery();
  return rows.map(shapeUser);
}

async function getAllUsers() {
  const rows = await userQuery();
  return rows.map(shapeUser);
}

async function getUserById(id) {
  const rows = await userQuery().where(eq(users.id, Number(id)));
  return shapeUser(rows[0] ?? null);
}

async function getUserByEmail(email) {
  const rows = await userQuery().where(eq(users.email, email));
  return shapeUser(rows[0] ?? null);
}

/**
 * Insert a new user.
 * Pass either `role_id` (number) or legacy string `role` ('admin' | 'user').
 */
async function insertUser({ name, email, password, role_id, role }) {
  let resolvedRoleId = role_id ?? null;

  if (!resolvedRoleId && role) {
    const roleRow = await getRoleByName(role);
    resolvedRoleId = roleRow?.id ?? null;
  }

  const result = await db.insert(users).values({
    uuid: uuidv4(),
    name,
    email,
    password,
    role_id: resolvedRoleId,
  });
  const insertId = result[0]?.insertId;
  return getUserById(insertId);
}

async function updateUserById(id, fields) {
  if (fields.role && !fields.role_id) {
    const roleRow = await getRoleByName(fields.role);
    fields = { ...fields, role_id: roleRow?.id ?? null };
    delete fields.role;
  }
  await db.update(users).set(fields).where(eq(users.id, Number(id)));
  return getUserById(id);
}

async function deleteUserById(id) {
  return db.delete(users).where(eq(users.id, Number(id)));
}

// ── Roles ─────────────────────────────────────────────────────────────────────

async function getRolesData() {
  return db.select().from(roles);
}

async function getRoleById(id) {
  const rows = await db.select().from(roles).where(eq(roles.id, Number(id)));
  return rows[0] ?? null;
}

async function getRoleByName(name) {
  const rows = await db.select().from(roles).where(eq(roles.name, name));
  return rows[0] ?? null;
}

async function insertRole({ name }) {
  const result = await db.insert(roles).values({ name });
  const insertId = result[0]?.insertId;
  return getRoleById(insertId);
}

async function updateRoleById(id, fields) {
  await db.update(roles).set(fields).where(eq(roles.id, Number(id)));
  return getRoleById(id);
}

async function deleteRoleById(id) {
  return db.delete(roles).where(eq(roles.id, Number(id)));
}

// ── Merged media ──────────────────────────────────────────────────────────────

async function getMergedMediaData() {
  return db.select().from(merged_media);
}

async function getMergedMediaById(id) {
  const rows = await db.select().from(merged_media).where(eq(merged_media.id, parseInt(id, 10)));
  return rows[0] ?? null;
}

async function insertMergedMedia({ name, path, duration, format, size, tags, uploadedAt, user_id }) {
  const result = await db.insert(merged_media).values({
    name,
    path,
    duration,
    format,
    size,
    tags,
    uploadedAt: uploadedAt ? new Date(uploadedAt) : new Date(),
    user_id: user_id ?? null,
  });
  console.log('[insertMergedMedia] raw result:', JSON.stringify(result));
  const insertId = result[0]?.insertId;
  console.log('[insertMergedMedia] insertId:', insertId);
  return getMergedMediaById(insertId);
}

async function updateMergedMediaById(id, fields) {
  await db.update(merged_media).set(fields).where(eq(merged_media.id, Number(id)));
  return getMergedMediaById(id);
}

async function deleteMergedMediaById(id) {
  return db.delete(merged_media).where(eq(merged_media.id, Number(id)));
}

module.exports = {
  db,
  newId,
  // media
  getMediaData,
  getMediaById,
  insertMedia,
  updateMediaById,
  deleteMediaById,
  // users
  getUsersData,
  getAllUsers,
  getUserById,
  getUserByEmail,
  insertUser,
  updateUserById,
  deleteUserById,
  // roles
  getRolesData,
  getRoleById,
  getRoleByName,
  insertRole,
  updateRoleById,
  deleteRoleById,
  // merged media
  getMergedMediaData,
  getMergedMediaById,
  insertMergedMedia,
  updateMergedMediaById,
  deleteMergedMediaById,
};