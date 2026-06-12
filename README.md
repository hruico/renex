# Renex — Asset Management System

A full-stack web application for managing institutional assets. Admins manage an asset inventory, handle booking requests, track asset health, and monitor usage analytics. Users browse available assets, submit booking requests, and track their own history.

---

## Technology Stack

### Frontend
| | |
|---|---|
| Framework | React 19 (Vite) |
| Routing | React Router v6 |
| State | Zustand with `persist` |
| HTTP | Axios with JWT interceptors |
| Charts | Recharts |
| Styling | Tailwind CSS v3 |

### Backend
| | |
|---|---|
| Runtime | Node.js + Express 5 |
| Database | MongoDB + Mongoose 9 |
| Auth | JWT (access 15m + refresh 7d via httpOnly cookie) |
| Validation | Zod |
| File Upload | Multer (local disk) |
| Email | Nodemailer (SMTP) |
| Scheduled Jobs | node-cron |
| QR Codes | qrcode |

### Infrastructure
- Docker + Docker Compose (local/self-hosted)
- Nginx reverse proxy (serves frontend, proxies `/api/` to backend)
- MongoDB Atlas (external, via `MONGO_URI`)

---

## Feature List

### Authentication
- Register / Login / Logout
- Silent JWT refresh (access token auto-renewed on 401)
- Role-based access: `admin` and `user`
- Change password from profile page

### Assets
- Browse assets with full-text search, category filter, status filter, and pagination
- Asset status auto-computed: `available` / `low_stock` (≤20%) / `unavailable` (0%)
- Admin: create, edit, soft-delete assets with optional image upload
- Admin: generate and download QR codes per asset (links to asset detail page)

### Asset Health Tracking
- Admin: log condition reports (`excellent`, `good`, `fair`, `damaged`, `under_maintenance`)
- `under_maintenance` zeroes available quantity; clearing it restores inventory
- Per-asset condition history with pagination
- Admin: global health snapshot across all assets

### Bookings
- Users submit booking requests (quantity, purpose, date range)
- Booking lifecycle: `pending → approved → issued → returned` (or `overdue`)
- Admin: approve, reject, issue, and record return — all with inventory sync
- Admin: bulk approve / bulk reject
- MongoDB transactions used when decrementing available quantity

### Notifications
- In-app notifications for every booking lifecycle event
- Mark individual or all notifications as read
- Email notifications via SMTP (booking updates, due reminders, overdue alerts)

### Analytics (Admin)
- Stat cards: total assets, active bookings, pending, overdue, available units
- Booking volume over the last 30 days (line chart)
- Booking status distribution (pie chart)
- Top 10 most booked assets (bar chart)
- Category utilization rates (bar chart)
- Paginated overdue bookings list

### Audit Logs (Admin)
- Immutable log of all significant actions (asset CRUD, booking lifecycle, user registration)
- Filterable by entity type, entity ID, and performing user

### Cron Jobs
- **9:00 AM daily** — marks issued bookings past their due date as overdue, sends notifications + email
- **8:00 AM daily** — sends due-tomorrow reminders for bookings due the next day

---

## Setup Instructions

### Prerequisites
- Node.js 20+
- MongoDB (local or Atlas)
- npm

### 1. Clone the repo

```bash
git clone https://github.com/your-username/renex.git
cd renex
```

### 2. Backend

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

```env
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/renex
JWT_ACCESS_SECRET=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
JWT_REFRESH_SECRET=<run same command again>
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Renex" <noreply@yourdomain.com>
```

```bash
npm install
```

### 3. Frontend

```bash
cd ../frontend
npm install
```

For local dev, API calls proxy to `localhost:3000` automatically — no `.env` needed.

---

## Running the Application

### Development (local)

```bash
# Terminal 1 — backend
cd backend
npm run dev   # nodemon, port 3000

# Terminal 2 — frontend
cd frontend
npm run dev   # Vite, port 5173
```

Open [http://localhost:5173](http://localhost:5173).

### Docker (self-hosted / VPS)

Create a `.env` file at the repo root (see `.env.example`), then:

```bash
docker compose up -d --build
```

Frontend at `http://localhost` (port 80). API proxied through Nginx at `/api/`.

---

## Deployment (Vercel + Render)

### Backend → Render

1. New **Web Service** → connect repo
2. Root Directory: `backend`
3. Build Command: `npm ci` | Start Command: `npm start`
4. Add all env vars from `backend/.env.example`
5. Set `FRONTEND_URL` to your Vercel URL after step below

### Frontend → Vercel

1. New Project → import repo
2. Root Directory: `frontend`
3. Add environment variable:
   - `VITE_API_URL` = `https://<your-render-service>.onrender.com/api/v1`
4. Deploy

After both are live, go back to Render and update `FRONTEND_URL` to your Vercel URL to allow CORS.

---

## Project Structure

```
renex/
├── backend/
│   └── src/
│       ├── controllers/   # Route handlers
│       ├── cron/          # Scheduled jobs
│       ├── middleware/    # Auth, upload
│       ├── models/        # Mongoose schemas
│       ├── routes/        # Express routers
│       └── utils/         # Email, audit log helpers
└── frontend/
    └── src/
        ├── components/    # UI primitives + layout
        ├── lib/           # Axios instance
        ├── pages/         # Route-level page components
        └── store/         # Zustand auth store
```
