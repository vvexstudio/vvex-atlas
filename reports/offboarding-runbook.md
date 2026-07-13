# Operational Runbook: Personnel Offboarding Chain

This runbook outlines the operational workflow and automated sequence that occurs when a crew member or admin is offboarded from event productions by **The Portal**.

---

## 1. Triggering Offboarding

Offboarding is triggered directly within the master Google Sheet database:

1.  Open the live Google Sheet.
2.  Navigate to the **`Personnel`** tab.
3.  Locate the row for the person leaving.
4.  Uncheck the checkbox in the **`active`** column (setting it to `FALSE`).
5.  *(Optional)* Change their department assignments or clear columns if desired. Do not delete the row entirely, as we maintain records for audit logs and historical tracking.

---

## 2. Automated Sequence

When the automated sync script executes (either manually or via the hourly trigger), the following steps are performed:

### A. Google Workspace & Group Cleanups (C1)
*   The script reads rows in `Personnel` where `active === FALSE`.
*   If the row's `invite_status` does not contain `"Offboarded"`, offboarding begins.
*   For each department assigned to the person, the script identifies the department Google Group (e.g. `lighting-rigging@yourdomain.com`).
*   It issues a `Members.remove(groupEmail, userEmail)` command to immediately remove their email from the group.
*   This automatically revokes access to any Shared Drives, Calendars, or Sites that rely on department group memberships.

### B. Access Token Gating (C2)
*   The sync script uploads the updated `active = false` status to the Firebase Realtime Database inside the `/auth-directory` node.
*   The web app's Custom Token service (`/api/auth/firebase-token`) checks `/auth-directory/{escaped_email}/active` during authentication.
*   If `active === false`, the system blocks token generation and returns a `403 Forbidden` response.
*   The user's active session is terminated, and they can no longer access crew-level maps, timelines, or sensitive details.

### C. Logging & Audit Trails
*   Upon successful group removal, the sync script writes `"Offboarded on <ISO Timestamp>"` to the `invite_status` column in the Google Sheet.
*   This marks the offboarding as complete, preventing redundant removals on subsequent sync cycles.

---

## 3. Human verification checklist

If manual verification is required:

*   [ ] Verify in the Google Workspace Admin Console that the user has been removed from the respective groups.
*   [ ] Check the Firebase Database console under `/auth-directory` to ensure their user node contains `"active": false`.
*   [ ] Attempt to log in with their credentials and verify that the app denies access.
