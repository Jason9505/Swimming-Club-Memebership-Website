import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') })

const { Pool } = pg

let pool = null

export function getPool() {
  if (pool) return pool

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Create a Postgres database (e.g. Neon) and set DATABASE_URL.')
  }

  pool = new Pool({ connectionString })
  return pool
}

export async function initDb() {
  const d = getPool()

  await d.query(`
    CREATE TABLE IF NOT EXISTS members (
      student_id TEXT NOT NULL,
      full_name TEXT DEFAULT '',
      date_joined TEXT DEFAULT '',
      expiry_date TEXT DEFAULT '',
      level TEXT DEFAULT '',
      gender TEXT DEFAULT '',
      faculty TEXT DEFAULT '',
      source_spreadsheet TEXT DEFAULT '',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (student_id, source_spreadsheet)
    );

    CREATE INDEX IF NOT EXISTS idx_members_student_id ON members(student_id);

    CREATE TABLE IF NOT EXISTS committee (
      student_id TEXT NOT NULL,
      full_name TEXT DEFAULT '',
      position TEXT DEFAULT '',
      status TEXT DEFAULT '',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (student_id)
    );

    CREATE INDEX IF NOT EXISTS idx_committee_student_id ON committee(student_id);

    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      "timestamp" TEXT NOT NULL,
      student_id TEXT NOT NULL,
      full_name TEXT DEFAULT '',
      faculty TEXT DEFAULT '',
      membership_status TEXT DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance("timestamp");

    CREATE TABLE IF NOT EXISTS sync_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_sync_at TIMESTAMPTZ,
      syncing BOOLEAN NOT NULL DEFAULT FALSE,
      syncing_at TIMESTAMPTZ
    );

    INSERT INTO sync_state (id, last_sync_at, syncing)
    VALUES (1, NULL, FALSE)
    ON CONFLICT (id) DO NOTHING;

    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
    );
  `)

  return d
}
