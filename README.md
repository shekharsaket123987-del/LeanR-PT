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

## Environment variables

Required for the app to run against its real Supabase backend:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Optional — enables real "Join" links (Zoom) on session cards. Without these set,
Join buttons stay disabled with a "link not ready yet" message rather than
breaking:

```
ZOOM_ACCOUNT_ID=
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=
ZOOM_HOST_EMAIL=
```

To get the Zoom values: in the [Zoom App Marketplace](https://marketplace.zoom.us),
go to **Developer → Build App → Server-to-Server OAuth**, create an app, and grant it
the meeting read + write scopes. `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, and
`ZOOM_CLIENT_SECRET` come from that app's credentials page. `ZOOM_HOST_EMAIL` is the
email of any licensed Zoom user on that account — every meeting is created under
this one account (not per-coach), since coaches only ever need a start link, not
their own Zoom login.

Optional — enables real payment (Razorpay) for package purchases and demo/assessment
session fees. Without these set, "Purchase Plan" / "Select" buttons will fail with a
clear "Razorpay isn't configured yet" error rather than silently charging nothing:

```
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

Get these from the [Razorpay Dashboard](https://dashboard.razorpay.com) → **Settings
→ API Keys**. Start in **Test Mode** (test keys, test card numbers, no real money
moves) and only switch to the Live Mode key pair once you're ready to accept real
payments — nothing else in the code changes, it's purely which key pair is set here.

Set these in Netlify/Vercel's project environment variable settings for
production, or in a local `.env.local` for development.

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
