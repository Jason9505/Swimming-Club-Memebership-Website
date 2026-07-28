# MMU Swimming Club — Attendance Tracking System

A web-based attendance and membership tracking system for the MMU Swimming Club. Members enter their Student ID to view their digital membership card with swimming level and membership status. Admins can access a password-protected dashboard at `/admin`.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Database | SQLite (synced from Google Sheets) |
| Auth | Password-based session auth (admin) |
| Hosting | Vercel / Render |

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A Google Cloud service account with the Google Sheets API enabled
- A Google Sheet with member data shared with the service account

## How It Works

On server startup, member data is **synced from Google Sheets into a local SQLite database**. All attendance check-ins, member lookups, and admin queries are served from SQLite — instant and zero rate-limit issues. The sync re-runs automatically every 30 minutes to pick up new registrations.

```
Google Forms → Google Sheets (member registration)
                    ↓ sync (startup + every 30 min)
                  SQLite (primary data store)
                    ↓
         Express API (instant local reads)
                    ↓
              React frontend
```

## Setup

### 1. Clone and install dependencies

```bash
# Install frontend dependencies
cd client && npm install

# Install backend dependencies
cd ../server && npm install
```

> **Note:** If you're switching between Windows CMD and WSL, delete `node_modules` and reinstall in the terminal you'll use. Native modules (`better-sqlite3`, `rolldown`) compile platform-specific binaries.

### 2. Get your own Google Sheets API credentials

> ⚠️ **Important:** The file `swimming-club-database-*.json` contains Google service account credentials and is listed in `.gitignore` so it **cannot be pushed to GitHub**. You must create your own.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select an existing one)
3. Enable the **Google Sheets API**
4. Go to **IAM & Admin → Service Accounts** and create a new service account
5. Click **Keys → Add Key → Create New Key** and choose **JSON**
6. A JSON key file will be downloaded — rename it (e.g. `swimming-club-credentials.json`) and place it in the project root folder
7. Share your Google Sheet with the service account email as **Editor**

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
PORT=3001
GOOGLE_SHEETS_CREDENTIALS_PATH="../your-credentials-file.json"
ADMIN_PASSWORD=your-secure-password
SESSION_SECRET=your-session-secret
ALLOWED_ORIGIN=http://localhost:5173
```

- `GOOGLE_SHEETS_CREDENTIALS_PATH` — points to your downloaded JSON key file
- `ADMIN_PASSWORD` — password used to log in to the admin dashboard
- `SESSION_SECRET` — secret for signing session cookies (use a random string)
- `ALLOWED_ORIGIN` — the frontend URL allowed by CORS (default: `http://localhost:5173`)

### 4. Configure spreadsheet files

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

Each spreadsheet must be **shared** with your service account email as **Editor**.

### 5. Expected sheet format

The system auto-detects columns by header name. Supported column names:

| Field | Expected headers |
|---|---|
| Student ID | `student_id`, `Student ID`, `Student ID:` |
| Name | `name`, `Full Name`, `full_name` |
| Swimming Level | `level`, `swimming level`, `swimming` |
| Date Joined | `date_joined`, `Start time`, `Timestamp` |
| Expiry Date | `expiry_date`, `Expiry Date` |

The system scans all tabs in each spreadsheet (except tabs named `Attendance`) and detects headers from any of the first 10 rows.

## Running

### Step 1 — Start the Backend (Terminal 1)

```bash
cd server
npm run dev
```

On startup you'll see:

```
[DB] SQLite database initialized
[Sync] Starting Google Sheets → SQLite sync...
[Sync] Term 24/25: 326 members synced
[Sync] Term 25/26: 61 members synced
[Sync] Term 23/25: 228 members synced
[Sync] Complete in 4.1s — 435 unique members in DB (3 sheets OK, 0 failed)
Server running on port 3001
```

The server is **not ready** until you see `Server running on port 3001`. The initial sync takes ~5 seconds. After that, re-syncs happen silently every 30 minutes in the background.

### Step 2 — Start the Frontend (Terminal 2)

```bash
cd client
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies API requests to the backend at `http://localhost:3001`.

### Production

```bash
# Build frontend
cd client && npm run build

# Start backend (serves built frontend from client/dist)
cd server && npm start
```

## Usage

### Attendance Check-In

1. Open the website
2. Enter your **Student ID** and click **Submit**
3. Your digital membership card is displayed with:
   - Student ID and membership status badge (Active / Expired)
   - Full Name
   - Member Since and Valid Thru dates (formatted as "DD MMM YYYY")
   - Swimming Level banner (color-coded: Blue = Beginner, Green = Intermediate, Red = Advanced)
   - If expired, a red "Membership Expired" bar appears below the card

If you check in multiple times on the same day, the card is shown again without recording a duplicate.

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
│   │   ├── components/         # MembershipCard
│   │   └── api/                # attendance.js, admin.js
│   ├── tailwind.config.js      # Dark metallic theme
│   └── package.json
├── server/                     # Express backend
│   ├── db/
│   │   ├── members.js          # Members table: init, upsert, find, getAllMap
│   │   └── attendance.js       # Attendance table: init, insert, query, summary
│   ├── routes/                 # attendance.js, member.js, admin.js
│   ├── services/               # googleSheets.js (Sheets API + date parsing)
│   ├── database.js             # Re-exports from db/ modules
│   ├── sync.js                 # Google Sheets → SQLite sync orchestrator
│   ├── index.js                # Server entry point (init DB, sync, schedule)
│   ├── sheets-config.json      # Spreadsheet list
│   ├── members.db              # SQLite members database (auto-created)
│   ├── attendance.db           # SQLite attendance database (auto-created)
│   └── package.json
├── .env                        # Credentials and config
└── PRD.txt                     # Product requirements
```

## Key Features

- **SQLite primary store** — All reads are instant local queries. No Google Sheets API rate limits.
- **Auto-sync** — Member data syncs from Google Sheets on startup and every 30 minutes.
- **Multi-sheet support** — Searches across multiple spreadsheets and tabs. Students in multiple terms are matched by latest registration, with missing fields filled from older records.
- **Duplicate handling** — Same Student ID cannot check in twice on the same day.
- **Date normalization** — All dates normalized to "DD MMM YYYY" format on the server, fixing locale parsing issues.
- **Auto-calculated expiry** — When a member's expiry date is missing from the sheet, it is automatically computed as `date_joined + 1 year`.
- **Empty name warning** — If a member's name is missing from the records, the card shows "Name not available" with a prompt to contact the admin.
- **Level color coding** — Beginner (blue), Intermediate (green), Advanced (red).
- **Expired membership** — Shows a red "Membership Expired" bar below the card when past the expiry date.
- **Admin dashboard** — Password-protected dashboard with summary stats, filterable attendance table, and print support. Rate-limited to 5 login attempts per 15 minutes.

things to improve later:
- differentiate attendance and checking the membership validation
- add committee into the system
