# Sprintboard — The Portal Map / Schedule App

> **This is the agent handoff reference. Read it at the start of every session before doing work.**
> Update the **Session Log** at the bottom when you finish meaningful work. Keep the **Current State** and **Task Board** sections honest — they are the source of truth for "what's done."

---

## 1. North Star

A private, reusable **interactive map + run-of-show (ROS) schedule** app for **The Portal**, an event production company. It is a fork of our public `bbb-map-app`. The client gave us synthetic data from a sample event ("MARTIANS", in Montalcino, Tuscany). Our job:

1. Prove the concept with a working private demo built on their data.
2. Augment the sparse synthetic data and **codify a master schema** so future events plug in without a from-scratch build.
3. Deliver a **schema template** (annotated spreadsheet + data dictionary) that lets the client hand us production data in a known shape.
4. Pitch and stage the **PLUS / Option B** operational features (roles, admin dashboard, calendar sync) behind the MVP.

**Proposal tiers:** Option A — MVP shared view ($2,500, ~10d). Option B — Operational PoC ($5,000, ~20d). See `proposal.md`.

---

## 2. Locked Decisions (from client, 2026-06-15)

| Decision | Choice |
|---|---|
| **Build scope** | **Build toward Option B, ship Option A first** as milestone 1. |
| **Map provider** | **Google Maps** (`@vis.gl/react-google-maps`). Client supplies a billed `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. |
| **Demo hosting** | **Firebase, password-protected** private preview for the Portal team. |
| **Branding** | **Client's real brand assets** — pull from **https://theportal.is** ("Access the Portal" — boutique experiential design firm). Neutral interim theme until final assets confirmed. |
| **Data architecture** | **Remote-first from day 1.** Canonical source = live Google Sheet `1rpmzT4_6NlAOSryN86ROv3mv1Jf4ydColAlk6MrY1zw`. Local KMZ/XLSX archived in `OFFLINE/` (gitignored). |

---

## 3. Pending Inputs From Client (blockers / to chase)

- [ ] **Google Maps API key** (billed, with Maps JavaScript API enabled) → for `.env.local` + Firebase env.
- [ ] **Brand assets**: logo (SVG/PNG), color palette, official event name + typography.
- [ ] Confirm the **real run-of-show vocabulary** we should mirror in synthetic data (department names, role titles, location naming) — or sign off on ours.
- [ ] Confirm the **role taxonomy** for Option B (proposal names: admin, lead, vendor, guest). Any others?
- [ ] Firebase: which account/org owns the deploy, and the desired private URL/password policy.

---

## 4. Current State Snapshot

**Stack:** Next.js 16.1.6, React 19.2.3, TypeScript. Google Maps via `@vis.gl/react-google-maps`. Testing: Vitest (`npm run test`, 24 tests passing). Data parsing: `xlsx`, `jszip`, `fast-xml-parser`.

- 📢 **Canonical Repository:** As of 2026-07-09, this repository (`portal-dev`), branch `main`, is the single source of truth. All other checkouts are read-only. **HUMAN-VERIFY:** Confirm that no unmerged work remains on any other machine, and run `git pull` on them to discard local divergence.

**What exists and works:**
- `src/components/event/*` — modular frontend architecture (`EventApp.tsx`, `MapView.tsx`, `ScheduleGrid.tsx`, `CalendarView.tsx`, `NowNext.tsx`, `Legend.tsx`, `Toasts.tsx`, `FilterBar.tsx`, `EventModal.tsx`) with dark/light themes, countdown badges, time axis indicator, and mobile pinch-to-zoom / bottom drawers.
- `src/lib/festival-data.ts` — server loader: reads remote Google Sheet tabs (`Locations`/`Personnel`/`Departments`/`ROS`) via OAuth API with public CSV fallback.
- `/admin` & `/admin/health` — password & OAuth role-gated admin portal and live data-health system monitor (`src/app/admin/health/page.tsx`). Admin pin CRUD persisted to Firebase RTDB (`admin-data/entries`) with disk fallback.
- `scripts/PortalSyncScript.js` — secretless Google Apps Script engine (OAuth JWT bearer tokens) featuring procedural two-level MD5 hashing, atomic upsert/prune state machine, RTDB metadata persistence, and idempotent email onboarding.
- **PWA & Offline & Agendas:** Service worker (`public/sw.js`), IndexedDB snapshot cache (`src/lib/offline-cache.ts`), starred agendas synced to Firebase RTDB (`/user-data/$email/starred`), and deep-linkable URL parameters (`src/lib/url-state.ts`).

**Data work completed (remote sheet `1rpmzT4…`):**
- ✅ Added **`Locations`** tab (24 rows): id, name, aliases, category, foh_boh_default, lat/lng (synthetic), capacity, notes.
- ✅ Added **`Personnel`** tab (23 rows): synthetic people + vendor teams (Cosimo, ALMA, ZANU, Sebach, …) with role/dept/org/type/email/phone/visibility.
- ✅ Generated **`ROS`** structured tab (91 rows) from the `ROS BY AREA` grid — every row mapped to a `location_id`, 64 with a parsed `lead_point_person`, times parsed from entry text.
- ✅ Schema + production-data template documented in `schema-template/README.md` (+ `.csv` files). `.env.example` written.

**Still open / to fix (Sprint 4 & Client Inputs):**
- 🟢 **Remote data fetching:** Google Sheets API + CSV fallback fully active.
- 🟢 **Component refactoring & Naming:** `festival-map-app.tsx` decomposed into modular `src/components/event/*` components.
- 🟢 **Tests & CI:** Vitest suite (6 files, 24 tests passing) + GitHub Actions CI workflow.
- 🟠 **Google My Map is private** (`/edit` link) → KML export 403s. `Locations` lat/lng are synthetic until real coords arrive or map is shared "anyone with link can view."
- 🔵 **Pending Sprint 4 Features:** `.ics` calendar feeds (`/api/ics`), vendor magic links (`/api/vendor`), standalone sheet linter (`schema-lint.ts`), and pitch PDF assets.

---

## 5. Recommended Master Schema (PoC → production template)

Goal: keep the way the client already works (the `ROS by TIME` columns are the backbone), add a handful of keys that make events map- and role-aware, and normalize lookups into their own tabs.

### Tab `ROS` (one row per schedule item) — canonical keys
| Key | Source / status | Notes |
|---|---|---|
| `event_id` | **new** | Stable slug/UUID. Lets edits + calendar sync be idempotent. |
| `start_date`, `end_date` | existing | ISO `YYYY-MM-DD`. |
| `start_time`, `end_time`, `duration` | existing | 24h `HH:MM`; duration derived if blank. |
| `location` | existing (empty) | FK → `Locations.name`. **Must be populated** for map matching. |
| `foh_boh` | existing (empty) | Front/Back of House — drives default visibility (BOH = crew-only). |
| `action` | existing (empty) | Short title / category. Becomes the event card title. |
| `description` | existing (filled) | Free text. |
| `event_type` | **new** | Controlled vocab mapped to app `EventType` (music, performance, food, services, venue, community…). |
| `lead_dept` | existing (empty) | FK → `Departments`. |
| `lead_point_person` | existing (empty) | FK → `Contacts`. |
| `support_dept_1/2`, `support_person_1/2` | existing (empty) | FKs. |
| `location_manager` | existing (empty) | FK → `Contacts`. |
| `notes` | existing (empty) | Internal notes. |
| `visibility` | **new (Option B)** | Role tags, e.g. `admin,lead,vendor,guest` or `public`. Gates row per role. |
| `status` | **new** | `confirmed / tentative / cancelled`. |

### Tab `Locations` (new — the "Locations index" from the proposal)
`location_id`, `name`, `aliases` (pipe-separated, feeds matcher), `category` (Hotel/Forest/Transport/Crew/Venue/Service…), `lat`, `lng`, `kmz_placemark_name`, `foh_boh_default`, `capacity`, `notes`.

### Tab `Departments` (new)
`dept_id`, `name`, `lead_contact_id`, `color` (drives map/legend accent).

### Tab `Contacts` (new — feeds Contacts Directory PLUS feature)
`contact_id`, `name`, `role`, `dept_id`, `email`, `phone`, `org`, `type` (crew/vendor/guest/artist), `visibility`.

### Tab `Roles` (new — Option B access model)
`role`, `label`, `visible_depts`, `visible_categories`, `visible_foh_boh`, `can_edit`.

> **Deliverable:** an annotated `.xlsx` template encoding these tabs with locked headers, dropdown validations (event_type, status, foh_boh, role), and a `README` / data-dictionary tab. This is what the client fills for future events.

---

## 6. Task Board (check off as completed; keep in sync with reality)

### M0 — Unbreak + foundation
- [x] Fix data-source mismatch: point loader at `ROS_VVEX.xlsx` (and decide canonical filename); make KMZ/XLSX paths config-driven, not hardcoded.
- [x] Add `.env.example` documenting `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and the admin password var.
- [x] `npm install`, confirm `npm run dev` + `npm run build` clean. Get the map rendering with current data.
- [x] Add a minimal smoke test for `getFestivalData()` (counts, no throw) + wire `npm run lint`/`build` as the CI gate.

### M1 — Option A MVP (first shippable milestone)
- [x] Populate synthetic structured data so the map+schedule is fully demonstrable (see M2 — they overlap; M1 needs *enough* data to look real).
- [x] Verify location→placemark matching works once `location` + `Locations` aliases exist.
- [x] Read/merge `ROS BY AREA` grid OR confirm `ROS by TIME` is the single source; reconcile the two.
- [x] Interim neutral Portal theming (rename "festival" surface labels; remove BBB-specific copy).
- [x] Deploy password-protected private preview to Firebase; share link with Portal team for the test event.
- [x] **Gate:** Portal team can open the demo, see the MARTIANS event on the map with a filterable schedule.

### M2 — Synthetic data + schema codification
- [x] Author the master schema tabs (Section 5) as real data: fill `Locations` from the 11 KMZ placemarks + ROS BY AREA areas; invent plausible `Departments`, `Contacts`, point persons, FOH/BOH, event_types for the 517 rows.
- [x] Build the **annotated XLSX template** (locked headers, dropdowns, data-dictionary tab).
- [x] Update `festival-data.ts` to read the new tabs (Locations/Departments/Contacts) instead of inferring everything from free text.
- [x] Document the schema + "how to give us production data" guide.

### M3 — Option B operational (PLUS features, pitched + staged)
- [x] Role-based auth (admin / lead / vendor / guest) replacing the single shared cookie (OAuth credentials configured, fixing redirect logic for reverse proxy / dev envs).
- [x] Reusable schema template proven by loading a *second* synthetic event end-to-end.
- [x] Deprecate Approved Emails tab and consolidate access checks to Personnel sheet.
- [x] Integrate passwordless admin page auth with SSR environment fallback (ADMIN_EMAILS) and top-bar profile action button.
- [x] Optimize print stylesheet to pack schedule days compactly, scale columns, and remove blank trailing overflow pages.
- [x] Day-of-Show Dashboard view (Now/Next happening now & upcoming events).
- [x] Starred Personal Agenda items with Realtime Database sync and offline localStorage fallback.
- [x] Programmatic Map focused pan & zoom coordinate synchronization from event cards.
- [x] Map pin legend overlay with permanence visibility toggle filtering.
- [x] Live countdown duration badges on event cards in timeline lists and grids.
- [x] Realtime update change notifications toasted warning alerts.
- [x] Calendar current time indicator line overlay with today auto-scrolling.
- [x] PWA offline caching manifest.json and sw.js service worker.
- [x] Procedural two-level MD5 hashing & atomic upsert/prune state machine for Google Calendar sync (eliminating event duplicates & purging deleted rows).
- [x] Firebase RTDB metadata registry persistence for calendar sync state (`crew-data/metadata/calendar-events`).
- [x] Idempotent onboarding invite sequence preventing duplicate email delivery.
- [x] Verification suite with Vitest unit tests (24/24 passing), clean lint checks, and successful Next.js production compiles.

### M4 — Productization & Option B Milestone (Sprint 4 Priorities)
- [x] Finalize the full written proposal with PLUS features pitched and pricing tiers.
- [x] DataProvider seam abstraction (`RtdbProvider`, `SheetsProvider`, `CsvProvider`) + refactor `festival-data.ts` to `event-data.ts`.
- [x] Standalone Sheet Linter (`src/lib/schema-lint.ts`) with validation report UI in Admin Health Panel (`/admin/health`).
- [x] Tokenized `.ics` calendar export & subscription feed endpoint (`src/app/api/ics/`).
- [x] Vendor magic links (`src/app/api/vendor/` & `/vendor?token=...`) for read-only single-person views.
- [x] Lock event timezone strictly to PDT (`America/Los_Angeles` / Black Rock City, Nevada) across Apps Script, header banner badges, and `.ics` feeds.
- [x] UI/UX design pass, custom component library, and aesthetic theme integration across all views.
- [ ] Role scoping & runtime filter policy UI (`Roles` tab → runtime filter & row-level visibility gating).
- [ ] Pitch PDF & one-pager asset generator (`reports/pitch/`).
- [ ] Two rounds of revision buffer (per proposal scope) + minor RFE handling.

### M5 — Security Hardening, Admin Polish & Pre-Launch (Sprint 5 Priorities)
- [x] **High-Entropy Cryptographic Vendor Tokens (Priority #1):** Replace plain department string tokens (`?token=Lighting`) with 128-bit unguessable tokens (`v_7f9a2b...`) generated via Crypto API (`src/components/admin/MagicLinkGenerator.tsx`).
- [x] **Private Sheet Access & Direct Auth Guard:** Update `database.rules.json` to allow `.read: true` for `/public-data` and enforce direct authenticated Firebase RTDB / Service Account API access for private sheets without fallback to synthetic stubs.
- [ ] **Google Maps API Key Referrer Restrictions:** Restrict `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in Google Cloud Console to authorized domain patterns (`https://*.theportal.is/*`, `https://*.web.app/*`, `http://localhost:3000/*`).
- [ ] **CLIENT COMMUNICATION FLAG (Firebase Blaze Plan Upgrade):** Flag client requirement to upgrade GCP project to Firebase Blaze (Pay-as-you-go) before deploying an event with >100 concurrent on-site sockets.
- [x] **Admin Health Linter Filtering:** Added interactive severityFilter state and clickable summary badges (**Errors**, **Warnings**, **Info**) in `/admin/health` to filter issue list by severity.
- [x] **Admin Locations Pin Editing & Delete Safety Warnings:** Added alert protection dialogs for Google Sheet locations in `/admin` location table, warning that deletions must be performed directly in Google Sheet and providing guidance for editing pin coordinates.
- [x] **Pre-populated Department Dropdown for Magic Links:** Replaced raw text input on `/admin/magic-links` with a select dropdown pre-populated with active departments loaded from the Google Sheet `Departments` tab.
- [ ] **Role Visibility & Public Gating Audit:** Audit public role views (`/public-data`) to ensure events mapped to internal departments (`Electricity`, `BOH`) remain invisible to unauthenticated public logins.

---

## 7. Deliverables Checklist
- [x] Working private demo (Firebase) on the MARTIANS dataset.
- [x] Augmented synthetic dataset (`ROS_VVEX.xlsx` filled + new tabs).
- [x] Master schema recommendation (this doc, Section 5) + annotated XLSX template + data dictionary.
- [x] Production-data intake guide.
- [ ] Updated full proposal (Option A + Option B).

---

## 7b. Services, keys & accounts to provision
Tracked here so we know what to stand up vs. what the client owns. Env var names live in `.env.example`.

| Service | Purpose | Auth / key | Owner |
|---|---|---|---|
| **Google Maps Platform** | Map rendering | Billed API key, Maps JavaScript API enabled, restricted to demo domains → `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Client (billed) |
| **Google Sheets API** | App reads `Locations`/`Personnel`/`ROS`; one-time tab pushes | **Service account** (recommended): GCP project → enable Sheets API → service account + JSON key → **share sheet as Editor with the SA email**. Vars: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`. (API key alone = read-only; writes need SA or OAuth.) | Us (project), client shares sheet |
| **Google My Maps** | Real `Locations` coordinates | Set map to "anyone with link can view" → KML export `…/maps/d/kml?mid=<MID>&forcekml=1` (`GOOGLE_MY_MAP_MID`) | Client (sharing) |
| **Firebase** | Password-protected demo hosting | Project + env vars + deployment protection | Decide ownership (sprintboard §3) |
| **Auth (Option B)** | Role-based access (admin/lead/vendor/guest) | NextAuth/Auth.js or Clerk; replaces single-password gate | Us |
| **Calendar (Option B)** | `.ics` export / subscription | Per-person/role feed token | Us |

> Sheets API enablement steps (service account) were provided to the client; setup deferred — meanwhile the app can read via the public CSV export.

## 8. Risks / Watchouts
- **Google billing**: demo depends on a client-supplied key; budget a guard against quota overrun (restrict key to demo domains).
- **Synthetic ≠ real shape**: our invented departments/roles may not match the client's real org. Get sign-off (Section 3) before hard-coding vocab.
- **Two ROS sheets** (`by TIME` vs `BY AREA`) may diverge; pick `by TIME` as canonical and treat `BY AREA` as a derived view.
- **Large monolith**: `festival-map-app.tsx` is ~2,880 lines — change surgically, avoid broad rewrites in early milestones.
- **Privacy**: it's a private internal tool — never commit real contact data; keep the demo password-gated.

---

## 9. Glossary
- **ROS** — Run of Show (the master event schedule).
- **FOH / BOH** — Front / Back of House (guest-facing vs crew/operational).
- **Placemark** — a point in the KMZ/Google My Maps map.
- **Venue** — app's internal term for a mapped location (derived from placemarks).

---

## 10. Session Log
> Append newest at top. Format: `YYYY-MM-DD — who — what changed / decided / discovered`.

- **2026-08-04 — agent — Updated `onShowOnMap` in `src/components/event/EventApp.tsx` and controlled collapse state in `src/components/event/Legend.tsx`: clicking 'Show on Map' from Schedule Grid or Spatial Calendar closes EventModal (`setModalEvent(null)`) and auto-collapses Map Explorer (`isLegendCollapsed = true`), ensuring the map pin and venue InfoWindow are completely unobstructed. Verified 33/33 Vitest unit tests and Next.js 16 build passing.**

- **2026-08-04 — agent — Optimized `useAuthProfile.ts` dependency arrays to use primitive values (`initialSession?.email`, `initialSession?.role`) instead of inline object references. Eliminated redundant `GET /api/auth/firebase-token` requests on component re-renders. Verified 33/33 Vitest unit tests and Next.js 16 build passing.**

- **2026-08-04 — agent — Reverted temporary 0-event RTDB fallback check in `src/lib/event-data.ts` to ensure authentic Firebase RTDB state reporting without masking sync status. Verified Google Sheet tab title matching (`ROS by Time ` with trailing spaces), header row auto-detection (Row 1, 2, or 3), and column aliases (`Loaction`, `Lead Dept`, `Lead Person`). Verified 33/33 Vitest unit tests and Next.js 16 build passing. Pushes restricted per explicit user instruction.**

- **2026-08-03 — agent — Enabled inclusive 'All Departments' master schedule magic links and iCal calendar subscriptions in `MagicLinkGenerator.tsx`, `/api/vendor`, `/api/ics`, and `ics.test.ts`. Selecting 'All Departments' generates a single magic link (`/vendor?token=All%20Departments`) and iCal subscription feed (`/api/ics?token=...&dept=All%20Departments`) scoped to all schedule events across all departments without filtering. Added inclusive token wildcard detection (`all`, `alldepartments`, `*`, `everyone`, `master`, `inclusive`) and dynamic calendar title formatting (`The Portal - Master Schedule (All Departments)`). Verified 33/33 Vitest unit tests, clean lint checks, and Next.js 16 build passing.**

- **2026-08-03 — agent — Fixed Apple Calendar (.ics) import error in `src/app/api/ics/route.ts` and `src/lib/__tests__/ics.test.ts`. Added RFC 5545-compliant 24-hour timestamp parser (`parseTimeToIcalFormat`) and text escaper (`escapeIcalText`), converting 12-hour AM/PM string formats (`"10:00 AM"`, `"2:30 PM"`) into standard `YYYYMMDDTHHMMSS` timestamps (`20260824T100000`, `20260824T143000`). Merged and pushed to `main` and `portal-production`. Verified 32/32 Vitest unit tests and Next.js 16 build passing.**

- **2026-08-03 — agent — Fixed RTDB sync reset issue on vendor magic links in `src/hooks/useEventData.ts` and `src/components/event/EventApp.tsx`. Added `skipRtdbSync: !!vendorScope` flag so client-side Realtime Database listeners (`/public-data`) do not overwrite the token-scoped vendor schedule dataset with general public data on page mount. Verified 31/31 Vitest unit tests and Next.js 16 build passing.**

- **2026-08-03 — agent — Resolved vendor token event matching across `/api/vendor` and `/api/ics`. Implemented smart wildcard detection for "All Departments" tokens, bidirectional substring matching (`q.includes(eDept)` and `eDept.includes(q)`), and tokenized word matching across `department`, `leadPointPerson`, `title`, `description`, `host`, `scheduleCategory`, `action`, and `locationName`. Verified 31/31 Vitest unit tests and Next.js 16 build passing.**

- **2026-08-03 — agent — Upgraded Vendor Schedule Magic Link View (`/vendor?token=...`) in `src/app/vendor/page.tsx`, `src/app/api/vendor/route.ts`, and `src/components/event/EventApp.tsx`. Replaced text list with the full interactive app interface (Spatial Calendar, Schedule Grid with day section headers and time slots, Now & Next, Interactive Map with venue pin inspectors, Event Modal, Theme selector, and one-click `.ics` calendar subscription button) pre-scoped to the vendor's assigned shifts. Verified 31/31 Vitest unit tests and Next.js 16 build passing.**

- **2026-08-03 — agent — Fixed vendor schedule magic link (`/vendor?token=...`) and iCal subscription feed (`/api/ics?token=...`) event matching in `src/app/api/vendor/route.ts` and `src/app/api/ics/route.ts`. Updated `getFestivalData` call from `"public"` to `"crew"` so BOH vendor shifts (e.g. `Heavy Equipment`, `Catering`, `Audio`) are preserved rather than filtered out by public FOH visibility gating. Expanded event attribute matching across `department`, `leadPointPerson`, `title`, `description`, `host`, and `scheduleCategory`. Verified 31/31 Vitest unit tests and Next.js 16 build passing.**

- **2026-08-03 — agent — Fixed Admin Panel navigation & sub-route authorization in `src/proxy.ts` and `src/lib/auth.ts`. Added fallback lookup to `getUserRoleFromPersonnel` when evaluating Google OAuth session cookies in middleware and API endpoints, allowing authenticated admin users to seamlessly navigate between Locations (`/admin`), Magic Links (`/admin/magic-links`), and Data Health (`/admin/health`) without getting redirected to `/` or `/admin/login`. Verified 31/31 Vitest unit tests and Next.js 16 build passing.**

- **2026-08-02 — agent — Fixed Admin Locations map starting view on fresh load in `src/components/admin/locations-dashboard.tsx`. Matched `MapView.tsx` camera center resolution (`mappableVenue` -> `mappableEntry` -> `MAP_CENTER` `{ lat: 40.7864, lng: -119.2065 }`) and default zoom level (`MAP_DEFAULT_ZOOM = 13`), ensuring all map pins load immediately in frame on fresh page loads. Verified 31/31 Vitest unit tests, clean lint checks, and Next.js 16 build passing.**

- **2026-08-02 — agent — Enabled seamless date & scroll position synchronization when toggling between Schedule Grid and Spatial Calendar views in `src/components/event/EventApp.tsx`. Unified view-focusing effect so switching tabs automatically positions the target view to the exact date (and time offset) the user was viewing in the previous tab, keeping Schedule and Calendar navigation in sync. Verified 31/31 Vitest unit tests, clean lint, and Next.js 16 build passing.**

- **2026-08-02 — agent — Preserved navigation & viewing date position on filter changes across Schedule Grid and Spatial Calendar views in `src/components/event/EventApp.tsx`, `src/components/event/ScheduleGrid.tsx`, and `src/components/event/CalendarView.tsx`. Added `data-date` markers to day section wrappers, passive container scroll tracking (`getActiveViewingDate`), and filter restoration effects (`findClosestDate`) so changing search, location, department, action, lead, or time filters maintains the user's scroll position at their active viewing date (or nearest available matching date) rather than jumping to the top of the schedule. Verified 31/31 Vitest unit tests, clean lint, and Next.js 16 production build passing.**

- **2026-08-02 — agent — Streamlined Admin Panel Single Sign-On across `src/proxy.ts`, `src/lib/auth.ts`, `src/app/api/admin-entries/route.ts`, `src/app/api/admin/approved-emails/route.ts`, `src/app/api/admin/health/route.ts`, and `src/app/api/admin/vendor-tokens/route.ts`. Users logged in via OAuth with `admin` role or listed in `ADMIN_EMAILS` now access `/admin` and all admin endpoints seamlessly without password re-entry. Non-admin users see no Admin Panel button, and manual navigation redirects to `/admin/login`. Direct password login (`admin_access` cookie) remains active as a dev/debugging fallback. Verified 31/31 Vitest unit tests, clean lint, and Next.js 16 build passing.**

- **2026-08-02 — agent — Gated environment chip (`PROD (Local)` / `DEV (Local)`), RTDB source connection label (`banner-source-label`), and bottom debug footer (`portal-debug-footer`) in `src/components/event/EventApp.tsx` strictly to accounts with `role === "admin"`. Normal users, crew members, and vendor pass holders now see a clean header with brand mark, title, and event eyebrow. Verified 31/31 Vitest unit tests, clean lint, and Next.js 16 build passing.**

- **2026-08-02 — agent — Added contextual view navigation buttons to `EventModal.tsx` and `EventApp.tsx`. When viewing from Spatial Calendar (`mainTab === "calendar"`), the modal renders a `Show on Schedule` action button (navigating to Schedule Grid, filtering location/day, and scrolling to row). When viewing from Schedule Grid, Map, or Now/Next, the modal renders `Show on Calendar` (navigating to Spatial Calendar with location/day filters applied). Styled `.show-on-schedule-btn` in `src/app/globals.css`. Verified 31/31 Vitest unit tests, clean lint, and Next.js 16 build passing.**

- **2026-08-02 — agent — Enhanced Map InfoWindow popups & EventModal navigation in `src/components/event/MapView.tsx`, `src/components/event/EventModal.tsx`, `src/components/event/EventApp.tsx`, and `src/app/globals.css`. Added map background click listener (`setActiveVenue(null)`), styled Google Maps popup container (`.gm-style-iw-c`) and close button (`button.gm-ui-hover-effect`) to inherit active theme colors with high contrast, added expandable location descriptions (`Read more`), added date divider headers (`inset-date-divider`) inside the scrolling event menu, hardened case-insensitive location filtering, and added `View on Calendar` navigation buttons in both Map InfoWindow and EventModal. Verified 31/31 Vitest unit tests, clean lint, and Next.js 16 build passing.**

- **2026-08-02 — agent — Redesigned Map InfoWindow location popup in `src/components/event/MapView.tsx` and `src/app/globals.css`. Replaced generic `Upcoming Today` list with a full-featured `Next Event` highlight card (featuring date badges, time, title, action/department tags, and modal click handler) and an inset scrollable list (`infowindow-inset-scroll`) displaying all remaining location events with date badges (`Mon Aug 24`). Respects `hideUnscheduled` filter settings and dynamic event timestamps. Verified 31/31 Vitest unit tests, clean lint, and Next.js 16 build passing.**

- **2026-08-02 — agent — Implemented `hideUnscheduled` filter state (`true` by default) in `src/hooks/useFilters.ts` to suppress date-unassigned TBD events (`scheduleDate` missing or `Date TBD`) across Schedule Grid, Running Schedule, and Now & Next view while preserving date-assigned all-day/TBD events on their respective day columns. Added interactive `Date TBD: Hidden / Shown` toggle button, active filter chip, and `Clear All Filters` reset handler in `src/components/event/FilterBar.tsx` and `src/components/event/EventApp.tsx`. Added unit tests in `src/lib/__tests__/filters-semantics.test.tsx` (all 31 Vitest unit tests, clean lint, and Next.js 16 build passing).**

- **2026-08-02 — agent — Replaced static preset department array in `MagicLinkGenerator.tsx` with dynamic department loading from master Google Sheet via new `/api/departments` route. Built custom multi-select dropdown UI with toggleable checkboxes, Select All / Clear actions, and active department filter chips. Updated `/api/vendor` and `/api/ics` endpoints to support combinatorial multi-department filtering (`token=Dept1,Dept2`) and wired 128-bit cryptographic token generator persistence to Firebase RTDB via `/api/admin/vendor-tokens`. All 30 Vitest unit tests and Next.js 16 build passing.**
- **2026-08-02 — agent — Fixed search field & filter query text theme color inheritance in `src/app/globals.css` and `src/app/admin/admin.css`. Enforced explicit `color: var(--ink)` and `color-scheme` preferences (`light` for Desert Letterpress, `dark` for Playa Noir / Dusk Rose) across `.legacy-search`, `.legend-search-input`, `.admin-input`, select dropdowns, and datetime pickers. Styled input placeholders (`::placeholder`) with `var(--muted)` so search and filter text remains clearly legible across all themes. Verified clean lint checks, 30/30 Vitest tests, and Next.js production build.**
- **2026-08-02 — agent — Implemented Canonical Entity & Alias Resolution Engine across `src/lib/event-mapper.ts`, `src/lib/event-data.ts`, and `src/types/festival.ts`. Schedule references in `ROS by TIME` now resolve aliases to canonical names for Locations, Departments, Personnel, and Actions, inheriting spatial coordinates without creating duplicate fallback venues. Hardened `CONFIG.APP_URL` in `scripts/PortalSyncScript.js` to normalize missing `https://` schemes. Created `src/lib/__tests__/alias-resolution.test.ts` (all 29 Vitest tests and Next.js 16 build passing).**
- **2026-08-01 — agent — Hardened Google Apps Script (`scripts/PortalSyncScript.js`): passed `{ sendNotifications: false }` across all `Calendar.Acl.insert` calls to completely suppress automated Google Calendar 'Accept your invitation to join shared calendar' emails. Deduplicated onboarding email subscription links. All 27 Vitest unit tests passing.**
- **2026-08-01 — agent — Updated System Design & Architecture Schema document (`system_design_schema.md`): reformatted Mermaid diagrams to horizontal `LR` flow with clean node titles, and added detailed explanation of 4-tier architectural separation (CMS Ingestion, Realtime Database, Next.js Server, Client PWA).**
- **2026-07-31 — agent — Enhanced Calendar Grid rendering & color system: added HSL hash fallback palette generator in `getColorStyle` (`src/components/event/EventApp.tsx`) so all custom/unlisted departments and locations render vibrant color-coded cards in dark/light themes. Sanitized event titles in `CalendarView.tsx` by stripping orphaned leading/trailing dashes (`-`). Enforced minimum card height (`44px`) and fixed `line-height` on `.event-card-time` / `.event-card-title` in `src/app/globals.css` to eliminate font clipping at top of cells. Verified 27/27 Vitest unit tests passing.**
- **2026-07-30 — agent — Added `env-cmd` dev dependency and `dev:portal` script to `package.json` for running local dev server with `.env.local.portal` environment config.**
- **2026-07-29 — agent — Fixed role resolution race condition causing admin accounts (juliavved@gmail.com, admin@vvexstudio.com) to log in with 'crew' role. Added direct fallback checks to Personnel sheet and ADMIN_EMAILS in `src/lib/auth.ts`, `src/app/api/auth/callback/route.ts`, `src/app/page.tsx`, and `src/app/api/auth/firebase-token/route.ts`. Ensured session cookies and custom claims correctly assign 'admin' role regardless of Firebase RTDB sync delays. Verified all 27 unit tests and Next.js 16 build passing.**
- **2026-07-29 — agent — Provisioned production deployment infrastructure: created `.firebaserc`, `firebase.json`, and `.github/workflows/deploy-production.yml` for client production deploys from `portal-production` branch. Expanded Phase 5 of `reports/client-setup-plan.md` with complete step-by-step walkthrough covering git branch setup, GCP/Firebase credentials, GitHub Environment secrets, and production domain binding.**
- **2026-07-28 — agent — Authored comprehensive step-by-step client Google Workspace, GCP, Firebase Blaze, and Apps Script migration plan (reports/client-setup-plan.md) detailing all human-in-the-loop setup steps, OAuth credentials, service account configuration, domain restrictions, script properties, and handoff smoke testing.**
- **2026-07-27 — agent — Resolved map pin rendering issue for Google Sheet locations. Fixed missing category/permanence property assignment in `createVenueFromNewSheetRow` (`src/lib/event-mapper.ts`) and defaulted unassigned venue categories to 'Standard' in `src/components/event/MapView.tsx` and `src/components/event/EventApp.tsx`. All mapped locations (Le Salon, LLL, Playa, Reno, Solaris, Storage, test2) now render correctly on the map and in the legend. Verified 27/27 Vitest unit tests and Next.js production build (`npm run build`) passing cleanly.**
- **2026-07-26 — agent — Completely eliminated legacy 'guest' role and hardened public event visibility gating. Unapproved Google OAuth sign-ins and unauthenticated public visitors strictly default to 'public' role. Gated full BOH shift visibility strictly to verified crew roles (admin, crew, lead, department_lead). Scoped IndexedDB/localStorage offline cache snapshots by role key (portal_offline_snapshot_public vs crew vs admin) and preserved valid SSR initialData on client RTDB connection errors. Added 1-click 'Login to Crew Portal' header button for public visitors and guarded starred events RTDB listeners against unauthenticated permission_denied errors. Verified Next.js 16 build (2.5s) and 27/27 Vitest unit tests passing.**
- **2026-07-26 — agent — Implemented Sprint 5 features (items 1, 2, 5, 6, 7): high-entropy 128-bit cryptographic vendor token generator in MagicLinkGenerator.tsx, database.rules.json public-data read permission update, interactive schema linter severity filtering badges (Errors, Warnings, Info) in Admin Health panel (/admin/health), master location delete protection & edit guidance alerts in Locations Dashboard (/admin), and pre-populated department select dropdown. All 27 Vitest unit tests and Next.js 16 production build passing cleanly.**
- **2026-07-26 — agent — Merged design/ui-updates branch back into sprint4/productization-milestone (incorporating full UI redesign, custom component primitives in src/components/ui/, admin styling modularization in src/app/admin/admin.css, and PWA icon assets). Staged Sprint 5 backlog tasks for high-entropy vendor tokens, Google Maps referrer lockdown, Firebase Blaze plan customer notification, and admin panel interactivity.**
- **2026-07-26 — agent — Created and published dedicated design branch 'design/ui-updates' for UI/UX styling runs and aesthetic refinements.**
- **2026-07-26 — agent — Enhanced Now & Next dashboard (src/components/event/NowNext.tsx) to automatically fall back to showing the next upcoming scheduled events (regardless of distance in future) when no events occur within 2 hours, and added a dedicated 'All-Day & Flexible / TBD' column. Added Google Maps API key error (ApiProjectMapError) diagnostic overlay in MapView.tsx, created dedicated Admin Magic Links page (/admin/magic-links), added Google Sheets TSV row exporter in Admin Locations dashboard (/admin), and enabled supersession of temporary pins when synced from Google Sheets Locations tab.**
- **2026-07-26 — agent — Completed Sprint 4 productization tasks: implemented DataProvider seam (src/lib/DataProvider.ts, src/lib/event-data.ts, RtdbProvider, SheetsProvider, CsvProvider), standalone sheet linter (src/lib/schema-lint.ts) with validation report UI in Admin Health Panel (/admin/health), tokenized .ics calendar export API (/api/ics/) with PDT timezone tags (America/Los_Angeles), and mobile-optimized Vendor Magic Links (/api/vendor/, /vendor?token=...). Locked event timezone strictly to PDT for Black Rock City, Nevada. Verified 27/27 Vitest unit tests passing.**
- **2026-07-26 — agent — Hardened onboarding invite idempotency in PortalSyncScript.js (processOnboardingInvites). Added pre-flight check for 'Onboarded' / 'email:ok' status, preserved 'email:ok' in final cell state, and added explicit SpreadsheetApp.flush() after unchecking sendInvite to prevent duplicate onboarding email triggers.**
- **2026-07-26 — agent — Fixed Firebase RTDB key validation error in PortalSyncScript.js by escaping dots in Google Calendar IDs (replace '.' with ',') inside gcal_event_ids metadata before writing to crew-data/metadata/calendar-events.**
- **2026-07-26 — agent — Refactored Google Calendar event sync in scripts/PortalSyncScript.js (syncRosEventsToGoogleCalendars) with procedural two-level MD5 hashing (semantic_key & content_hash), Firebase RTDB metadata registry persistence (crew-data/metadata/calendar-events), atomic upsert & prune state machine, and silent consolidated summary logging.**
- **2026-08-03 — agent — Implemented default current-date auto-focusing for Schedule View and Calendar View in src/components/event/EventApp.tsx: when the user opens the app during the event, the views automatically scroll to the day group and time section corresponding to the current date.**
- **2026-07-26 — agent — Sanitized entriesMap payload in src/lib/admin-entries.ts before writing to Firebase RTDB by stripping out undefined fields via JSON.parse(JSON.stringify(entriesMap)), resolving Firebase RTDB set() runtime errors and enabling clean real-time pin synchronization.**
- **2026-07-26 — agent — Fixed admin entries reading bug in src/lib/admin-entries.ts. Updated readAdminEntries to fall back to reading local portal-admin-entries.json when Firebase RTDB returns an empty payload or has no entries, and automatically seed Firebase RTDB with local entries to keep local disk and Firebase RTDB state in sync.**
- **2026-07-26 — agent — Fixed database access rules to allow crew and admin roles to read crew-data at the root level, resolving permission denied errors for non-admin crew. Hardened Apps Script Google Groups member addition logic to report and throw failures rather than silently passing. Removed redundant allowExternalMembers calls from the group check path to optimize sync performance. Fixed case-sensitive header parsing in event-mapper.ts by introducing a robust case-insensitive key helper getRowValue. Upgraded excelTimeToMinutes in event-mapper.ts to support ISO date-times, 24h, and 12h meridians, resolving time-rendering issues and restoring full calendar grid functionality. Fixed ScheduleGrid table width styling to apply both width and minWidth values, enabling responsive layout scaling and horizontal scroll via the width slider.**
- **2026-08-06 — agent** — Built reactive Offline Badge & Last Sync Status Indicator component (`src/components/ui/OfflineBadge.tsx`) using React 19 `useSyncExternalStore`. Integrated offline indicator into header navigation (`EventApp.tsx` & `VendorSchedulePage`). Designed high-contrast emerald (Live) and amber (Offline) pill badges with glowing dot status indicators and tabular monospace sync timestamps in `globals.css`. Verified with 100% clean `npm run lint` and production build (`npm run build`). Committed as `8d873f8`.
- **2026-08-05 — agent** — Completed PWA offline shell verification, automatic admin session cookie issuance (`admin_access=true`), Google Maps `DEMO_MAP_ID` fallback & dev console error interceptors, and client-side offline map card render fallback. Verified 100% Vitest passing, zero ESLint errors, and clean Next.js production build (`npm run build`).
- **2026-07-25 — agent — Optimized Admin onboarding to only add users to the 'all-departments' group. Tucked calendar subscription links inside a collapsed HTML details panel in onboarding emails. Enabled automatic self-healing for deleted/inaccessible Google Calendars in Google Sheets. Resolved template loading error by trying multiple path fallbacks. Finalized full written proposal in proposal.md and updated smoke test checklist.**
- **2026-07-25 — agent — Enabled Google Groups Settings API advanced service in appsscript.json and integrated allowExternalMembers programmatically in PortalSyncScript.js to configure newly created/existing groups to accept external crew members (@gmail.com). Added dynamic calendar & group provisioning (self-healing) at the start of sync, resolved TBD date-times as all-day events with [TBD] appended to titles, nested All Departments/Admin group subscriptions, and hardened processOffboardingRemovals to completely offboard Admins/All Departments users from all groups.**
- **2026-07-24 — agent — Fixed event synchronization duplicates and timezone shift issues in PortalSyncScript.js. Introduced calendar ID deduplication per event to avoid duplicate entries when multiple departments map to the same Google Calendar ID, resolved time object checking to correctly parse scheduled times instead of defaulting to midnight (preventing all-day shifts), and excluded Sunrise and Sunset events from calendar synchronization.**
- **2026-07-19 — agent — Removed auto-creation of Google Calendars in Apps Script: replaced getOrProvisionDepartmentCalendars with strict getDepartmentCalendarMap that strictly reads existing google_calendar_ids from the Departments tab.**
- **2026-07-19 — agent** — Resolved Department column mismatch in Apps Script event sync: updated syncRosEventsToGoogleCalendars to read 'Lead Dept', 'Support Dept 1', and 'Support Dept 2' columns from ROS by TIME tab (matching the canonical sheet headers).
- **2026-07-19 — agent** — Added self-healing getOrProvisionDepartmentCalendars() helper in PortalSyncScript.js to automatically create and resolve Google Calendar IDs for departments missing explicit IDs in the Google Sheet.
- **2026-07-19 — agent** — Added syncRosEventsToGoogleCalendars() to PortalSyncScript.js to automatically push ROS by TIME event rows into department Google Calendars (with duplicate prevention and support for 'All Departments' events).
- **2026-07-18 — agent** — Fixed empty calendar bug: refactored readSheetToJson in Apps Script to automatically skip title banners (like row 1 of 'ROS by TIME'), and extracted event-mapping helpers to a client-safe event-mapper.ts to parse raw Firebase RTDB events/venues on both client and server.
- **2026-07-18 — agent** — Resolved the Google Calendar 'primary' ID placeholder in PortalSyncScript.js. The Apps Script now dynamically maps department names to their google_calendar_ids retrieved from the Departments tab and formats onboarding welcome email links accordingly.
- **2026-07-14 — agent** — Authored a comprehensive migration and configuration guide for moving the Google Cloud Platform, Firebase Realtime Database, Google Workspace Groups/Calendars, and Apps Script pipeline from the legacy 'vvexstudio@gmail.com' account to the canonical 'admin@vvexstudio.com' credentials and Web App Client ID '6aa34'.
- **2026-07-14 — agent** — Completed all Sprint 3 integration tasks: implemented PWA support (manifest.json, sw.js service worker); built Now/Next dashboard; synced starred events via Firebase RTDB / localStorage; wired bidirectionally focused venue zoom/pan; styled Map Legend Overlay, Toast warnings, and calendar live timeline indicator line; and updated RunningSchedule/ScheduleGrid/CalendarView with live event countdown labels. Tested with 100% Vitest passing, zero eslint compile errors, and successful Next.js build compilation.
- **2026-07-13 — agent** — Pivot: Deprecated the 'Approved Emails' tab in favor of the 'Personnel' tab as the single source of truth. Removed approved-emails API endpoints and replaced `/admin/approved-emails` with a deprecation notice card. Optimized calendar print preview sizing, page-breaks, and columns. Integrated server-side `ADMIN_EMAILS` fallback checks inside `page.tsx` for immediate passwordless admin panel access and header actions button display.
- **2026-07-13 — agent** — Completed all Sprint 2 tasks (WP-6 Data-health, WP-11 Theming, WP-5 Offboarding): implemented multi-department filtering logic (A1); created data-health admin dashboard API and client page (A2); moved admin map pins to Firebase RTDB with file fallback (A3); refactored CSS variable theme tokens (B1); designed branded onboarding email HTML template (B2) and print media stylesheet (B3); added Apps Script group removal logic for offboarded users (C1); gated Next.js token generation for inactive users (C2); wired template-based onboarding emails (C3); and drafted offboarding runbook document (C4). Verified Next.js builds and all tests successfully.
- **2026-07-13 — agent** — Completed remaining Sprint 1 Team C tasks (WP-4: Apps Script hardening): implemented group, calendar ACL, and membership idempotency checks; progressive status logging; exponential backoff retries; runtime cursor time-limit checkpointing with automatic trigger resumes; sync heartbeat write to Firebase Realtime Database; and clasp deployment configurations (.clasp.json, scripts/appsscript.json, scripts/clasp/README.md).
- **2026-07-13 — agent** — Reconciled local main with origin/main (incorporating merged Team A refactors and Team B Vitest/CI changes). Restored and committed local hardened Firebase configuration and custom token routes, pushing to origin. Archived unmerged Sheets-Native version history branch as tag `archive/revision-history` and cleaned up merged remote branches (`frontend-ui`, `sprint1/team-a-decompose`, `sprint1/team-b-tests-ci`).
- **2026-07-13 — agent** — Securely wired the Google Apps Script synchronization to Firebase using Google Service Account OAuth 2.0 token flow (removing legacy database secrets). Enhanced the sync logic to merge the 'Approved Emails' tab (as default guests) with the 'Personnel' tab (roles and departments) into the Firebase 'auth-directory' node, making all column name lookups case-insensitive and robust. Verified successful real-time population of 'auth-directory' in the Firebase Console.
- **2026-07-10 — agent** — Completed Sprint 1 Team A (Decompose Main Component). Extracted UI components (EventModal, FilterBar, MapView, ScheduleGrid, RunningSchedule, CalendarView) and custom React hooks (useFilters, useEventData, useAuthProfile). Renamed main client entry from festival-map-app.tsx to EventApp.tsx, and updated page.tsx references. Cleaned up all unused imports, variables, and type warnings. Verified successful production build and linting.
- **2026-07-09 — agent** — Hardened .gitignore (added client_secret.json and *service-account*.json) and conducted a git history audit for client_secret.json (confirmed no occurrences in history). Marked S0.1, S0.2, and S0.3 tasks as completed in playbooks.
- **2026-07-09 — agent** — Reconciled local repository: reset frontend-ui branch to origin/frontend-ui, checked out main and fast-forwarded main to origin/main. Recreated missing Firebase integration files (firebase-admin.ts, firebase-client.ts, api/auth/firebase-token/route.ts, database.rules.json, PortalSyncScript.js) which were omitted in the remote merge. Fixed all modular import/type errors. Verified production build builds cleanly. Committed recreated files to local main branch.
- **2026-07-08 — agent** — Refactored TBD unassigned items inside calendar grid column headers to render as a single clickable badge that opens an absolute-positioned dropdown menu, cleaning up header height clutter on days like Aug 24. Aligned `.calendar-day-header` styling (font weight, color, background) with `.main-schedule-day-header` for theme consistency across views. Removed UTC label from the time axis header cell. Simplified calendar grid column horizontal scaling, replacing explicit stretching logic with a `min-width: columnWidthScale` and `min-width: max(100%, manualSize)` layout formula, allowing manual scaling down to screen width, below which columns automatically stretch to fill the viewport. Restricted column stretching to a maximum of `columnWidthScale * 1.25` so columns scale down proportionally and remain narrow instead of expanding too wide on desktop/wide scrolls.
- **2026-07-08 — agent** — Unified typography and layouts. Packed all layout controls (zoom sliders, hide empty toggles) into the main tabs header (right-aligned) on desktop and completely hid them on mobile, saving vertical screen space. Added a single bottom sticky bar action for Hide Empty Hours. Implemented sticky Time columns with opaque backgrounds, vertical stack formats, and 70px width locks via `table-layout: fixed`. Enabled custom mobile gesture pinch-to-zoom scaling for both Calendar and Schedule views. Filtered empty columns day-by-day in calendar grid, and stretched columns to fill the screen viewport when 3 or fewer are visible for a day (capping the maximum width of a stretched column at 400px to prevent excessive stretching). Made category headers left-aligned sticky, and abbreviated schedule table column titles (Dept. and Lead) for readability. Fixed schedule day header clipping by raising z-index. Fixed horizontal scrolling, black grid layout gaps, and vertical day header stickiness on calendar view by introducing a `.spatial-calendar-grid-content` wrapper container that forces all day sections to stretch horizontally to the maximum scrollable width (keeping backgrounds and grid lines continuous and aligned). Wrapped calendar day date texts in sticky spans so dates remain stuck horizontally when scrolling right.
- **2026-07-07 — agent** — Fixed mobile horizontal calendar scroll alignment: Unified column calculations (departments and locations) across all days globally, ensuring matching widths, correct vertical alignment, and preventing empty scroll gaps or sticky time axes scrolling off on shorter days. Replaced raw emojis in scale sliders with custom inline SVG icons, and styled labels, values, and tracks to look cleaner and premium; refactored the layout controls markup to declare SVG icons and scale value elements outside the full/short text label spans, removing duplicate code blocks; replaced the checkbox sliding switch entirely with a single clickable toggle button (.calendar-toggle-btn) that matches the layout scale slider labels exactly and highlights when checked.
- **2026-07-07 — agent** — Refactored calendar grid layout and unified chips: Created one shared `CalendarChip` component for both department/location headers and TBD status tags, ensuring consistent padding, border-radius (6px), and layout structure; status tags now use a darker/muted tint of the primary color via CSS overlays; configured columns to stretch equally using `flex: 1` and align with proportional flex-grow parent cells; removed mobile horizontal padding on `.spatial-calendar-container` to extend the grid edge-to-edge.
- **2026-07-07 — agent** — Maximized screen real estate: Consolidated header banner to a single-row flex layout on both desktop and mobile; hid user name/email on mobile and changed light/dark mode switch to a compact icon button; replaced bottom collapsible accordions on mobile with a sticky navigation bar that opens slide-up drawer panels (bottom sheets) for Filters & Search and the Running Schedule.
- **2026-07-07 — agent** — Fixed mobile layout bugs: stacked filter dropdowns and date-time pickers vertically on screens ≤ 720px to prevent global horizontal page overflow; added horizontal scroll to main schedule table on mobile with 750px min-width to avoid column squishing; added minWidth constraint and flex-shrink: 0 to calendar-day-sections to prevent column squeezing in calendar view.
- **2026-07-04 — Antigravity** — Implemented Google Calendar & role-gated Firebase Realtime Database Option B integration. Scaffolded Firebase Admin SDK on the server, built custom token-minting APIs, configured modular Web SDK onValue listeners in the client component, wrote the complete spreadsheet sync Google Apps Script, authored database rules, and successfully verified clean Next.js compilation.
- **2026-07-03 — agent** — Expanded filters collapsible header support from mobile-only up to tablet stacked layouts (max-width: 1080px), styling and behaving identically to the running schedule collapse header.
- **2026-07-03 — agent** — Made the running schedule collapsible on mobile/tablet stacked viewports. Compressed calendar controls into a single row on mobile with "W", "H", and "Hide Empty" abbreviations. Positioned the desktop sidebar toggle button on the left boundary of the sidebar.
- **2026-07-03 — agent** — Simplified the calendar layout toolbar to a single toggle ("Hide Empty Hours", enabled by default). Converted "Hide Empty Columns" to a permanent background feature.
- **2026-07-03 — agent** — Simplified the header banner by removing the kicker, removing the secondary sub-heading ("ROS by TIME Master View"), and hiding the data source label, leaving "The Portal" as the sole primary title.
- **2026-07-03 — agent** — Fixed mobile header layout overlapping title text, kicker, and data source label, and resolved theme switch button clipping on narrow viewports by introducing a vertical block stack layout with dynamic profile label truncation.
- **2026-07-03 — agent** — Implemented "Hide Empty Columns" calendar view toggle (on by default) to dynamically filter columns per day, built collapsible mobile filters, and added a desktop toggleable sidebar with a floating pill button at the edge.
- **2026-07-03 — agent** — Verified and resolved mobile calendar date header stickiness. Swapped hardcoded tab heights for a flexbox hierarchy, restricted grid min-height on mobile viewports, and configured tab-specific overflow limits so that vertical/horizontal scrolling happens purely within the grid context. Added `-webkit-sticky` and touch momentum scrolling support.
- **2026-07-03 — agent** — Implemented granular vertical scale zoom for calendar view. Added support for displaying 30-minute and 15-minute increments along the vertical time axis and dashed background grid lines when zoomed in.
- **2026-06-30 — agent** — Fixed `0.0.0.0:8080` redirect loop. Updated redirects in `src/app/api/auth/callback/route.ts` and `src/app/api/auth/logout/route.ts` to resolve against dynamically detected `origin` instead of `request.url`.
- **2026-06-28 — agent** — Updated dynamic host detection in `src/app/api/auth/login/route.ts` and `src/app/api/auth/callback/route.ts` to support the `x-forwarded-host` header. This fixes Google OAuth redirect URI mismatches when running on Cloud Run behind Firebase App Hosting.
- **2026-06-22 — agent** — Updated `schema-template/README.md` to document the active Google Sheets master schema structure (Locations, Personnel, Departments, Actions, ROS by TIME, Approved Emails tabs, and dynamic color formatting). Configured a git pre-push hook (`scripts/pre-push.sh` / `package.json` prepare) to prevent remote pushes without explicit user approval or the `PORTAL_ALLOW_PUSH=true` override. Updated push instructions in `AGENTS.md`.
- **2026-06-19 — agent** — Completed Option A MVP features. Configured Google Sheets remote data fetching (with fallback to public CSV exports). Integrated conditional formatting colors dynamically from `sheet-colors.json`. Upgraded time range pickers to full `datetime-local` selectors with timezone-safe overnight logic. Implemented additive multi-select dropdowns and split filters into separate color-coded chips. Fixed sticky day/date headers in both the left grid (removing `overflow: hidden`) and right running schedule (removing container `padding-top` leak). Verified production build builds cleanly.
- **2026-06-15 (cont.) — agent** — **Remote-first pivot.** Archived local KMZ/XLSX to `OFFLINE/` (gitignored). Confirmed the live Google Sheet (`1rpmzT4…`) exports via CSV/xlsx (read) but the My Map is private (KML 403). Built synthetic **`Locations`** (24) + **`Personnel`** (23) tabs and a structured **`ROS`** (91 rows, all location-mapped) — all derived only from the new sheet. Client imported Locations/Personnel CSVs into the sheet (verified present); `ROS.csv` pending import. Wrote `schema-template/` (CSVs + data-dictionary README), `.env.example`, and a Sheets-API/service-account enablement guide. Connected Claude-in-Chrome and confirmed edit access via `juliavved@gmail.com`. Brand source = https://theportal.is. **Next:** rewrite `festival-data.ts` to read the sheet tabs remotely.
- **2026-06-15 — agent** — Initial discovery + planning. Audited repo, KMZ (11 placemarks, Tuscany), and `ROS_VVEX.xlsx`. Found: data-load filename mismatch (`ROS  - MARTIANS.xlsx` vs `ROS_VVEX.xlsx`) → 0 events; structured ROS columns all empty; `ROS BY AREA` sheet unused. Captured 4 locked decisions. Authored `sprintboard.md` + `CLAUDE.md`. No code changed yet — awaiting go-ahead + pending client inputs (Section 3).
