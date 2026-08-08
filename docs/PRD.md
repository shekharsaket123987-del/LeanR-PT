# LEANR by Fitelo — Product Requirements Document (PRD)

> **Version:** 1.0
> **Document snapshot:** 2026-08-01 — reflects the UI/content as currently built in this repo (`src/app`, `src/components`, `src/lib/mock-data.ts`).
> **Companion doc:** [`docs/PROJECT_BLUEPRINT.md`](./PROJECT_BLUEPRINT.md) covers the engineering/architecture side (stack, backend, security, API). This document covers the **product** side: what the site says, how it looks, and what every page/feature does.
> **Scope:** This is a design/UX prototype with a real Supabase schema built alongside it but not yet wired up — see [§8 Implementation Status](#8-implementation-status) for exactly what's real vs. mock today.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Users & Roles](#2-users--roles)
3. [Design System / Theme](#3-design-system--theme)
4. [Site Map](#4-site-map)
5. [Public Website (Landing Page)](#5-public-website-landing-page)
6. [Client Portal](#6-client-portal)
7. [Coach Portal](#7-coach-portal)
8. [Admin Portal](#8-admin-portal)
9. [Data Model](#9-data-model)
10. [Business Rules](#10-business-rules)
11. [Implementation Status](#11-implementation-status)
12. [Out of Scope (Deliberate)](#12-out-of-scope-deliberate)

---

## 1. Product Overview

**Product name:** LEANR (by Fitelo)
**Tagline:** *"Train Live. Anywhere."*
**One-liner (meta description):** "Train live, anywhere. LEANR by Fitelo connects you with certified personal trainers for live 1:1 online coaching, custom programs, and real progress tracking."

**What it is:** A live, online 1:1 personal training platform. A client purchases a session package, is matched with a dedicated coach who stays with them for the full plan, books recurring or one-off live video sessions, and tracks progress over time. Three portals serve three audiences from one codebase:

| Portal | Audience | Core job |
|---|---|---|
| **Client** | The person training | Book sessions, meet their coach live, track progress, manage their plan |
| **Coach** | The trainer | Manage schedule/availability, run sessions, log notes, track assigned clients |
| **Admin** | Fitelo operations staff | Oversee clients/coaches/sessions platform-wide, resolve coach-change requests, configure platform-wide rules, pull reports |

**Brand relationship:** LEANR is presented as a sub-brand/product **"by Fitelo"** — the logo always pairs "LEANR" with a small "By FITELO" lockup (see [§3.5](#35-logo)).

---

## 2. Users & Roles

| Role | How they get an account | What they can do | Where they land |
|---|---|---|---|
| **Client** | Purchases a package (assumed pre-platform or via `createAssessmentBooking` public entry point) | Book/cancel/reschedule sessions, view their coach, track progress, manage profile, view notifications, request a coach change | `/client/dashboard` |
| **Coach** | Onboarded by admin | Set weekly availability, request leave, view/run their schedule, manage assigned clients, log workout notes after a session, edit their public profile | `/coach/dashboard` |
| **Admin** | Internal Fitelo ops account | Full visibility across clients/coaches/sessions, resolve coach-change requests, assign shadow coaches, manage package tiers, configure platform-wide numeric rules, pull reports | `/admin/dashboard` |

Each role has a separate login route (`/login/client`, `/login/coach`, `/login/admin`) and a separate portal shell/navigation — there is no unified "one login, pick your role" flow.

---

## 3. Design System / Theme

### 3.1 Visual identity

The public marketing site (landing page) uses a **dark, high-contrast, editorial** look — black backgrounds, bold italic display type, a single loud accent color. The three **portals** switch to a **light, clean, data-dense** look — white/`#FAFAFA` backgrounds, the same accent color used sparingly for active states and highlights. This split (dark marketing shell → light product shell) is intentional and consistent across every page.

### 3.2 Color palette

Defined in `tailwind.config.ts` under `theme.extend.colors.brand`:

| Token | Hex | Usage |
|---|---|---|
| `brand.black` | `#000000` | Landing page background, primary text on light surfaces, secondary buttons |
| `brand.charcoal` | `#111111` | Body text color (`globals.css` sets it as the default text color) |
| `brand.charcoal2` | `#1A1A1A` | Secondary-button hover state |
| `brand.yellow` | `#F5E400` | **Primary accent** — CTAs, active nav states, ratings/stars, highlights, selection color |
| `brand.yellow2` | `#FFE600` | Primary-button hover state, gradient partner for `brand-gradient-text` utility |
| `#FAFAFA` | — | Light portal/section background (not tokenized, used as a literal) |
| `#FAFAFA` body default | — | `globals.css`: `body { @apply bg-[#FAFAFA] text-[#111111] font-body; }` |

Text-selection color is also branded: `::selection { background: #F5E400; color: #000; }`.

### 3.3 Typography

| Role | Font | Weight(s) loaded | CSS var |
|---|---|---|---|
| **Display** (headings, stat numbers, logo) | Oswald | 500, 600, 700 | `--font-display`, applied via `.text-display` utility (also sets `letter-spacing: -0.01em`) |
| **Body** (paragraphs, UI text) | Manrope | 400, 500, 600, 700, 800 | `--font-body`, applied as the default `font-body` on `<body>` |

Both are loaded via `next/font/google` in `src/app/layout.tsx`, subset to `latin`, with `display: "swap"`.

**Display type convention:** nearly every heading across the site is **bold + italic** (`font-bold italic`) in the Oswald display face — this is the single most repeated typographic pattern in the codebase (headings, stat numbers, pricing, coach names).

### 3.4 Other theme primitives (`tailwind.config.ts`)

| Token | Value | Notes |
|---|---|---|
| `borderRadius.xl` | `1rem` | Cards, buttons |
| `borderRadius.2xl` | `1.25rem` | Larger cards, hero image frame |
| `boxShadow.soft` | `0 4px 24px rgba(0,0,0,0.06)` | Primary buttons, portal cards |
| `boxShadow.card` | `0 2px 12px rgba(0,0,0,0.05)` | Testimonial/coach cards |
| `boxShadow.glow` | `0 0 40px rgba(245,228,0,0.25)` | Hero image frame, highlighted pricing card — the brand-yellow "glow" accent |
| `animation.fade-in` / `slide-up` | 0.5s ease-out | Defined but usage should be audited/extended as needed |

### 3.5 Logo

`src/components/shared/Logo.tsx` — "LEANR" in bold italic display type (yellow on dark surfaces, black on light surfaces), paired with a small stacked "By / FITELO" lockup beside it. The mobile portal top-bar uses a variant where the "R" gets a black text-stroke effect over the yellow fill.

### 3.6 Component primitives (`src/components/ui/`)

| Component | Purpose |
|---|---|
| `Button` | Variants: `primary` (yellow fill), `secondary` (black fill), `outline`, `ghost`, `destructive` (red fill), `destructive-outline` (red outline). Sizes: `sm`/`md`/`lg`. Supports `href` (renders as `Link`), `loading` (spinner), disabled state. |
| `Card` | Generic bordered/rounded container |
| `Badge` | Status pills (used for role badges, session status, etc.) |
| `Modal` | Dialog overlay |
| `ConfirmDialog` | Destructive-action confirmation (cancel/delete flows) |
| `Avatar` | Circular photo with fallback |
| `EmptyState` | "Nothing here yet" placeholder |
| `ProgressRing` | Circular progress indicator (used in Client Progress page) |
| `Skeleton` | Loading placeholder |
| `StatCard` | Dashboard KPI tile |

### 3.7 Imagery & Video

All photography in the current build is **placeholder**: `picsum.photos` (seeded, so images stay stable per entity) and `i.pravatar.cc` for avatars. `next.config.mjs` allowlists `i.pravatar.cc`, `picsum.photos`, and `images.unsplash.com` as remote image domains. **These must be swapped for real photography/asset domains before production launch** (also flagged in `PROJECT_BLUEPRINT.md` §8 Frontend Security Checklist).

The **hero visual is a self-hosted, looping background video** (a coach actively training a client), not a static photo — see [§5.2](#52-hero-herotsx) for the design intent and `public/videos/README.md` for the asset contract, specs, and where to source a properly licensed clip. It degrades gracefully to the existing poster photo if no video file is present, so this is additive, not a hard dependency.

---

## 4. Site Map

```
/                           Landing page (public marketing site)
/login/client               Client login
/login/coach                Coach login
/login/admin                Admin login

/client/dashboard           Client home
/client/sessions            My Sessions (list, past + upcoming)
/client/book                Book a Session (multi-step flow)
/client/coach                My Coach (assigned coach profile)
/client/progress             Progress tracking
/client/notifications        Notifications
/client/profile               Profile & personal/health info

/coach/dashboard             Coach home ("Good to see you, {name}")
/coach/schedule               Schedule (day/week view of sessions)
/coach/clients                Assigned clients list
/coach/clients/[id]            Individual client detail
/coach/availability            Weekly working hours + leave requests
/coach/session/[id]            In-session / session detail view
/coach/profile                  Public-facing coach profile editor

/admin/dashboard                Platform overview (KPIs across clients/coaches/sessions)
/admin/clients                  All clients
/admin/clients/[id]               Individual client detail
/admin/coaches                    All coaches
/admin/coaches/[id]                 Individual coach detail
/admin/sessions                     Master session list, platform-wide
/admin/coach-change-requests        Review/resolve coach-change requests
/admin/reports                      Report exports (5 report types)
/admin/settings                     Platform-wide numeric rules + packages

/not-found                    404 page
```

Every `/client/*`, `/coach/*`, `/admin/*` route is wrapped by that role's `layout.tsx` → shared `PortalShell` (sidebar nav + top identity block + logout).

---

## 5. Public Website (Landing Page)

Single scrollable page (`src/app/page.tsx`) assembling these sections in order. Section anchors (`#how-it-works`, `#coaches`, `#pricing`, `#stories`) are used by the nav for in-page scrolling.

### 5.1 Navbar (`Navbar.tsx`)

- Sticky, dark, blurred background (`bg-black/90 backdrop-blur-md`)
- Left: Logo. Center (desktop): in-page links — *How it Works, Coaches, Pricing, Success Stories*. Right: three login CTAs — *Coach Login* (ghost), *Admin Login* (ghost), *Client Login* (primary/yellow)
- Mobile: hamburger menu with the same links stacked + all three login buttons

### 5.2 Hero (`Hero.tsx`)

- Black background with a soft yellow radial glow in the top-right corner
- Eyebrow badge: **"Live 1:1 Coaching"** (radio-wave icon)
- Headline: **"Train Live. Anywhere."** (second line "Anywhere." in brand yellow)
- Subhead: *"Real coaches. Real-time coaching. LEANR pairs you with a dedicated personal trainer for live online sessions built around your goals — no gym required."*
- Two CTAs: **"Book Your First Session"** (primary, → `/login/client`) and **"Watch How it Works"** (outline, play icon)
- Trust stat row: **120+ Certified Coaches** · **48K+ Sessions Completed** · **4.9★ Average Rating**

**Right side — dynamic video visual (updated):** the static hero photo is now a **looping, autoplaying background video** of a coach actively training a client, framed inside the same rounded/glow card and dressed as a **live video call UI**:

- "LIVE · 24:18" badge with a pulsing red dot (top-left)
- A small self-view thumbnail (bottom-right) and a coach name-card overlay ("Arjun Mehta — Strength & Conditioning", bottom-left)
- A minimal mute/unmute toggle (top-right) — the clip autoplays muted (required by browser autoplay policy) with a real audio track underneath, so a visitor can opt in to sound
- A dark gradient wash for text legibility, same as before

**Why this change:** a moving shot of an actual training session sells the product's core promise — *real-time, energetic, 1:1 coaching* — far more convincingly than a still frame, and reads as noticeably more premium/"alive" above the fold. The video-call chrome (LIVE badge, self-cam, name card) is kept because it's still the clearest visual shorthand for *this is a live 1:1 video session*, now reinforced by actual motion instead of implied by a static photo.

**Resilience:** the video is optional at the asset level — `Hero.tsx` keeps the original poster photo mounted underneath and only cross-fades to the video once it reports `onCanPlay`; if `public/videos/hero-training.mp4` is missing, 404s, or the visitor has `prefers-reduced-motion` set, the component silently falls back to the static poster with zero layout shift and no console-visible breakage. See `public/videos/README.md` for the exact file path, format/length/size guidance, and where to source a properly licensed clip (or self-host via Supabase Storage, consistent with how other media is already handled in this project).

### 5.3 Trust Bar (`TrustBar.tsx`)

Four-stat strip on a white background, just below the hero: **120+ Certified Coaches**, **48,000+ Sessions Completed**, **4.9/5 Average Client Rating**, **100% Certified & Verified**. Reinforces the hero's numbers in a persistent, always-visible band.

### 5.4 How It Works (`HowItWorks.tsx`, `#how-it-works`)

Eyebrow: *"The process"*. Headline: **"How LEANR Works"**. Five numbered steps (large ghost numerals `01`–`05`), each with an icon, title, and one-line description:

1. **Choose Package** — Pick LeanR Advance or a PT Add-on tier that fits your goals.
2. **Choose Coach** — Get matched with a certified coach who stays with you the whole way.
3. **Pick Schedule** — Choose recurring slots that fit your week — as simple or custom as you need.
4. **Join Live Session** — Train 1:1 over live video — real-time form checks, real coaching.
5. **Track Progress** — See your streak, session history, and coach remarks after every workout.

### 5.5 Meet the Coaches (`TrainerCarousel.tsx`, `#coaches`)

Eyebrow: *"Meet the coaches"*. Headline: **"Trainers Who Show Up For You"**. Subcopy: *"Every LEANR coach is certified, background-checked, and stays with you for your entire plan."* Horizontally-scrollable (mobile) / grid (desktop, up to 4 columns) cards showing the first 8 coaches from mock data — action photo, star rating + review count badge, name, specialization, years of experience, and a **"Book with {FirstName}"** CTA per card.

### 5.6 Pricing (`PricingSection.tsx`, `#pricing`)

Light-gray section (`#FAFAFA`). Eyebrow: *"Packages"*. Headline: **"Simple, Honest Pricing"**. Reassurance banner: *"Your assigned coach stays the same for the entire duration of your plan — every package included."* Pricing cards rendered from `packages` mock data (category `advance`/`addon`), each showing: package name, session count, price in ₹ (Indian Rupees, `en-IN` locale formatting) with optional struck-through original price, a feature checklist, and a **"Get Started"** CTA. One package can be flagged `highlighted` — rendered as an inverted (black background) card with a **"Most Popular"** yellow badge and glow shadow.

### 5.7 Success Stories (`Testimonials.tsx`, `#stories`)

Eyebrow: *"Success stories"*. Headline: **"Real Results, Real People"**. Two parts:
1. Three testimonial cards: quote, client photo/name, coach attribution ("Coached by {coach}"), a green result callout (e.g. weight/measurement change), 5-star rating.
2. Three "Before/After" transformation tiles styled as video thumbnails (play-icon overlay) — currently placeholder imagery, no real video wired up.

### 5.8 Footer (`Footer.tsx`)

Black, four-column layout: (1) Logo + one-line brand description + social icons (Instagram/YouTube/Facebook, non-functional placeholders); (2) **Portals** — links to all three logins; (3) **Company** — in-page anchor links; (4) **Get in Touch** — `support@leanr.fitelo.co`, `+91 1800 123 4567`. Bottom bar: copyright (`© 2026 LEANR by Fitelo`) + Privacy Policy / Terms of Service links (currently `#`, no pages built).

---

## 6. Client Portal

Sidebar nav (`PortalShell`, role=`client`): **Dashboard · My Sessions · Book a Session · My Coach · Progress · Notifications · Profile**. Portal badge reads "client Portal". Identity block currently hardcoded to a sample user ("Saket Shekhar", plan "LeanR Advance").

| Page | Title / description shown | Purpose |
|---|---|---|
| **Dashboard** (`/client/dashboard`) | "Welcome back, {FirstName}" — *"Here's where things stand today."* | At-a-glance home: next session, streak, quick stats |
| **My Sessions** (`/client/sessions`) | "My Sessions" — *"Everything you've booked, past and upcoming."* | Full session list/history with status (upcoming/completed/cancelled/missed); cancel/reschedule actions gated by the 12-hour cutoff rule (see [§10](#10-business-rules)) |
| **Book a Session** (`/client/book`) | "Book a Session" — *"A few quick steps and you're on the calendar."* | Multi-step booking flow: pick date/time from available slots → confirm |
| **My Coach** (`/client/coach`) | "My Coach" — *"Your dedicated coach for this plan."* | Assigned coach's profile: bio, specialization, certifications, ratings |
| **Progress** (`/client/progress`) | "Progress" — *"Your journey with LEANR, tracked session by session."* | Session history, streak, progress visualization (`ProgressRing`) |
| **Notifications** (`/client/notifications`) | "Notifications" — *"Booking confirmations, reminders, and feedback requests."* | Notification feed, read/unread state |
| **Profile** (`/client/profile`) | "Profile" — *"Manage your personal and health information."* | Editable profile: contact info, medical notes, equipment, goals |

Other client-facing components: `NextSessionCard` (upcoming-session summary widget, likely used on Dashboard), `FeedbackModal` (post-session rating/feedback capture).

---

## 7. Coach Portal

Sidebar nav: **Dashboard · Schedule · Clients · Availability · Profile**. Portal badge "coach Portal". Sample identity: "Arjun Mehta", "Strength & Conditioning".

| Page | Title / description shown | Purpose |
|---|---|---|
| **Dashboard** (`/coach/dashboard`) | "Good to see you, {FirstName}" — *"Here's your day at a glance."* | Today's sessions, quick stats |
| **Schedule** (`/coach/schedule`) | — | Calendar/list view of the coach's booked sessions |
| **Clients** (`/coach/clients`) | "Clients" — *"{N} clients currently assigned to you."* | Roster of assigned clients |
| **Clients Detail** (`/coach/clients/[id]`) | "{Client Name}" — *"{Package} · Client since {date}"* | Individual client's plan, session history, medical notes, equipment, goals |
| **Availability** (`/coach/availability`) | "Availability" — *"Set your working hours and manage time off."* | Weekly recurring availability windows + leave requests (subject to admin approval) |
| **Session detail** (`/coach/session/[id]`) | — | Per-session view/run screen — logging workout notes/homework, marking attendance |
| **Profile** (`/coach/profile`) | "Profile" — *"How clients see you across LEANR."* | Editable public-facing profile: specialization, bio, certifications, languages |

---

## 8. Admin Portal

Sidebar nav: **Dashboard · Clients · Coaches · Sessions · Coach Change Requests · Reports · Settings**. Portal badge "admin Portal". Sample identity: "Admin", "Operations Team".

| Page | Title / description shown | Purpose |
|---|---|---|
| **Dashboard** (`/admin/dashboard`) | "Overview" — *"Platform performance across clients, coaches, and sessions."* | Platform-wide KPIs (Recharts visualizations) |
| **Clients** (`/admin/clients`) | "Clients" — *"{N} total clients on the platform."* | Full client roster |
| **Clients Detail** (`/admin/clients/[id]`) | — | Full client record, admin-level edit/actions |
| **Coaches** (`/admin/coaches`) | "Coaches" — *"{N} coaches on the platform."* | Full coach roster |
| **Coaches Detail** (`/admin/coaches/[id]`) | — | Full coach record, utilization/rating detail |
| **Sessions** (`/admin/sessions`) | "Sessions" — *"Master list of every session across the platform."* | Platform-wide session log |
| **Coach Change Requests** (`/admin/coach-change-requests`) | "Coach Change Requests" — *"Review and resolve client requests to switch coaches."* | Approve/reject client requests to switch coach; on approve, admin also picks the new coach and the system reassigns active recurring slots + upcoming bookings |
| **Reports** (`/admin/reports`) | "Reports" — *"Export data for finance, ops, and coaching reviews."* | Five report types, listed below |
| **Settings** (`/admin/settings`) | "Settings" — *"Platform-wide rules and package configuration."* | Sliders/inputs for every numeric business rule (cutoffs, durations, thresholds) + package tier management |

### 8.1 Reports catalog (`/admin/reports`)

| Report | Description | Cadence |
|---|---|---|
| Client Report | Full client roster with packages, status, and coach assignments | Updated daily |
| Coach Report | Coach performance, utilization, ratings, and client load | Updated daily |
| Monthly PT Report | Session volume, completion rate, and assessment conversions | Updated monthly |
| Revenue Report | Package sales, add-ons, and revenue breakdown by coach | Updated daily |
| Cancellation / No-Show Report | Cancelled and missed sessions by client and coach | Updated daily |

*(As of this snapshot, report generation/export is prototype UI — no CSV/PDF export wiring confirmed; verify against `admin/reports/page.tsx` implementation before promising this to stakeholders.)*

---

## 9. Data Model

Core entities as currently typed in `src/lib/types.ts` (prototype layer) — these map closely, but not 1:1, to the real Postgres schema in `supabase/migrations/` (see `docs/erd.md` for the authoritative DB-level model).

| Entity | Key fields |
|---|---|
| **Coach** | name, photo, specialization, secondarySpecializations[], yearsExperience, rating, reviewCount, bio, certifications[], languages[], activeClients, utilization, status (`active`/`inactive`/`on-leave`) |
| **Client** | name, photo, email, phone, coachId, packageName, sessionsTotal/Used/Remaining, status (`active`/`inactive`/`paused`), joinedDate, streak, goals[], medicalNotes, equipment[] |
| **Session** | clientId, coachId, date, durationMinutes, type (`assessment`/`regular`), status (`upcoming`/`completed`/`cancelled`/`missed`), remarks, rating, feedback |
| **PackageTier** | name, category (`advance`/`addon`), sessions, price, originalPrice, features[], highlighted |
| **Testimonial** | name, photo, quote, result, coachName |
| **NotificationItem** | title, message, time, type (`booking`/`reminder`/`feedback`/`system`), read |
| **CoachChangeRequest** | clientId, currentCoachId, reason, submittedDate, status (`pending`/`approved`/`rejected`) |

Status vocabularies here are deliberately reused verbatim in the real Postgres enums (`0001_enums.sql`) so no rendering/badge code needs to change once the UI is wired to live data — see `docs/business-rules.md`.

---

## 10. Business Rules

These are product-level rules, already documented at the engineering level in `docs/business-rules.md` and enforced by Postgres functions in the (not-yet-wired) backend. Included here because they directly shape UI behavior (which buttons are enabled, what copy is shown):

| Rule | Default | UI effect |
|---|---|---|
| Cancel/reschedule cutoff | 12 hours before session start | "Cancel"/"Reschedule" disabled inside the window on `/client/sessions` |
| "Join" button window | 10 minutes before session start | Join button on the next-session card enables only inside this window |
| Default regular session length | 45 minutes | Used when building the booking calendar |
| Assessment (first-time intake) session length | 60 minutes | Longer slot reserved for a client's first session |
| Inactivity threshold | 30 days without a completed session | Flags a client as inactive for admin follow-up |
| Temporary slot hold duration | 10 minutes | How long a slot is reserved for a client mid-checkout before it's released back to the pool |

All are admin-editable via `/admin/settings` and, at the data layer, live in a single `system_settings` table (see `PROJECT_BLUEPRINT.md` §4.4).

---

## 11. Implementation Status

| Area | Status |
|---|---|
| Landing page (all sections in §5) | **Built**, content as documented above, static/mock data |
| Hero background video | **Built** (code + graceful fallback) — **asset pending**: drop a real clip at `public/videos/hero-training.mp4` per `public/videos/README.md`; renders the static poster photo until then |
| Three portals' navigation, layout, and page shells | **Built** |
| Login forms | **Built**, calling real Supabase Auth (`signInWithPassword`) — see `PROJECT_BLUEPRINT.md` §7 |
| Portal page content (dashboards, lists, detail pages) | **Built against `mock-data.ts`** — not yet reading from the real Supabase schema/service layer |
| Route protection (session/role check before rendering a portal) | **Not implemented** — see `PROJECT_BLUEPRINT.md` §4.6 |
| Booking, cancellation, reschedule actions | **UI built**, updates local component state only — no persistence yet |
| Admin approve/reject/refund-style actions | **UI built**, local state only |
| Real-time video call | **Not implemented** — hero section's "LIVE" call UI is a static mockup; no video/WebRTC integration in this repo |
| Payments/checkout | **Not implemented** — "Get Started"/"Book Your First Session" CTAs route to login, no payment step |
| Report export (CSV/PDF) | **Not confirmed implemented** — verify in `admin/reports/page.tsx` before committing to stakeholders |
| Real Postgres schema, RLS policies, service layer (Phase 1 backend) | **Built and documented** (`supabase/migrations/`, `src/lib/services/`, `docs/api.md`) but **not connected to any page** |

For the full engineering-level breakdown of what's real vs. mock, see [`PROJECT_BLUEPRINT.md` §4.6 "Known Gaps"](./PROJECT_BLUEPRINT.md#46-known-gaps-vs-this-blueprint).

---

## 12. Out of Scope (Deliberate)

Carried over from `docs/business-rules.md` — these are intentional Phase 1 boundaries, not omissions to silently "fix":

- **No real payments/refunds.** Packages/subscriptions model what was purchased and session balance only; no payment-gateway integration.
- **No automated cron/scheduled jobs.** Missed-session marking and inactivity checks are callable, not scheduled.
- **No email/push/WhatsApp dispatch.** Notification records exist; nothing sends anything yet.
- **No real video calling.** The hero's looping background clip is a marketing asset (ambient b-roll dressed as a live-call UI), **not** a live video call — and "Join Session" buttons in the portals are still UI-only. No WebRTC/video SDK is integrated anywhere in the product.
- **No Privacy Policy / Terms of Service pages** — footer links exist and point to `#`.
- **No social media integration** — footer icons (Instagram/YouTube/Facebook) are static, non-functional.

---

*This PRD describes product content and UX as currently built. Update it whenever a landing-page section, portal page, or piece of copy changes — and cross-check §11/§12 whenever a "not yet implemented" item gets built.*
