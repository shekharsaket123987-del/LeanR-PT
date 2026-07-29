# LEANR by Fitelo — Web App Prototype

A clickable design/UX prototype for LEANR's live online Personal Training platform, built with
Next.js 14 (App Router), TypeScript, Tailwind CSS, and Recharts. Three portals — Client, Coach,
and Admin — each with their own login, navigation, and full mock data so every screen in the spec
is browsable end-to-end.

## Running locally

Requires Node.js 18.18+ and internet access (to install npm packages).

```bash
npm install
npm run dev
```

Then open http://localhost:3000

- Landing page: `/`
- Client login: `/login/client` → any email/password logs you in
- Coach login: `/login/coach`
- Admin login: `/login/admin`

## Deploying

This is a standard Next.js app and deploys cleanly to **Netlify** or **Vercel**:

**Netlify:** Connect this repo (or drag-and-drop after `npm run build`) — a `netlify.toml` is
already included with the `@netlify/plugin-nextjs` plugin configured.

**Vercel:** `vercel deploy` from this directory, or connect the repo in the Vercel dashboard —
zero config needed.

## What's real vs. mock

This is a **design/UX prototype**, not a production build:
- All data (coaches, clients, sessions, revenue, requests) lives in `src/lib/mock-data.ts`
- Login accepts any input and routes by role — there's no real auth/backend
- Buttons like "Save", "Approve", "Refund" update local component state only (no persistence)
- Images are placeholder photography from picsum.photos / pravatar.cc

## Structure

- `src/app/` — routes (App Router): landing, `/login/*`, `/client/*`, `/coach/*`, `/admin/*`
- `src/components/ui/` — shared design-system primitives (Button, Card, Badge, Modal, etc.)
- `src/components/shared/` — portal shell (sidebar/nav), page header, logo
- `src/components/landing/`, `client/`, `coach/`, `admin/` — feature-specific components
- `src/lib/mock-data.ts`, `types.ts`, `utils.ts` — mock data, types, helpers

## Design system

- Colors: black `#000000`, brand yellow `#F5E400`, white, charcoal `#111111`
- Display font: Oswald (bold/italic) · Body font: Manrope
- All primary actions use the yellow accent; destructive actions use red outline + confirmation
