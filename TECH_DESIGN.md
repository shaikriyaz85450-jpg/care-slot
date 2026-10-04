# CareSlot Technical Design Document

## 1. System Architecture Overview

CareSlot is an MVP for hospital doctor availability and appointment scheduling. It enables patients to view real-time doctor availability and book time slots, doctors to manage their daily status and appointments, and hospital administrators to oversee operations.

### Tech Stack
- **Framework:** Next.js (App Router, React 19)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Backend & Database:** Supabase (PostgreSQL, Auth, Row-Level Security, Realtime)
- **Email Service:** Resend
- **Deployment:** Vercel & Supabase Cloud

---

## 2. Project Directory Structure

```
care-slot/
├── .env.example
├── .env.local
├── design/                      # Visual reference & Stitch design assets
│   └── README.md
├── public/                      # Static assets
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── (auth)/              # Authentication route group
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── signup/
│   │   │       └── page.tsx
│   │   ├── (patient)/           # Patient facing routes
│   │   │   └── appointments/
│   │   │       └── page.tsx
│   │   ├── admin/               # Admin panel
│   │   │   └── page.tsx
│   │   ├── api/                 # API route handlers
│   │   ├── doctor/              # Doctor dashboard
│   │   │   └── dashboard/
│   │   │       └── page.tsx
│   │   ├── doctors/             # Doctor profiles & slot booking
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── favicon.ico
│   │   ├── globals.css          # Tailwind CSS styles
│   │   ├── layout.tsx           # Root layout
│   │   └── page.tsx             # Home / Doctor listing
│   ├── components/
│   │   ├── common/              # Shared components (Navbar, Footer, NotificationBell)
│   │   └── ui/                  # Reusable UI primitives (Button, Card, Badge, Modal, Input)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts        # Browser client (createBrowserClient)
│   │   │   ├── server.ts        # Server client with cookies (createServerClient)
│   │   │   ├── admin.ts         # Service role client for privileged server tasks
│   │   │   └── middleware.ts    # Session refresh & route guard helper
│   │   └── utils.ts             # Utility functions
│   ├── proxy.ts                 # Next.js 16 proxy for session refresh & route guards
│   └── types/
│       ├── database.types.ts    # Supabase generated database types
│       └── index.ts             # Application domain types
├── supabase/
│   └── migrations/              # SQL migration files
├── package.json
├── tsconfig.json
├── PROJECT.md
├── TECH_DESIGN.md
└── PROGRESS.md
```

---

## 3. Data Model & Database Schema

Supabase PostgreSQL schema:

1. **`profiles`**
   - `id`: `uuid primary key references auth.users(id) on delete cascade`
   - `full_name`: `text not null`
   - `phone`: `text`
   - `role`: `text not null check (role in ('patient', 'doctor', 'admin')) default 'patient'`
   - `created_at`: `timestamptz default now()`

2. **`departments`**
   - `id`: `uuid primary key default gen_random_uuid()`
   - `name`: `text not null unique`
   - `description`: `text`
   - `created_at`: `timestamptz default now()`

3. **`doctors`**
   - `id`: `uuid primary key default gen_random_uuid()`
   - `profile_id`: `uuid not null references profiles(id) on delete cascade`
   - `department_id`: `uuid not null references departments(id) on delete restrict`
   - `specialization`: `text not null`
   - `qualification`: `text not null`
   - `experience_years`: `integer not null default 0`
   - `consultation_minutes`: `integer not null default 15`
   - `created_at`: `timestamptz default now()`

4. **`doctor_schedules`**
   - `id`: `uuid primary key default gen_random_uuid()`
   - `doctor_id`: `uuid not null references doctors(id) on delete cascade`
   - `weekday`: `integer not null check (weekday between 0 and 6)`
   - `start_time`: `time not null`
   - `end_time`: `time not null`
   - `created_at`: `timestamptz default now()`

5. **`doctor_daily_status`**
   - `id`: `uuid primary key default gen_random_uuid()`
   - `doctor_id`: `uuid not null references doctors(id) on delete cascade`
   - `date`: `date not null default current_date`
   - `status`: `text not null check (status in ('available', 'delayed', 'on_leave', 'not_checked_in')) default 'not_checked_in'`
   - `delay_minutes`: `integer default 0`
   - `note`: `text`
   - `updated_at`: `timestamptz default now()`
   - Unique on `(doctor_id, date)`

6. **`appointments`**
   - `id`: `uuid primary key default gen_random_uuid()`
   - `patient_id`: `uuid not null references profiles(id) on delete cascade`
   - `doctor_id`: `uuid not null references doctors(id) on delete cascade`
   - `date`: `date not null`
   - `start_time`: `time not null`
   - `end_time`: `time not null`
   - `status`: `text not null check (status in ('booked', 'cancelled', 'completed', 'no_show')) default 'booked'`
   - `reason`: `text`
   - `created_at`: `timestamptz default now()`
   - **Unique partial index / constraint:** `unique (doctor_id, date, start_time) where (status = 'booked')`

7. **`notifications`**
   - `id`: `uuid primary key default gen_random_uuid()`
   - `user_id`: `uuid not null references profiles(id) on delete cascade`
   - `title`: `text not null`
   - `body`: `text not null`
   - `read`: `boolean not null default false`
   - `created_at`: `timestamptz default now()`

---

## 4. Environment Variables

The project requires the following environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL (public)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon/public API key (public)
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase secret service role key (server-only)
- `RESEND_API_KEY`: Resend email provider API key (server-only)

---

## 5. Client & Server Supabase Architecture

- **Browser Client (`src/lib/supabase/client.ts`):**
  Uses `createBrowserClient` from `@supabase/ssr`. Utilized in client components, realtime listeners, and browser-side auth state.
- **Server Client (`src/lib/supabase/server.ts`):**
  Uses `createServerClient` from `@supabase/ssr` with Next.js `cookies()` store from `next/headers`. Utilized in Server Components, Server Actions, and Route Handlers.
- **Admin Client (`src/lib/supabase/admin.ts`):**
  Uses `createClient` from `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS for system operations like automated notifications or admin setup).
- **Middleware Helper (`src/lib/supabase/middleware.ts`):**
  Refreshes auth cookies and manages role-based route access.
- **Proxy (`src/proxy.ts`):**
  Next.js 16 file convention executing before routes to run session updates and route guards.
- **Auth Foundation (`src/lib/auth.ts`):**
  Server-side authentication helpers (`getCurrentUser`, `requireUser`, `requireRole`, `signOutAction`).
