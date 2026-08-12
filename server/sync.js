import { loadSheetsConfig, getMemberRows } from './services/googleSheets.js'
import {
  upsertMembers,
  upsertCommittee,
  getMemberCount,
  getCommitteeCount,
  getPool,
} from './database.js'

const SYNC_STALE_MS = Number(process.env.SYNC_STALE_MS) || 5 * 60 * 1000
const SYNC_LOCK_MS = Number(process.env.SYNC_LOCK_MS) || 10 * 60 * 1000

function isCommitteeConfig(cfg) {
  return cfg.type === 'committee' || cfg.label === 'Committee'
}

async function syncSheet(cfg) {
  const members = await getMemberRows(cfg.id)
  if (isCommitteeConfig(cfg)) {
    const count = await upsertCommittee(members)
    console.log(`[Sync] ${cfg.label}: ${count} committee members synced`)
  } else {
    const count = await upsertMembers(members, cfg.label)
    console.log(`[Sync] ${cfg.label}: ${count} members synced`)
  }
}

export async function syncFromSheets() {
  const startTime = Date.now()
  console.log('[Sync] Starting Google Sheets → Postgres sync...')

  const configs = loadSheetsConfig()
  if (configs.length === 0) {
    console.log('[Sync] No spreadsheets configured. Skipping.')
    return { success: false, message: 'No spreadsheets configured' }
  }

  let successCount = 0
  let errorCount = 0

  const results = await Promise.allSettled(
    configs.map(async (cfg) => {
      await syncSheet(cfg)
      return { label: cfg.label }
    })
  )

  for (const result of results) {
    if (result.status === 'fulfilled') {
      successCount++
    } else {
      console.error(`[Sync] Error:`, result.reason?.message || result.reason)
      errorCount++
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const dbCount = await getMemberCount()
  const committeeDbCount = await getCommitteeCount()
  console.log(`[Sync] Complete in ${elapsed}s — ${dbCount} unique members, ${committeeDbCount} committee in DB (${successCount} sheets OK, ${errorCount} failed)`)

  try {
    await getPool().query(
      `UPDATE sync_state SET last_sync_at = NOW(), syncing = FALSE, syncing_at = NULL WHERE id = 1`
    )
  } catch {
    // best-effort; next maybeSync will retry
  }

  return {
    success: errorCount === 0,
    totalMembers: dbCount,
    committeeMembers: committeeDbCount,
    sheetsSynced: successCount,
    sheetsFailed: errorCount,
    elapsed: `${elapsed}s`,
  }
}

export async function maybeSync() {
  const pool = getPool()
  try {
    const locked = await pool.query(
      `UPDATE sync_state
       SET syncing = TRUE, syncing_at = NOW()
       WHERE id = 1
         AND (syncing = FALSE OR syncing_at < NOW() - make_interval(secs => $1))
         AND (last_sync_at IS NULL OR last_sync_at < NOW() - make_interval(secs => $2))
       RETURNING id`,
      [SYNC_LOCK_MS / 1000, SYNC_STALE_MS / 1000]
    )
    if (locked.rowCount === 0) return

    try {
      await syncFromSheets()
    } finally {
      await pool.query(
        `UPDATE sync_state SET syncing = FALSE, syncing_at = NULL WHERE id = 1`
      )
    }
  } catch (err) {
    console.error('[Sync] maybeSync failed:', err.message)
  }
}
