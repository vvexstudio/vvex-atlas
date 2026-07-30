# Client Google Workspace & Infrastructure Setup Plan

> **Purpose:** Step-by-step checklist of all manual ("human-in-the-loop") setup tasks required to transfer, provision, and configure the Portal Map & Schedule App under the client's official Google Workspace, Google Cloud Platform (GCP), and Firebase accounts.

---

## 📋 Overview of Accounts & Access Required

Before beginning configuration, ensure you have super-admin or owner privileges for:
1. **Google Workspace Admin Console** (`admin.google.com`)
2. **Google Cloud Console** (`console.cloud.google.com`)
3. **Firebase Console** (`console.firebase.google.com`)
4. **Domain Registrar / DNS Control Panel** (for custom domain & SSL mapping)
5. **Production Hosting Platform** (Firebase Hosting, Vercel, or AWS/Cloud Run)

---

## 🔑 Summary of Environment Variables to Collect

During this setup, you will generate and collect the following keys to populate `.env.local` / host environment variables:

| Category | Key Name | Where Obtained |
|---|---|---|
| **Google Maps** | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | GCP Maps Platform (Restricted) |
| **Google Maps** | `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | GCP Map Management (Advanced Markers) |
| **Google Sheets** | `GOOGLE_SHEETS_SPREADSHEET_ID` | Client Google Sheet URL |
| **Google OAuth** | `GOOGLE_CLIENT_ID` | GCP Credentials -> OAuth 2.0 Client ID |
| **Google OAuth** | `GOOGLE_CLIENT_SECRET` | GCP Credentials -> OAuth 2.0 Client Secret |
| **Service Account** | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | GCP IAM Service Accounts |
| **Service Account** | `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | GCP IAM Service Account JSON key |
| **Admin Access** | `ADMIN_PASSWORD` / `ADMIN_EMAILS` | Internal security policy |
| **Firebase Client** | `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console Project Settings |
| **Firebase Client** | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Console Project Settings |
| **Firebase Client** | `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | Firebase Console RTDB Dashboard |
| **Firebase Client** | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Console Project Settings |
| **Firebase Client** | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Console Project Settings |
| **Firebase Client** | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Console Project Settings |
| **Firebase Client** | `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Console Project Settings |
| **Firebase Admin** | `FIREBASE_PROJECT_ID` | GCP / Firebase Project ID |
| **Firebase Admin** | `FIREBASE_CLIENT_EMAIL` | Firebase Service Account Email |
| **Firebase Admin** | `FIREBASE_PRIVATE_KEY` | Firebase Service Account Private Key |
| **Firebase Admin** | `FIREBASE_DATABASE_URL` | Firebase RTDB URL |

---

## 🚀 Step-by-Step Setup Workflow

### Phase 1: Google Workspace Setup (`admin.google.com`)

- [x] **Step 1.1: Verify Workspace Super Admin Account**
  - Log into `admin.google.com` using the client's official admin account (e.g., `admin@theportal.is`).

- [x] **Step 1.2: Enable External Group Memberships**
  - Go to **Apps $\rightarrow$ Google Workspace $\rightarrow$ Groups for Business $\rightarrow$ Sharing settings**.
  - Set **Accessing topics** and **Member creation** to allow owners/managers to invite external members (`@gmail.com`, vendor domains).
  - *Why:* Crew members and contractors often use external emails; Apps Script needs permission to add external users to department Google Groups.

- [x] **Step 1.3: Provision Core Department Groups**
  - Navigate to **Directory $\rightarrow$ Groups**.
  - Create the required department groups (or allow `PortalSyncScript.js` to create them dynamically):
    - `all-departments@clientdomain.com`
    - `admin@clientdomain.com`
    - `lighting@clientdomain.com`, `f-b@clientdomain.com`, `rigging@clientdomain.com`, etc.

---

### Phase 2: Google Cloud Platform (GCP) & OAuth Configuration (`console.cloud.google.com`)

- [x] **Step 2.1: Create GCP Organization Project**
  - Open `console.cloud.google.com`.
  - Create a new GCP Project named **`Portal-Map-App`** under the client's GCP Organization.

- [x] **Step 2.2: Enable Required APIs**
  - In the GCP Search Bar, navigate to **APIs & Services $\rightarrow$ Library**.
  - Search for and **Enable** each of the following 5 APIs:
    1. **Maps JavaScript API**
    2. **Google Sheets API**
    3. **Google Calendar API**
    4. **Admin SDK API** (Directory API)
    5. **Google Groups Settings API** 

- [x] **Step 2.3: Configure OAuth 2.0 Consent Screen**
  - Go to **APIs & Services $\rightarrow$ OAuth consent screen**.
  - Choose User Type: **Internal** (or **External** if non-workspace users log in via Google OAuth).
  - App Name: `The Portal Map App`
  - User support email: Select client admin email.
  - Developer contact information: Input client tech lead email.
  - Authorized Domains: Add `theportal.is`, `web.app`, `firebaseapp.com`.
  - Save and Continue through Scopes (`email`, `profile`, `openid`).

- [x] **Step 2.4: Create Web OAuth 2.0 Client Credentials**
  - Go to **APIs & Services $\rightarrow$ Credentials $\rightarrow$ Create Credentials $\rightarrow$ OAuth client ID**.
  - Application type: **Web application**.
  - Name: `Portal Web App Client`.
  - **Authorized JavaScript origins:**
    - `http://localhost:3000`
    - `https://portal-map-app.web.app`
    - `https://app.theportal.is` (production domain)
  - **Authorized redirect URIs:**
    - `http://localhost:3000/api/auth/callback`
    - `https://portal-map-app.web.app/api/auth/callback`
    - `https://app.theportal.is/api/auth/callback`
  - Copy `Client ID` $\rightarrow$ `GOOGLE_CLIENT_ID`.
  - Copy `Client Secret` $\rightarrow$ `GOOGLE_CLIENT_SECRET`.

- [x] **Step 2.5: Create & Restrict Google Maps API Key**
  - Go to **Google Maps Platform $\rightarrow$ Credentials $\rightarrow$ Create API Key**.
  - Name: `Portal Maps Key (Production)`.
  - Under **Application Restrictions**: Select **Websites (HTTP referrers)**.
  - Add Referrer Patterns:
    - `http://localhost:3000/*`
    - `https://*.web.app/*`
    - `https://*.firebaseapp.com/*`
    - `https://*.theportal.is/*`
  - Under **API Restrictions**: Select **Restrict key** $\rightarrow$ check **Maps JavaScript API**.
  - Copy key $\rightarrow$ `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
  - *(Optional)* Go to **Map Management** $\rightarrow$ Create Vector Map ID $\rightarrow$ `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`.

- [x] **Step 2.6: Create GCP Service Account for Sheets & Backend**
  - Go to **IAM & Admin $\rightarrow$ Service Accounts $\rightarrow$ Create Service Account**.
  - Name: `portal-backend-sync`.
  - Role: Project $\rightarrow$ **Editor** (or minimal needed).
  - Click into the created Service Account $\rightarrow$ **Keys** tab $\rightarrow$ **Add Key $\rightarrow$ Create new key $\rightarrow$ JSON**.
  - Save JSON securely.
  - Copy `client_email` $\rightarrow$ `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `FIREBASE_CLIENT_EMAIL`.
  - Copy `private_key` $\rightarrow$ `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` / `FIREBASE_PRIVATE_KEY`.

---

### Phase 3: Firebase Project & Realtime Database (`console.firebase.google.com`)

- [x] **Step 3.1: Add Firebase to Existing GCP Project**
  - Go to `console.firebase.google.com`.
  - Click **Add Project** $\rightarrow$ Select the existing GCP Project created in Phase 2 (`Portal-Map-App`).
  - Confirm billing setup.

- [x] **Step 3.2: Upgrade Firebase Plan to Blaze (Pay-as-you-go)**
  - In Firebase Console bottom left, click **Upgrade** next to Spark plan.
  - Select **Blaze Plan** (Pay-as-you-go).
  - ⚠️ *Critical:* Spark plan limits Realtime Database to 100 concurrent websocket connections. Blaze is mandatory for on-site crew usage (>100 active devices).

- [x] **Step 3.3: Provision Firebase Realtime Database (RTDB)**
  - In left menu: **Build $\rightarrow$ Realtime Database $\rightarrow$ Create Database**.
  - Select Region (e.g. `us-central1` or nearest to event site).
  - Select **Start in Locked Mode**.
  - Copy RTDB URL (`https://portal-map-app-default-rtdb.firebaseio.com/`) $\rightarrow$ `NEXT_PUBLIC_FIREBASE_DATABASE_URL` & `FIREBASE_DATABASE_URL`.

- [x] **Step 3.4: Deploy RTDB Security Rules**
  - Click **Rules** tab in RTDB dashboard.
  - Paste contents of `database.rules.json` from codebase:
    ```json
    {
      "rules": {
        "public-data": {
          ".read": true,
          ".write": "auth != null && auth.token.admin === true"
        },
        "crew-data": {
          ".read": "auth != null",
          ".write": "auth != null && auth.token.admin === true"
        },
        "admin-data": {
          ".read": "auth != null && auth.token.admin === true",
          ".write": "auth != null && auth.token.admin === true"
        },
        "auth-directory": {
          ".read": "auth != null && auth.token.admin === true",
          ".write": "auth != null && auth.token.admin === true"
        },
        "user-data": {
          "$uid": {
            ".read": "auth != null && auth.uid === $uid",
            ".write": "auth != null && auth.uid === $uid"
          }
        }
      }
    }
    ```
  - Click **Publish**.

- [x] **Step 3.5: Register Web App in Firebase**
  - Go to **Project Settings $\rightarrow$ General $\rightarrow$ Your Apps $\rightarrow$ Add App $\rightarrow$ Web App (`</>`)**.
  - App nickname: `Portal Web App`.
  - Copy Firebase SDK Config values to `.env`:
    - `apiKey` $\rightarrow$ `NEXT_PUBLIC_FIREBASE_API_KEY`
    - `authDomain` $\rightarrow$ `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
    - `projectId` $\rightarrow$ `NEXT_PUBLIC_FIREBASE_PROJECT_ID` / `FIREBASE_PROJECT_ID`
    - `storageBucket` $\rightarrow$ `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
    - `messagingSenderId` $\rightarrow$ `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
    - `appId` $\rightarrow$ `NEXT_PUBLIC_FIREBASE_APP_ID`

---

### Phase 4: Master Google Sheet & Apps Script Binding (`scripts/PortalSyncScript.js`)

- [ ] **Step 4.1: Transfer Master Google Sheet to Client Drive**
  - Copy or move the master event Google Sheet into the client's Google Drive.
  - Ensure canonical tabs exist: `Locations`, `Personnel`, `Departments`, `Actions`, `ROS by TIME`.
  - Copy the Spreadsheet ID from the URL (`https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`) $\rightarrow$ `GOOGLE_SHEETS_SPREADSHEET_ID`.

- [ ] **Step 4.2: Share Sheet with Service Account**
  - Open the Google Sheet $\rightarrow$ Click **Share**.
  - Paste the Service Account email (`portal-backend-sync@...iam.gserviceaccount.com`).
  - Set Role to **Editor** $\rightarrow$ Uncheck notify $\rightarrow$ Click **Share**.

- [ ] **Step 4.3: Bind Google Apps Script**
  - Inside the Google Sheet, navigate to **Extensions $\rightarrow$ Apps Script**.
  - Open `appsscript.json` (Project Settings $\rightarrow$ Check "Show appsscript.json manifest file in editor").
  - Replace content with `scripts/appsscript.json`:
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
  - Clear `Code.gs` and paste the full contents of `scripts/PortalSyncScript.js`.

- [ ] **Step 4.4: Configure Apps Script Properties**
  - In Apps Script left sidebar, click ⚙️ **Project Settings**.
  - Scroll to **Script Properties** $\rightarrow$ Click **Add script property**:
    - `FIREBASE_DB_URL`: `https://portal-map-app-default-rtdb.firebaseio.com/`
    - `APP_URL`: `https://app.theportal.is` (or production URL)
    - `SPREADSHEET_ID`: `<SPREADSHEET_ID>`

- [ ] **Step 4.5: Authorize Scopes & Run Initial Sync**
  - Return to Editor $\rightarrow$ Select function **`syncAllToFirebase`** $\rightarrow$ Click **Run**.
  - A modal will prompt for Google Account Authorization.
  - Select the client admin account $\rightarrow$ Advanced $\rightarrow$ **Proceed to PortalSyncScript (unsafe)** $\rightarrow$ Allow all requested permissions (Calendar, Groups, Sheets, External Web).
  - Verify Execution log shows successful completion without errors.

- [ ] **Step 4.6: Set Up Automated 5-Minute Trigger**
  - In Apps Script left sidebar, click ⏰ **Triggers** $\rightarrow$ **Add Trigger** (bottom right):
    - Choose function: **`syncAllToFirebase`**
    - Choose deployment: **`Head`**
    - Event source: **`Time-driven`**
    - Type of time-based trigger: **`Minutes timer`**
    - Minute interval: **`Every 5 minutes`**
  - Click **Save**.

---

### Phase 5: Hosting Deployment & Environment Variables

- [ ] **Step 5.1: Configure Repository & Production Branch**
  - Canonical Vendor Repo: `portal-dev` (remains primary single source of truth).
  - Production Branch: Create/rename release branch to `portal-production`.
  - Set branch protection rules on `portal-production` requiring review/approval before merging or pushing.

- [ ] **Step 5.2: Set Up GitHub Environment & Secrets**
  - In GitHub repository settings, create Environment `production` (with manual approval required).
  - Populate protected Secrets:
    - `GCP_SA_KEY` / `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON key or Workload Identity provider details)
    - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
    - `FIREBASE_DATABASE_URL`
    - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

- [ ] **Step 5.3: Configure Firebase CLI & GitHub Actions Workflow**
  - Configure `.firebaserc` with aliases for `dev` (vendor) and `production` (client).
  - Add `.github/workflows/deploy-production.yml` triggered on push to `portal-production`.

- [ ] **Step 5.4: Execute Initial Production Deployment & Domain Binding**
  - Push code to `portal-production` branch to trigger CI build & deploy to Client Firebase project.
  - Map custom domain (e.g. `app.theportal.is`) in Firebase Hosting DNS setup.
  - Ensure SSL certificate issuance completes cleanly.


---

### Phase 6: Handoff Verification Smoke Test

- [ ] **Step 6.1: Run Full Human Smoke Test**
  - Perform all checklist items in [human-smoke-test-checklist.md](file:///Users/user/dev/portal-dev/reports/human-smoke-test-checklist.md):
    - [x] Apps Script trigger execution & log check
    - [x] Onboarding email deliverability & template link validation
    - [x] Offboarding flow & group removal validation
    - [x] Data-health dashboard status (`/admin/health`)
    - [x] Map Pin creation & RTDB persistence (`/admin`)
    - [x] Department Google Calendar self-healing & event sync
    - [x] ICS subscription feed validation (`/api/ics/`)
    - [x] Vendor Magic Link generation (`/api/vendor/`)

---

## 🎯 Completion Sign-Off

- **Client Project Admin Name:** ________________________
- **Technical Lead Signature:** ________________________
- **Date Completed:** ________________________
