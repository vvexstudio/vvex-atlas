# Production Deployment & Live Spreadsheet Transition Checklist

> **Target Domain:** `bm26.theportal.is`  
> **Purpose:** Step-by-step checklist for transitioning from the development/staging Google Sheet to the client's live production Google Sheet and verifying operational readiness.

---

## 1. Apps Script & Sync Engine Transition

- [ ] **Deactivate Trigger on Test Sheet:** Open the current test Google Sheet (`1rpmzT4...`) $\rightarrow$ **Extensions $\rightarrow$ Apps Script $\rightarrow$ Triggers (⏰)** and **delete/pause** the 5-minute `syncAllToFirebase` trigger so both sheets don't race/overwrite Firebase RTDB or trigger duplicate emails.
- [ ] **Bind Script to Client's Live Sheet:** Open the client's live Google Sheet $\rightarrow$ **Extensions $\rightarrow$ Apps Script**:
  - Update `appsscript.json` with the manifest from [`scripts/appsscript.json`](../scripts/appsscript.json) (enabling Calendar, GroupsSettings, and AdminDirectory services).
  - Copy the contents of [`scripts/PortalSyncScript.js`](../scripts/PortalSyncScript.js) into `Code.gs`.
- [ ] **Set Script Properties in Live Sheet:** Go to **Project Settings (⚙️) $\rightarrow$ Script Properties** and configure:
  - `FIREBASE_DB_URL`: Your Firebase RTDB URL (e.g., `https://<project-id>-default-rtdb.firebaseio.com/`).
  - `APP_URL`: `https://bm26.theportal.is`
  - `SPREADSHEET_ID`: Client's live Google Sheet ID.
- [ ] **Run Initial Manual Sync & Authorize:** Run `syncAllToFirebase` manually once under the client's Workspace admin account to grant OAuth permissions (Calendar, Directory, Groups, External Web).
- [ ] **Enable Live 5-Minute Trigger:** Add a new time-driven trigger in the live sheet's Apps Script: `syncAllToFirebase` $\rightarrow$ `Head` $\rightarrow$ `Time-driven` $\rightarrow$ `Minutes timer` $\rightarrow$ `Every 5 minutes`.

---

## 2. Environment Variables & App Configuration

- [ ] **Update `GOOGLE_SHEETS_SPREADSHEET_ID`:** Update your hosting environment variables (Firebase Hosting / Vercel / `.env.local`) to point to the client's new live spreadsheet ID.
- [ ] **Verify Tab Names / Wildcard Rules:** Ensure tab names match standard canonical tabs (`Locations*`, `Personnel*`, `Departments*`, `Actions*`, `ROS by TIME*`). *The app supports wildcards (e.g. `ROS by TIME - updated 08/10`), so client dates or notes appended to tab titles won't break ingestion.*
- [ ] **Set `NEXT_PUBLIC_SUPPORT_EMAIL`:** Confirm destination support email in environment variables (e.g., `admin@theportal.is`).
- [ ] **Timezone Check:** Ensure `NEXT_PUBLIC_EVENT_TIMEZONE=PDT` (or the target event timezone) is set.

---

## 3. Google Workspace & Security Gating

- [ ] **Share Sheet with Service Account:** Open the client's live Google Sheet $\rightarrow$ **Share** $\rightarrow$ Add `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `FIREBASE_CLIENT_EMAIL` with **Editor** permissions.
- [ ] **GCP OAuth Authorized Domains:** In GCP Console $\rightarrow$ **APIs & Services $\rightarrow$ Credentials $\rightarrow$ OAuth 2.0 Client ID**:
  - Add `https://bm26.theportal.is` to **Authorized JavaScript origins**.
  - Add `https://bm26.theportal.is/api/auth/callback` to **Authorized redirect URIs**.
- [ ] **Firebase Auth Authorized Domains:** In Firebase Console $\rightarrow$ **Authentication $\rightarrow$ Settings $\rightarrow$ Authorized domains**, add `bm26.theportal.is`.
- [ ] **Google Maps API Key Restrictions:** In GCP Console $\rightarrow$ **Google Maps Platform $\rightarrow$ Credentials**, ensure HTTP Referrer restrictions include `https://bm26.theportal.is/*`.

---

## 4. Live Data Verification & Health Linter

- [ ] **Run `/admin/health` Linter:** Log into `https://bm26.theportal.is/admin/health` as an admin and check the data-health monitor:
  - [ ] Check for missing headers or unrecognized columns.
  - [ ] Verify `Personnel` tab email syntax & assigned roles (`admin`, `crew`, `lead`).
  - [ ] Verify `Departments` tab names match `google_calendar_id` fields.
  - [ ] Confirm `Locations` lat/lng coordinates map cleanly without orphan placemarks.
  - [ ] Ensure `ROS by TIME` dates and 24h start/end times parse without parsing errors.
- [ ] **Canonical Entity Resolution:** Confirm schedule items in `ROS by TIME` match location names/aliases defined in `Locations`.

---

## 5. Feature & Access Smoke Tests

- [ ] **Public vs Crew Gate Test:** Open `https://bm26.theportal.is` in an Incognito window (unauthenticated). Confirm that BOH/crew shifts are hidden and only FOH/Public events are visible.
- [ ] **Admin Single Sign-On:** Verify admin accounts (listed in `ADMIN_EMAILS` or `Personnel` sheet with `admin` role) land directly into `/admin` and `/admin/health` without redirect loops.
- [ ] **Vendor Magic Links & ICS Subscription:**
  - Test generating a vendor link at `/admin/magic-links`.
  - Confirm the generated link (`/vendor?token=...`) and `.ics` subscription feed (`/api/ics?token=...`) output correct PDT timestamps (`America/Los_Angeles`) and department event scopes.

---

## 6. Production Infrastructure Scale

- [ ] **Firebase Blaze Plan Check:** Ensure the Firebase project hosting RTDB is upgraded to **Blaze Plan (Pay-as-you-go)**. *(The free Spark plan caps active Realtime Database WebSocket connections at 100 concurrent users, which will bottleneck on-site crew).*
- [ ] **RTDB Rules Verification:** Confirm `database.rules.json` rules are published on the live RTDB instance.

---

## 7. Verification Summary & Sign-off

1. **Spreadsheet ID updated in hosting environment.**
2. **Apps Script trigger active on live sheet & disabled on test sheet.**
3. **Service Account granted Editor access to live sheet.**
4. **All checks in `/admin/health` verified clean.**
