# MMU Swimming Club — Attendance Tracking System

A web-based attendance and membership tracking system for the MMU Swimming Club. Members record attendance by entering their Student ID, and the system displays a digital membership card with their swimming level and membership status.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Database | Google Sheets API |
| Auth | Simple admin login |
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

### 2. Configure Google Sheets credentials

Download your service account JSON key file and place it in the project root folder. Then create a `.env` file in the project root:

```env
PORT=3001
GOOGLE_SHEETS_CREDENTIALS_PATH="../swimming-club-database-913570867b98.json"
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-password
```

### 3. Configure spreadsheet files

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

### 4. Expected sheet format

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
   - Student ID and membership status (Active / Expired)
   - Full Name
   - Member Since and Valid Thru dates
   - Swimming Level banner (color-coded: Blue = Beginner, Green = Intermediate, Red = Advanced)

### Admin Dashboard

- View attendance records
- Filter by date, Student ID, faculty, membership status
- Print reports or save as PDF

## Project Structure

```
├── client/                     # React frontend
│   ├── public/                 # Static assets (logo)
│   ├── src/
│   │   ├── pages/              # AttendancePage, MembershipCardPage
│   │   ├── components/         # MembershipCard
│   │   └── api/                # API call helpers
│   ├── tailwind.config.js      # Dark metallic theme
│   └── package.json
├── server/                     # Express backend
│   ├── routes/                 # attendance.js, member.js
│   ├── services/               # googleSheets.js
│   ├── sheets-config.json      # Spreadsheet list
│   └── package.json
├── .env                        # Credentials and config
└── PRD.txt                     # Product requirements
```

## Key Features

- **Multi-sheet support** — Search across multiple spreadsheets and tabs automatically. Students registered in multiple terms are matched by latest registration date, with missing fields filled from older records.
- **Duplicate prevention** — Prevents the same Student ID from recording attendance twice on the same day.
- **Auto-sheet creation** — The `Attendance` tab is created automatically on first use.
- **Level color coding** — Beginner (blue), Intermediate (green), Advanced (red).
- **Expired membership** — Shows a "Membership Expired" overlay when past the expiry date.
