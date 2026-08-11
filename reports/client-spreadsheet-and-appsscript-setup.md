# Master Google Sheet & Apps Script Setup Guide

This guide provides a step-by-step walkthrough for switching **The Portal Map & Schedule App** to a new/client master Google Sheet, binding `scripts/PortalSyncScript.js`, configuring Script Properties, authorizing OAuth scopes, creating background sync triggers, and updating web app environment variables.

---

## 📋 Overview of Setup Steps

1. **Service Account Permissions** — Grant Sheet Editor access to the backend Service Account.
2. **Sheet Tab Structure** — Verify canonical tabs & column headers.
3. **Apps Script Manifest & Code** — Bind `appsscript.json` and `PortalSyncScript.js`.
4. **Script Properties (Env Vars)** — Set RTDB URL, App URL, and Spreadsheet ID.
5. **OAuth Authorization & First Sync** — Run initial sync and grant Google permissions.
6. **Time-Driven Sync Trigger** — Create 5-minute automated background trigger.
7. **Web App Environment Config** — Update `GOOGLE_SHEETS_SPREADSHEET_ID` in your app.

---

## Phase 1: Service Account Permissions

1. Open the client's master Google Sheet in Google Drive.
2. Click **Share** (top right).
3. In the input field, add your GCP Service Account Email (`firebase-adminsdk-fbsvc@portal-map-app.iam.gserviceaccount.com`).
4. Set role to **Editor**.
5. Uncheck "Notify people" and click **Share**.

---

## Phase 2: Verify Sheet Tabs & Headers

Ensure the spreadsheet contains the canonical tabs below (wildcard suffixes such as `ROS by TIME - Aug 10` are supported):

- **`Locations`**  
  *Headers:* `location_id`, `name`, `category`, `lat`, `lng`, `foh_boh_default`, `capacity`, `notes`
- **`Personnel`**  
  *Headers:* `contact_id`, `name`, `role`, `department`, `email`, `phone`, `org`, `type`, `visibility`
- **`Departments`**  
  *Headers:* `dept_id`, `name`, `color`, `lead_contact_id`, `google_calendar_id`
- **`Actions`**  
  *Headers:* `action_id`, `name`, `color`
- **`ROS by TIME`**  
  *Headers:* `Date`, `Start`, `End`, `Location`, `Lead Dept`, `Lead Person`, `Action`, `Description`, `FOH / BOH`

---

## Phase 3: Bind Apps Script & Manifest

1. In the Google Sheet menu, click **Extensions** $\rightarrow$ **Apps Script**.
2. Click ⚙️ **Project Settings** (left sidebar).
3. Under General Settings, check **"Show appsscript.json manifest file in editor"**.
4. In the left file list, open `appsscript.json` and replace its content with `scripts/appsscript.json`:

```json
{
  "timeZone": "America/Los_Angeles",
  "dependencies": {
    "enabledAdvancedServices": [
      { "userSymbol": "Calendar", "serviceId": "calendar", "version": "v3" },
      { "userSymbol": "AdminDirectory", "serviceId": "admin", "version": "directory_v1" },
      { "userSymbol": "GroupsSettings", "serviceId": "groupssettings", "version": "v1" }
    ]
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

5. Open `Code.gs` (or `PortalSyncScript.gs`) in the file list, clear existing placeholder code, and paste the complete content of `scripts/PortalSyncScript.js` from the codebase.
6. Create the Onboarding HTML Email Template file:
   - Next to **Files** in the left sidebar, click **+** (Add a file) $\rightarrow$ select **HTML**.
   - Name the file: `email-templates/onboarding` (or `onboarding`).
   - Paste the contents of `scripts/email-templates/onboarding.html` from the codebase.
7. Click 💾 **Save Project** (`Cmd + S` or `Ctrl + S`).

---

## Phase 4: Configure Script Properties (Environment Variables)

1. In Apps Script, click ⚙️ **Project Settings** (left sidebar).
2. Scroll down to **Script Properties** $\rightarrow$ click **Add script property**.
3. Add the following 5 key-value pairs:

| Property | Value | Notes |
|---|---|---|
| `FIREBASE_DB_URL` | `https://portal-map-app-default-rtdb.firebaseio.com/` | Realtime Database URL |
| `APP_URL` | `https://bm26.theportal.is` | Live Production URL |
| `SPREADSHEET_ID` | `<THE_NEW_CLIENT_SPREADSHEET_ID>` | Extracted from Sheet URL |
| `SA_CLIENT_EMAIL` | `firebase-adminsdk-fbsvc@portal-map-app.iam.gserviceaccount.com` | Service Account Email |
| `SA_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...` | Service Account Private Key |

> 💡 **Note on `SA_PRIVATE_KEY`**: Copy the complete private key string from your Service Account JSON key (or `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` in `.env.local`), including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`.

---

## Phase 5: Run Initial Authorization & Sync

1. In the Apps Script editor (`Code.gs`), select the function **`syncAllToFirebase`** from the top toolbar dropdown.
2. Click **Run**.
3. A popup will request authorization:
   - Click **Review permissions**.
   - Select your Google Workspace Admin account.
   - Click **Advanced** $\rightarrow$ **Proceed to PortalSyncScript (unsafe)**.
   - Click **Allow** to grant permissions (Calendar, Groups, Sheets, External HTTP).
4. Inspect the **Execution log** at the bottom to verify it finishes cleanly with `0 errors`.

---

## Phase 6: Set Up 5-Minute Time-Driven Trigger

1. In the Apps Script left sidebar, click ⏰ **Triggers**.
2. Click **+ Add Trigger** (bottom right).
3. Configure the trigger parameters:
   - **Choose which function to run**: `syncAllToFirebase`
   - **Choose which deployment should run**: `Head`
   - **Select event source**: `Time-driven`
   - **Select type of time based trigger**: `Minutes timer`
   - **Select minute interval**: `Every 5 minutes`
4. Click **Save**.

---

## Phase 7: Web App Environment Variable Update

In your Next.js application environment (`.env.local` or Firebase App Hosting Environment Variables):

```bash
GOOGLE_SHEETS_SPREADSHEET_ID="<THE_NEW_CLIENT_SPREADSHEET_ID>"
```

Redeploy or restart the Next.js development server to verify the web application reads directly from the new client Google Sheet!
