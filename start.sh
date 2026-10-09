#!/usr/bin/env bash
# RXL Logistics - one-command dev startup
# Runs backend (Express+Prisma, :5001) and frontend (Vite, :5173) together.
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$DIR/backend"
FRONTEND="$DIR/frontend"

echo "==> Checking Node.js..."
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install it first: https://nodejs.org (LTS)"
  exit 1
fi
echo "Node $(node -v), npm $(npm -v)"

echo "==> Backend: installing dependencies..."
cd "$BACKEND"
npm install

echo "==> Backend: syncing database schema..."
npm run db:push
echo "==> Backend: seeding demo data (safe to re-run, uses upserts)..."
npm run db:seed

echo "==> Frontend: installing dependencies..."
cd "$FRONTEND"
npm install

cleanup() {
  echo ""
  echo "==> Shutting down..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> Starting backend on http://localhost:5001 ..."
cd "$BACKEND"
npm run dev > "$DIR/backend.log" 2>&1 &
BACKEND_PID=$!

echo "==> Starting frontend on http://localhost:5173 ..."
cd "$FRONTEND"
npm run dev > "$DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

sleep 3
echo ""
echo "============================================"
echo " Backend:  http://localhost:5001/health"
echo " Frontend: http://localhost:5173"
echo ""
echo " Demo login:  demo@rxllogistics.com / customer123"
echo " Admin login: admin@rxllogistics.com / admin123"
echo " Tracking:    RXL-2024-AIR-001, RXL-2024-SEA-002"
echo ""
echo " Logs: backend.log, frontend.log (in this folder)"
echo " Press Ctrl+C to stop both servers."
echo "============================================"

wait
