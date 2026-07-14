# Human-in-the-Loop Smoke Test Checklist

Use this checklist to run a manual validation of the Sprint 3 Day-of-Show and Map Linkage features. 

---

## 1. Independent Verification (Testable Immediately in Local Dev)

These items require no Firebase credential setup or active Google Sheet write integration, and can be verified using the local dev environment (`npm run dev`) and synthetic data.

### 📋 Now & Next Dashboard View
- [ ] **Tab Switcher:** Navigate to the **⚡ Now & Next** view (the fourth tab in the header). Confirm it renders correctly.
- [ ] **Simulated Time Badge:** If current real time is outside the event dates (Aug 24–27, 2026), verify the amber **Simulated Time** badge appears and the clock runs using the first day of the event.
- [ ] **Happening Now Cards:** Verify active events render in the left column with a green indicator, showing accurate time duration and a moving green progress bar.
- [ ] **Upcoming Next Cards:** Verify upcoming events render in the right column with an amber indicator.
- [ ] **Card Details modal:** Click any event card in the dashboard. Verify it opens the correct Event Modal details.

### 🗺️ Map Legend & Popups
- [ ] **Legend Toggles:** Switch to the **Map View** (the third tab). Find the floating category **Legend** card on the map. Toggle category labels (e.g., *Venue* or *Forest*) on/off. Verify the corresponding map markers show and hide.
- [ ] **Popovers Active Events:** Click a map venue pin. Verify the popover InfoWindow displays:
  - Venue title and category.
  - A chronological list of active events happening at that location.
  - A clickable "Directions" button.
- [ ] **Google Directions Deep-Link:** Click the "Directions" button in any popover. Verify it opens a new browser tab with Google Maps navigation loaded for that coordinate.

### 🔗 Bidirectional Modal Navigation
- [ ] **Show on Map Integration:** Open the schedule list or timeline, click an event card to launch the **Event Modal**, and click the blue **📍 Show on Map** button.
  - Verify the tab automatically changes to the Map View.
  - Verify the map centers, zooms (level 16), and automatically opens the InfoWindow for the matching location.

### ⭐ Local Starred Agendas & "My Schedule"
- [ ] **Starring Toggle:** Click the star icon on any card (in the list, modal, or dashboard). Toggle it on and off.
- [ ] **Guest Fallback Caching:** Open browser Developer Tools, inspect `localStorage` under key `portal_starred_ids`. Confirm the IDs of your starred events are saved locally.
- [ ] **Starred Agenda Filter:** Click the header star icon tab button (**⭐**).
  - Verify the button highlights in gold.
  - Verify the Calendar View, Schedule Grid, and Running Schedule filter to display *only* your starred events.

### 📅 Live Calendar Time Line & Auto-Scroll
- [ ] **Live Line Draw:** Switch to the **Calendar Grid** view. If today is in the active filters, verify a red horizontal live line draws at the correct hour offset.
- [ ] **Live Line Dot & Label:** Verify a digital time label and glowing dot are attached to the left of the line.
- [ ] **Auto-Focus Scroll:** Open the Calendar view. Verify the calendar scroll body automatically centers on the live timeline.

### 🔗 URL State Synchronization & Day Filter Dropdown
- [ ] **Day Dropdown Selector:** Open the **Filters & Search** panel. Find the new **Day** selector dropdown. Select a specific day (e.g., *Mon, Aug 24*). Verify that the main schedule view, calendar grid, and sidebar timeline filter to show only events from that day.
- [ ] **URL Updates:** Open the app and modify search inputs, select days from the dropdown, filter category chips, or select active tabs. Watch the browser URL query string. Verify changes map to `v`, `d`, `e`, `q`, `loc`, `act`, `dept`, `lead`, or `my`.
- [ ] **URL Restoration:** Copy the modified URL query string (e.g. `?v=calendar&d=2026-08-25&q=lunch`), close the tab, open a new tab, and load the URL. Verify all tabs, selected day dropdown state, search queries, and layouts restore on load.

---

## 2. Dependent Verification (Revisit when Firebase/Sheets Credentials exist)

These items depend on Firebase Auth custom token claims, active Firebase Realtime Database syncing, and public HTTPS environments.

### 🔐 Authenticated Starring Sync (Requires Firebase configuration)
- [ ] **Auth Token Claims:** Log in as an approved user. Confirm that the login custom token includes the `escapedEmail` claim.
- [ ] **RTDB Synchronization:** Star an event. Open the Firebase Realtime Database console. Under path `/user-data/$escaped_email/starred`, verify the event ID is stored.
- [ ] **Cross-Device Sync:** Log in with the same email on two different devices/browsers. Star an event on device A; verify it highlights on device B in real-time.

### 🔔 Real-Time Changed-Event Toasts (Requires live Sheets Sync or RTDB write)
- [ ] **Change Notifications:** Keep the app open on a desktop client. Modify an event's schedule time or location in the sheets spreadsheet (triggering an Apps Script sync) or edit it directly in the Firebase Database.
  - Verify a warning toast notification slides in at the bottom-right of the client app immediately, summarizing the change (e.g. *"Lunch updated: Location: HQ (was Forest)"*).

### 📱 PWA Offline & Install Support (Requires HTTPS deployment)
- [ ] **PWA Install Button:** Access the deployed app on an HTTPS secure staging URL. Look at the browser address bar (Chrome/Edge/Safari). Verify the "Install App" monitor prompts.
- [ ] **Offline Loading Banner:** Turn off network/WiFi connectivity. Refresh the page.
  - Verify the app loads the UI layout.
  - Verify the red **Offline Mode** banner appears in the header showing the last successful sync time.
  - Verify cached event and location details populate correctly.
