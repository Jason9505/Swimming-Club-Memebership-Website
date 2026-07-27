import { loadSheetsConfig, getMemberRows } from './services/googleSheets.js'
import { upsertMembers, getMemberCount } from './database.js'

export async function syncFromSheets() {
  const startTime = Date.now()
  console.log('[Sync] Starting Google Sheets → SQLite sync...')

  const configs = loadSheetsConfig()
  if (configs.length === 0) {
    console.log('[Sync] No spreadsheets configured. Skipping.')
    return { success: false, message: 'No spreadsheets configured' }
  }

  let totalMembers = 0
  let successCount = 0
  let errorCount = 0

  const results = await Promise.allSettled(
    configs.map(async (cfg) => {
      const members = await getMemberRows(cfg.id)
      const count = upsertMembers(members, cfg.label)
      console.log(`[Sync] ${cfg.label}: ${count} members synced`)
      return { label: cfg.label, count }
    })
  )

  for (const result of results) {
    if (result.status === 'fulfilled') {
      totalMembers += result.value.count
      successCount++
    } else {
      console.error(`[Sync] Error:`, result.reason?.message || result.reason)
      errorCount++
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const dbCount = getMemberCount()
  console.log(`[Sync] Complete in ${elapsed}s — ${dbCount} unique members in DB (${successCount} sheets OK, ${errorCount} failed)`)

  return {
    success: errorCount === 0,
    totalMembers: dbCount,
    sheetsSynced: successCount,
    sheetsFailed: errorCount,
    elapsed: `${elapsed}s`,
  }
}
