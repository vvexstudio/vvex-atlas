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
   - Firebase will display the required DNS records to add:
     - **CNAME Record**: Pointing `bm26` to `<YOUR_FIREBASE_PROJECT_ID>.web.app.` or `<YOUR_APP_HOSTING_DOMAIN>`.
     - *(Alternative)*: If Firebase provides static **A Records**, note the two IPv4 addresses.
     - *(Optional)*: If TXT ownership verification is required, copy the provided `firebase=...` token.

---

## Phase 2: Client Instructions for 101domain.com (Send to Client)

You can copy and send the email below directly to the client's IT or domain administrator:

```text
To: The Portal IT / Domain Administrator
Subject: DNS Configuration for bm26.theportal.is

Hi Team,

To connect our map & run-of-show web app to bm26.theportal.is, please log into your 101domain management panel and add the following DNS records for theportal.is:

Step 1: Log into 101domain
1. Go to 101domain.com and sign in.
2. Navigate to Domain Names -> My Domains.
3. Click on theportal.is.
4. Click on Manage DNS (or DNS Records / Name Server & DNS Records).

Step 2: Add DNS Record for Subdomain
Add the following record:

  Record Type: CNAME
  Name / Subdomain / Host: bm26 (Note: enter just bm26, not the full domain)
  Target / Value / Points To: <YOUR_FIREBASE_PROJECT_ID>.web.app. (Replace with the exact target provided in Firebase Console)
  TTL: 3600 (or Automatic / Default)

(If Firebase provides A records instead of a CNAME, add two A records with Host 'bm26' pointing to the two provided IPv4 addresses).

Step 3: Save Changes
Click Save Records or Apply Changes.

Please reply once updated so we can verify DNS propagation and issue the SSL certificate.
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
