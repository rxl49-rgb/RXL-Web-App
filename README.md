# RXL Logistics – Freight Forwarding & Ecommerce App

A full-stack freight forwarding web application with Shopify-style ecommerce features.

## Architecture

```
RXL-shipping/
├── backend/    # Standalone REST API (Express + TypeScript + Prisma + SQLite)
└── frontend/   # React SPA (Vite + TypeScript + Tailwind CSS)
```

Both are **independent projects** — the API can be consumed by any external app, mobile app, or third-party integration.

---

## Backend API

### Setup

```bash
cd backend
npm install
npm run db:push       # Create SQLite database
npm run db:seed       # Seed demo data
npm run dev           # Start dev server on :5000
```

### API Base URL
`http://localhost:5000/api`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Health check |
| POST | `/auth/register` | — | Register user |
| POST | `/auth/login` | — | Login, returns JWT |
| GET | `/auth/me` | JWT | Get current user |
| PUT | `/auth/me` | JWT | Update profile |
| GET | `/products` | — | List products (filter: `?category=slug&search=q&page=1`) |
| GET | `/products/:id` | — | Product detail |
| GET | `/products/meta/categories` | — | All categories |
| POST | `/products` | Admin | Create product |
| PUT | `/products/:id` | Admin | Update product |
| GET | `/shipments/track/:number` | — | Public tracking |
| GET | `/shipments/mine` | JWT | My shipments |
| POST | `/shipments` | Admin | Create shipment |
| POST | `/shipments/:id/events` | Admin | Add tracking event |
| PATCH | `/shipments/:id/status` | Admin | Update status |
| GET | `/orders/mine` | JWT | My orders |
| POST | `/orders` | JWT | Place order |
| GET | `/orders/:id` | JWT | Order detail |
| GET | `/orders` | Admin | All orders |
| PATCH | `/orders/:id/status` | Admin | Update order status |
| POST | `/quotes/calculate` | — | Calculate shipping quote |
| POST | `/quotes` | JWT | Save a quote |
| GET | `/quotes/mine` | JWT | My quotes |

### Auth
JWT Bearer token — include in header:
```
Authorization: Bearer <token>
```

### Demo Accounts (after seeding)
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rxllogistics.com | admin123 |
| Customer | demo@rxllogistics.com | customer123 |

### Demo Tracking Numbers
- `RXL-2024-AIR-001` — Air freight, In Transit (Miami → London)
- `RXL-2024-SEA-002` — Sea freight, Processing (Kingston → Miami)

---

## Frontend

### Setup

```bash
cd frontend
npm install
npm run dev   # Start dev server on :5173
```

### Pages
| Route | Description |
|-------|-------------|
| `/` | Landing page with hero, services, features |
| `/track` | Package tracker with timeline |
| `/store` | Product catalog with filters |
| `/store/:id` | Product detail page |
| `/cart` | Shopping cart |
| `/checkout` | Multi-step checkout |
| `/order/:id` | Order confirmation |
| `/quote` | Freight quote calculator |
| `/login` | Sign in |
| `/register` | Create account |
| `/dashboard` | Customer dashboard (orders, shipments, profile) |

---

## Production Deployment

**Backend**: Deploy to Railway, Render, or any Node host. Set environment variables:
```env
DATABASE_URL="file:./prod.db"   # or PostgreSQL URL
JWT_SECRET="your-strong-secret"
CLIENT_URL="https://yourfrontend.com"
PORT=5000
```

**Frontend**: Build with `npm run build`, deploy dist/ to Vercel, Netlify, or any static host. Set `VITE_API_URL` if your API is on a different domain.

## Features
- Package tracking with real-time timeline
- Air / Sea / Ground freight quote calculator
- Product store (packaging, insurance, tracking devices, freight services)
- Shopping cart with drawer
- Full checkout flow (card, PayPal, wire transfer)
- Customer dashboard with orders & shipments overview
- JWT authentication (register / login)
- Admin API for managing products, orders, and shipments
- Fully RESTful API — connect any external app
