# CLAUDE.md — Working Rules for The Portal Map App

## 0. First thing every session
**Read `sprintboard.md` before doing any work.** It is the handoff source of truth: current state, locked decisions, task board, and session log. When you finish meaningful work, **append to its Session Log** and check off completed tasks. Do not let it drift from reality.

## 1. What this project is
A private, reusable interactive **map + run-of-show schedule** app for The Portal (event production company). Fork of our public `bbb-map-app`. Built on a sample event ("MARTIANS", Montalcino, Tuscany). Goal: prove the concept, codify a reusable master schema, and stage operational (role-based) features. See `proposal.md` for the two pricing tiers.

## 2. Stack & key files
- **Next.js 16 / React 19 / TypeScript.** Google Maps via `@vis.gl/react-google-maps`.
- `src/app/page.tsx` — server entry; calls `getFestivalData()`.
- `src/lib/festival-data.ts` — **data layer**: parses KMZ placemarks + `ROS by TIME` xlsx → venues + events.
- `src/components/festival-map-app.tsx` — the main client view (~2,880 lines; map, filters, search, timeline). **Change surgically.**
- `src/app/admin/*`, `src/proxy.ts` — admin gate (currently a single shared cookie/password). `src/components/admin/pin-editor.tsx` — pin CRUD.
- `src/types/festival.ts`, `src/types/admin-entry.ts`, `src/data/festival.ts` — types + label maps.

## 3. Locked decisions (do not re-litigate without the client)
- Build **toward Option B, ship Option A first**.
- **Google Maps** (client supplies billed API key) — do not swap map providers.
- Deploy **Firebase, password-protected**.
- Brand with **client's real assets** (pending) — use a neutral Portal interim theme meanwhile.

## 4. Data rules
- **Remote-first.** The canonical data source is the **live Google Sheet** (`GOOGLE_SHEETS_SPREADSHEET_ID=1rpmzT4_6NlAOSryN86ROv3mv1Jf4ydColAlk6MrY1zw`), read remotely (CSV export today; Sheets API once credentials exist). Local `MARTIANS map.kmz` / `ROS_VVEX.xlsx` are archived in `OFFLINE/` (gitignored) — **ignore them; never wire the app to them.**
- Canonical tabs: **`Locations`**, **`Personnel`**, **`ROS`** (structured). `ROS BY TIME` / `ROS BY AREA` are legacy source/derived grids — not read by the app. Schema + data dictionary: `schema-template/README.md`; column shapes mirror `schema-template/*.csv`.
- The Google My Map (`/edit` link) is **private** → KML export 403s. `Locations` lat/lng are **synthetic** until real coords arrive or the map is shared "anyone with link can view."
- **Never commit real contact/PII data.** Synthetic only (`*.example` emails). Keep the demo password-gated.
- Don't reintroduce the old Bombay Beach / BBB data pipeline — it was deliberately removed.

## 5. How to work here
- Match the surrounding code's style, naming, and structure. No broad rewrites of the big component in early milestones.
- Before claiming something works, run it: `npm install`, `npm run dev`, `npm run lint`, `npm run build`. Report failures with the actual output.
- Map rendering needs `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local` (and Firebase config/env). Never commit `.env*`.
- Prefer small, reviewable commits. Branch off `main`; don't commit/push unless asked. **Do NOT add any Co-authored-by or co-committer trailers to commit messages. Agents must never take co-author credit or use the antigravity@google.com email.**
- **Never push to remote without explicit permission from the user.** The repository is configured with a git pre-push hook that prevents pushes unless interactive confirmation is given, or bypassed via `PORTAL_ALLOW_PUSH=true git push`.
- Keep `proposal.md`, `sprintboard.md`, and the schema template consistent with each other when scope changes.

## 6. Commands
```bash
npm install          # node_modules is not checked in
npm run dev          # local dev server
npm run lint         # eslint
npm run build        # production build / type-check gate
```

## 7. Open inputs blocking full delivery
Tracked in `sprintboard.md` §3 — Google Maps key, brand assets, vocabulary/role sign-off, Firebase ownership. Don't invent final answers to these; flag them.
