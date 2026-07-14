# Walkthrough — Sprint 3 (Day-of-Show & Map Linking)

We have completed the implementation and verification of all Day-of-Show Experience and Map Linkage features. The code successfully passes all TypeScript types, eslint validation rules, unit tests, and production compilation builds.

## Key Accomplishments

### 1. Day-of-Show UX & Active Dashboards
- **Now & Next View (`NowNext.tsx`):** A custom view dashboard (placed as the **fourth** tab) rendering a live clock, dynamic simulated time indicator, a happening-now list with visual progress bars showing percentage complete, and upcoming-next lists.
- **Changed-Event Toasts (`Toasts.tsx`):** Displays sliding notification alerts when event listings (such as schedules, times, or locations) are dynamically updated in the database.
- **Clock & Ticker Synchronization:** Configured a global 1-minute ticker hook inside `EventApp.tsx` that determines if the user is in actual event time or fallback simulated time (first day of the event, keeping current HH:MM:SS), keeping active clocks accurate.
- **Auto-Scrolling Today Indicator Line:** Draws a horizontal time indicator line across the today calendar grid column inside `CalendarView.tsx` and automatically scrolls to center the viewport on it upon loading.
- **Countdown Indicators:** Appended live badges indicating "ends in Xm" or "starts in Xh Xm" inside `RunningSchedule.tsx`, `ScheduleGrid.tsx`, and `NowNext.tsx`.

### 2. Starred Personal Agendas & Header Toggles
- **Real-Time Starring Synchronization (`useStarredEvents.ts`):** Syncs starred events to Firebase Realtime Database path `/user-data/$escaped_email/starred` with an automated local localStorage fallback for guests or offline clients.
- **Stars toggles:** Integrated interactive star controls inside both the sidebar chronological list cards and the `EventModal.tsx` details view.
- **Header "⭐" Tab:** Replaced the screen-cluttering date button bar with a simple, compact `⭐` icon tab button in the header toolbar to toggle the starred personal agenda overlay.

### 2b. Day Filter Integration
- **Day Selector Dropdown:** Integrated a clean, searchable "Day" dropdown selector inside the sidebar / mobile drawer filter panel (`FilterBar.tsx`), completely eliminating the bulky date buttons bar from the top of the schedule.
- **Day Chips:** Rendered a dismissible day chip indicator inside the active filters row for simple clear-all accessibility.

### 3. Bidirectional Map Linkages & Popups
- **Programmatic Marker Sync:** Event modal cards now render a "Show on Map" button that automatically changes the active view to the Google Map, pans/zooms to center the venue marker, and pops open its active event info window.
- **Info Window Enhancements (`MapView.tsx`):** venue markers display an HTML infowindow detailing active events, category badges, and deep links to Google Maps driving/walking directions.
- **Collapsible Category Legend (`Legend.tsx`):** Renders a styled legend floating overlay over the Map that lets users toggle marker visibilities dynamically based on venue category (e.g. Venue, Forest, Transport, crew, etc.).

### 4. PWA Caching & Offline Support
- **PWA Asset Configurations:** Penned `public/manifest.json` and a caching service worker `public/sw.js` registering them within `EventApp.tsx` and metadata headers inside `layout.tsx`.
- **Offline hydration:** Hooked cached snapshots into `useEventData.ts` to instantly restore database values when connection drops or is unavailable.

---

## Changed Files

### [NEW]
- [url-state.ts](file:///Users/vincentnaples/Documents/github/portal-dev/src/lib/url-state.ts) — Parses and serializes URL state query parameters.
- [useStarredEvents.ts](file:///Users/vincentnaples/Documents/github/portal-dev/src/hooks/useStarredEvents.ts) — Starred events real-time RTDB synchronization hook.
- [NowNext.tsx](file:///Users/vincentnaples/Documents/github/portal-dev/src/components/event/NowNext.tsx) — Now & Next dashboard widget component.
- [Toasts.tsx](file:///Users/vincentnaples/Documents/github/portal-dev/src/components/event/Toasts.tsx) — Alert toast stack.
- [Legend.tsx](file:///Users/vincentnaples/Documents/github/portal-dev/src/components/event/Legend.tsx) — Floating map categories toggle sidebar.
- [manifest.json](file:///Users/vincentnaples/Documents/github/portal-dev/public/manifest.json) — PWA installation configuration.
- [sw.js](file:///Users/vincentnaples/Documents/github/portal-dev/public/sw.js) — Stale-while-revalidate service worker.
- [url-state.test.ts](file:///Users/vincentnaples/Documents/github/portal-dev/src/lib/url-state.test.ts) — Unit tests for URL state parsing and serializing.

### [MODIFY]
- [route.ts](file:///Users/vincentnaples/Documents/github/portal-dev/src/app/api/auth/firebase-token/route.ts) — Escaped email claim token injections.
- [database.rules.json](file:///Users/vincentnaples/Documents/github/portal-dev/database.rules.json) — `/user-data` path authorization security rules.
- [useEventData.ts](file:///Users/vincentnaples/Documents/github/portal-dev/src/hooks/useEventData.ts) — Offline storage hydration.
- [EventModal.tsx](file:///Users/vincentnaples/Documents/github/portal-dev/src/components/event/EventModal.tsx) — Starring and Show on Map buttons.
- [MapView.tsx](file:///Users/vincentnaples/Documents/github/portal-dev/src/components/event/MapView.tsx) — InfoWindow direction deep links, category markers, and programmatic centering.
- [CalendarView.tsx](file:///Users/vincentnaples/Documents/github/portal-dev/src/components/event/CalendarView.tsx) — Added event card DOM IDs for department and location lanes.
- [RunningSchedule.tsx](file:///Users/vincentnaples/Documents/github/portal-dev/src/components/event/RunningSchedule.tsx) — Added sidebar card click interceptor triggers.
- [ScheduleGrid.tsx](file:///Users/vincentnaples/Documents/github/portal-dev/src/components/event/ScheduleGrid.tsx) — Added row DOM IDs and conditional `.highlight-active` class rendering.
- [EventApp.tsx](file:///Users/vincentnaples/Documents/github/portal-dev/src/components/event/EventApp.tsx) — Added smooth scroll-into-view coordination, selection highlighting state, and capturing window scroll listeners to automatically clear highlights upon manual user scrolls.
- [layout.tsx](file:///Users/vincentnaples/Documents/github/portal-dev/src/app/layout.tsx) — Injected manifest link header in Next.js metadata.
- [globals.css](file:///Users/vincentnaples/Documents/github/portal-dev/src/app/globals.css) — Custom dashboard grids, glowing progress bars, legend templates, offline alerts, toast warnings, pulsing keyframe highlights, and persistent `.highlight-active` outline styling overrides.
- [sprintboard.md](file:///Users/vincentnaples/Documents/github/portal-dev/sprintboard.md) — Completed M3 Task Board checkpoints and appended log entry.

---

## Verification & Build Results

### 1. Unit Tests
All 24 unit tests completed successfully with `vitest run`:
- `csv-parsing.test.ts` (4/4 passed)
- `rtdb-validation.test.tsx` (3/3 passed)
- `filters-semantics.test.tsx` (5/5 passed)
- `time-math.test.ts` (2/2 passed)
- `location-matching.test.ts` (2/2 passed)
- `url-state.test.ts` (8/8 passed)

### 2. Lint Check
Executed `npm run lint`:
- 0 errors, 1 ignorable standard warning for Next.js `<img>` vs `<Image>` element.

### 3. Production Compilation Build
Executed `npm run build`:
- Turbopack compilation succeeded.
- TypeScript compilation succeeded with zero type-checking errors.
- Pre-render static pages compiled successfully.
