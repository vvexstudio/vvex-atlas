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

**Stack:** Next.js 16.1.6, React 19.2.3, TypeScript. Google Maps via `@vis.gl/react-google-maps`. Data parsing: `xlsx`, `jszip`, `fast-xml-parser`.

- 📢 **Canonical Repository:** As of 2026-07-09, this repository (`portal-dev`), branch `main`, is the single source of truth. All other checkouts are read-only. **HUMAN-VERIFY:** Confirm that no unmerged work remains on any other machine, and run `git pull` on them to discard local divergence.

**What exists and works:**
- `src/components/festival-map-app.tsx` (~2,880 lines) — mature single shared view: Google map, geofenced markers, category/project-type filters, fuzzy search, day tabs, timeline view, service icons, event modals.
- `src/lib/festival-data.ts` — server loader: parses KMZ placemarks → venues, `ROS by TIME` sheet → events, infers event types from text, name-matches schedule locations to placemarks, keeps unmatched rows as "unmapped."
- `/admin` — single shared-cookie gate (`admin_access=true`) + password server action (`src/app/admin/actions.ts`, `src/proxy.ts`). CRUD pin editor (`src/components/admin/pin-editor.tsx`); entries persist to local `portal-admin-entries.json`.

**Data work completed this session (remote sheet `1rpmzT4…`):**
- ✅ Added **`Locations`** tab (24 rows): id, name, aliases, category, foh_boh_default, lat/lng (synthetic), capacity, notes.
- ✅ Added **`Personnel`** tab (23 rows): synthetic people + vendor teams (Cosimo, ALMA, ZANU, Sebach, …) with role/dept/org/type/email/phone/visibility.
- ✅ Generated **`ROS`** structured tab (91 rows) from the `ROS BY AREA` grid — every row mapped to a `location_id`, 64 with a parsed `lead_point_person`, times parsed from entry text. (Pending: import `schema-template/ROS.csv` into the sheet — Locations/Personnel already imported.)
- ✅ Schema + production-data template documented in `schema-template/README.md` (+ `.csv` files). `.env.example` written.

**Still open / to fix:**
- 🔴 **App still reads local files.** `festival-data.ts` parses the OFFLINE KMZ/XLSX and hardcodes paths. Must be rewritten to pull the **Google Sheet tabs** (`Locations`/`Personnel`/`ROS`) remotely. → M0/M1.
- 🟠 **Google My Map is private** (`/edit` link) → KML export 403s. `Locations` lat/lng are synthetic until real coords arrive or the map is shared "anyone with link can view."
- 🟡 No tests, no CI. `node_modules` not installed in this checkout.
- 🟡 Inherited "festival" naming throughout; not yet themed to theportal.is.

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
- [ ] Admin dashboard to scope what each role sees (`Roles` tab → runtime filter).
- [ ] Row-level `visibility` + FOH/BOH gating in the map/schedule.
- [ ] Contacts Directory + personal view.
- [ ] Calendar `.ics` export + subscription feed per role/person.
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
- [x] Verification suite with Vitest unit tests, clean lint checks, and successful Next.js production compiles.

### M4 — Proposal + handoff
- [ ] Finalize the full written proposal with PLUS features pitched and pricing tiers.
- [ ] Two rounds of revision buffer (per proposal scope) + minor RFE handling.

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
- **MARTIANS / VVEX** — the client's sample event + dataset (Montalcino, Tuscany).

---

## 10. Session Log
> Append newest at top. Format: `YYYY-MM-DD — who — what changed / decided / discovered`.

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
