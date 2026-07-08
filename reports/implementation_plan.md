# Master Implementation Plan — Google Calendar Sync & Firebase Realtime Integration (Option B)

This document maps out the current integration status, the manual configurations required on external platforms (Firebase, Google Workspace, Google Sheets), and the blueprints for the upcoming Google Workspace Groups onboarding sequence.

---

## 🏁 1. What Has Been Completed So Far

We have successfully completed Sprints 1, 2, and 3 of the Next.js scaffold. The codebase compiles cleanly (`npm run build` succeeds).

### 💻 Next.js Codebase Scaffold (Done)
- [x] **Firebase Admin SDK Setup**: Initialized the SDK in [firebase-admin.ts](file:///Users/vincentnaples/Documents/github/portal-dev/src/lib/firebase-admin.ts) using environment variables.
- [x] **Token Minting Endpoint**: Created [route.ts](file:///Users/vincentnaples/Documents/github/portal-dev/src/app/api/auth/firebase-token/route.ts) to read Next.js sessions and mint Firebase Custom Tokens with role-based claims.
- [x] **Strict OAuth Validations**: Updated [route.ts](file:///Users/vincentnaples/Documents/github/portal-dev/src/app/api/auth/callback/route.ts) to verify Google's `email_verified` claim and enforce lowercase email trimming.
- [x] **SSR Pre-fetching**: Updated [page.tsx](file:///Users/vincentnaples/Documents/github/portal-dev/src/app/page.tsx) to fetch initial data from the correct Firebase Realtime Database tier prior to rendering.
- [x] **Real-time Map Hydration**: Integrated the Firebase Web SDK in [festival-map-app.tsx](file:///Users/vincentnaples/Documents/github/portal-dev/src/components/festival-map-app.tsx) using WebSocket listeners (`onValue`) to dynamically bind data states without reloading the page.
- [x] **Database Security Config**: Authored the database access controls in [database.rules.json](file:///Users/vincentnaples/Documents/github/portal-dev/database.rules.json).
- [x] **Initial Script Blueprint**: Placed the Google Apps Script code in [PortalSyncScript.js](file:///Users/vincentnaples/Documents/github/portal-dev/scripts/PortalSyncScript.js).

---

## ⚙️ 2. Checklist: Third-Party Service Configuration

To activate the real-time sync, the following configurations must be made manually in your Google and Firebase accounts:

### 📊 A. Google Sheet Prep
- [ ] **Tab `Departments`**: Add column `google_calendar_id`. Ensure rows for `All Departments` and `Public` exist.
- [ ] **Tab `Personnel`**: 
  - Add column `send_invite` (Add Checkbox validation: *Data > Data validation > Add rule > Criteria: Checkbox*).
  - Add column `invite_status` (Leave blank; Apps Script writes here).
  - Ensure the `role` and `department` columns contain comma-space-separated lists (e.g. `Catering, Hospitality` or `admin, crew`).

### 🔧 B. Google Apps Script Setup
- [ ] Open the Google Sheet and click **Extensions > Apps Script**.
- [ ] Paste the code from [PortalSyncScript.js](file:///Users/vincentnaples/Documents/github/portal-dev/scripts/PortalSyncScript.js).
- [ ] Configure `CONFIG.FIREBASE_DB_URL` and `CONFIG.FIREBASE_SECRET` at the top of the script.
- [ ] **Enable Calendar API**: In the left sidebar of Apps Script, click the **"+"** icon next to **Services**, select **Google Calendar API**, and click **Add**.
- [ ] **Enable Admin Directory API (New)**: Click the **"+"** icon next to **Services**, select **Admin SDK API** (Directory API), and click **Add** (required to manage Workspace Groups).

### 🔑 C. Google Workspace Admin Console (For Groups Sync)
- [ ] **Admin Credentials**: Ensure the Google account executing the spreadsheet sync script is a **Group Admin** or **Super Admin** on your custom Workspace domain (e.g. `@yourdomain.com`).
- [ ] **Domain Setup**: Verify that your Workspace domain is configured (the script cannot write to public `@googlegroups.com` accounts).
- [ ] **API Access**: Ensure API Access is enabled in *Admin Console > Security > Access and data control > API controls > Trust internal Apps Script*.

### 🔥 D. Firebase Console Configuration
- [ ] **Create Database**: Go to Firebase Console > Realtime Database > **Create Database**.
- [ ] **Apply Rules**: Copy the contents of [database.rules.json](file:///Users/vincentnaples/Documents/github/portal-dev/database.rules.json), paste them into the **Rules** tab in the console, and click **Publish**.
- [ ] **App Hosting Environment Variables (Server-side)**: Set these values in your hosting dashboard:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY` (Paste the full block including `-----BEGIN PRIVATE KEY-----`).
  - `FIREBASE_DATABASE_URL` (E.g. `https://your-app-default-rtdb.firebaseio.com/`).
- [ ] **App Hosting Environment Variables (Client-side)**:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`

---

## 🚀 3. Proposed Sprint: Google Workspace Onboarding Sequence

In our next coding session, we will expand our Apps Script and Next.js app to handle the **Google Workspace Groups sync & Comma-Separated role/department validation**.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Sheet Administrator
    participant Sheet as Personnel Sheet
    participant AppsScript as Apps Script (Admin SDK)
    participant Group as Google Groups API
    participant Cal as Google Calendar API
    participant Mail as MailApp Service

    Admin->>Sheet: Checks 'Send Invite' box
    AppsScript->>Sheet: Reads Row details (Role, Email, Depts)
    
    loop For each assigned Department
        AppsScript->>Group: Get or Create Group (e.g., catering@domain.com)
        Group-->>AppsScript: Returns Group Email
        Note over AppsScript, Cal: Sleep 5000ms to propagate
        AppsScript->>Cal: Grant Group ACL Reader Access (If new)
        AppsScript->>Group: Add User Email as Member
    end
    
    AppsScript->>Mail: Send custom onboarding HTML Email
    AppsScript->>Sheet: Update 'invite_status' & set checkbox to FALSE
```

### Script Execution Flow
1.  **Read Multiple Role/Department Entries:** 
    *   Parse the `department` and `role` cells using comma-space splitting (e.g. `Catering, Transport`).
2.  **Verify/Create Department Google Group (Step 1):**
    *   Check if a Workspace Group exists for the department (e.g., `catering@domain.com`).
    *   If not, call `AdminDirectory.Groups.insert()` to create it dynamically.
3.  **Ensure Calendar Permissions (Step 2):**
    *   Add the Group email as a reader to the corresponding Google Calendar via `Calendar.Acl.insert()`. Since permissions are bound to the group, this step only runs during initial setup.
4.  **Add User to Group (Step 3):**
    *   Call `AdminDirectory.Members.insert()` to add the user's personal email to the department group.
    *   *Gotcha Protection:* Insert `Utilities.sleep(5000)` (5-second pause) after group creation to ensure Google's servers replicate the group directory before attempting member additions or ACL bindings.
5.  **Send Welcome Email (Step 4):**
    *   Call `MailApp.sendEmail()` to fire a branded HTML onboarding email detailing their teams, showing synced calendar listings, and linking to the web map.
6.  **Write Status:**
    *   Update `invite_status` with details of all mapped groups and turn the checkbox back to `FALSE`.

### Next.js & Frontend Adaptations
- [ ] **Comma-Separated Parsing**: Update the filters and profile matching inside `festival-map-app.tsx` to handle comma-separated department arrays (e.g., matching a crew member assigned to `Lighting, Rigging` to both of those filter lists simultaneously).

---

### 🛡️ E. Updated Firebase Realtime Database Security Rules
To support dynamic per-department isolation (using `$department_id` wildcards), verify that your Rules are set to:
```json
{
  "rules": {
    "public-data": {
      ".read": "auth != null",
      ".write": "false"
    },
    "crew-data": {
      "departments": {
        "$department_id": {
          ".read": "auth.token.role === 'admin' || (auth != null && auth.token.departments != null && auth.token.departments[$department_id] === true)",
          ".write": "false"
        }
      },
      "venues": {
        ".read": "auth.token.role === 'crew' || auth.token.role === 'admin'",
        ".write": "false"
      },
      "metadata": {
        ".read": "auth.token.role === 'crew' || auth.token.role === 'admin'",
        ".write": "false"
      }
    },
    "admin-data": {
      ".read": "auth.token.role === 'admin'",
      ".write": "false"
    },
    "auth-directory": {
      ".read": "auth != null",
      ".write": "false"
    }
  }
}
```
