require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getMediaDataSafe, getMergedMediaDataSafe } = require('./db/index');

// ── Config ────────────────────────────────────────────────────────────────────

const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
const OUTPUT_DIR  = path.resolve(__dirname, 'outputs');
const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv']);

// ── Helpers ───────────────────────────────────────────────────────────────────

function getVideoFilesInDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => VIDEO_EXTENSIONS.has(path.extname(f).toLowerCase()));
}

function buildKnownPaths(rows) {
  const known = new Set();
  for (const row of rows) {
    if (row.path) {
      // Normalize backslashes (Windows) before extracting filename
      const normalized = row.path.replace(/\\/g, '/');
      known.add(path.basename(normalized));
    }
  }
  return known;
}

function deleteFile(filePath) {
  try {
    fs.unlinkSync(filePath);
    console.log(`[sync] Deleted orphaned file: ${filePath}`);
  } catch (err) {
    console.error(`[sync] Failed to delete ${filePath}:`, err.message);
  }
}

// ── Core sync ─────────────────────────────────────────────────────────────────

async function syncFiles() {
  console.log(`[sync] Running at ${new Date().toISOString()}`);

  try {
    // Fetch all paths currently tracked in the DB
    const [mediaRows, mergedRows] = await Promise.all([
      getMediaDataSafe(),
      getMergedMediaDataSafe(),
    ]);

    const knownUploads = buildKnownPaths(mediaRows);
    const knownOutputs = buildKnownPaths(mergedRows);

    let deleted = 0;

    // Check uploads/ against media table
    for (const file of getVideoFilesInDir(UPLOADS_DIR)) {
      if (!knownUploads.has(file)) {
        deleteFile(path.join(UPLOADS_DIR, file));
        deleted++;
      }
    }

    // Check output/ against merged_media table
    for (const file of getVideoFilesInDir(OUTPUT_DIR)) {
      if (!knownOutputs.has(file)) {
        deleteFile(path.join(OUTPUT_DIR, file));
        deleted++;
      }
    }

    if (deleted === 0) {
      console.log('[sync] All files are in sync — nothing to delete.');
    } else {
      console.log(`[sync] Done. Removed ${deleted} orphaned file(s).`);
    }
  } catch (err) {
    console.error('[sync] Error during sync:', err.message);
  }
}

// ── Start loop ────────────────────────────────────────────────────────────────

console.log(`[sync] Starting file sync (interval: ${SYNC_INTERVAL_MS / 1000}s)`);
syncFiles(); // Run immediately on start
setInterval(syncFiles, SYNC_INTERVAL_MS);