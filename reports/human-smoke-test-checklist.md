# Human-in-the-Loop Smoke Test Checklist & Guide

Use this guide to manually validate all integration flows, backend systems, and user interface features for **Sprint 2 (Pipeline Trust & Backend Integration)** and **Sprint 3 (Day-of-Show & Frontend Experience)**.

---

## 📅 Sprint 2: Pipeline Trust & Backend Systems

These tests verify database synchronization, email deliverability, permission gating, and the automated offboarding pipeline.

### 1. ⚙️ Apps Script Trigger Execution
*Verify that the background Google Sheet-to-Firebase synchronization runs automatically.*

- [x] **Step 1:** Open the master Google Sheet.
- [x] **Step 2:** Navigate to **Extensions** $\rightarrow$ **Apps Script** to open the Apps Script editor.
- [x] **Step 3:** On the left sidebar, click the alarm clock icon (**Triggers**).
- [x] **Step 4:** Verify there is a trigger for `syncAllToFirebase`. If no trigger exists, click **Add Trigger** (bottom right) and configure:
  - Choose which function to run: **`syncAllToFirebase`**
  - Choose which deployment should run: **`Head`**
  - Select event source: **`Time-driven`**
  - Select type of time-based trigger: **`Minutes timer`**
  - Select minute interval: **`Every 5 minutes`** (or 10/15 depending on current config).
- [x] **Step 5:** Click **Save**. (You may need to complete Google OAuth/authorization permissions flow).
- [x] **Step 6:** Click on **Executions** in the left sidebar and verify recent runs list as `Completed` without errors.

---

### 2. 📧 Email Deliverability Check
*Ensure onboarding emails land in the primary inbox rather than the spam folder.*

- [x] **Step 1:** Open the master Google Sheet and click the **`Personnel`** tab.
- [x] **Step 2:** Add a new test row with a Gmail address you own.
- [x] **Step 3:** *(Optional)* Add a second test row with an Outlook/Hotmail address you own.
- [x] **Step 4:** Set the **`active`** column to `TRUE` (checked) for your test row(s).
- [x] **Step 5:** Check the **`Send Invite`** checkbox in your test row(s).
- [x] **Step 6:** Wait for the Apps Script trigger to fire (or click **Run** on the `syncAllToFirebase` function manually inside Apps Script).
- [x] **Step 7:** Open your test email inbox(es).
- [x] **Step 8:** Confirm the email arrived in the **Primary Inbox** (not Spam/Junk).
- [x] **Step 9:** Verify the email body matches the branded template in [onboarding.html](file:///Users/user/dev/portal-dev/scripts/email-templates/onboarding.html) and contains correct links.
- [x] **Step 10 (Admin Compact Links Check):** Onboard a test user marked as Admin (or with "All Departments"). Verify the received onboarding email does not show a long vertical list of individual calendar links, but instead displays a compact, bullet-separated inline list of calendars (e.g., *ATPF • Electricity • F&B*) enclosed in a grey border box.
- [x] **Step 11 (Ampersand Email Check):** Onboard a test user with department list including `"F&B"`. Set `Send Invite` to `TRUE` and run the script.
- [x] **Step 12:** Verify the received onboarding email displays `"F&B"` under departments and contains a subscription link for the `"F&B"` calendar.
- [x] **Step 13 (Ampersand Group Verification):** Confirm in the Google Workspace Admin Console that the user was added to `f&b@yourdomain.com` (not `f-b@yourdomain.com`) and that no duplicate `f-b` group was created.
- [x] **Step 14 (Onboarding Email Idempotency Check):** Onboard a test user by checking `Send Invite` = `TRUE`. Run `syncAllToFirebase()`. Verify exactly one email arrives. Verify `invite_status` updates to `"Onboarded on <Timestamp>; email:ok"` and `send_invite` is set to `FALSE`. Run sync again and confirm zero duplicate emails are sent.

---

### 3. 🔐 Offboarding Flow Verification
*Ensure that toggling a user to inactive immediately revokes Google Workspace and application access.*

- [x] **Step 1:** Onboard a test user (e.g. `offboard-test@example.com`) in the **`Personnel`** sheet, checking `active`, and assigning them to a department (e.g., `Lighting`).
- [x] **Step 2:** Open the Google Workspace Admin Console and verify the email has been added to the department group (e.g. `lighting-rigging@yourdomain.com`). *(Skipped: Groups bypassed in script test)*
- [x] **Step 3:** Go back to the **`Personnel`** sheet and uncheck the **`active`** checkbox (setting it to `FALSE`) for their row.
- [x] **Step 4:** Run the Apps Script synchronization.
- [x] **Step 5:** **Verify Workspace Cleanups:** Confirm in the Admin Console that the email was successfully removed from the department group. *(Skipped: Groups bypassed in script test)*
- [x] **Step 6:** **Verify Sheet Logging:** Confirm the `invite_status` column in the Google Sheet has updated to `"Offboarded on <Timestamp>"`.
- [x] **Step 7:** **Verify Database Update:** Open the Firebase Console, go to the Realtime Database under `/auth-directory/offboard-test,example,com`, and verify that `active` is set to `false`.
- [x] **Step 8:** **Verify Application Gating:** Attempt to log into the web application with the inactive email address. Confirm that the custom token route blocks authentication and returns a `403 Forbidden` error.
- *Refer to the [offboarding-runbook.md](file:///Users/user/dev/portal-dev/reports/offboarding-runbook.md) for more details.*

---

### 4. 🏥 Data-Health Admin Dashboard
*Verify the admin health panel alerts administrators when synchronization heartbeat goes stale.*

- [ ] **Step 1:** Navigate to the Web App Admin Health Dashboard at [/admin/health](file:///Users/user/dev/portal-dev/src/app/admin/health/page.tsx) (or staging equivalent).
- [ ] **Step 2:** Note the "Last Sync Status" or "Sync Heartbeat" timestamp (it should be green if the sync ran recently).
- [ ] **Step 3:** Go to the Apps Script Trigger dashboard and temporarily pause or delete the time-driven trigger.
- [ ] **Step 4:** Wait 10 minutes.
- [ ] **Step 5:** Refresh the [/admin/health](file:///Users/user/dev/portal-dev/src/app/admin/health/page.tsx) page.
- [ ] **Step 6:** Confirm the sync status indicator turns **red** with a stale heartbeat warning.
- [ ] **Step 7:** Re-enable the trigger (or run the sync script manually) and confirm the dashboard status indicator turns **green** again.

---

### 5. 🗂️ Multi-Department Filtering
*Ensure that users assigned to multiple teams are parsed correctly and visible under all filters.*

- [ ] **Step 1:** Open the Google Sheet and select the **`Personnel`** tab.
- [ ] **Step 2:** Locate a test user and update their department to a comma-separated list (e.g. `Lighting, Rigging`).
- [ ] **Step 3:** Run the spreadsheet sync.
- [ ] **Step 4:** Open the web application and click the **Filters & Search** panel.
- [ ] **Step 5:** Confirm that `Lighting` and `Rigging` are available as separate selectable filter chips.
- [ ] **Step 6:** Select `Lighting` $\rightarrow$ verify the user's events appear.
- [ ] **Step 7:** Select `Rigging` $\rightarrow$ verify the user's events also appear.

---

### 6. 💾 RTDB Persistence (Admin Pins)
*Confirm that custom map pins added by admins persist in Firebase and survive app redeployments.*

- [ ] **Step 1:** Access the application's Admin Panel at `/admin` using your admin password or authorized email.
- [ ] **Step 2:** Locate the custom pin editor and create a new pin (label: `Test Pin`, category: `Venue`, coordinates: `43.0583, 11.4883`).
- [ ] **Step 3:** Open the Firebase Console, go to the Realtime Database, and check that the pin is stored under `/admin-data/entries`.
- [ ] **Step 4:** Restart your local development server (`npm run dev`) or trigger a staging redeployment.
- [ ] **Step 5:** Load the main Map View.
- [ ] **Step 6:** Confirm that the custom `Test Pin` remains visible on the map.

---

### 7. 🩹 Apps Script Calendar Self-Healing
*Verify that the sync script automatically recreates deleted or invalid department Google Calendars.*

- [ ] **Step 1:** In the **Departments** sheet, find any department row and temporarily corrupt its `google_calendar_id` (e.g., append `_deleted` to the end of the ID).
- [ ] **Step 2:** Run the Google Apps Script sync manually.
- [ ] **Step 3:** Verify the execution logs show `Inaccessible calendar ID...` followed by `Creating missing/inaccessible calendar...`.
- [ ] **Step 4:** Confirm in the spreadsheet that the corrupted ID has been replaced with a brand new, valid calendar ID.

---

### 8. 📅 Apps Script Calendar Procedural Sync & Prune State Machine
*Verify that event sync uses procedural two-level MD5 hashing to update events in-place and prune deleted rows without duplicates.*

- [x] **Step 1 (Initial Sync & Metadata Registry):** Run `syncAllToFirebase()`. Open Firebase Console $\rightarrow$ Realtime Database $\rightarrow$ `/crew-data/metadata/calendar-events` and confirm `semantic_key` entries are created storing `content_hash` and dot-escaped `gcal_event_ids`.
- [x] **Step 2 (Idempotent Unchanged Sync):** Re-run `syncAllToFirebase()` without modifying the sheet. Verify logs show `0 updated, 0 added, 0 pruned, N unchanged`. Confirm Google Calendar API was not called and 0 duplicate events were created.
- [x] **Step 3 (In-Place Time & Detail Patch):** Modify an event's start/end time or description in the `ROS by TIME` sheet. Run `syncAllToFirebase()`. Verify logs show `1 updated, 0 added, 0 pruned, N-1 unchanged`. Open Google Calendar and verify the event updated in-place without creating a duplicate.
- [x] **Step 4 (Automated Event Pruning):** Delete an event row from `ROS by TIME`. Run `syncAllToFirebase()`. Verify logs show `1 pruned`. Open Google Calendar and confirm the deleted event was purged from all assigned department calendars.

---

## ⚡ Sprint 3: Day-of-Show & Frontend Experience

These tests verify client-side interactivity, map-linkage, starred agendas, offline PWA capabilities, and live data syncing.

### 1. ⚡ Now & Next Dashboard View
*Verify the default dashboard layout and simulated clock mode.*

- [ ] **Step 1:** Click the **⚡ Now & Next** tab in the main header.
- [ ] **Step 2:** Verify that if the current real time is outside the event dates (Aug 24–27, 2026), an amber **Simulated Time** badge appears.
- [ ] **Step 3:** Verify that the simulated clock starts from the first day of the event (August 24, 2026).
- [ ] **Step 4:** Verify that events happening *now* render in the left column with a green active indicator and progress bar.
- [ ] **Step 5:** Verify that upcoming events (happening in the next 2 hours) render in the right column with an amber indicator.
- [ ] **Step 6:** Click any event card in this view and verify the Event Modal opens with the correct details.

---

### 2. 🗺️ Map Legend & Popups
*Check legend pin filtering, popover event lists, and deep directions linking.*

- [ ] **Step 1:** Navigate to the **Map View** (third tab).
- [ ] **Step 2:** Locate the floating **Legend** overlay on the map.
- [ ] **Step 3:** Click a category chip (e.g., *Venue* or *Forest*) to toggle it off. Verify that matching pins disappear from the map.
- [ ] **Step 4:** Click the category chip again to turn it back on. Verify the pins reappear.
- [ ] **Step 5:** Click an active map pin to open its InfoWindow popover.
- [ ] **Step 6:** Confirm that the popover displays:
  - Location title and category.
  - A chronological list of events scheduled at that location today.
  - A clickable "Directions" button.
- [ ] **Step 7:** Click the **Directions** button.
- [ ] **Step 8:** Confirm it opens a new browser tab with Google Maps navigation loaded for those coordinates (`https://maps.google.com/?daddr=lat,lng`).

---

### 3. 🔗 Bidirectional Modal Navigation
*Verify seamless linkage between schedule event modals and map markers.*

- [ ] **Step 1:** Navigate to the Schedule Timeline or Calendar Grid.
- [ ] **Step 2:** Click any event to open its detail modal.
- [ ] **Step 3:** Click the blue **📍 Show on Map** button.
- [ ] **Step 4:** Confirm the app switches automatically to the **Map View** tab.
- [ ] **Step 5:** Confirm the map centers and zooms (level 16) directly on the location coordinates.
- [ ] **Step 6:** Confirm the map InfoWindow popover opens automatically for that location.

---

### 4. ⭐ Starred Agendas & "My Schedule"
*Ensure bookmarked schedules sync properly and fall back to local storage when unauthenticated.*

- [ ] **Step 1:** Star multiple events by clicking the star icon on their cards (in lists, grid, dashboard, or modal).
- [ ] **Step 2:** Open browser DevTools $\rightarrow$ Application $\rightarrow$ Local Storage, inspect the key `portal_starred_ids`, and verify the starred event IDs are saved.
- [ ] **Step 3:** Click the header star icon tab (**⭐**).
- [ ] **Step 4:** Confirm all schedules (Calendar View, Schedule Grid, and Running Schedule) filter to display *only* starred events.
- [ ] **Step 5 (Cross-Device Sync):** Log in as an approved user on two different browsers/devices. Star an event on device A; verify it highlights on device B in real-time.
- [ ] **Step 6 (RTDB Verification):** Open the Firebase Database console and confirm starred events are saved under `/user-data/$escaped_email/starred`.

---

### 5. 📱 PWA Offline & Install Support
*Verify the application operates offline using cached assets.*

- [ ] **Step 1:** Access the application over a secure HTTPS staging URL.
- [ ] **Step 2:** Verify that the browser address bar prompts an "Install App" or "Add to Home Screen" option.
- [ ] **Step 3:** Open browser DevTools, go to the Network tab, and toggle the connection to **Offline** (or disconnect your internet/WiFi).
- [ ] **Step 4:** Refresh the page.
- [ ] **Step 5:** Confirm the application shell loads successfully from the service worker cache.
- [ ] **Step 6:** Confirm a red **Offline Mode** banner appears in the header showing the last successful sync time.
- [ ] **Step 7:** Verify that you can still browse cached events and locations.

---

### 6. 🔗 URL State Synchronization
*Verify deep links preserve filter and navigation settings.*

- [ ] **Step 1:** Select a specific day from the day selector dropdown (e.g. *Mon, Aug 24*).
- [ ] **Step 2:** Type a query in the search input (e.g. "lunch").
- [ ] **Step 3:** Select a category chip filter (e.g. "Service").
- [ ] **Step 4:** Verify that the browser URL query string updates to reflect the active filters (e.g. `?v=timeline&d=2026-08-24&q=lunch`).
- [ ] **Step 5:** Copy the URL.
- [ ] **Step 6:** Open an incognito browser tab, paste the URL, and press Enter.
- [ ] **Step 7:** Confirm that the app restores the exact same view, day selection, search text, and filter selections.

---

### 🔔 Real-Time Changed-Event Toasts
*Verify users are notified immediately when event data changes on the server.*

- [ ] **Step 1:** Open the web app on your screen.
- [ ] **Step 2:** In a separate window, open the Google Sheet (or Firebase Database Console).
- [ ] **Step 3:** Edit an event's start time or location.
- [ ] **Step 4:** Return to the web app window.
- [ ] **Step 5:** Confirm a toast notification slides in at the bottom-right of the screen summarizing the change (e.g., *"Lunch updated: Location: HQ (was Forest)"*).

---

## 🛠️ Sprint 4: Productization & Commercial Readiness

These manual verification steps validate tokenized calendar subscriptions, vendor magic links, schema linting, and data provider failovers.

### 1. 📅 Tokenized `.ics` Feed Subscriptions
*Verify role and department calendar feeds import into Apple/Google Calendar with PDT timezone integrity.*

- [ ] **Step 1:** Open your browser and navigate to `/api/ics?token=demo-token` (or add a department parameter e.g., `/api/ics?token=demo-token&dept=lighting`).
- [ ] **Step 2:** Confirm a `.ics` file named `the-portal-schedule.ics` downloads.
- [ ] **Step 3:** Open the downloaded `.ics` file or import the URL into Apple Calendar, Google Calendar, or Outlook.
- [ ] **Step 4:** Confirm the events import cleanly and that event start/end times evaluate in PDT (`America/Los_Angeles`).
- [ ] **Step 5 (Token Revocation Test):** In Firebase Console under `/crew-data/tokens/demo-token`, set `revoked` to `true` (or use a revoked token). Request `/api/ics?token=demo-token` again.
- [ ] **Step 6:** Confirm the API returns a `410 Gone` HTTP status with `"Calendar subscription token has been revoked."`.

---

### 2. 🔗 Vendor Magic Links
*Verify frictionless, read-only mobile schedule access for external contractors without requiring user authentication.*

- [ ] **Step 1:** Open a mobile browser or set DevTools to mobile viewport (e.g. 390px iPhone).
- [ ] **Step 2:** Navigate to `/vendor?token=Lighting` (or `/vendor?token=Audio`).
- [ ] **Step 3:** Confirm the page renders a streamlined, read-only schedule view titled **The Portal — Vendor View**.
- [ ] **Step 4:** Confirm that NO Google login or password prompt is requested.
- [ ] **Step 5:** Confirm that only shifts matching that vendor/department are listed.
- [ ] **Step 6:** Click the **📅 Subscribe to Calendar (.ics)** button at the top of the vendor view and confirm it downloads their vendor-scoped `.ics` feed.

---

### 3. 🔍 Data-Health Schema Linter Report
*Verify the automated schema linter catches data quality issues and displays them on the admin panel.*

- [ ] **Step 1:** Log into the web app as Admin and navigate to [/admin/health](file:///Users/vincentnaples/Documents/github/portal-dev/src/app/admin/health/page.tsx).
- [ ] **Step 2:** Confirm a new card titled **🔍 Schema Validation & Quality Report** appears.
- [ ] **Step 3:** Verify summary badges display counts for **Errors**, **Warnings**, and **Info** issues.
- [ ] **Step 4 (Validation Error Test):** In the Google Sheet, temporarily add an event with an unmapped location name (e.g., `NonExistentStage`).
- [ ] **Step 5:** Trigger a sync (or run Apps Script) and refresh [/admin/health](file:///Users/vincentnaples/Documents/github/portal-dev/src/app/admin/health/page.tsx).
- [ ] **Step 6:** Confirm the Linter Report flags an **[LOCATION]** error stating `Location "NonExistentStage" referenced by ... does not match any known venue`.

---

### 4. 🗄️ DataProvider Seam & Gateway Health
*Verify active data gateway provider reporting.*

- [ ] **Step 1:** Open [/admin/health](file:///Users/vincentnaples/Documents/github/portal-dev/src/app/admin/health/page.tsx).
- [ ] **Step 2:** Inspect the **Active Data Gateway** card.
- [ ] **Step 3:** Confirm it correctly identifies the active provider backend (`Firebase RTDB (/crew-data)`, `Google Sheet (OAuth)`, or `Public CSV`).

---

### 5. 🔑 Dedicated Magic Links & Feeds Admin Management Page
*Verify generator, copy controls, and testing shortcuts on `/admin/magic-links`.*

- [ ] **Step 1:** Log into the web app as Admin and navigate to [/admin/magic-links](file:///Users/vincentnaples/Documents/github/portal-dev/src/app/admin/magic-links/page.tsx) or click **`🔑 Magic Links & Feeds`** in the header.
- [ ] **Step 2:** Type a vendor token/department name (e.g. `Lighting` or `Audio`).
- [ ] **Step 3:** Click **📋 Copy Link** for the Vendor Schedule Magic Link, paste into a browser window, and confirm it copies correctly.
- [ ] **Step 4:** Click **📋 Copy Feed URL** for the iCal Subscription Feed, paste into a browser window, and confirm it downloads the `.ics` file.
- [ ] **Step 5:** Click **↗ Open Vendor Mobile View** and confirm it opens the vendor view page in a new browser tab.

---

### 6. 📍 Master Locations Registry, Addresses & TSV Export / Supersession
*Verify location addresses, coordinates, TSV export, and automatic pin supersession on `/admin`.*

- [ ] **Step 1:** Log into the web app as Admin and navigate to [/admin](file:///Users/vincentnaples/Documents/github/portal-dev/src/app/admin/page.tsx) or click **`📍 Locations`** in the header.
- [ ] **Step 2:** Inspect the **📍 Event Locations Registry** table and confirm real street addresses (e.g. `Reno Arch, 345 N`, `9:20 & I`, `2:00 & K`) and Lat/Lng coordinates load from the Google Sheet.
- [ ] **Step 3:** Scroll to **📍 Custom Map Pin Overlays** and click **📋 Copy Pins for Google Sheet**.
- [ ] **Step 4:** Open the Google Sheet **`Locations`** tab, click column A in a new row, and paste (`Cmd+V`). Confirm all columns (`Location`, `Aliases`, `Address`, `Lat`, `Long`, `Description`) paste cleanly into separate columns.
- [ ] **Step 5:** Run the spreadsheet sync.
- [ ] **Step 6:** Refresh [/admin](file:///Users/vincentnaples/Documents/github/portal-dev/src/app/admin/page.tsx) and verify the custom pin now displays a green badge: **`✓ In Sheet (Superseded)`**.

---

### 7. 🗺️ Google Maps `ApiProjectMapError` Diagnostic Alert Overlay
*Verify user-friendly guidance appears if Google Maps API key authentication fails.*

- [ ] **Step 1:** Open the web app on Map View.
- [ ] **Step 2 (Simulated Auth Failure):** If an invalid API key or restricted referrer is used, verify a clean red diagnostic card appears over the map titled **Google Maps API Key Error (ApiProjectMapError)**.
- [ ] **Step 3:** Confirm the card provides step-by-step instructions:
  1. Enable Maps JavaScript API on GCP project.
  2. Confirm Billing is attached.
  3. Check API Key Application Restrictions.

---

### 8. ⚡ Now & Next Fallback & All-Day / TBD Column
*Verify fallback to future events when beyond 2 hours and display of unscheduled/all-day shifts.*

- [ ] **Step 1:** Click **⚡ Now & Next** in the top navigation bar.
- [ ] **Step 2:** If current time is outside event hours, verify the 2nd column title displays **`Upcoming Next (Next Scheduled)`** (instead of empty `No upcoming events in next 2 hours`).
- [ ] **Step 3:** Confirm the next scheduled upcoming events are listed chronologically with start countdown badges (e.g. `⏳ starts in 5h 30m`).
- [ ] **Step 4:** Inspect the 3rd column: **`🗓️ All-Day & Flexible / TBD`**.
- [ ] **Step 5:** Confirm all-day or unscheduled shifts (e.g., shifts with `TBD` times or dates) are rendered here with `📋 All-Day / Unscheduled` badges.
- [ ] **Step 6:** Click any card in the All-Day column and verify the Event Modal opens correctly.

---

## 📋 Master Summary of Open Human Smoke Test Items

Use this consolidated checklist during your final manual testing pass across Sprints 2, 3, and 4:

- [ ] **1. 🏥 Data-Health Heartbeat Alert (`/admin/health`):** Pause Apps Script trigger $\rightarrow$ wait 10m $\rightarrow$ confirm indicator turns red; re-enable $\rightarrow$ turns green.
- [ ] **2. 🗂️ Multi-Department Filtering:** Set personnel department to `Lighting, Rigging` $\rightarrow$ verify both chips appear and filter correctly.
- [ ] **3. 💾 RTDB Admin Pins Persistence (`/admin`):** Add a custom pin $\rightarrow$ verify saved under `/admin-data/entries` $\rightarrow$ restart dev server $\rightarrow$ confirm pin persists on map.
- [ ] **4. 🩹 Apps Script Calendar Self-Healing:** Corrupt `google_calendar_id` in sheet $\rightarrow$ run sync $\rightarrow$ verify log shows creation and sheet updates with new valid calendar ID.
- [ ] **5. ⚡ Now & Next Dashboard & Fallback:** Verify active events in col 1, next upcoming events in col 2 (even if >2h away, labeled `Upcoming Next (Next Scheduled)`), and all-day/TBD shifts in col 3.
- [ ] **6. 🗺️ Map Legend & InfoWindow Directions:** Toggle category chips in legend $\rightarrow$ click map pin $\rightarrow$ click **Directions** button $\rightarrow$ confirm Google Maps navigation opens in new tab.
- [ ] **7. 🔗 Bidirectional Modal Navigation:** Open event modal $\rightarrow$ click **📍 Show on Map** $\rightarrow$ confirm view switches to Map View, centers/zooms (level 16), and opens InfoWindow.
- [ ] **8. ⭐ Starred Agendas & Realtime Sync:** Star events $\rightarrow$ check `portal_starred_ids` in Local Storage $\rightarrow$ filter by star icon tab $\rightarrow$ test real-time sync across two logged-in browsers.
- [ ] **9. 📱 PWA Offline & Install Shell:** Test over HTTPS staging URL $\rightarrow$ verify "Install App" prompt $\rightarrow$ set Network to Offline $\rightarrow$ refresh and confirm app shell loads with red Offline banner.
- [ ] **10. 🔗 URL State Synchronization:** Select day, search text, and category filter $\rightarrow$ copy URL (`?v=timeline&d=2026-08-24&q=lunch`) $\rightarrow$ open in incognito window $\rightarrow$ verify exact state restores.
- [ ] **11. 🔔 Real-Time Changed-Event Toasts:** Keep web app open $\rightarrow$ edit event in sheet or Firebase $\rightarrow$ confirm toast notification slides in summarizing change.
- [ ] **12. 📅 Tokenized `.ics` Feed Subscriptions:** Download `/api/ics?token=demo-token` $\rightarrow$ import into Apple/Google Calendar $\rightarrow$ confirm PDT timezone (`America/Los_Angeles`) $\rightarrow$ revoke token $\rightarrow$ confirm HTTP 410.
- [ ] **13. 🔗 Vendor Magic Links:** Open mobile viewport $\rightarrow$ visit `/vendor?token=Lighting` $\rightarrow$ verify read-only view loads without password prompts, filtered to vendor shifts.
- [ ] **14. 🔍 Data-Health Schema Linter Report:** Open [/admin/health](file:///Users/vincentnaples/Documents/github/portal-dev/src/app/admin/health/page.tsx) $\rightarrow$ add unmapped location name to sheet $\rightarrow$ sync $\rightarrow$ verify Linter Report flags `[LOCATION]` error.
- [ ] **15. 🔑 Magic Links & Feeds Admin Page:** Open [/admin/magic-links](file:///Users/vincentnaples/Documents/github/portal-dev/src/app/admin/magic-links/page.tsx) $\rightarrow$ type vendor name $\rightarrow$ test **Copy Link**, **Copy Feed URL**, and **↗ Open Vendor Mobile View**.
- [ ] **16. 📍 Locations Registry & TSV Exporter / Supersession:** Open [/admin](file:///Users/vincentnaples/Documents/github/portal-dev/src/app/admin/page.tsx) $\rightarrow$ verify street addresses & coordinates $\rightarrow$ click **Copy Pins for Google Sheet** $\rightarrow$ paste into sheet $\rightarrow$ sync $\rightarrow$ verify pin status updates to `✓ In Sheet (Superseded)`.

