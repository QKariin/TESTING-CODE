# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server at localhost:3000
npm run build     # Production build
npm run lint      # ESLint check
```

No test suite is configured.

## Architecture Overview

This is a **Next.js 14 App Router** project with two primary user-facing pages:

- `/profile` — User-facing profile page (`src/app/profile/page.tsx`)
- `/dashboard` — Admin dashboard page (`src/app/dashboard/page.tsx`)

### Key Pattern: Legacy Script Architecture

Both pages use a hybrid pattern: React renders the HTML shell, then a large set of **vanilla TypeScript modules** (`src/scripts/`) handle all DOM manipulation and business logic. Functions are explicitly assigned to `window.*` inside `useEffect` so that inline `onclick` handlers in the HTML can call them. This is intentional — do not refactor to React event handlers unless asked.

### State Management

Two separate in-memory state singletons (not React state, not Redux):

- **`src/scripts/profile-state.ts`** — Profile page state (`ProfileState` interface: `isLocked`, `wallet`, `score`, `rank`, `lastWorshipTime`, etc.). Use `getState()` / `setState()` to read/write.
- **`src/scripts/dashboard-state.ts`** — Dashboard state (exported mutable variables + setter functions for `users`, `globalQueue`, `currId`, etc.).

### Database: Supabase

Two Supabase client instances in `src/lib/supabase.ts`:

- **`supabase`** — Anon client, respects RLS. Used client-side.
- **`supabaseAdmin`** — Service role client, bypasses RLS. Used in API routes and server actions only.

Also `src/utils/supabase/client.ts` and `src/utils/supabase/server.ts` for the newer SSR-aware Supabase helpers (used in auth flows).

### Key Database Tables

| Table | Purpose |
|---|---|
| `profiles` | User data — `member_id` (email), `wallet`, `score`, `hierarchy`, `routine`, `parameters` (JSONB) |
| `tasks` | Kneeling/task tracking — `member_id`, `lastWorship`, `kneelCount`, `today kneeling`, `Taskdom_History` (JSON) |
| `messages` | Chat history |

`member_id` is always the user's email. Lookups use `.ilike('member_id', email)` for case-insensitivity.

### API Routes (`src/app/api/`)

All routes use `supabaseAdmin` to bypass RLS. Key routes:

- `POST /api/kneel` — Records a kneeling session, increments `today kneeling` in `tasks`
- `GET /api/kneel-status` — Returns lock state + today's kneeling count (handles UTC midnight reset)
- `POST /api/claim-reward` — Awards coins or merit points to `profiles`, preserves kneeling state in `tasks`
- `GET /api/routine-status` — Reads `profiles.routine` + parses `tasks.Taskdom_History` to check today's upload
- `GET /api/slave-profile` — CRUD for `profiles` table
- `GET /api/dashboard-data` — Aggregated data for admin dashboard

Server Actions live in `src/actions/velo-actions.ts` (marked `'use server'`).

### Kneeling Hours Specifically

`src/scripts/kneeling.ts` drives the kneeling UI. On load it calls `GET /api/kneel-status` which reads `tasks['today kneeling']` from Supabase (reset to 0 if `lastWorship` is from a prior UTC day). After each session `POST /api/kneel` increments the count. The UI renders both a desktop bar (`#deskKneelDailyFill`, `#deskKneelDailyText`) and mobile bar (`#kneelDailyFill`, `#kneelDailyText`). Goal is 8 sessions/day (shows x/8), max display is 24 (shows x/24 with gold glow).

Lock state uses both Supabase (`lastWorship` timestamp) and `localStorage` (`lastWorshipTime`) — the newer of the two wins.

### CSS

Static CSS lives in `public/css/` (loaded via HTML `<link>`) and in `src/css/` (imported by Next.js). Both locations are in use — check both when debugging styles.

### Media Uploads

Bytescale is used for file/image uploads. Account constants (`ACCOUNT_ID`, `API_KEY`) are in `src/scripts/dashboard-state.ts`. Upload logic is in `src/scripts/media.ts` and `src/scripts/mediaSupabase.ts`.

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```
