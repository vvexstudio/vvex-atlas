# System Design & Architecture Specification
**Project:** The Portal — Interactive Map & Run-of-Show (ROS) Platform  
**Purpose:** Comprehensive system design schema for architecture review & system design studies.

---

## Visual Architecture Overview

![System Design Architecture Schema](/Users/user/.gemini/antigravity-ide/brain/d78fb70b-c62d-4227-a024-c33727737c29/system_architecture_schema_1785650988075.png)

### Data Provider Architecture Schema
![Data Provider Architecture Schema](/Users/user/.gemini/antigravity-ide/brain/4ed7169d-c08e-4612-ac91-a699d813dc45/data_provider_schema_1785692931926.png)

---

## Multi-Level Data Flow Pipeline (L1 $\rightarrow$ L5)

### 5-Stage End-to-End Data Flow Pipeline
![End-to-End Data Flow Pipeline Schema](/Users/user/.gemini/antigravity-ide/brain/4ed7169d-c08e-4612-ac91-a699d813dc45/end_to_end_data_flow_schema_1785723160406.png)

### Whiteboard System Design Study Sketch
![Hand-Drawn System Data Flow Schema Blackboard Sketch](/Users/user/.gemini/antigravity-ide/brain/d78fb70b-c62d-4227-a024-c33727737c29/hand_drawn_system_schema_1785651347446.png)

### Multi-Tier Digital Pipeline Architecture
![Multi-Tier Data Flow Pipeline Architecture](/Users/user/.gemini/antigravity-ide/brain/d78fb70b-c62d-4227-a024-c33727737c29/data_flow_pipeline_schema_1785651303273.png)

```mermaid
flowchart LR
    subgraph L1 ["Level 1: Raw Source Ingestion"]
        L1_Sheets["Google Sheets\n• Locations (GIS Coords)\n• Personnel (App Access)\n• ROS Schedule (Events)"]
    end

    subgraph L2 ["Level 2: Sync & Transformation"]
        L2_Script["Google Apps Script\n(PortalSyncScript.js)\n• Normalizes Times & Coords\n• Extracts Roles & Depts\n• Service Account Auth"]
    end

    subgraph L3 ["Level 3: Storage & Access Control"]
        L3_RTDB["Firebase Realtime Database\n• /auth-directory (User Roles)\n• /crew-data (Public/Crew Events)\n• /admin-data (Full Production)"]
    end

    subgraph L4 ["Level 4: Server Auth & Client Hydration"]
        L4_Server["Next.js Server & Hooks\n• OAuth Callback & Session Cookie\n• /api/auth/firebase-token\n• Realtime WebSocket Listener"]
    end

    subgraph L5 ["Level 5: UI Presentation & Offline Storage"]
        L5_UI["Client Application (EventApp.tsx)\n• Google Maps Markers & Timeline\n• Role-Filtered Views & Filters\n• LocalStorage Snapshot Cache"]
    end

    L1_Sheets -->|OnEdit / Scheduled Cron| L2_Script
    L2_Script -->|Atomic Writes via OAuth2| L3_RTDB
    L3_RTDB <-->|WebSocket Realtime Sync| L4_Server
    L4_Server -->|Reactive Hooks / State| L5_UI
```

---

## 1. High-Level System Architecture

```mermaid
flowchart TD
    subgraph Data Layer ["1. Source Data & Sync Engine"]
        GS["Google Sheets\n(Locations, Personnel, ROS, Departments)"]
        GAS["Google Apps Script\n(PortalSyncScript.js)"]
        GS -->|Trigger / Time-driven Sync| GAS
    end

    subgraph Backend Infrastructure ["2. Firebase RTDB & Auth Stack"]
        RTDB[("Firebase Realtime Database\n(WebSocket Hydration)")]
        AuthDir[("/auth-directory\n(Email -> Role & Depts)")]
        CrewData[("/crew-data\n(Filtered Public/Crew Events)")]
        AdminData[("/admin-data\n(Full Event & Venue Data)")]
        
        RTDB --- AuthDir
        RTDB --- CrewData
        RTDB --- AdminData

        GAS -->|Service Account OAuth2| AuthDir
        GAS -->|Service Account OAuth2| CrewData
        GAS -->|Service Account OAuth2| AdminData
    end

    subgraph NextJS App ["3. Next.js 16 App Server (SSR / Edge)"]
        ServerRoute["App Router Server Page (page.tsx)"]
        AuthRoute["OAuth Callback (/api/auth/callback)"]
        TokenRoute["Custom Token API (/api/auth/firebase-token)"]
        GoogleOAuth["Google OAuth 2.0 Provider"]

        AuthRoute <-->|Exchange Auth Code| GoogleOAuth
        AuthRoute -->|Mint Session Cookie| ServerRoute
        TokenRoute -->|Query User Role| AuthDir
        TokenRoute -->|Generate Custom Token| FirebaseAdmin["Firebase Admin SDK"]
    end

    subgraph Client Application ["4. Client Browser Application"]
        ClientApp["React 19 Client App (EventApp.tsx)"]
        AuthHook["useAuthProfile Hook"]
        DataHook["useEventData Hook"]
        OfflineStorage[("Browser LocalStorage\n(Offline Fallback Cache)")]
        GoogleMaps["Google Maps JS API"]

        ClientApp --> AuthHook
        ClientApp --> DataHook
        DataHook <-->|Realtime WebSocket Listener| RTDB
        DataHook <-->|Fallback Offline Cache| OfflineStorage
        ClientApp -->|Render Map Markers| GoogleMaps
        AuthHook -->|Fetch Token| TokenRoute
    end

    subgraph External Integrations ["5. External Integrations"]
        GCal["Google Calendars\n(Per-department Auto-sync)"]
        GAS -->|Sync Events & Invites| GCal
    end
```

---

## 2. Component Architecture & Data Flow

### A. Authentication & Session Flow
```mermaid
sequenceDiagram
    autonumber
    actor User as Client / User Browser
    participant App as Next.js Server (/app)
    participant OAuth as Google OAuth 2.0
    participant API as /api/auth/firebase-token
    participant RTDB as Firebase RTDB (/auth-directory)
    participant Auth as Firebase Client Auth

    User->>App: Click "Login with Google"
    App->>OAuth: Redirect to Google OAuth Consent
    OAuth-->>User: Authenticate & Return Auth Code
    User->>App: Callback /api/auth/callback?code=...
    App->>RTDB: Query /auth-directory/{escaped_email}
    RTDB-->>App: Return User Role & Departments
    App-->>User: Set HTTP-Only Session Cookie (portal_user_session)
    
    User->>API: Client mounts & requests /api/auth/firebase-token
    API->>RTDB: Verify active status & role
    API-->>User: Return Firebase Custom JWT Token
    User->>Auth: signInWithCustomToken(token)
    Auth-->>User: Authenticated with Custom Claims (role, departments)
```

### B. Real-Time Data Sync Pipeline
1. **Google Sheets as Source of Truth**: Editors update `Locations`, `Personnel`, and `ROS by TIME` tabs.
2. **Apps Script Execution**: `PortalSyncScript.js` triggers on change or cron timer.
   - Parses `Personnel` to map `email` $\rightarrow$ `app_role` (`admin`, `crew`, `guest`).
   - Normalizes schedule times, venue coordinates, and department assignments.
   - Pushes sanitized snapshots to Firebase RTDB:
     - `/auth-directory/${escapedEmail}` $\rightarrow$ User permissions & active status.
     - `/crew-data` $\rightarrow$ Sanitized events accessible to crew & public.
     - `/admin-data` $\rightarrow$ Full detailed production schedule.
3. **Client WebSocket Hydration**: Client subscribes to RTDB via `useEventData(role)`. On update, UI updates instantly without polling or page reloads.

---

## 3. Database Schema & Data Dictionary

### Firebase Realtime Database Structure
```json
{
  "auth-directory": {
    "user_example_com": {
      "role": "admin | crew | guest",
      "departments": ["Lighting", "Audio"],
      "active": true
    }
  },
  "crew-data": {
    "events": [
      {
        "id": "evt-001",
        "title": "Mainstage Soundcheck",
        "scheduleDate": "2026-08-15",
        "startTime": "14:00",
        "endTime": "16:00",
        "locationName": "Main Stage",
        "department": "Audio",
        "leadPointPerson": "Julia",
        "isPublic": false
      }
    ],
    "venues": [
      {
        "id": "loc-001",
        "name": "Main Stage",
        "lat": 43.056,
        "lng": 11.489,
        "permanence": "Stage"
      }
    ]
  },
  "admin-data": {
    "events": "...",
    "venues": "...",
    "personnel": "..."
  }
}
```

---

## 4. Key Security & Resilience Mechanisms

| Layer | Mechanism | Design Description |
|---|---|---|
| **Identity** | Google OAuth 2.0 + HMAC Cookie | Encrypted, cryptographically signed HTTP-only JWT-style session cookies. |
| **Authorization** | RTDB Security Rules (`database.rules.json`) | Role-based data access control enforcing read permissions based on `auth.token.role`. |
| **Offboarding** | Active Gate (`active: false`) | Immediate revocation of token generation and RTDB access upon setting `active: false` in Google Sheet. |
| **Offline Resilience** | Dual-tier Storage (`localStorage` fallback) | Cached local snapshot allows complete offline map and schedule functionality if network fails on-site. |
| **Environment Isolation** | Multi-Project Setup | Complete separation between Developer Sandbox (`portal-dev-6aa34`) and Production Client GCP. |

---

## 5. Technology Stack Summary

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Vanilla CSS (Custom Design System), `@vis.gl/react-google-maps`.
- **Backend / Data**: Firebase Realtime Database (RTDB), Firebase Admin SDK, Google Apps Script (`PortalSyncScript.js`).
- **Authentication**: Google OAuth 2.0, Firebase Custom Authentication Tokens.
- **CI/CD & Hosting**: Firebase Hosting, GitHub Actions with Workload Identity Federation (WIF).
