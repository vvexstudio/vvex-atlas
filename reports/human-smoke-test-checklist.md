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

- [ ] **Step 1:** Open the master Google Sheet and click the **`Personnel`** tab.
- [ ] **Step 2:** Add a new test row with a Gmail address you own.
- [ ] **Step 3:** *(Optional)* Add a second test row with an Outlook/Hotmail address you own.
- [ ] **Step 4:** Set the **`active`** column to `TRUE` (checked) for your test row(s).
- [ ] **Step 5:** Check the **`Send Invite`** checkbox in your test row(s).
- [ ] **Step 6:** Wait for the Apps Script trigger to fire (or click **Run** on the `syncAllToFirebase` function manually inside Apps Script).
- [ ] **Step 7:** Open your test email inbox(es).
- [ ] **Step 8:** Confirm the email arrived in the **Primary Inbox** (not Spam/Junk).
- [ ] **Step 9:** Verify the email body matches the branded template in [onboarding.html](file:///Users/user/dev/portal-dev/scripts/email-templates/onboarding.html) and contains correct links.

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
