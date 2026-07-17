/**
 * PortalSyncScript.js
 * 
 * Google Apps Script to sync Google Sheet data to Firebase Realtime Database,
 * provision Workspace Groups, update Google Calendar permissions, and send onboarding emails.
 */

const CONFIG = {
  FIREBASE_DB_URL: PropertiesService.getScriptProperties().getProperty("FIREBASE_DB_URL") || "",
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
      const role = roleKey ? String(person[roleKey]).trim() : "";
      
      // Find department key
      const deptKey = Object.keys(person).find(k => k.toLowerCase().includes("dept") || k.toLowerCase().includes("department"));
      const departmentsList = deptKey ? String(person[deptKey]).trim() : "";

      // Find active status (defaulting to true if column is missing or blank)
      const activeKey = Object.keys(person).find(k => k.toLowerCase().includes("active"));
      const active = activeKey ? (person[activeKey] !== false && String(person[activeKey]).toUpperCase() !== "FALSE") : true;
      
      authDirectory[escapedEmail] = {
        role: role || "guest",
        departments: parseCsvList(departmentsList),
        active: active
      };
    }
  });

  Logger.log("Auth Directory entries count: " + Object.keys(authDirectory).length);
  writeToFirebase("auth-directory", authDirectory);

  Logger.log("Firebase sync completed successfully.");
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

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, "_"));
  const emailColIdx = headers.findIndex(h => h.includes("email")) + 1;
  const sendInviteColIdx = headers.findIndex(h => h.includes("send_invite") || h.includes("send_invitation")) + 1;
  const inviteStatusColIdx = headers.findIndex(h => h.includes("invite_status") || h.includes("invitation_status")) + 1;
  const roleColIdx = headers.findIndex(h => h.includes("role")) + 1;
  const deptColIdx = headers.findIndex(h => h.includes("dept") || h.includes("department")) + 1;
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
    const departmentsList = row[deptColIdx - 1];
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
        const depts = parseCsvList(departmentsList);

        depts.forEach(dept => {
          const groupEmail = dept.toLowerCase().replace(/\s+/g, "-") + "@yourdomain.com";

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
          const calendarId = "primary"; // placeholder
          const step2Pattern = "cal:" + groupEmail + ":ok";
          if (currentStatus.indexOf(step2Pattern) === -1) {
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
          try {
            // Load responsive HTML template pushed via clasp
            const template = HtmlService.createHtmlOutputFromFile("email-templates/onboarding").getContent();
            
            // Build calendar subscription buttons
            const calendarLinksHtml = depts.map(dept => {
              const groupEmail = dept.toLowerCase().replace(/\s+/g, "-") + "@yourdomain.com";
              const cid = encodeURIComponent(groupEmail);
              const link = "https://calendar.google.com/calendar/render?cid=" + cid;
              return `<p style="margin: 4px 0;"><a href="${link}" style="color: #bc5c2d; text-decoration: underline; font-weight: bold;">Subscribe to ${dept} Calendar</a></p>`;
            }).join("");

            htmlBody = template
              .replace("{{name}}", email.split("@")[0])
              .replace("{{departments}}", departmentsList)
              .replace("{{calendar_links}}", calendarLinksHtml)
              .replace("{{app_url}}", CONFIG.APP_URL || "https://your-domain.vercel.app");
          } catch (templateErr) {
            Logger.log("Could not load onboarding HTML template: " + templateErr + ". Falling back to plain text email.");
            htmlBody = ""; // Clear HTML body so we use plain text body
          }

          const subject = "Welcome to The Portal Map & Run of Show!";
          if (htmlBody) {
            executeWithRetry(() => GmailApp.sendEmail(email, subject, "", {
              htmlBody: htmlBody
            }));
          } else {
            // Safe plain text fallback without spam-trigger links
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

  const headers = values[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, "_"));
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = {};
    headers.forEach((header, index) => {
      if (header) obj[header] = row[index];
    });
    rows.push(obj);
  }
  return rows;
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

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, "_"));
  const emailColIdx = headers.indexOf("email") + 1;
  const inviteStatusColIdx = headers.indexOf("invite_status") + 1;
  const activeColIdx = headers.indexOf("active") + 1;
  const deptColIdx = headers.indexOf("department") + 1;

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
    const departmentsList = row[deptColIdx - 1];
    const status = String(row[inviteStatusColIdx - 1] || "");

    // Run offboarding if marked active=false and not yet flagged as offboarded
    if (active === false && email && status.indexOf("Offboarded") === -1) {
      Logger.log("Processing offboarding for: " + email);
      try {
        const depts = parseCsvList(departmentsList);

        depts.forEach(dept => {
          const groupEmail = dept.toLowerCase().replace(/\s+/g, "-") + "@yourdomain.com";
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

