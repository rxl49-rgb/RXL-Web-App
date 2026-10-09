# Quick Setup Guide

## 1. Install Node.js (if not installed)

Download from: https://nodejs.org  (choose LTS version, e.g. 20.x)

Or install via Homebrew:
```bash
brew install node
```

---

## 2. Start the Backend API

```bash
cd backend
npm install
npm run db:push       # Creates SQLite database file
npm run db:seed       # Loads demo products, users, shipments
npm run dev           # Runs on http://localhost:5000
```

Health check: http://localhost:5000/health

---

## 3. Start the Frontend

Open a **new terminal tab**:

```bash
cd frontend
npm install
npm run dev           # Runs on http://localhost:5173
```

Open browser: http://localhost:5173

---

## Demo Credentials

| Role     | Email                      | Password     |
|----------|----------------------------|--------------|
| Customer | demo@rxllogistics.com      | customer123  |
| Admin    | admin@rxllogistics.com     | admin123     |

## Demo Tracking Numbers
- `RXL-2024-AIR-001` — Air freight Miami → London (In Transit)
- `RXL-2024-SEA-002` — Sea freight Kingston → Miami (Processing)

---

## Environment

The backend `.env` file is pre-configured for local development.
For production, update:
- `JWT_SECRET` — use a long random string
- `CLIENT_URL` — your deployed frontend URL
- `DATABASE_URL` — switch to PostgreSQL for production
