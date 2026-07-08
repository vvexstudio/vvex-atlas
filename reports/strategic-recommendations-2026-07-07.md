# Portal Map App — Strategic Recommendations Report (v2)

**Date:** 2026-07-07 (revised same day)
**Scope:** Usability, design, roadmap, productization, market opportunities, and agent-ready work packages.
**Inputs considered:** full repo audit, `sprintboard.md` session log, `proposal.md`, `schema-template/`, `reports/implementation_plan.md` (the Firebase/Apps Script/Workspace-Groups master plan), and the Gemini design conversation. *Note: the Gemini share link requires Google sign-in and could not be read directly; `implementation_plan.md` is treated as the authoritative record of the decisions made there.*

---

## 1. Executive Summary

Since v1 of this report, the picture changed in three important ways:

1. **The app is further along than the docs suggest.** Google OAuth login is live (approved-emails allowlist, dynamic host detection for Cloud Run/Firebase App Hosting), a spatial calendar view with per-day department/location columns exists, dark/light theming and mobile bottom-sheet drawers shipped this week. Option A is essentially delivered and Option B is underway.
2. **The architecture has pivoted to a Google-native real-time stack.** Per `implementation_plan.md`: Google Sheet → Apps Script → **Firebase Realtime Database** (WebSocket-hydrated UI, role-scoped security rules), plus **Google Workspace Groups** auto-provisioning and **per-department Google Calendars** with group ACLs, and automated onboarding emails. This is a genuinely differentiated design — and it introduces a new class of risks (§4) that should be engineered around *before* the client's first production event.
3. **The repo has forked across machines.** The plan marks Firebase Admin SDK, token-minting route, RTDB hydration, `database.rules.json`, and `PortalSyncScript.js` as complete — **none of these exist in this checkout** (no firebase dependency in `package.json`, no `scripts/PortalSyncScript.js`, no `firebase-token` route). Reconciling the two working copies is now the single most urgent engineering task: every day of parallel drift makes the merge worse.

The three highest-leverage moves:

1. **Reconcile the codebases and harden the sync pipeline** — merge the Firebase work into one canonical repo, replace the Apps Script database-secret pattern with a service account, and design the offboarding path the plan currently omits (§4.3).
2. **Ship the day-of-show experience** — Now/Next view, personal agenda, deep links, offline resilience. Real-time RTDB hydration makes several of these dramatically cheaper than they were under polling (§5.1).
3. **Split the integration story into two tiers** — the Workspace-native pipeline (Groups + native Calendars) is a premium tier that only works for clients who own a Google Workspace domain; a provider-agnostic `.ics` tier must exist underneath it or the product can't be sold to half the market (§8.2).

---

## 2. Current State Assessment

**Strengths**
- Remote-first Sheets data layer with automatic public-CSV fallback — resilient by design.
- Working Google OAuth with approved-emails allowlist; deployed behind Firebase App Hosting / Cloud Run with `x-forwarded-host` handled.
- Additive multi-select chip filters (OR within category, AND across); datetime-range filtering with overnight rollover logic.
- Color coding harvested from the client's own sheet conditional formatting — the product's core insight: *render the client's existing workflow, don't replace it*.
- New spatial calendar view: per-day location/department columns, vertical time-scale zoom (60/30/15-min), hide-empty-hours, shared `CalendarChip` component.
- Mobile work is real: sticky nav with slide-up drawer panels, edge-to-edge grid, compact header, dark/light toggle.
- Schema template + data dictionary (`schema-template/`) already documented; pre-push hook guards accidental pushes.
- The planned architecture (Sheet → Apps Script → RTDB → WebSocket UI) gives sub-second propagation from a producer's cell edit to every crew phone. That is the demo moment that sells this product.

**Liabilities**
- 🔴 **Repo divergence.** The Firebase sprint work (per `implementation_plan.md`) lives on another machine/branch. Until merged, this checkout's active UI work (`festival-map-app.tsx` changed heavily this week) and the Firebase hydration changes to the *same file* are on a collision course.
- 🔴 `client_secret.json` untracked in the repo root and not gitignored. One `git add .` from leaking Google OAuth credentials.
- 🔴 **`FIREBASE_SECRET` in Apps Script** (plan §2B): legacy database secrets are deprecated, grant full read/write to the entire RTDB, can't be scoped, and live in a script the client's sheet admins can open. Replace with a service account + short-lived OAuth token (Apps Script can mint these natively) before production data flows.
- 🟠 `festival-map-app.tsx` ~1,700–2,900 lines (varies by branch): filters, map, schedule, calendar, modals in one file. It is the merge-conflict epicenter and blocks parallel agent work.
- 🟠 The onboarding flow (plan §3) only *adds* people — no offboarding. Events churn contractors weekly; without a removal path, ex-vendors keep calendar and group access indefinitely (§4.3).
- 🟡 Zero automated tests, no CI; the timezone/rollover/alias-matching logic is exactly where regressions will hide.
- 🟡 Admin pin entries persist to local JSON — dies on Cloud Run's ephemeral filesystem. (RTDB is now the obvious home.)
- 🟡 "Festival" naming persists throughout; two data read paths now exist (Sheets-direct and RTDB) with no declared source of truth per environment.

---

## 3. What the New Architecture Buys You

Worth stating plainly, because it should shape the pitch (§9) and roadmap (§6):

- **Live propagation**: producer edits a cell → Apps Script pushes → RTDB → every open client updates over WebSocket without reload. No polling quota pressure, no staleness ambiguity.
- **Real security, not CSS hiding**: RTDB rules enforce role/department scoping server-side (`auth.token.departments[$department_id]`), with roles minted as custom-token claims from the Next.js session. BOH data never reaches an unauthorized browser.
- **Calendar where people already live**: department Google Calendars shared to auto-provisioned Groups means crew see their schedule in the calendar app they already check, with zero per-person ACL management.
- **Onboarding as a spreadsheet gesture**: checking `send_invite` on a Personnel row provisions groups, calendar access, and a branded welcome email. The spreadsheet *is* the admin panel — perfectly on-brand for this product.

---

## 4. Architecture Risks & Hardening (new section — read before the next sprint)

### 4.1 Codebase reconciliation (do first)
Designate one repo/branch as canonical. Port or merge the Firebase sprint (admin SDK init, `firebase-token` route, RTDB hydration in the main component, `database.rules.json`, `PortalSyncScript.js`) into it *before* further UI work. The main component must be decomposed (§7, WP-2) as part of this merge or the next merge will be worse.

### 4.2 Apps Script pipeline hardening
- **Kill the database secret.** Use a service account; Apps Script can sign a JWT and exchange it for a scoped OAuth token, or use `ScriptApp.getOAuthToken()` with the Firebase scope where applicable.
- **Quota math.** `MailApp` caps at ~1,500 recipients/day on Workspace (100/day on consumer Gmail — verify which account runs the script). `Utilities.sleep(5000)` per new group inside a per-department loop eats into the 6-minute execution ceiling fast: 20 people × 2 departments ≈ minutes of pure sleep. Mitigations: only sleep after *creation* (not lookup) — the plan already implies this; batch invites; use time-based triggers to resume; write a cursor to the sheet.
- **Idempotency & partial failure.** The flow updates `invite_status` at the end; a mid-loop crash leaves groups created, member not added, checkbox still true. Make every step check-before-write and record per-step status so re-running the checkbox is always safe.
- **Version-control the script.** Apps Script edited in the browser is invisible to git. Use `clasp` to push `scripts/PortalSyncScript.js` from the repo, so the deployed script and the repo copy can't drift.
- **Alert on sync failure.** A failed push means the app silently serves stale RTDB data. Have the script write a `last_sync` heartbeat node; the app's admin panel (and a scheduled check) alarms when it goes stale.

### 4.3 The offboarding gap (design it now)
Event crews churn weekly. Add to the schema/script: an `active` or `offboard` column → script removes the member from groups (`AdminDirectory.Members.remove`), which automatically revokes group-bound calendar access; disable their app role claim; log to `invite_status`. GDPR (Tuscany!) makes removal a *right*, not a feature. Also decide group lifecycle: archive/delete department groups after the event, or reuse across events?

### 4.4 Two read paths, one truth
The app now has Sheets-API/CSV *and* RTDB paths. Declare the contract: **RTDB is the runtime source; Sheets is the authoring source; the CSV fallback is disaster mode only.** Render which path is live in the admin data-health panel. Otherwise you will one day debug a "wrong data" report that is actually a "which path" report.

### 4.5 Non-Google users
Group-ACL calendar sharing assumes members have Google accounts. Vendors on Outlook exist. The `.ics` feed tier (§8.2) is the answer — treat it as a required fallback, not a nice-to-have.

### 4.6 Cost & limits sanity check
RTDB free tier: 100 simultaneous connections (Spark) — a 200-person crew with the app open exceeds it; budget the Blaze plan and estimate GB-downloaded (fan-out the data per department node, as the rules already imply, so clients only sync what they can read — cheaper *and* safer). Admin Directory API and Calendar API have per-minute quotas that bulk onboarding can trip; the sleep already helps, but add exponential backoff.

---

## 5. Usability Recommendations

*(Items from v1 that have since shipped — dark mode, bottom sheets, mobile drawers, calendar zoom — are dropped. What remains is still open.)*

### 5.1 The "day-of-show" lens (highest impact; now cheaper thanks to RTDB)
- **"Now / Next" mode.** Default landing state: what's happening now + next 2 hours, auto-scrolled, live time indicator line. With WebSocket hydration this stays truthful without refresh — the whole feature is a filtered view + a 1-minute ticker.
- **Personal agenda ("My Schedule").** Star events → "mine" view. Persist per-user in RTDB under their uid (the auth plumbing now exists) with localStorage for guests.
- **Change notifications.** RTDB `onValue` already delivers diffs; surface them: toast + badge "Stage B load-in moved +30 min," and a per-user "changes since you last looked" digest. This converts the real-time plumbing into *visible* product value — otherwise clients can't tell the app apart from a static page.
- **Countdown labels** on cards ("in 25 min", "started 10 min ago").
- **Deep links.** Serialize filters/day/selected event to URL params. Producers coordinate by pasting links into WhatsApp; if state isn't in the URL, the app isn't part of the conversation.
- **Search everything** — descriptions, personnel, location aliases — results grouped by type.

### 5.2 Map ↔ Schedule linkage
- Pin tap filters the schedule to that location; event location chip pans/zooms the map. Bidirectional linkage makes two panes feel like one app.
- Per-category pin shapes/icons + cluster count badges ("Stage A · 12 events today"). Color alone fails in sunlight and for color-blind users.
- **"Walk there"**: pin popover → native maps directions. Trivial, disproportionately loved.
- **Legend/key** for the category palette (long-standing to-do; real gap).

### 5.3 Filters & density
- **Saved filter presets** ("Audio day 2", "All BOH") — shareable via URL; departments define once, reuse all event.
- **Comma-separated multi-department membership** in filters and profile matching (explicitly flagged in the implementation plan as pending — a crew member in `Lighting, Rigging` must match both filters).
- **Empty-state guidance** with a one-tap fix ("No Audio events on Day 3 — clear day filter?").
- **Density toggle**: compact scan mode vs comfortable mode.

### 5.4 Field conditions
- **PWA + offline.** Cache app shell + last-good dataset; staleness banner with last-sync time. Note the interplay: WebSockets don't work offline — persist the last RTDB snapshot to IndexedDB and rehydrate from it. Montalcino connectivity makes this a requirement.
- **High-contrast / sunlight mode** toggle.
- **Pull-to-refresh** with visible "last synced" timestamp (doubles as the RTDB heartbeat display, §4.2).

### 5.5 Trust
- **Admin data-health panel**: active data path (RTDB / Sheets API / CSV fallback), `last_sync` heartbeat age, row counts, unmapped-location report, invite-queue status. This panel is also what you screen-share when the client says "is it working?"

---

## 6. Design Recommendations

- **Theme tokens.** The dark/light toggle exists; finish extracting every color/font/radius/spacing into CSS variables + one theme config so the theportal.is brand assets land as a one-file change — and so white-labeling (§8) is a config, not a fork.
- **Typography for scanning**: time is the strongest anchor on every row (tabular figures, bold), then title, then chips. People scan schedules by time first.
- **One chip vocabulary.** `CalendarChip` unification was the right move — extend it to filter chips and modal badges with icon-prefix per category so the whole UI speaks one language.
- **Styled Google Maps JSON** matched to brand palette; default Google look reads "generic," styled reads "built for you."
- **Skeleton loading states** for initial hydration; **branded onboarding email template** (the plan's welcome email is a brand touchpoint — design it, don't let it look like a script's default HTML).
- **Print stylesheet.** Producers still print. Clean one-day-per-page schedule, no map, no chrome.
- **Accessibility pass**: keyboard nav through the schedule, focus states, aria-labels on icon buttons (the new SVG slider icons need them), contrast ≥ 4.5:1, reduced motion. Required for corporate/campus/municipal buyers (§9).

---

## 7. Architecture & Code Health

1. **Secrets hygiene (30 min, today).** Gitignore `client_secret.json` + `OFFLINE/` + `.env*`; verify via `git log --all --full-history -- client_secret.json` it was never committed; rotate if in doubt; env-var the credentials everywhere (the Firebase plan already does this pattern — extend it to the Sheets service account).
2. **Merge the fork (this week).** §4.1. Everything else queues behind it.
3. **Decompose `festival-map-app.tsx`** into `FilterBar`, `ScheduleGrid`, `RunningSchedule`, `CalendarView`, `MapView`, `EventModal` + `useFilters`, `useEventData` (wrapping the RTDB listeners), `useAuthProfile`. Target ≤ 300 lines/file. Prerequisite for parallel agent work and for surviving the merge.
4. **Move admin entries to RTDB** (`admin-data` node already exists in the rules design). Kill the local JSON.
5. **Tests where bugs live**: date normalization, overnight rollover, alias matching, filter OR/AND semantics, comma-separated department parsing, fallback triggering, and — new — RTDB payload shape validation (a bad Apps Script push must not white-screen the app). Vitest + GitHub Actions on PR.
6. **`DataProvider` seam.** UI reads one interface; behind it: RTDB (runtime), Sheets API (authoring/preview), CSV (fallback), and later Airtable (already paid for by client per the to-do). This is the seam that admits other backends without touching the UI.
7. **Rename `festival-*` → `event-*`** during decomposition, not as a separate pass.
8. **Error reporting + structured logs** (Sentry or GCP Error Reporting — you're on Cloud Run; Cloud Logging is right there). The 5am malformed-row scenario should page a dashboard, not the client.

---

## 8. Generalization & Scaling to Other Projects

### 8.1 Extract an "event-app engine"
- One core repo; per-client difference = theme token file + `event.config.ts` (name, timezone, map center/zoom, role taxonomy, feature flags) + credentials. The fork-per-client model (bbb → portal) dies at ~3 clients.
- **Schema adapter + sheet linter.** Formalize `schema-template/` into a mapping config ("client's `Lead Point Person` → `lead_point_person`") with a validation report: missing locations, unknown departments, unparseable times, duplicate ids, malformed comma-separated lists. The linter is a *sellable deliverable* — it converts "your data is messy" from an argument into a checklist. It should run both in CI and inside the Apps Script push (reject-with-report beats sync-garbage).
- **Feature flags per tier** — `realtime`, `roles`, `calendarNative`, `calendarIcs`, `contacts`, `liveOps`, `notifications` — which map 1:1 to pricing tiers.

### 8.2 The two-tier integration story (new, forced by the Workspace pivot)
The Groups/native-Calendar pipeline requires the client to **own a Google Workspace domain with Super Admin cooperation** (plan §2C). Boutique production firms often have this; wedding planners, small festivals, and film productions often don't.
- **Tier 1 — Universal:** tokenized `.ics` subscription feeds per user/filter. Works with Outlook, Apple, anything; no Workspace, no Groups, no Admin SDK. Cheap to build off the same data.
- **Tier 2 — Google-native (premium):** the full Groups + department calendars + onboarding-email pipeline. Pitch as "white-glove Workspace integration."
Selling Tier 2 to a Tier 1 client currently means a failed onboarding call with their IT. The flag split prevents that.

### 8.3 Multi-tenant path
- Phase 1 (now): one repo, one Firebase project **per client** (clean isolation, client can own billing, Apps Script bound to *their* sheet — the architecture is accidentally well-shaped for per-tenant isolation).
- Phase 2: subdomain-per-event on shared infra, event switcher, archived past events (the archive is a retention moat — "what was last year's load-in plan?").
- Phase 3: self-serve — client connects sheet, runs linter, gets app. Don't rush it; Phase 1 with a 1-day onboarding runbook already transforms margins.
- **Onboarding runbook as product artifact**: exact steps from "client sends spreadsheet" → "live URL" (linter, mapping config, Firebase project, Apps Script deploy via clasp, env vars, smoke test). If an agent can follow it, it's a business.

---

## 9. Potential Customers & Markets

Core pitch: **"Your existing spreadsheet becomes a live, role-aware event app — edits propagate to every crew phone in seconds, and your teams get it in their Google Calendar automatically."** The real-time + calendar-native angles strengthen the pitch for exactly the segments that have Workspace.

| Segment | Fit | Angle / notes |
|---|---|---|
| **Boutique event production firms** (The Portal's peers) | Identical workflow: ROS sheet + My Maps. | The beachhead; ask The Portal for 2 intros post-show. Most run Workspace → Tier 2 pitch. |
| **Music festivals (1k–20k)** | Multi-stage, multi-day, crew+vendor churn. | bbb-map-app origin market. Offboarding (§4.3) matters most here. |
| **Film/TV production** | Call sheets *are* run-of-show; locations map perfectly. | Biggest adjacent market; vocabulary swap ("call sheet mode"). Often not on Workspace → needs Tier 1. |
| **High-end wedding/destination planners** | Multi-venue weekends, vendor call times, guest schedule. | Guest view = branded schedule; planner view = ops. Mixed email providers → Tier 1. |
| **Conferences & corporate offsites** | Multi-track agendas, room maps, speakers. | Workspace-native calendar sync is a *killer* differentiator vs Sched/Whova here. Accessibility + SSO required. |
| **Sports tournaments & races** | Multi-field scheduling, volunteers, course maps. | Map view is the star; volunteer group provisioning maps to departments. |
| **University campus events** | Orientation, commencement; many campuses run Google Workspace for Education. | Groups pipeline fits eerily well; procurement slow but annually recurring. |
| **Municipal/street festivals** | Public map + schedule, vendor coordination. | Public-sector accessibility compliance; Tier 1. |
| **Touring productions** | Same show, N cities → multi-event workspaces. | Archive + config-per-city; strong retainer shape. |
| **Corporate internal events / all-hands weeks** | HR-run, Workspace-native, department-scoped visibility. | The RTDB role isolation (§3) is literally their org chart. New segment unlocked by the pivot. |

**Pitch asset:** a 90-second recording — spreadsheet on the left, two phones on the right (admin + guest roles), edit a cell, watch both phones update live and differently. That video *is* the product for every segment above.

---

## 10. Considerations You Haven't Asked About (but the market will)

1. **Offboarding & access lifecycle** (§4.3) — churn is weekly in events; removal is a GDPR right; design the `active=false` path now.
2. **GDPR/PII posture.** Personnel = names, phones, emails; the pipeline now *also* creates Groups memberships and sends emails. A one-page data-processing note (what's stored where: Sheet, RTDB, Groups; retention; deletion path) becomes a sales asset with corporate clients — and is arguably required for the EU event.
3. **Email deliverability.** Onboarding mail from `MailApp` sends as the script owner; SPF/DKIM alignment on the client's domain determines whether invites land in spam. Test with cold Gmail/Outlook accounts before show week.
4. **Timezones as a feature.** Destination events = producer in LA, venue in Italy. Store event-local with explicit TZ; offer "show in my time" toggle. Timezone bugs are the credibility killer in scheduling tools.
5. **The 11pm column rename.** A producer *will* rename a sheet column before show day. Linter (§8.1) + last-known-good RTDB snapshot + admin alert turns catastrophe into a warning. The RTDB layer actually helps here: the app keeps serving the last good push.
6. **Vendor magic links.** Tokenized no-login link showing a vendor only *their* events. Low effort, high wow, viral — every vendor who receives one sees the product. Works even for non-Google vendors (complements §8.2 Tier 1).
7. **Kiosk/green-room mode.** Read-only auto-refreshing "what's next at this location" display — nearly free from the Now/Next view, looks incredible in a production office, and the WebSocket layer means it's genuinely live.
8. **Live ops annotations.** Leads set per-event status (on-time/delayed/cancelled) from their phone; RTDB write rules currently say `".write": false` everywhere — carving out a narrow, validated write path for status is the first step toward the app being *written to* during the show.
9. **Conflict detection.** Same location double-booked, same lead in two places, load-out before load-in. Production managers pay for this specific feature; it's a pure function over data you already have.
10. **Weather strip** per outdoor location/day (Open-Meteo, free) — producers check obsessively.
11. **Apps Script observability.** Browser-edited scripts with silent failures are the classic "it stopped syncing Tuesday" incident. clasp + heartbeat + alert (§4.2) is the fix; treat the script as production code.
12. **Don't become Airtable.** The differentiator is *"we render your workflow"* — the spreadsheet stays the authoring UI; `send_invite` checkboxes prove the pattern. The moment you build a full event-editing UI you compete with the spreadsheet instead of embracing it. Guard that line in every scoping call.

---

## 11. Prioritized Sequence (recommended)

1. **Day 0:** secrets hygiene — gitignore `client_secret.json`, history audit, env-var everything. *(hours)*
2. **Week 1:** repo reconciliation — merge/port the Firebase sprint into the canonical repo; decompose the main component as part of the merge; replace the Apps Script DB secret with a service account; set up clasp.
3. **Week 2:** pipeline hardening — idempotent onboarding, offboarding path, sync heartbeat + admin data-health panel, comma-separated department parsing in UI; tests + CI.
4. **Weeks 3–4:** day-of-show UX — Now/Next, personal agenda, change toasts, deep links, pin↔schedule linkage, legend, PWA/offline snapshot.
5. **Weeks 5–6:** `.ics` feed tier, vendor magic links, contacts directory, brand theming + onboarding email template, print stylesheet. **← Option B demo milestone**
6. **Post-delivery:** sheet linter + mapping config, feature-flag tiering, multi-event workspace, kiosk mode, pitch video, The Portal referral asks.

---

## 12. Agent-Ready Work Packages

Scoped for hand-off to agentic workers with minimal shared context. **WP-0 and WP-2 gate almost everything**; packages marked ∥ can run in parallel once their gate clears.

### WP-0: Repo Reconciliation *(gate for all code WPs)*
- [ ] Locate the Firebase sprint work (other machine/branch); diff against this checkout, esp. `festival-map-app.tsx`, `src/app/api/auth/*`, `package.json`.
- [ ] Merge into one canonical branch; verify `npm run build`; document canonical repo/branch in `sprintboard.md`.
- **Acceptance:** one repo contains OAuth + calendar-view UI + Firebase files (`firebase-admin.ts`, `firebase-token` route, `database.rules.json`, `PortalSyncScript.js`); build clean; session log updated.

### WP-1: Secrets & Repo Hygiene *(no dependencies — can run today)*
- [ ] `.gitignore`: `client_secret.json`, `.env*`, `OFFLINE/`.
- [ ] `git log --all --full-history -- client_secret.json` — report whether it was ever committed; rotate if so.
- [ ] All credentials via env vars; update `.env.example` + README.
- **Acceptance:** fresh clone + documented env boots; no secret files in tree or history.

### WP-2: Decompose the Main Component *(after WP-0; gates UI WPs)*
- [ ] Extract `FilterBar`, `ScheduleGrid`, `RunningSchedule`, `CalendarView`, `MapView`, `EventModal`; hooks `useFilters`, `useEventData` (wrapping RTDB `onValue` listeners), `useAuthProfile`.
- [ ] Rename `festival-*` → `event-*` in the same pass. Zero behavior change (before/after screenshot diff).
- **Acceptance:** build clean; no file > 300 lines; UI pixel-identical.

### WP-3: Tests + CI ∥ *(parallel with WP-2)*
- [ ] Vitest: date normalization, overnight rollover, alias matching, filter OR/AND, comma-separated department parsing, CSV-fallback trigger, RTDB payload-shape validation (malformed push must render an error state, not crash).
- [ ] GitHub Actions: lint + typecheck + test on push/PR.
- **Acceptance:** ≥ 30 meaningful assertions; CI green on the canonical branch.

### WP-4: Apps Script Hardening *(after WP-0)*
- [ ] Replace `FIREBASE_SECRET` with service-account token flow.
- [ ] Idempotent onboarding: per-step status writes, safe re-run, sleep only after group *creation*, exponential backoff on Directory/Calendar API errors.
- [ ] `last_sync` heartbeat node; clasp setup so the deployed script tracks `scripts/PortalSyncScript.js` in git.
- **Acceptance:** deliberately killing the script mid-run leaves a resumable state; re-check of the box completes cleanly; heartbeat visible in RTDB.

### WP-5: Offboarding Path *(after WP-4)*
- [ ] Schema: `active`/`offboard` column in Personnel; script removes member from all department groups, logs to `invite_status`.
- [ ] App: role claim revoked on next token mint; document the full "person leaves" runbook (groups, calendar, app, sheet row).
- **Acceptance:** demo — flag a synthetic person, verify group membership and calendar access gone, app access denied, audit trail written.

### WP-6: Data-Health Admin Panel ∥ *(after WP-0)*
- [ ] Panel showing: active data path (RTDB/Sheets/CSV), heartbeat age with stale alarm, row counts per tab, unmapped locations, pending/failed invites.
- **Acceptance:** unplugging the Apps Script trigger turns the panel red within one heartbeat interval.

### WP-7: Day-of-Show UX *(after WP-2)*
- [ ] Now/Next default view, live time line, countdown labels.
- [ ] Personal agenda: star → RTDB per-uid (localStorage for guests), "My Schedule" tab.
- [ ] Change toasts from RTDB diffs ("Stage B load-in moved +30 min").
- [ ] Deep-linkable state: filters/day/event serialized to URL, restored on load.
- **Acceptance:** shareable URL reproduces exact view; sheet edit produces a visible toast on an open client within seconds; stars survive re-login.

### WP-8: Map↔Schedule Linkage + Legend ∥ *(after WP-2)*
- [ ] Pin tap → filter schedule; location chip → pan/zoom map + open pin.
- [ ] Category legend; per-category pin icons/shapes; cluster count badges; "Directions" button opening native maps.
- **Acceptance:** round-trip navigation works both directions on a mobile viewport; legend reflects live palette from `sheet-colors.json`.

### WP-9: PWA + Offline Snapshot *(after WP-7)*
- [ ] Service worker for app shell; last RTDB snapshot persisted to IndexedDB; offline rehydration + staleness banner; manifest (icons, standalone).
- **Acceptance:** airplane-mode reload shows the full schedule with "data as of HH:MM" banner; Lighthouse installable check passes.

### WP-10: `.ics` Feed Tier + Vendor Magic Links *(after WP-4)*
- [ ] `.ics` endpoint generating VEVENTs from RTDB; tokenized per-user/per-filter subscription URLs; admin revocation (revoked → 410).
- [ ] Vendor magic link: tokenized read-only view scoped to one person's events, no login.
- **Acceptance:** feed subscribes in Google + Apple + Outlook calendars; sheet edit propagates on next refresh; magic link shows only that vendor's rows.

### WP-11: Theming Tokens + Print ∥ *(after WP-2)*
- [ ] All colors/typography/spacing → CSS variables + one theme config; styled-map JSON slot; branded onboarding-email HTML template.
- [ ] Print stylesheet: one day per page, no map/chrome.
- **Acceptance:** swapping one token file visibly rebrands app + email; print preview of a filtered day is clean.

### WP-12: Sheet Linter & Schema Adapter *(after WP-3; the generalization seam)*
- [ ] `DataProvider` interface; RTDB/Sheets/CSV behind it.
- [ ] Mapping config (client column → canonical key) + validation report: missing fields, unknown locations/departments, bad times, duplicate ids, malformed comma lists.
- [ ] Linter runs in CI *and* in the Apps Script push (reject-with-report); report surfaces in the WP-6 panel.
- **Acceptance:** feeding a deliberately broken sheet yields a human-readable issue list, not a broken UI; vocabulary matches `schema-template/README.md`.

### WP-13: Pitch Assets ∥ *(after WP-7)*
- [ ] 90-sec demo capture: sheet edit → two phones (admin vs guest roles) updating live and differently.
- [ ] One-page PDF: value prop, tier table (feature flags ↔ pricing, incl. Tier 1 `.ics` vs Tier 2 Workspace-native), 3 screenshots, data-handling note (§10.2).
- **Acceptance:** assets reviewed against §9 customer table; The Portal referral ask drafted.

---

## 13. Closing Note

The unusual asset here is unchanged from v1 — treating the client's spreadsheet as the database *and* the admin panel — but the Firebase/Workspace pivot raises the stakes in both directions. Done well, "check a box in the sheet and your rigger has the calendar on her phone" is a pitch no competitor in this niche can match. Done carelessly, a deprecated database secret in a client-visible script, a sync that silently dies on Tuesday, or an ex-contractor who still sees the BOH schedule will each cost more trust than the feature earned. Harden the pipeline (§4), keep the `.ics` tier underneath the Workspace tier (§8.2), and extract the engine after the Option B milestone — every event after MARTIANS then gets cheaper while every pitch gets stronger.
