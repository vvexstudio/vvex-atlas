/**
 * PortalSyncScript.js
 * 
 * Google Apps Script to sync Google Sheet data to Firebase Realtime Database,
 * provision Workspace Groups, update Google Calendar permissions, and send onboarding emails.
 */

const CONFIG = {
  FIREBASE_DB_URL: PropertiesService.getScriptProperties().getProperty("FIREBASE_DB_URL") || "",
  APP_URL: PropertiesService.getScriptProperties().getProperty("APP_URL") || "http://localhost:3000",
  SPREADSHEET_ID: "",
};

/**
 * Main trigger function to run the sync
 */
function syncAllToFirebase() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID || SpreadsheetApp.getActiveSpreadsheet().getId());

  // 1. Read sheet tabs
  const locations = readSheetToJson(ss.getSheetByName("Locations"));
  const personnel = readSheetToJson(ss.getSheetByName("Personnel"));
  const ros = readSheetToJson(ss.getSheetByName("ROS by TIME") || ss.getSheetByName("ROS"));
  const departments = readSheetToJson(ss.getSheetByName("Departments"));

  // 2. Format & Map data to structure
  const data = {
    venues: locations,
    personnel: personnel,
    events: ros,
    departments: departments
  };

  // 3. Write data to public-data, crew-data, and admin-data nodes in Firebase
  writeToFirebase("public-data/venues", locations);
  writeToFirebase("public-data/events", filterPublicEvents(ros));

  writeToFirebase("crew-data/venues", locations);
  writeToFirebase("crew-data/events", ros);
  writeToFirebase("crew-data/departments", departments);
  writeToFirebase("crew-data/personnel", personnel);

  // 3a. Write sync heartbeat
  writeToFirebase("crew-data/metadata/heartbeat", {
    last_sync: new Date().toISOString(),
    rows: ros.length
  });

  writeToFirebase("admin-data", data);

  // 4. Build/Update Auth Directory for authentication tokens from Personnel tab
  const authDirectory = {};

  Logger.log("Personnel count: " + personnel.length);

  personnel.forEach(person => {
    const emailKey = Object.keys(person).find(k => k.toLowerCase().includes("email"));
    const email = emailKey ? String(person[emailKey]).trim() : "";

    if (email) {
      const escapedEmail = email.toLowerCase().replace(/\./g, ",");

      // Find role key
      const roleKey = Object.keys(person).find(k => k.toLowerCase().includes("role"));
      const roleVal = roleKey ? String(person[roleKey]).trim() : "";

      let role = "guest";
      let depts = [];

      const lowerRoleVal = roleVal.toLowerCase();
      if (lowerRoleVal === "admin") {
        role = "admin";
        depts = ["All Departments"];
      } else if (lowerRoleVal === "public" || !roleVal) {
        role = "guest";
        depts = ["Public"];
      } else {
        role = "crew";
        depts = parseCsvList(roleVal);
      }

      // Find active status (defaulting to true if column is missing or blank)
      const activeKey = Object.keys(person).find(k => k.toLowerCase().includes("active"));
      const active = activeKey ? (person[activeKey] !== false && String(person[activeKey]).toUpperCase() !== "FALSE") : true;

      authDirectory[escapedEmail] = {
        role: role,
        departments: depts,
        active: active
      };
    }
  });

  Logger.log("Auth Directory entries count: " + Object.keys(authDirectory).length);
  writeToFirebase("auth-directory", authDirectory);

  Logger.log("Firebase sync completed successfully.");

  // 5. Automatically process onboarding and offboarding invites
  try {
    processOnboardingInvites();
  } catch (onboardingErr) {
    Logger.log("Error during automatic onboarding/offboarding phase: " + onboardingErr);
  }

  // 6. Automatically sync events from ROS sheet to Google Calendars
  try {
    syncRosEventsToGoogleCalendars(ss);
  } catch (calSyncErr) {
    Logger.log("Error during Google Calendar event sync phase: " + calSyncErr);
  }
}

/**
 * Google Workspace Groups and onboarding sequence flow
 * (Option B Operational Features)
 */
function processOnboardingInvites(startRow) {
  // Run offboarding removals first to sync inactive flags
  try {
    processOffboardingRemovals();
  } catch (offboardingErr) {
    Logger.log("Error during offboarding removals phase: " + offboardingErr);
  }

  startRow = startRow || 2;
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID || SpreadsheetApp.getActiveSpreadsheet().getId());
  const sheet = ss.getSheetByName("Personnel");
  if (!sheet) return;

  // Build department to calendar mapping from Departments tab
  const deptCalMap = getDepartmentCalendarMap(ss);

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader);
  const emailColIdx = headers.findIndex(h => h.includes("email")) + 1;
  const sendInviteColIdx = headers.findIndex(h => h.includes("send_invite") || h.includes("send_invitation")) + 1;
  const inviteStatusColIdx = headers.findIndex(h => h.includes("invite_status") || h.includes("invitation_status")) + 1;
  const roleColIdx = headers.findIndex(h => h.includes("role")) + 1;
  const activeColIdx = headers.findIndex(h => h.includes("active")) + 1;

  if (!emailColIdx || !sendInviteColIdx || !inviteStatusColIdx) {
    Logger.log("Required onboarding columns (email, send_invite, invite_status) not found.");
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < startRow) return;

  const dataRange = sheet.getRange(startRow, 1, lastRow - startRow + 1, sheet.getLastColumn());
  const values = dataRange.getValues();

  const startTime = Date.now();

  for (let i = 0; i < values.length; i++) {
    const rowNum = i + startRow;
    const row = values[i];
    const email = row[emailColIdx - 1];
    const sendInvite = row[sendInviteColIdx - 1];
    const roleVal = (roleColIdx > 0 && row[roleColIdx - 1]) ? String(row[roleColIdx - 1]).trim() : "";
    
    let role = "guest";
    let depts = [];

    const lowerRoleVal = roleVal.toLowerCase();
    if (lowerRoleVal === "admin") {
      role = "admin";
      depts = ["All Departments"];
    } else if (lowerRoleVal === "public" || !roleVal) {
      role = "guest";
      depts = ["Public"];
    } else {
      role = "crew";
      depts = parseCsvList(roleVal);
    }

    const displayedDepartments = role === "admin" ? "All Departments" : (depts.join(", ") || "General");
    const currentStatus = String(row[inviteStatusColIdx - 1] || "");

    // Execution time limit check (4.5 minutes)
    const elapsed = Date.now() - startTime;
    if (elapsed > 4.5 * 60 * 1000) {
      const props = PropertiesService.getScriptProperties();
      props.setProperty("ONBOARDING_CURSOR", String(rowNum));
      createResumeTrigger();
      Logger.log("Onboarding time limit approaching (4.5m). Saved cursor at row " + rowNum + " and scheduled trigger.");
      return;
    }

    if (sendInvite === true && email) {
      Logger.log("Processing invite for: " + email);
      try {
        const domain = getWorkspaceDomain();

        depts.forEach(dept => {
          const groupEmail = dept.toLowerCase().replace(/\s+/g, "-") + "@" + domain;

          // STEP 1: Workspace Group (Idempotent)
          let group = null;
          const step1Pattern = "group:" + groupEmail + ":ok";
          if (currentStatus.indexOf(step1Pattern) === -1) {
            try {
              group = executeWithRetry(() => AdminDirectory.Groups.get(groupEmail));
            } catch (e) {
              group = executeWithRetry(() => AdminDirectory.Groups.insert({
                email: groupEmail,
                name: dept + " Group",
                description: "Automated group for " + dept
              }));
              Utilities.sleep(5000); // Sleep for replication only after creation
            }
            updateInviteProgress(sheet, rowNum, inviteStatusColIdx, step1Pattern);
          }

          // STEP 2: Calendar ACL (Idempotent)
          const calendarId = deptCalMap[dept.toLowerCase()] || "";
          const step2Pattern = "cal:" + groupEmail + ":ok";
          if (!calendarId) {
            Logger.log("No google_calendar_id found in Departments sheet for department: " + dept + ". Skipping calendar ACL setup.");
            updateInviteProgress(sheet, rowNum, inviteStatusColIdx, step2Pattern);
          } else if (currentStatus.indexOf(step2Pattern) === -1) {
            let aclExists = false;
            try {
              const aclList = executeWithRetry(() => Calendar.Acl.list(calendarId));
              if (aclList && aclList.items) {
                for (let j = 0; j < aclList.items.length; j++) {
                  const rule = aclList.items[j];
                  if (rule.scope && rule.scope.type === "group" && rule.scope.value === groupEmail) {
                    aclExists = true;
                    break;
                  }
                }
              }
            } catch (aclListErr) {
              Logger.log("Could not check calendar ACL list: " + aclListErr);
            }

            if (!aclExists) {
              try {
                executeWithRetry(() => Calendar.Acl.insert({
                  role: "reader",
                  scope: { type: "group", value: groupEmail }
                }, calendarId));
              } catch (calErr) {
                Logger.log("Could not set calendar ACL for group: " + calErr);
              }
            }
            updateInviteProgress(sheet, rowNum, inviteStatusColIdx, step2Pattern);
          }

          // STEP 3: Member Addition (Idempotent)
          const step3Pattern = "member:" + groupEmail + ":ok";
          if (currentStatus.indexOf(step3Pattern) === -1) {
            let isMember = false;
            try {
              const checkResult = executeWithRetry(() => AdminDirectory.Members.hasMember(groupEmail, email));
              isMember = checkResult.isMember;
            } catch (e) {
              // If check fails, member is likely not present
            }

            if (!isMember) {
              try {
                executeWithRetry(() => AdminDirectory.Members.insert({
                  email: email,
                  role: "MEMBER"
                }, groupEmail));
              } catch (memberErr) {
                Logger.log("Could not add user to group: " + memberErr);
              }
            }
            updateInviteProgress(sheet, rowNum, inviteStatusColIdx, step3Pattern);
          }
        });

        // STEP 4: Send Onboarding Email (Idempotent)
        const step4Pattern = "email:ok";
        if (currentStatus.indexOf(step4Pattern) === -1) {
          let htmlBody = "";
          // Build calendar subscription buttons
          let calendarLinksHtml = depts.map(dept => {
            const calId = deptCalMap[dept.toLowerCase()];
            if (!calId) return "";
            const cid = encodeURIComponent(calId);
            const link = "https://calendar.google.com/calendar/render?cid=" + cid;
            return `<p style="margin: 4px 0;"><a href="${link}" style="color: #bc5c2d; text-decoration: underline; font-weight: bold;">Subscribe to ${dept} Calendar</a></p>`;
          }).filter(Boolean).join("");
          if (!calendarLinksHtml) {
            calendarLinksHtml = "<p style='color: #63584c; font-style: italic;'>No department calendars assigned.</p>";
          }

          try {
            // Load responsive HTML template pushed via clasp
            const template = HtmlService.createHtmlOutputFromFile("email-templates/onboarding").getContent();
            htmlBody = template
              .replace("{{name}}", email.split("@")[0])
              .replace("{{departments}}", displayedDepartments)
              .replace("{{calendar_links}}", calendarLinksHtml)
              .replace("{{app_url}}", CONFIG.APP_URL);
          } catch (templateErr) {
            Logger.log("Could not load onboarding HTML template from file: " + templateErr + ". Using embedded fallback template.");
            htmlBody = getEmbeddedEmailTemplate(
              email.split("@")[0],
              displayedDepartments,
              calendarLinksHtml,
              CONFIG.APP_URL
            );
          }

          const subject = "Welcome to The Portal Map & Run of Show!";
          if (htmlBody) {
            executeWithRetry(() => GmailApp.sendEmail(email, subject, "", {
              htmlBody: htmlBody
            }));
          } else {
            // Safe plain text fallback without spam-trigger links (failsafe only)
            executeWithRetry(() => GmailApp.sendEmail(
              email,
              subject,
              "Welcome to The Portal!\n\nYou have been onboarded. You can access the event map and schedule once active."
            ));
          }
          updateInviteProgress(sheet, rowNum, inviteStatusColIdx, step4Pattern);
        }

        // Complete Onboarding
        sheet.getRange(rowNum, inviteStatusColIdx).setValue("Onboarded on " + new Date().toISOString());
        sheet.getRange(rowNum, sendInviteColIdx).setValue(false);
        if (activeColIdx) {
          sheet.getRange(rowNum, activeColIdx).setValue(true);
        }
      } catch (err) {
        Logger.log("Failed to process invite for " + email + ": " + err);
        const cell = sheet.getRange(rowNum, inviteStatusColIdx);
        const currentVal = String(cell.getValue() || "");
        cell.setValue(currentVal + (currentVal ? "; " : "") + "failed: " + err.message);
      }
    }
  }
}

/**
 * Appends a step status pattern to the invite_status cell.
 */
function updateInviteProgress(sheet, rowNum, colIdx, statusPattern) {
  const cell = sheet.getRange(rowNum, colIdx);
  const val = String(cell.getValue() || "");
  if (val.indexOf(statusPattern) === -1) {
    const newVal = val ? val + "; " + statusPattern : statusPattern;
    cell.setValue(newVal);
  }
}

function readSheetToJson(sheet) {
  if (!sheet) return [];
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length < 2) return [];

  // Detect and skip a banner row if it's mostly empty (<= 2 non-empty cells)
  let headerRowIdx = 0;
  if (sheet.getName() === "ROS by TIME" || (values[0].filter(val => String(val).trim() !== "").length <= 2 && values.length > 2)) {
    headerRowIdx = 1;
  }

  const headers = values[headerRowIdx].map(normalizeHeader);
  const rows = [];

  for (let i = headerRowIdx + 1; i < values.length; i++) {
    const row = values[i];
    const obj = {};
    headers.forEach((header, index) => {
      if (header) obj[header] = row[index];
    });
    rows.push(obj);
  }
  return rows;
}

/**
 * Safely normalizes header keys for Firebase compatibility, replacing illegal characters
 * like $ # [ ] / . and spaces with underscores.
 */
function normalizeHeader(h) {
  return String(h)
    .trim()
    .toLowerCase()
    .replace(/[\/\s.#$\[\]]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getFirebaseAccessToken() {
  const props = PropertiesService.getScriptProperties();
  const clientEmail = props.getProperty("SA_CLIENT_EMAIL");
  let privateKey = props.getProperty("SA_PRIVATE_KEY");

  if (!clientEmail || !privateKey) {
    throw new Error("Script Properties SA_CLIENT_EMAIL or SA_PRIVATE_KEY are missing.");
  }

  privateKey = privateKey.replace(/\\n/g, "\n");

  const header = JSON.stringify({
    alg: "RS256",
    typ: "JWT"
  });

  const now = Math.floor(Date.now() / 1000);
  const claim = JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  });

  const base64Encode = (str) => {
    return Utilities.base64EncodeWebSafe(str).replace(/=+$/, "");
  };

  const signatureInput = base64Encode(header) + "." + base64Encode(claim);
  const signature = Utilities.computeRsaSha256Signature(signatureInput, privateKey);
  const jwt = signatureInput + "." + base64Encode(Utilities.newBlob(signature).getBytes());

  const response = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    contentType: "application/x-www-form-urlencoded",
    payload: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + jwt
  });

  const data = JSON.parse(response.getContentText());
  return data.access_token;
}

function writeToFirebase(path, data) {
  const dbUrl = CONFIG.FIREBASE_DB_URL.endsWith("/") ? CONFIG.FIREBASE_DB_URL : CONFIG.FIREBASE_DB_URL + "/";
  const token = getFirebaseAccessToken();
  const url = dbUrl + path + ".json";

  const options = {
    method: "put",
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + token
    },
    payload: JSON.stringify(data)
  };
  UrlFetchApp.fetch(url, options);
}

function filterPublicEvents(events) {
  return events.filter(e => e.foh_boh !== "BOH");
}

function parseCsvList(str) {
  if (!str) return [];
  return String(str)
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function testPersonnelData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Personnel");
  if (!sheet) {
    Logger.log("No 'Personnel' sheet found!");
    return;
  }
  const data = readSheetToJson(sheet);
  Logger.log("Row count in Personnel: " + data.length);
  if (data.length > 0) {
    Logger.log("Columns found: " + Object.keys(data[0]).join(", "));
    Logger.log("First row data: " + JSON.stringify(data[0]));
  }
}

/**
 * Helper to execute an API call with exponential backoff.
 * Retries up to 3 times on 403 Rate Limit or 5xx Server errors.
 */
function executeWithRetry(apiCall) {
  const attempts = 3;
  const delays = [2000, 4000, 8000];
  for (let i = 0; i < attempts; i++) {
    try {
      return apiCall();
    } catch (e) {
      const msg = e.message || String(e);
      const isRetryable = msg.indexOf("403") !== -1 || msg.indexOf("50") !== -1 || msg.indexOf("rateLimit") !== -1 || msg.indexOf("User Rate Limit Exceeded") !== -1;
      if (isRetryable && i < attempts - 1) {
        Logger.log("Temporary error encountered: " + msg + ". Retrying in " + delays[i] + "ms...");
        Utilities.sleep(delays[i]);
      } else {
        throw e;
      }
    }
  }
}

/**
 * Creates a one-shot time trigger to resume onboarding execution.
 * Deletes any existing resume triggers first to prevent accumulation.
 */
function createResumeTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "resumeOnboarding") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("resumeOnboarding")
    .timeBased()
    .after(60 * 1000)
    .create();
}

/**
 * Entry point for script trigger to resume onboarding from the saved cursor.
 */
function resumeOnboarding() {
  const props = PropertiesService.getScriptProperties();
  const cursorStr = props.getProperty("ONBOARDING_CURSOR");
  if (cursorStr) {
    const cursor = parseInt(cursorStr, 10);
    props.deleteProperty("ONBOARDING_CURSOR");
    Logger.log("Resuming onboarding process from row: " + cursor);
    processOnboardingInvites(cursor);
  }
}

/**
 * Audit checks the Personnel sheet for active=false.
 * Removes inactive members from all assigned Workspace groups.
 */
function processOffboardingRemovals() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID || SpreadsheetApp.getActiveSpreadsheet().getId());
  const sheet = ss.getSheetByName("Personnel");
  if (!sheet) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader);
  const emailColIdx = headers.indexOf("email") + 1;
  const inviteStatusColIdx = headers.indexOf("invite_status") + 1;
  const activeColIdx = headers.indexOf("active") + 1;
  const roleColIdx = headers.indexOf("role") + 1;

  if (!emailColIdx || !activeColIdx || !inviteStatusColIdx) {
    Logger.log("Required offboarding columns (email, active, invite_status) not found.");
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  const values = dataRange.getValues();

  for (let i = 0; i < values.length; i++) {
    const rowNum = i + 2;
    const row = values[i];
    const email = row[emailColIdx - 1];
    const active = row[activeColIdx - 1];
    const roleVal = (roleColIdx > 0 && row[roleColIdx - 1]) ? String(row[roleColIdx - 1]).trim() : "";
    const status = String(row[inviteStatusColIdx - 1] || "");

    // Run offboarding if marked active=false and not yet flagged as offboarded
    if (active === false && email && status.indexOf("Offboarded") === -1) {
      Logger.log("Processing offboarding for: " + email);
      try {
        let depts = [];
        const lowerRoleVal = roleVal.toLowerCase();
        if (lowerRoleVal === "admin") {
          depts = ["All Departments"];
        } else if (lowerRoleVal === "public" || !roleVal) {
          depts = ["Public"];
        } else {
          depts = parseCsvList(roleVal);
        }

        const domain = getWorkspaceDomain();

        depts.forEach(dept => {
          const groupEmail = dept.toLowerCase().replace(/\s+/g, "-") + "@" + domain;
          try {
            executeWithRetry(() => AdminDirectory.Members.remove(groupEmail, email));
            Logger.log("Removed " + email + " from group: " + groupEmail);
          } catch (removeErr) {
            Logger.log("Could not remove " + email + " from group " + groupEmail + ": " + removeErr);
          }
        });

        sheet.getRange(rowNum, inviteStatusColIdx).setValue("Offboarded on " + new Date().toISOString());
      } catch (err) {
        Logger.log("Failed offboarding for " + email + ": " + err);
        sheet.getRange(rowNum, inviteStatusColIdx).setValue("Offboard failed: " + err.message);
      }
    }
  }
}

/**
 * Embedded fallback branded email template
 */
function getEmbeddedEmailTemplate(name, departments, calendarLinks, appUrl) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to The Portal</title>
</head>
<body style="margin: 0; padding: 0; background-color: #efe5d0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e1a16;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #efe5d0; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #fffdf3; border: 1px solid rgba(56, 38, 17, 0.15); border-radius: 12px; box-shadow: 0 10px 30px rgba(62, 35, 12, 0.08); overflow: hidden;">
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #1e1a16; padding: 32px; text-align: center; border-bottom: 4px solid #bc5c2d;">
              <h1 style="margin: 0; color: #f5ead2; font-size: 24px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">The Portal</h1>
              <p style="margin: 6px 0 0 0; color: #63584c; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;">Event Production Map & Schedule</p>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="margin: 0 0 20px 0; color: #1e1a16; font-size: 20px; font-weight: 700;">Hello ${name},</h2>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #3a3229;">
                You have been onboarded as crew for the upcoming event production. Below are your assigned departments and calendar access details:
              </p>
              
              <!-- Department Badges Box -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 28px 0; background-color: rgba(188, 92, 45, 0.06); border-left: 4px solid #bc5c2d; border-radius: 4px; padding: 16px 20px;">
                <tr>
                  <td>
                    <span style="display: block; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #bc5c2d; margin-bottom: 6px;">Your Departments</span>
                    <strong style="font-size: 16px; color: #1e1a16;">${departments}</strong>
                  </td>
                </tr>
              </table>

              <!-- Calendar Subscriptions Box -->
              <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; text-transform: uppercase; color: #63584c;">&#x1F4C5; Google Calendar Subscriptions</h3>
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #50473d;">
                You have been granted access to your department schedules on Google Calendar. Click below to add them to your calendar viewer:
              </p>
              <div style="margin: 0 0 32px 0; line-height: 1.6; font-size: 14px;">
                ${calendarLinks}
              </div>

              <!-- Action Button -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-top: 10px;">
                    <a href="${appUrl}" target="_blank" style="display: inline-block; background-color: #1e1a16; color: #fffdf3; border: 1px solid #bc5c2d; border-radius: 6px; padding: 14px 28px; font-size: 14px; font-weight: 700; text-decoration: none; letter-spacing: 0.05em; text-transform: uppercase; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">Access the Map Web App</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: rgba(30, 26, 22, 0.03); border-top: 1px solid rgba(56, 38, 17, 0.08); padding: 24px 32px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #63584c; line-height: 1.5;">
                This is an automated operational invite for crew members of event productions by The Portal.
              </p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: rgba(99, 88, 76, 0.7);">
                &copy; 2026 The Portal. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Dynamically resolves the Google Workspace domain of the executing user.
 */
function getWorkspaceDomain() {
  const email = Session.getEffectiveUser().getEmail() || "";
  const parts = email.split("@");
  return parts.length > 1 ? parts[1] : "vvexstudio.com";
}

/**
 * Synchronizes events from the 'ROS by TIME' (or 'ROS') sheet into their respective Department Google Calendars.
 */
function syncRosEventsToGoogleCalendars(ss) {
  ss = ss || SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID || SpreadsheetApp.getActiveSpreadsheet().getId());
  
  // 1. Build map of department name -> google_calendar_id from Departments tab
  const deptCalMap = getDepartmentCalendarMap(ss);

  const calendarKeys = Object.keys(deptCalMap);
  if (calendarKeys.length === 0) {
    Logger.log("No valid Google Calendar IDs found.");
    return;
  }

  // 2. Read ROS events
  const rosSheet = ss.getSheetByName("ROS by TIME") || ss.getSheetByName("ROS");
  if (!rosSheet) return;
  const rosEvents = readSheetToJson(rosSheet);

  Logger.log("Starting Google Calendar event sync for " + rosEvents.length + " ROS rows across " + calendarKeys.length + " department calendars.");

  let syncedCount = 0;
  let skippedCount = 0;

  rosEvents.forEach(row => {
    const action = String(row["action"] || "").trim();
    const description = String(row["description"] || "").trim();
    const title = description.split(/\n|\/\//)[0].trim() || action || "Scheduled Event";
    if (!title || title === "Scheduled Event") return;

    const startDateVal = row["start_day"] || row["start_date"] || row["date"];
    const startTimeVal = row["start"];
    const endTimeVal = row["end_time"] || row["end"];

    const startTime = parseRosDateTime(startDateVal, startTimeVal);
    if (!startTime) return;

    let endTime = parseRosDateTime(startDateVal, endTimeVal);
    if (!endTime || isNaN(endTime.getTime())) {
      endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hr default
    } else if (endTime <= startTime) {
      endTime.setDate(endTime.getDate() + 1);
    }

    const locationName = String(row["solaris_ros_location"] || row["location"] || "").trim();
    const leadDept = String(row["lead_dept"] || row["department"] || row["lead_department"] || "").trim();
    const support1 = String(row["support_dept_1"] || "").trim();
    const support2 = String(row["support_dept_2"] || "").trim();

    const deptsRaw = [leadDept, support1, support2].filter(Boolean).join(", ");
    let depts = parseCsvList(deptsRaw);

    if (depts.some(d => d.toLowerCase() === "all" || d.toLowerCase() === "all departments")) {
      depts = calendarKeys;
    }

    depts.forEach(dept => {
      const calId = deptCalMap[dept.toLowerCase()];
      if (!calId) return;

      try {
        const cal = CalendarApp.getCalendarById(calId);
        if (!cal) {
          Logger.log("Could not access Google Calendar ID: " + calId);
          return;
        }

        // Check if event already exists in window to prevent duplication
        const existingEvents = cal.getEvents(new Date(startTime.getTime() - 60000), new Date(endTime.getTime() + 60000));
        const duplicate = existingEvents.find(e => e.getTitle() === title);

        if (!duplicate) {
          cal.createEvent(title, startTime, endTime, {
            location: locationName,
            description: description ? (action ? action + "\n\n" + description : description) : action
          });
          syncedCount++;
        } else {
          skippedCount++;
        }
      } catch (err) {
        Logger.log("Failed to sync event '" + title + "' to calendar " + calId + ": " + err);
      }
    });
  });

  Logger.log("Google Calendar sync complete. Synced new: " + syncedCount + ", skipped existing: " + skippedCount);
}

/**
 * Helper to parse ROS start/end dates and times into JavaScript Date objects.
 */
function parseRosDateTime(dateVal, timeVal) {
  if (!dateVal && (timeVal === undefined || timeVal === null || timeVal === "")) return null;
  let year = 2026, month = 6, day = 19; // Default fallback: Montalcino 2026

  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    year = dateVal.getFullYear();
    month = dateVal.getMonth();
    day = dateVal.getDate();
  } else if (typeof dateVal === "number" && dateVal > 0) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(excelEpoch.getTime() + dateVal * 86400000);
    year = d.getFullYear();
    month = d.getMonth();
    day = d.getDate();
  } else if (typeof dateVal === "string" && dateVal.trim()) {
    const cleaned = dateVal.trim().replace(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s*/i, "");
    const parsed = new Date(cleaned.includes("20") ? cleaned : cleaned + ", 2026");
    if (!isNaN(parsed.getTime())) {
      year = parsed.getFullYear();
      month = parsed.getMonth();
      day = parsed.getDate();
    }
  }

  let hours = 0;
  let minutes = 0;

  if (typeof timeVal === "number" && Number.isFinite(timeVal)) {
    const normalized = ((timeVal % 1) + 1) % 1;
    const totalMinutes = Math.round(normalized * 24 * 60);
    hours = Math.floor(totalMinutes / 60);
    minutes = totalMinutes % 60;
  } else if (typeof timeVal === "string" && timeVal.trim()) {
    const compact = timeVal.trim().toLowerCase();
    const match = compact.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]m|m)?$/);
    if (match) {
      hours = Number(match[1]);
      minutes = Number(match[2] ?? "0");
      const suffix = match[3];
      if (suffix === "pm" && hours < 12) hours += 12;
      if ((suffix === "am" || suffix === "m") && hours === 12) hours = 0;
    }
  }

  return new Date(year, month, day, hours, minutes, 0, 0);
}

/**
 * Reads the 'Departments' sheet and returns a map of department_name (lowercase) -> google_calendar_id.
 * STRICT: Reads directly from the sheet and NEVER auto-creates new calendars.
 */
function getDepartmentCalendarMap(ss) {
  ss = ss || SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID || SpreadsheetApp.getActiveSpreadsheet().getId());
  const deptSheet = ss.getSheetByName("Departments");
  const deptCalMap = {};
  if (!deptSheet) return deptCalMap;

  const deptData = readSheetToJson(deptSheet);
  deptData.forEach(row => {
    const nameKey = Object.keys(row).find(k => k.toLowerCase() === "department" || k.toLowerCase() === "name" || k.toLowerCase() === "dept" || k.toLowerCase() === "dept_id");
    const calKey = Object.keys(row).find(k => k.toLowerCase() === "google_calendar_id" || k.toLowerCase() === "calendar_id");

    if (nameKey && calKey && row[nameKey] && row[calKey]) {
      const deptName = String(row[nameKey]).trim().toLowerCase();
      const calId = String(row[calKey]).trim();
      if (deptName && calId && !calId.includes("PRIMARY_OR_DEPT")) {
        deptCalMap[deptName] = calId;
      }
    }
  });

  return deptCalMap;
}

