# Domain Setup Instructions: `bm26.theportal.is`

Here is a step-by-step guide formatted for both your engineering team (Firebase/GCP side) and a ready-to-send instruction sheet for your client to update DNS on 101domain.com.

---

## 📋 Overview & Strategy

- **Target Domain**: `bm26.theportal.is`
- **Apex Domain**: `theportal.is` (registered on 101domain.com)
- **Why a Subdomain?**: Using `bm26` leaves the main website (`theportal.is`) untouched, avoids root CNAME/A-record conflicts, and delegates traffic cleanly to Firebase Hosting with free, managed SSL/TLS certificates.

---

## Phase 1: Firebase Console Setup (Developer Side)

1. **Log into Firebase Console**:
   - Open [Firebase Console](https://console.firebase.google.com/) and select your project (`portal-map-app` for production or `portal-dev-6aa34` for staging).

2. **Add Custom Domain**:
   - In the left sidebar, navigate to **Build** $\rightarrow$ **Hosting** (or **Hosting** under Project Overview).
   - Under **Custom domains**, click **Add custom domain**.
   - Enter `bm26.theportal.is`.
   - Leave "Redirect to an existing domain" **unchecked**.
   - Click **Continue**.

3. **Retrieve DNS Records**:
   - Firebase App Hosting displays the exact required DNS records to add and remove:
     - **Remove CNAME**: `bm26` pointing to `portal-production--portal-map-app.us-east4.hosted.app`
     - **Add A Record**: `bm26` pointing to `35.219.200.205`
     - **Add TXT Record**: `bm26` with value `fah-claim=023-02-aad1d339-b18d-44b2-b03f-6f8764ede60f`
     - **Add ACME Validation CNAME**: `_acme-challenge_3bf472zqqwby6fxh.bm26` pointing to `252f1efc-0db1-4b9f-96a8-df973af09a0f.11.authorize.certificatemanager.goog.`

---

## Phase 2: Client Instructions for 101domain.com (Send to Client)

You can copy and send the email below directly to the client's IT or domain administrator:

```text
To: The Portal IT / Domain Administrator
Subject: DNS Configuration Update for bm26.theportal.is

Hi Team,

To connect our map & run-of-show web app to bm26.theportal.is and complete SSL certificate validation, please log into 101domain.com and update the DNS records for theportal.is as follows:

Step 1: Log into 101domain
1. Log into 101domain.com.
2. Navigate to Domain Names -> My Domains -> theportal.is -> Manage DNS.

Step 2: REMOVE Existing CNAME Record
- Record Type: CNAME
- Host / Subdomain: bm26
- Points To / Value: portal-production--portal-map-app.us-east4.hosted.app

Step 3: ADD the Following 3 Records

1. A Record (App Hosting Endpoint)
   - Record Type: A
   - Host / Subdomain: bm26
   - Points To / Value: 35.219.200.205
   - TTL: 3600 (or Default)

2. TXT Record (Domain Ownership Claim)
   - Record Type: TXT
   - Host / Subdomain: bm26
   - Value: fah-claim=023-02-aad1d339-b18d-44b2-b03f-6f8764ede60f
   - TTL: 3600 (or Default)

3. CNAME Record (SSL Certificate Validation)
   - Record Type: CNAME
   - Host / Subdomain: _acme-challenge_3bf472zqqwby6fxh.bm26
   - Points To / Value: 252f1efc-0db1-4b9f-96a8-df973af09a0f.11.authorize.certificatemanager.goog.
   - TTL: 3600 (or Default)

Step 4: Save Changes
Click Save / Apply Changes.

Please let us know once updated so we can finalize SSL verification and verify the live app!
```

---

## Phase 3: Security & OAuth Updates (Developer Side)

Once the domain DNS propagates and SSL issues:

1. **Google OAuth Authorized Domains & Origins**:
   - Open **Google Cloud Console** $\rightarrow$ **APIs & Services** $\rightarrow$ **Credentials**.
   - Select your Web Application OAuth 2.0 Client ID.
   - Under **Authorized JavaScript origins**, add: `https://bm26.theportal.is`
   - Under **Authorized redirect URIs**, add: `https://bm26.theportal.is/api/auth/callback`

2. **Firebase Auth Authorized Domains**:
   - Open **Firebase Console** $\rightarrow$ **Authentication** $\rightarrow$ **Settings** $\rightarrow$ **Authorized domains**.
   - Add `bm26.theportal.is` to the list of authorized domains.

3. **Google Maps API Key Restrictions**:
   - In Google Cloud Console $\rightarrow$ **Credentials**, select `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
   - Under **Website restrictions**, ensure `https://bm26.theportal.is/*` is allowed.
