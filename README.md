# Hostel Management System

A production-ready Hostel Management System built with **Next.js (Pages Router)**, **Postgres (Neon)**, and **JWT authentication**. Three portals — Admin, Warden, and Student — each with their own login and dashboard.

Payment gateway integration is intentionally **not included** (as requested) — fees are tracked and can be marked "Paid" manually by the admin.

---

## What's included

**Core, fully working:**
- Separate login flows: `/login` (student, with a "Warden Login" button), `/warden/login`, `/admin/login`
- JWT auth stored in an httpOnly cookie, role-based API protection
- Admin: dashboard stats, student CRUD (with photo + ID proof upload stored directly in Postgres as base64), room & hostel management, room allocation/transfer/check-out, fee tracking, attendance marking, complaint assignment & resolution, leave approval, staff/warden management, notifications/circulars
- Warden: dashboard, student list, attendance marking, complaint handling, leave approval, notifications
- Student: profile (editable, with photo upload), fee status (view-only), attendance history, raise/track complaints, apply for leave, view notifications
- Images (profile photos, ID proofs) are stored **directly in the database** as base64 text columns — no external file storage/S3 needed

**Data model ready, but no dedicated UI yet** (you can extend the API pattern already established for these):
- Visitor management (`visitors` table + schema ready)
- Inventory tracking (`inventory` table + schema ready)
- Parent portal
- Biometric/QR gate integration
- SMS/push notifications (in-app notifications work; SMS/push would need a provider like Twilio/FCM wired into the `notifications` insert)

---

## Tech stack

- Next.js 14 (Pages Router) + React 18
- Tailwind CSS
- Postgres via `pg` (works with [Neon](https://neon.tech))
- `jsonwebtoken` + httpOnly cookies for auth
- `bcryptjs` for password hashing

---

## Setup

### 1. Create a Neon Postgres database
Go to [console.neon.tech](https://console.neon.tech), create a project, and copy the connection string (it looks like `postgresql://user:pass@host/dbname?sslmode=require`).

### 2. Configure environment variables
```bash
cp .env.example .env.local
```
Edit `.env.local` and set:
- `DATABASE_URL` — your Neon connection string
- `JWT_SECRET` — any long random string (e.g. `openssl rand -hex 32`)
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — used once by the seed script

### 3. Install dependencies
```bash
npm install
```

### 4. Create the database schema
Run the SQL in `schema.sql` against your Neon database. Easiest way — paste it into the Neon SQL Editor in the console. Or via psql:
```bash
psql "$DATABASE_URL" -f schema.sql
```

### 5. Create your admin account
```bash
npm run seed
```
This prints the admin email/password (defaults to `admin@hostel.com` / `Admin@123` unless overridden in `.env.local`). **Change the password after your first login** by adding a small "change password" feature or updating the `users` table directly.

### 6. Run it
```bash
npm run dev
```
- Students & default landing: `http://localhost:3000/login`
- Warden: `http://localhost:3000/warden/login`
- Admin: `http://localhost:3000/admin/login`

### 7. Deploy
Works on any Node host that supports Next.js (Vercel, Railway, Render, a VPS with `npm run build && npm run start`, etc). Just set `DATABASE_URL` and `JWT_SECRET` as environment variables on the host.

---

## How accounts work

- **Admin** creates warden/staff accounts from `Admin → Staff & Wardens` (choose role "Warden" or "Staff").
- **Admin** creates student accounts from `Admin → Students → + Add Student` (sets their login email/password, optionally allocates a room).
- Students, wardens, and admins log in through their **separate** login pages, but the underlying `/api/auth/login` endpoint checks role — a warden's credentials won't work on `/login` and vice versa.

## Extending

The pattern for every module is the same:
1. Table already exists in `schema.sql` (e.g. `visitors`, `inventory`)
2. Add an API route under `pages/api/admin/...` using `withAuth(handler, ["admin"])` from `lib/auth.js`
3. Add a page under `pages/admin/...` using the `PortalLayout` component and `useAuthGuard` hook — copy any existing admin page (e.g. `pages/admin/fees/index.js`) as a template

## Notes

- Images are stored as base64 data-URLs directly in Postgres `TEXT` columns (`users.image`, `students.id_proof`). This is simple and keeps everything in one database, but base64 is ~33% larger than binary and not ideal for very large files or huge scale — fine for ID photos/proofs.
- Rate limiting, email verification, and password-reset flows are not included — add them if you expose this publicly.
