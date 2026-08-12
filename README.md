# MMU Swimming Club — Attendance Tracking System

A web-based attendance and membership tracking system for the MMU Swimming Club. Members enter their Student ID to view their digital membership card with swimming level and membership status. Committee members are recognized first and get a gold card showing their position and status. Attendance is only recorded during the club's sessions (Tue & Wed, 7:50 PM – 10:00 PM); membership checks work anytime. Admins can access a password-protected dashboard at `/admin`.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Database | PostgreSQL (Neon), synced from Google Sheets |
| Auth | Password-based session auth (admin) |
| Hosting | Vercel |

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A PostgreSQL database (e.g. [Neon](https://neon.tech) — free tier is plenty), used as the primary data store
- A Google Cloud service account with the Google Sheets API enabled
- A Google Sheet with member data shared with the service account

## How It Works

Member data is **synced from Google Sheets into a hosted PostgreSQL database**. The committee spreadsheet is synced into its own `committee` table, while registration sheets are synced into the `members` table. All attendance check-ins, member lookups, and admin queries are served from Postgres — instant and zero rate-limit issues.

Because the app runs on serverless functions (no long-running process), there are no background timers. Instead, the sync is **on-demand**:

- Every attendance / member lookup triggers a cheap freshness check against a `sync_state` table (one `UPDATE`). If the last sync is older than 5 minutes, the sync runs right then, guarded by an atomic lock so only one instance syncs at a time.
- A daily cron (Vercel Cron, `0 0 * * *` UTC) calls `GET /api/sync` as a safety net — this also picks up edits to existing cells, which the freshness check alone would eventually catch.
- On server startup, a full sync runs once.

New registrations therefore appear in the database within seconds of the **first request** after a form response lands — no polling needed.

- `SYNC_STALE_MS` — how old the last sync must be before a request triggers a re-sync (default `300000` / 5 min).
- `SYNC_LOCK_MS` — how long a stuck sync lock is considered stale (default `600000` / 10 min).

```
Google Forms → Google Sheets (member registration)
                    ↓ sync (startup + on-demand + daily cron)
          PostgreSQL (Neon — primary data store)
                    ↓
         Express API (instant reads)
                    ↓
          React frontend (served by Vercel CDN)
```

## Setup

### 1. Clone and install dependencies

```bash
# Install frontend dependencies
cd client && npm install

# Install backend dependencies
cd ../server && npm install
```

> **Note:** If you're switching between Windows CMD and WSL, delete `node_modules` and reinstall in the terminal you'll use.

### 2. Get your own Google Sheets API credentials

> ⚠️ **Important:** The file `swimming-club-database-*.json` contains Google service account credentials and is listed in `.gitignore` so it **cannot be pushed to GitHub**. You must create your own.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select an existing one)
3. Enable the **Google Sheets API**
4. Go to **IAM & Admin → Service Accounts** and create a new service account
5. Click **Keys → Add Key → Create New Key** and choose **JSON**
6. A JSON key file will be downloaded — rename it (e.g. `swimming-club-credentials.json`) and place it in the project root folder
7. Share your Google Sheet with the service account email as **Editor**

### 3. Create a PostgreSQL database

Create a Postgres database (e.g. [Neon](https://neon.tech), or via the Vercel Marketplace → Postgres). Copy the pooled connection string (the `-pooler` one) — this is your `DATABASE_URL`.

### 4. Configure environment variables

Create a `.env` file in the project root:

```env
PORT=3001
DATABASE_URL=postgres://user:password@host/dbname
GOOGLE_SHEETS_CREDENTIALS_PATH="../your-credentials-file.json"
# OR, if you don't want to manage the file on the server:
# GOOGLE_SHEETS_CREDENTIALS_JSON={"type":"service_account","project_id":...}
ADMIN_PASSWORD=your-secure-password
SESSION_SECRET=your-session-secret
CRON_SECRET=your-cron-secret
ALLOWED_ORIGIN=http://localhost:5173
```

- `DATABASE_URL` — connection string for your Postgres database (required)
- `GOOGLE_SHEETS_CREDENTIALS_PATH` — path to your downloaded JSON key file (local dev). On Vercel, set `GOOGLE_SHEETS_CREDENTIALS_JSON` to the full JSON string instead.
- `ADMIN_PASSWORD` — password used to log in to the admin dashboard
- `SESSION_SECRET` — secret for signing session cookies (use a random string)
- `CRON_SECRET` — secret used to protect the `/api/sync` endpoint (Vercel sends it as `Authorization: Bearer`)
- `ALLOWED_ORIGIN` — the frontend URL allowed by CORS (default: `http://localhost:5173`)
- `SYNC_STALE_MS` — re-sync threshold for on-demand sync (default: `300000`)

### 5. Configure spreadsheet files

Open `server/sheets-config.json` and add your spreadsheet IDs:

```json
[
  {
    "id": "your-spreadsheet-id-here",
    "label": "Term 24/25"
  }
]
```

To add more spreadsheets (e.g., different terms), just add more entries:

```json
[
  { "id": "sheet-id-1", "label": "Term 24/25" },
  { "id": "sheet-id-2", "label": "Term 26/27" }
]
```

**Committee spreadsheet** — add an entry with `"type": "committee"`. Committee Student IDs are checked **first** at lookup time, so committee members always get their gold card instead of a regular membership card:

```json
[
  { "id": "committee-sheet-id", "label": "Committee", "type": "committee" },
  { "id": "term-sheet-id", "label": "Term 25/26" }
]
```

Each spreadsheet must be **shared** with your service account email as **Editor**.

### 6. Expected sheet format

The system auto-detects columns by header name. Supported column names for **member (registration) sheets**:

| Field | Expected headers |
|---|---|
| Student ID | `student_id`, `Student ID`, `Student ID:` |
| Name | `name`, `Full Name`, `full_name` |
| Swimming Level | `level`, `swimming level`, `swimming` |
| Date Joined | `date_joined`, `Start time`, `Timestamp` |
| Expiry Date | `expiry_date`, `Expiry Date` |

The system scans all tabs in each spreadsheet (except tabs named `Attendance`) and detects headers from any of the first 10 rows.

**Committee sheet** — the committee spreadsheet expects these columns:

| Field | Expected headers |
|---|---|
| Name | `name`, `Full Name`, `full_name` |
| Student ID | `student_id`, `Student ID`, `Student ID:` |
| Position | `position`, `Position` |
| Status | `status`, `Status` (e.g. `Active`, `Probation`) |

### 7. Configure session schedule

Attendance is only recorded during the club's sessions. The schedule lives in `server/session-config.json` (this file is tracked in git, unlike other `*.json` files):

```json
{
  "days": [2, 3],
  "start": "19:50",
  "end": "22:00",
  "timezone": "Asia/Kuala_Lumpur"
}
```

- `days` — day-of-week numbers, `0` (Sun) through `6` (Sat). `[2, 3]` = Tuesday and Wednesday
- `start` / `end` — local wall-clock times; `end` is **exclusive** (22:00 is not counted)
- `timezone` — the timezone used to evaluate "now" (Asia/Kuala_Lumpur by default), so session timing works correctly on Vercel / Render

Outside the window, student IDs are still looked up and their card is shown (a **membership check**), but **no attendance is recorded**. `GET /api/session` returns the current session state and which day is active.

## Running

### Step 1 — Start the Backend (Terminal 1)

```bash
cd server
npm run dev
```

On startup you'll see:

```
[DB] Postgres database initialized (members + committee + attendance + session)
[Sync] Starting Google Sheets → Postgres sync...
[Sync] Term 25/26: 528 members synced
[Sync] Term 26/27: 46 members synced
[Sync] Committee: 19 committee members synced
[Sync] Complete in 6.5s — 393 unique members, 19 committee in DB (3 sheets OK, 0 failed)
Server running on port 3001
```

The server is **not ready** until you see `Server running on port 3001`. The initial sync takes ~5 seconds. After that, re-syncs happen on-demand (when a lookup finds the data older than 5 minutes) and via a daily cron.

### Step 2 — Start the Frontend (Terminal 2)

```bash
cd client
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies API requests to the backend at `http://localhost:3001`.

### Production

```bash
# Build frontend (outputs to server/public)
cd client && npm run build

# Start backend (serves built frontend from server/public)
cd server && npm start
```

## Deploying to Vercel

The backend is an Express app deployed as a Vercel **Node.js Backend** (single project, same-origin). The React build is produced during the Vercel build and served from `server/public/`.

### 1. Create a Neon Postgres database

Use the Vercel Marketplace (Storage → Postgres) or [console.neon.tech](https://console.neon.tech). Copy the pooled `DATABASE_URL`.

### 2. Create the Vercel project

Import this repo into Vercel (or use `vercel link`), then set:

- **Root Directory**: `server`
- **Framework Preset**: Node.js (entrypoint `index.js` is auto-detected)
- **Build Command**: `npm run build` (defined in `server/package.json` — it installs and builds the client into `server/public`)
- **Install Command**: `npm install`

### 3. Set environment variables (Vercel project → Settings → Environment Variables)

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `GOOGLE_SHEETS_CREDENTIALS_JSON` | Full service-account JSON (paste as one string) |
| `ADMIN_PASSWORD` | Admin dashboard password |
| `SESSION_SECRET` | Random string |
| `CRON_SECRET` | Random string |

Apply to **Production** (and Preview if you want). Then **Deploy**.

### 4. Sync schedule on Vercel

`server/vercel.json` registers a daily cron (`0 0 * * *` UTC) that calls `GET /api/sync`. The route only runs for requests carrying `Authorization: Bearer <CRON_SECRET>` (or an admin session), so it can't be abused. On the free Hobby plan crons run once per day; the on-demand freshness check keeps member data current the rest of the time. On Pro, you can change the schedule to e.g. `*/15 * * * *` for more frequent refreshes.

### 5. Verify

- `GET /ping` → `{"ok":true}`
- `GET /api/session` → session schedule + active state
- Enter a real Student ID on the homepage → digital card appears
- `GET /card` and `/admin` load the SPA (client-side routes fall back to `index.html`)
- Admin login works and the session survives redeploys (sessions live in Postgres)
- The daily cron shows a green success in the Vercel dashboard → Cron Jobs

> **Troubleshooting:** If client-side routes like `/card` or `/admin` return a 404 on Vercel (Vercel's CDN answers before the Express catch-all), the static files aren't being bundled into the Lambda. Check `server/vercel.json` has `"includeFiles": "public/**"` under `functions.index.js`. The `express.static()` call is ignored on Vercel — the `public/` folder is served by the CDN, and the catch-all is only for the SPA fallback.

### Local dev against Postgres

The old `*.db` SQLite files are no longer used. To run locally, set `DATABASE_URL` in the root `.env` to your Neon connection string, then `cd server && npm run dev`. All data (members, attendance, admin sessions) lives in Postgres, so local and deployed apps share the same data.


## Usage

### Attendance Check-In

1. Open the website
2. Enter your **Student ID** and click **Submit**

The page shows one pill per session day (Tue / Wed). When a session is open, its pill is highlighted gold with "Session open now" and the remaining time.

**During a session** (Tue & Wed, 7:50 PM – 10:00 PM KL), checking in records your attendance:

- Your digital membership card is displayed with:
   - Student ID and membership status badge (Active / Expired)
   - Full Name
   - Member Since and Valid Thru dates (formatted as "DD MMM YYYY")
   - Swimming Level banner (color-coded: Blue = Beginner, Green = Intermediate, Red = Advanced)
   - A green "✓ Attendance recorded successfully" message
- If expired, a red "Membership Expired" bar appears below the card
- Checking in multiple times on the same day shows the card again with "already checked in" and does **not** record a duplicate

**Outside a session**, the card is still shown as a **membership check** — your membership is verified but **no attendance is recorded** and no success message appears.

**Committee members** are recognized first (their Student ID is checked against the committee sheet before the member records):

- A **gold** card with a "COMMITTEE" badge
- The Status row shows their committee status (e.g. Active / Probation)
- A gold banner shows their **position** (e.g. "President", "Assistant Secretary")
- No message appears below the card (their attendance is still recorded during sessions, but no confirmation is shown)

### Admin Dashboard

Navigate to `/admin` and log in with the configured admin password (`ADMIN_PASSWORD` in `.env`). The dashboard includes:

- **Summary cards** — Total attendance, active members, expired members
- **Filterable attendance table** — Filter by date range, Student ID, Faculty, Membership Status
- **Enriched data** — Each row includes swimming level alongside attendance info
- **Print / PDF** — Browser-printable view with hidden UI elements

## Project Structure

```
├── client/                     # React frontend
│   ├── public/                 # Static assets (logo)
│   ├── src/
│   │   ├── pages/              # AttendancePage, MembershipCardPage, AdminDashboardPage
│   │   ├── components/         # MembershipCard, SessionBars
│   │   └── api/                # attendance.js, admin.js
│   ├── tailwind.config.js      # Dark metallic theme (+ gold committee colors)
│   └── package.json
├── server/                     # Express backend
│   ├── db/
│   │   ├── index.js            # Postgres pool + schema bootstrap
│   │   ├── members.js          # Members table: init, upsert, find, getAllMap
│   │   ├── committee.js        # Committee table: init, upsert, find, getAllMap
│   │   └── attendance.js       # Attendance table: init, insert, query, summary
│   ├── routes/                 # attendance.js, member.js, admin.js
│   ├── services/               # googleSheets.js (Sheets API + date parsing), session.js
│   ├── database.js             # Re-exports from db/ modules
│   ├── sync.js                 # Google Sheets → Postgres sync orchestrator (+ on-demand maybeSync)
│   ├── index.js                # Server entry point (init DB, sync, SPA serving)
│   ├── sheets-config.json      # Spreadsheet list (member + committee sheets)
│   ├── session-config.json     # Session schedule (days, start/end, timezone)
│   ├── vercel.json             # Vercel config: cron + Lambda includeFiles
│   ├── public/                 # Built React app (auto-generated by `npm run build` in client/)
│   └── package.json
├── .env                        # Credentials and config
└── PRD.txt                     # Product requirements
```

## Key Features

- **PostgreSQL primary store** — All reads are instant queries against a hosted Postgres (Neon). No Google Sheets API rate limits, and data survives on serverless.
- **Auto-sync** — Member data syncs from Google Sheets on startup, on-demand (when data is stale), and via a daily cron.
- **Multi-sheet support** — Searches across multiple spreadsheets and tabs. Students in multiple terms are matched by latest registration, with missing fields filled from older records.
- **Duplicate handling** — Same Student ID cannot check in twice on the same day.
- **Date normalization** — All dates normalized to "DD MMM YYYY" format on the server, fixing locale parsing issues.
- **Auto-calculated expiry** — When a member's expiry date is missing from the sheet, it is automatically computed as `date_joined + 1 year`.
- **Empty name warning** — If a member's name is missing from the records, the card shows "Name not available" with a prompt to contact the admin.
- **Committee support** — Committee members are checked against the committee sheet **first** and get a gold card showing their position and status (Active / Probation), instead of a regular membership card.
- **Session-based attendance** — Attendance is only recorded during configured sessions (Tue & Wed 7:50–10:00 PM, configurable via `session-config.json`). Membership checks work anytime.
- **Live session indicator** — Per-day session bars on the attendance page highlight the open session with "Session open now".
- **Level color coding** — Beginner (blue), Intermediate (green), Advanced (red).
- **Expired membership** — Shows a red "Membership Expired" bar below the card when past the expiry date.
- **Admin dashboard** — Password-protected dashboard with summary stats, filterable attendance table, and print support. Rate-limited to 5 login attempts per 15 minutes; sessions persist in Postgres so logins survive redeploys.

## things to improve later:

- add QR code scanning so members can check in by scanning a QR at the pool
- add member profile pages (view own attendance history)
- add committee management UI (add/remove members, update positions/status)
- add email renewal reminders when membership is close to expiring
