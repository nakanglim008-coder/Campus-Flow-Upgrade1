# PulsePass

Smart digital exeat/campus movement system — students submit pass requests, admins approve, security scans QR codes at the gate.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied to `/api`)
- `pnpm --filter @workspace/pulsepass run dev` — run the frontend (port 18413, proxied to `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET`, `ADMIN_INVITE_TOKEN`, `SECURITY_INVITE_TOKEN`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite, Wouter router, TanStack Query, Tailwind CSS v4
- API: Express 5 on Node (persistent server)
- DB: PostgreSQL + Drizzle ORM (`drizzle/node-postgres`)
- Auth: JWT in httpOnly cookie (`pulsepass_token`), signed with `SESSION_SECRET`, 30-day expiry
- QR scanning: `html5-qrcode` (camera) + `qrcode.react` (display)
- Netlify deploy: `netlify.toml` + `netlify/functions/api.mts` (uses `@neondatabase/serverless` for edge)

## Where things live

- `lib/db/src/schema/index.ts` — DB schema (users + exeat_requests tables, all enums)
- `artifacts/api-server/src/routes/` — auth.ts, exeats.ts, health.ts
- `artifacts/api-server/src/lib/auth.ts` — JWT sign/verify, requireAuth middleware
- `artifacts/api-server/src/lib/db.ts` — pg Pool + Drizzle client
- `artifacts/pulsepass/src/` — React SPA (pages/, lib/api.ts, lib/auth.tsx)
- `netlify/functions/api.mts` — Netlify serverless function (all API routes combined)
- `netlify.toml` — Netlify build + redirect config

## Architecture decisions

- **No SSR** — pure React SPA; eliminates TanStack Start `createServerFn` React errors entirely
- **JWT cookie auth** — httpOnly, sameSite lax, 30-day expiry; works across proxy boundary without CORS hassle
- **Invite-link signup** — admin/security signup at `/invite/admin/:token` and `/invite/security/:token`; token validated server-side against env vars `ADMIN_INVITE_TOKEN` / `SECURITY_INVITE_TOKEN`; page not linked anywhere public
- **Role guards** — `StudentGuard`, `AdminGuard`, `SecurityGuard` components redirect unauthorized users at the React level
- **Dual DB drivers** — api-server uses `pg` Pool (persistent TCP connection), Netlify functions use `@neondatabase/serverless` (HTTP, serverless-compatible)

## Product

- **Students**: Sign up, submit exeat requests (regular/medical/academic/emergency), track status, view QR pass code
- **Admins**: Review all requests, approve/reject with notes
- **Security officers**: Camera QR scan or manual code entry; tap-to-mark departure/return; view all active passes
- **Emergency exeats** auto-approve immediately

## Invite URLs

Change `ADMIN_INVITE_TOKEN` and `SECURITY_INVITE_TOKEN` env vars to something secret, then share these URLs privately:
- Admin signup: `https://your-domain.com/invite/admin/<ADMIN_INVITE_TOKEN>`
- Security signup: `https://your-domain.com/invite/security/<SECURITY_INVITE_TOKEN>`

## User preferences

- Dark green/black OKLCH theme — primary: oklch(0.62 0.18 150), bg: oklch(0.13 0.02 155)
- "Made by shadow" in footer of every page

## Netlify Deploy

1. Set env vars in Netlify dashboard: `DATABASE_URL` (your Neon DB URL), `SESSION_SECRET`, `ADMIN_INVITE_TOKEN`, `SECURITY_INVITE_TOKEN`
2. Build command: `pnpm install && pnpm --filter @workspace/pulsepass run build`
3. Publish dir: `artifacts/pulsepass/dist`
4. Functions dir: `netlify/functions`

## Gotchas

- `drizzle-kit push` uses `DATABASE_URL` — runs against Replit built-in Postgres in dev, Neon in Netlify prod
- Netlify function at `netlify/functions/api.mts` must use `@neondatabase/serverless` (HTTP driver), NOT `pg` Pool (TCP doesn't work in edge)
- `ADMIN_INVITE_TOKEN` and `SECURITY_INVITE_TOKEN` default to `admin-pulse-2026` / `security-pulse-2026` — change before production

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
