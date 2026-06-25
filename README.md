# MMU Swimming Club — Attendance Tracking System

A web-based attendance and membership tracking system for the MMU Swimming Club. Members enter their Student ID to view their digital membership card with swimming level and membership status. Admins can access a dashboard by entering a configured Admin Student ID.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Database | Google Sheets API |
| Auth | Admin Student ID check |
| Hosting | Vercel / Render |

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A Google Cloud service account with the Google Sheets API enabled
- A Google Sheet with member data shared with the service account

## Setup

### 1. Clone and install dependencies

```bash
# Install frontend dependencies
cd client && npm install

# Install backend dependencies
cd ../server && npm install
```

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
ADMIN_STUDENT_ID=ADMIN001
```

Make sure `GOOGLE_SHEETS_CREDENTIALS_PATH` points to your downloaded JSON key file.

`ADMIN_STUDENT_ID` is a special Student ID that, when entered on the attendance page, redirects to the admin dashboard instead of showing a membership card.

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

The system scans all tabs in each spreadsheet (except tabs named `Attendance`) and detects headers from **row 1** or **row 4**.

An `Attendance` tab is auto-created in the first spreadsheet on the first submission.

## Running

### Development (two terminals)

```bash
# Terminal 1 — Backend
cd server && npm run dev

# Terminal 2 — Frontend
cd client && npm run dev
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
   - Member Since and Valid Thru dates
   - Swimming Level banner (color-coded: Blue = Beginner, Green = Intermediate, Red = Advanced)
   - If expired, a red "Membership Expired" bar appears below the card

If you check in multiple times on the same day, the card is shown again without recording a duplicate.

### Admin Dashboard

Access the admin dashboard by entering the configured Admin Student ID (`ADMIN_STUDENT_ID` in `.env`) on the attendance page. The dashboard includes:

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
│   ├── routes/                 # attendance.js, member.js, admin.js
│   ├── services/               # googleSheets.js
│   ├── sheets-config.json      # Spreadsheet list
│   └── package.json
├── .env                        # Credentials and config
└── PRD.txt                     # Product requirements
```

## Key Features

- **Multi-sheet support** — Search across multiple spreadsheets and tabs automatically. Students registered in multiple terms are matched by latest registration date, with missing fields filled from older records.
- **Duplicate handling** — If the same Student ID checks in multiple times on the same day, the card is shown without recording a duplicate (no error).
- **Auto-sheet creation** — The `Attendance` tab is created automatically on first use.
- **Level color coding** — Beginner (blue), Intermediate (green), Advanced (red).
- **Expired membership** — Shows a red "Membership Expired" bar below the card when past the expiry date.
- **Admin dashboard** — Enter the admin Student ID on the attendance page to access the admin dashboard with summary stats, filtered attendance table, and print support.
