import { loadSheetsConfig, getMemberRows } from './services/googleSheets.js'
import { upsertMembers, upsertCommittee, getMemberCount, getCommitteeCount } from './database.js'

function isCommitteeConfig(cfg) {
  return cfg.type === 'committee' || cfg.label === 'Committee'
}

export async function syncFromSheets() {
  const startTime = Date.now()
  console.log('[Sync] Starting Google Sheets → SQLite sync...')

  const configs = loadSheetsConfig()
  if (configs.length === 0) {
    console.log('[Sync] No spreadsheets configured. Skipping.')
    return { success: false, message: 'No spreadsheets configured' }
  }

  let committeeCount = 0
  let successCount = 0
  let errorCount = 0

  const results = await Promise.allSettled(
    configs.map(async (cfg) => {
      const members = await getMemberRows(cfg.id)
      if (isCommitteeConfig(cfg)) {
        committeeCount = upsertCommittee(members)
        console.log(`[Sync] ${cfg.label}: ${committeeCount} committee members synced`)
      } else {
        const count = upsertMembers(members, cfg.label)
        console.log(`[Sync] ${cfg.label}: ${count} members synced`)
      }
      return { label: cfg.label, count: members.length }
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
  const dbCount = getMemberCount()
  const committeeDbCount = getCommitteeCount()
  console.log(`[Sync] Complete in ${elapsed}s — ${dbCount} unique members, ${committeeDbCount} committee in DB (${successCount} sheets OK, ${errorCount} failed)`)

  return {
    success: errorCount === 0,
    totalMembers: dbCount,
    committeeMembers: committeeDbCount,
    sheetsSynced: successCount,
    sheetsFailed: errorCount,
    elapsed: `${elapsed}s`,
  }
}
