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

function formatLastSync(row) {
  return {
    lastSyncAt: row?.last_sync_at ? row.last_sync_at.toISOString() : null,
    syncing: row?.syncing ?? false,
    syncingAt: row?.syncing_at ? row.syncing_at.toISOString() : null,
    lastResult: row?.last_result || null,
  }
}

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
  const errors = []

  const results = await Promise.allSettled(
    configs.map(async (cfg) => {
      try {
        await syncSheet(cfg)
        return { label: cfg.label }
      } catch (err) {
        err.label = cfg.label
        throw err
      }
    })
  )

  for (const result of results) {
    if (result.status === 'fulfilled') {
      successCount++
    } else {
      const label = result.reason?.label || 'unknown'
      console.error(`[Sync] Error:`, result.reason?.message || result.reason)
      errorCount++
      errors.push({ label, error: result.reason?.message || String(result.reason) })
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const dbCount = await getMemberCount()
  const committeeDbCount = await getCommitteeCount()
  console.log(`[Sync] Complete in ${elapsed}s — ${dbCount} unique members, ${committeeDbCount} committee in DB (${successCount} sheets OK, ${errorCount} failed)`)

  const result = {
    success: errorCount === 0,
    totalMembers: dbCount,
    committeeMembers: committeeDbCount,
    sheetsSynced: successCount,
    sheetsFailed: errorCount,
    elapsed: `${elapsed}s`,
    errors,
  }

  try {
    await getPool().query(
      `UPDATE sync_state SET last_sync_at = NOW(), syncing = FALSE, syncing_at = NULL, last_result = $1 WHERE id = 1`,
      [JSON.stringify(result)]
    )
  } catch {
    // best-effort; next maybeSync will retry
  }

  return result
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

export async function getSyncStatus() {
  const pool = getPool()
  const stateRow = (await pool.query('SELECT * FROM sync_state WHERE id = 1')).rows[0]
  const [memberCount, committeeCount] = await Promise.all([
    getMemberCount(),
    getCommitteeCount(),
  ])
  return {
    ...formatLastSync(stateRow),
    memberCount,
    committeeCount,
  }
}

export async function forceSync() {
  const pool = getPool()
  const locked = await pool.query(
    `UPDATE sync_state
     SET syncing = TRUE, syncing_at = NOW()
     WHERE id = 1
       AND (syncing = FALSE OR syncing_at < NOW() - make_interval(secs => $1))
     RETURNING id`,
    [SYNC_LOCK_MS / 1000]
  )
  if (locked.rowCount === 0) {
    return { success: false, message: 'A sync is already in progress' }
  }

  try {
    return await syncFromSheets()
  } finally {
    await pool.query(
      `UPDATE sync_state SET syncing = FALSE, syncing_at = NULL WHERE id = 1`
    )
  }
}
