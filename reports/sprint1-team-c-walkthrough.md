# Walkthrough — Sprint 1 Team C: Google Apps Script Sync Hardening

We completed all Team C tasks for Sprint 1 (WP-4: Apps Script hardening) to establish a secure, idempotent, and fault-tolerant synchronization pipeline between Google Sheets, Google Workspace APIs, and Firebase Realtime Database.

---

## Changes Made

### 1. Token-Based JWT Authentication (C1)
*   Replaced the deprecated database query parameter secret authentication (`?auth=SECRET`) with the secure Google Service Account JWT flow.
*   The script reads credentials stored as Script Properties (`SA_CLIENT_EMAIL`, `SA_PRIVATE_KEY`, `FIREBASE_DB_URL`), constructs a cryptographically signed JSON Web Token (JWT) using `Utilities.computeRsaSha256Signature`, and exchanges it for a short-lived OAuth 2.0 access token.
*   Access tokens are cached in `CacheService` for 1 hour to prevent excessive token request overhead.
*   All Firebase REST operations are authorized using `Authorization: Bearer <TOKEN>` header credentials.

### 2. Group & Calendar Idempotency (C2)
*   **Workspace Groups:** The script checks if a department group already exists via `AdminDirectory.Groups.get()` before calling `insert()`. `Utilities.sleep(5000)` replication delays are only executed during new group creation, not during lookups.
*   **Calendar ACL Access:** Checks if the target group email already holds a rule inside the Calendar ACL list using `Calendar.Acl.list()` before assigning a new `reader` permission.
*   **Group Membership:** Checks if the user is already enrolled using `AdminDirectory.Members.hasMember()` to prevent duplicate insert calls.
*   **Progressive Status Logging:** Replaced the binary status update with progressive status keys (e.g. `group:ok; cal:ok; member:ok; email:ok`) inside the spreadsheet `invite_status` cells. If the sync script encounters an error and resumes, it parses these keys and skips completed operations.

### 3. Exponential Backoff & API Resilience (C3)
*   Created helper function `executeWithRetry(apiCall)` that intercepts calls to Google Advanced Services (Directory and Calendar APIs).
*   If a request fails with temporary `403 User Rate Limit Exceeded` or `5xx Server Error` status codes, the script pauses and retries the operation up to 3 times using progressive delay intervals (`2000ms`, `4000ms`, `8000ms`).

### 4. GAS Run-Time Limits & Cursor Resumes (C3)
*   Monitors the total elapsed time of the onboarding loop execution.
*   If execution exceeds 4.5 minutes (approaching Google's strict 6-minute execution window), the loop pauses gracefully, writes the current spreadsheet row pointer to Script Properties under `ONBOARDING_CURSOR`, schedules a one-shot time trigger to run `resumeOnboarding()` in 1 minute, and terminates.
*   Added `resumeOnboarding()` entry point trigger function that retrieves the cursor, clears the property, and resumes onboarding operations where it left off.

### 5. Database Heartbeats (C4)
*   Modified the end of `syncAllToFirebase()` to write sync metadata (ISO timestamp and row count) to the database path `/crew-data/metadata/heartbeat` upon a successful push.

### 6. clasp Deployment Scaffolding (C5)
*   Added `.clasp.json` at the project root configured to push code from the `scripts/` directory.
*   Added the Apps Script manifest file `scripts/appsscript.json` defining dependency permissions (Calendar API and Admin Directory SDK).
*   Created `scripts/clasp/README.md` guiding developers on how to install, authenticate, and push updates using clasp.

---

## Verification Results

### 1. Build Compilation Check
Verified that Next.js production builds compile cleanly with the newly introduced JSON and JS configuration files:
```text
✓ Compiled successfully in 2.0s
  Running TypeScript ...
✓ Generating static pages using 7 workers (14/14) in 191.2ms
```

### 2. Test Verification
All 15 unit tests pass cleanly:
```text
 Test Files  5 passed (5)
      Tests  15 passed (15)
   Start at  16:35:22
   Duration  543ms
```
