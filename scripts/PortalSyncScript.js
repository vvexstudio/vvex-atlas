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
  const lock = LockService.getScriptLock();
  try {
    // Wait for up to 30 seconds for any previous execution to finish
    lock.waitLock(30000);
  } catch (e) {
    Logger.log("Could not acquire lock: another execution is in progress. Skipping this run.");
    return;
  }

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID || SpreadsheetApp.getActiveSpreadsheet().getId());

    // Automatically provision missing Google Calendars and Groups first
    try {
      provisionMissingCalendarsAndGroups(ss);
    } catch (provisionErr) {
      Logger.log("Error during dynamic department provisioning: " + provisionErr);
    }

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
        if (lowerRoleVal === "admin" || lowerRoleVal.includes("admin")) {
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
  } finally {
    lock.releaseLock();
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
  const calendarKeys = Object.keys(deptCalMap);

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader);
  const nameColIdx = headers.findIndex(h => h === "name" || h.includes("name")) + 1;
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
    const userName = (nameColIdx > 0 && row[nameColIdx - 1]) ? String(row[nameColIdx - 1]).trim() : email.split("@")[0];
    const roleVal = (roleColIdx > 0 && row[roleColIdx - 1]) ? String(row[roleColIdx - 1]).trim() : "";
    
    let role = "guest";
    let depts = [];

    const lowerRoleVal = roleVal.toLowerCase();
    if (lowerRoleVal === "admin" || lowerRoleVal.includes("admin")) {
      role = "admin";
      depts = ["All Departments"];
    } else if (lowerRoleVal === "public" || !roleVal) {
      role = "guest";
      depts = ["Public"];
    } else {
      role = "crew";
      depts = parseCsvList(roleVal);
    }

    const displayedDepartments = (role === "admin" || depts.some(d => d.toLowerCase() === "all" || d.toLowerCase() === "all departments")) ? "All Departments" : (depts.join(", ") || "General");
    const currentStatus = String(row[inviteStatusColIdx - 1] || "");

    // Determine target departments to process
    let deptsToProcess = depts;
    const isAdmin = role === "admin" || depts.some(d => d.toLowerCase() === "all" || d.toLowerCase() === "all departments");
    if (isAdmin) {
      deptsToProcess = ["All Departments"];
    }

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
      if (currentStatus.indexOf("Onboarded") !== -1 || currentStatus.indexOf("email:ok") !== -1) {
        Logger.log("Info: " + email + " is already onboarded/emailed. Skipping duplicate invite.");
        sheet.getRange(rowNum, sendInviteColIdx).setValue(false);
        SpreadsheetApp.flush();
        continue;
      }

      Logger.log("Processing invite for: " + email);
      try {
        const domain = getWorkspaceDomain();

        deptsToProcess.forEach(dept => {
          const groupEmail = dept.toLowerCase().replace(/[^a-z0-9&]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") + "@" + domain;

          // STEP 1: Workspace Group (Idempotent)
          let group = null;
          const step1Pattern = "group:" + groupEmail + ":ok";
          if (currentStatus.indexOf(step1Pattern) === -1) {
            try {
              group = executeWithRetry(() => AdminDirectory.Groups.get(groupEmail));
            } catch (e) {
              try {
                group = executeWithRetry(() => AdminDirectory.Groups.insert({
                  email: groupEmail,
                  name: dept + " Group",
                  description: "Automated group for " + dept
                }));
                Utilities.sleep(5000); // Sleep for replication only after creation
                allowExternalMembers(groupEmail);
              } catch (insertErr) {
                Logger.log("Info: Group " + groupEmail + " already exists or could not be created: " + insertErr);
              }
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
                throw new Error("Failed to add " + email + " to Google Group " + groupEmail + ": " + memberErr.message);
              }
            }
            updateInviteProgress(sheet, rowNum, inviteStatusColIdx, step3Pattern);
          }
        });

        // STEP 4: Send Onboarding Email (Idempotent)
        const step4Pattern = "email:ok";
        if (currentStatus.indexOf(step4Pattern) === -1 && currentStatus.indexOf("Onboarded") === -1) {
          let htmlBody = "";
          let calendarSectionHtml = "";
          if (isAdmin) {
            // Build calendar subscription buttons for admins (compact inline list to prevent clutter)
            let calendarLinksHtml = calendarKeys.filter(d => d.toLowerCase() !== "all" && d.toLowerCase() !== "all departments" && d.toLowerCase() !== "public").map(dept => {
              const calId = deptCalMap[dept.toLowerCase()];
              if (!calId) return "";
              const cid = encodeURIComponent(calId);
              const link = "https://calendar.google.com/calendar/render?cid=" + cid;
              return `<a href="${link}" style="color: #bc5c2d; text-decoration: underline; font-weight: bold; margin-right: 12px; display: inline-block;">${dept}</a>`;
            }).filter(Boolean).join(" • ");

            calendarSectionHtml = `
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #50473d;">
                As an Admin / All Departments member, you have automatically been granted access to all department schedules via the <strong>all-departments</strong> group.
              </p>
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #50473d;">
                <strong>Note:</strong> Google Calendar does not automatically add shared calendars to your sidebar. You can view all events on the Map Web App, or click below to add specific department calendars to your Google Calendar viewer:
              </p>
              <p style="margin: 0 0 32px 0; line-height: 1.8; font-size: 14px; background-color: rgba(30, 26, 22, 0.03); border: 1px solid rgba(56, 38, 17, 0.1); border-radius: 6px; padding: 12px 16px;">
                ${calendarLinksHtml}
              </p>
            `;
          } else {
            let calendarLinksHtml = deptsToProcess.map(dept => {
              const calId = deptCalMap[dept.toLowerCase()];
              if (!calId) return "";
              const cid = encodeURIComponent(calId);
              const link = "https://calendar.google.com/calendar/render?cid=" + cid;
              return `<p style="margin: 4px 0;"><a href="${link}" style="color: #bc5c2d; text-decoration: underline; font-weight: bold;">Subscribe to ${dept} Calendar</a></p>`;
            }).filter(Boolean).join("");

            if (!calendarLinksHtml) {
              calendarLinksHtml = "<p style='color: #63584c; font-style: italic;'>No department calendars assigned.</p>";
            }

            calendarSectionHtml = `
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #50473d;">
                You have been granted access to your department schedules on Google Calendar. Click below to add them to your calendar viewer:
              </p>
              <div style="margin: 0 0 32px 0; line-height: 1.6; font-size: 14px;">
                ${calendarLinksHtml}
              </div>
            `;
          }

          try {
            // Load responsive HTML template pushed via clasp (or fallback to flattened name)
            let templateString = "";
            try {
              templateString = HtmlService.createHtmlOutputFromFile("email-templates/onboarding").getContent();
            } catch (e) {
              // Fallback if the user manually created it as just "onboarding" in the web editor
              templateString = HtmlService.createHtmlOutputFromFile("onboarding").getContent();
            }
            htmlBody = templateString
              .replace("{{name}}", userName)
              .replace("{{departments}}", displayedDepartments)
              .replace("{{calendar_section}}", calendarSectionHtml)
              .replace("{{app_url}}", CONFIG.APP_URL);
          } catch (templateErr) {
            Logger.log("Could not load onboarding HTML template from file: " + templateErr + ". Using embedded fallback template.");
            htmlBody = getEmbeddedEmailTemplate(
              userName,
              displayedDepartments,
              calendarSectionHtml,
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
        sheet.getRange(rowNum, inviteStatusColIdx).setValue("Onboarded on " + new Date().toISOString() + "; email:ok");
        sheet.getRange(rowNum, sendInviteColIdx).setValue(false);
        if (activeColIdx) {
          sheet.getRange(rowNum, activeColIdx).setValue(true);
        }
        SpreadsheetApp.flush();
      } catch (err) {
        Logger.log("Failed to process invite for " + email + ": " + err);
        const cell = sheet.getRange(rowNum, inviteStatusColIdx);
        const currentVal = String(cell.getValue() || "");
        cell.setValue(currentVal + (currentVal ? "; " : "") + "failed: " + err.message);
        SpreadsheetApp.flush();
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

function readFromFirebase(path) {
  const dbUrl = CONFIG.FIREBASE_DB_URL.endsWith("/") ? CONFIG.FIREBASE_DB_URL : CONFIG.FIREBASE_DB_URL + "/";
  const token = getFirebaseAccessToken();
  const url = dbUrl + path + ".json";

  const options = {
    method: "get",
    headers: {
      "Authorization": "Bearer " + token
    },
    muteHttpExceptions: true
  };
  try {
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() === 200) {
      const text = response.getContentText();
      return (text && text !== "null") ? JSON.parse(text) : null;
    }
  } catch (e) {
    Logger.log("Error reading from Firebase (" + path + "): " + e);
  }
  return null;
}

function computeMd5(input) {
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(input || ""), Utilities.Charset.UTF_8);
  let txt = "";
  for (let i = 0; i < rawHash.length; i++) {
    let byteVal = rawHash[i];
    if (byteVal < 0) byteVal += 256;
    let byteStr = byteVal.toString(16);
    if (byteStr.length === 1) byteStr = "0" + byteStr;
    txt += byteStr;
  }
  return txt;
}

function normalizeString(val) {
  return String(val || "").trim().toLowerCase();
}

function escapeFirebaseKey(key) {
  return String(key || "").replace(/\./g, ",");
}

function unescapeFirebaseKey(key) {
  return String(key || "").replace(/,/g, ".");
}

function formatDateIso(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function insertGcalEvent(payload, calId) {
  return Calendar.Events.insert(payload, calId);
}

function patchGcalEvent(payload, calId, gcalEventId) {
  if (typeof Calendar.Events.patch === "function") {
    return Calendar.Events.patch(payload, calId, gcalEventId);
  } else if (typeof Calendar.Events.update === "function") {
    return Calendar.Events.update(payload, calId, gcalEventId);
  }
  throw new Error("Calendar.Events.patch method not available");
}

function deleteGcalEvent(calId, gcalEventId) {
  try {
    if (typeof Calendar.Events.delete === "function") {
      return Calendar.Events.delete(calId, gcalEventId);
    } else if (typeof Calendar.Events.remove === "function") {
      return Calendar.Events.remove(calId, gcalEventId);
    }
  } catch (e) {
    // Ignore if event was already deleted
  }
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
        const deptCalMap = getDepartmentCalendarMap(ss);
        const calendarKeys = Object.keys(deptCalMap);

        let depts = [];
        const lowerRoleVal = roleVal.toLowerCase();
        if (lowerRoleVal === "admin") {
          depts = ["All Departments"];
        } else if (lowerRoleVal === "public" || !roleVal) {
          depts = ["Public"];
        } else {
          depts = parseCsvList(roleVal);
        }

        let deptsToProcess = depts;
        if (
          lowerRoleVal === "admin" ||
          lowerRoleVal.includes("admin") ||
          depts.some(d => {
            const dl = d.toLowerCase();
            return dl === "all" || dl === "all departments" || dl === "admin";
          })
        ) {
          deptsToProcess = calendarKeys.filter(d => d.toLowerCase() !== "all" && d.toLowerCase() !== "all departments" && d.toLowerCase() !== "public");
          deptsToProcess.push("All Departments");
        }

        const domain = getWorkspaceDomain();

        deptsToProcess.forEach(dept => {
          const groupEmail = dept.toLowerCase().replace(/[^a-z0-9&]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") + "@" + domain;
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
function getEmbeddedEmailTemplate(name, departments, calendarSection, appUrl) {
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
              ${calendarSection}

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
 * Synchronizes events from the 'ROS by TIME' (or 'ROS') sheet into their respective Department Google Calendars
 * using procedural two-level hashing (semantic_key + content_hash) and atomic upsert/prune state machine.
 */
function syncRosEventsToGoogleCalendars(ss) {
  const syncStartTime = Date.now();
  ss = ss || SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID || SpreadsheetApp.getActiveSpreadsheet().getId());
  
  // 1. Build map of department name -> google_calendar_id from Departments tab
  const deptCalMap = getDepartmentCalendarMap(ss);
  const calendarKeys = Object.keys(deptCalMap);
  if (calendarKeys.length === 0) {
    Logger.log("No valid Google Calendar IDs found.");
    return;
  }

  // 2. Fetch existing sync metadata registry from Firebase RTDB
  const metadataPath = "crew-data/metadata/calendar-events";
  const metadata = readFromFirebase(metadataPath) || {};

  // 3. Read ROS events
  const rosSheet = ss.getSheetByName("ROS by TIME") || ss.getSheetByName("ROS");
  if (!rosSheet) return;
  const rosEvents = readSheetToJson(rosSheet);

  const activeKeys = new Set();
  const occurrenceMap = {};

  let updatedCount = 0;
  let addedCount = 0;
  let prunedCount = 0;
  let unchangedCount = 0;

  rosEvents.forEach(row => {
    const action = String(row["action"] || "").trim();
    const description = String(row["description"] || "").trim();
    let title = description.split(/\n|\/\//)[0].trim() || action || "Scheduled Event";
    if (!title || title === "Scheduled Event") return;

    // Skip all sunset and sunrise events
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes("sunrise") || lowerTitle.includes("sunset")) return;

    const startDateVal = row["start_day"] || row["start_date"] || row["date"];
    const startTimeVal = row["start"];
    const endTimeVal = row["end_time"] || row["end"];

    let isAllDay = false;
    let isTbd = false;

    const startStr = String(startTimeVal || "").trim().toUpperCase();
    if (!startTimeVal || startStr === "TBD" || startStr === "") {
      isAllDay = true;
      if (startStr === "TBD") {
        isTbd = true;
      }
    }

    if (isTbd && !title.toUpperCase().includes("TBD")) {
      title += " [TBD]";
    }

    const startTime = parseRosDateTime(startDateVal, isAllDay ? "" : startTimeVal);
    if (!startTime) return;

    let endTime;
    if (isAllDay) {
      endTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000);
    } else {
      endTime = parseRosDateTime(startDateVal, endTimeVal);
      if (!endTime || isNaN(endTime.getTime())) {
        endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      } else if (endTime <= startTime) {
        endTime.setDate(endTime.getDate() + 1);
      }
    }

    const locationName = String(row["solaris_ros_location"] || row["location"] || "").trim();
    const leadDept = String(row["lead_dept"] || row["department"] || row["lead_department"] || "").trim();
    const support1 = String(row["support_dept_1"] || "").trim();
    const support2 = String(row["support_dept_2"] || "").trim();
    const fohBoh = String(row["foh_boh"] || "").trim();

    const deptsRaw = [leadDept, support1, support2].filter(Boolean).join(", ");
    let depts = parseCsvList(deptsRaw);

    if (depts.some(d => d.toLowerCase() === "all" || d.toLowerCase() === "all departments")) {
      depts = calendarKeys;
    }

    const targetCalIds = new Set();
    depts.forEach(dept => {
      const calId = deptCalMap[dept.toLowerCase()];
      if (calId) targetCalIds.add(calId);
    });

    if (targetCalIds.size === 0) return;

    // --- Procedural Two-Level Hashing ---
    const startDateIso = formatDateIso(startTime);
    const baseIdentityStr = normalizeString(startDateIso) + "::" + normalizeString(locationName) + "::" + normalizeString(title);
    const occurrenceIndex = (occurrenceMap[baseIdentityStr] || 0) + 1;
    occurrenceMap[baseIdentityStr] = occurrenceIndex;

    const semanticKeyInput = baseIdentityStr + "::" + occurrenceIndex;
    const semanticKey = computeMd5(semanticKeyInput);
    activeKeys.add(semanticKey);

    const startTimeStr = isAllDay ? startDateIso : startTime.toISOString();
    const endTimeStr = isAllDay ? formatDateIso(endTime) : endTime.toISOString();
    const supportDeptsStr = [support1, support2].filter(Boolean).map(normalizeString).join(",");
    const contentHashInput = normalizeString(startTimeStr) + "::" + normalizeString(endTimeStr) + "::" + normalizeString(description) + "::" + normalizeString(leadDept) + "::" + supportDeptsStr + "::" + normalizeString(fohBoh);
    const contentHash = computeMd5(contentHashInput);

    // Prepare Google Calendar Event Payload
    const payload = {
      summary: title,
      location: locationName,
      description: description ? (action ? action + "\n\n" + description : description) : action
    };

    if (isAllDay) {
      payload.start = { date: startDateIso };
      payload.end = { date: formatDateIso(endTime) };
    } else {
      payload.start = { dateTime: startTime.toISOString() };
      payload.end = { dateTime: endTime.toISOString() };
    }

    const existingEntry = metadata[semanticKey];

    if (existingEntry && existingEntry.content_hash === contentHash) {
      // Unchanged Row: Skip Google Calendar API calls
      unchangedCount++;
    } else if (existingEntry) {
      // Time/Detail Change: Patch existing Google Calendar events in-place
      const gcalEventIds = existingEntry.gcal_event_ids || {};
      targetCalIds.forEach(calId => {
        const escapedCalId = escapeFirebaseKey(calId);
        const existingGcalId = gcalEventIds[escapedCalId];
        if (existingGcalId) {
          try {
            executeWithRetry(() => patchGcalEvent(payload, calId, existingGcalId));
          } catch (patchErr) {
            // Fallback to insert if patch failed (e.g. event was manually deleted)
            try {
              const newEvt = executeWithRetry(() => insertGcalEvent(payload, calId));
              if (newEvt && newEvt.id) {
                gcalEventIds[escapedCalId] = newEvt.id;
              }
            } catch (insertErr) {
              // Ignore single calendar failure
            }
          }
        } else {
          try {
            const newEvt = executeWithRetry(() => insertGcalEvent(payload, calId));
            if (newEvt && newEvt.id) {
              gcalEventIds[escapedCalId] = newEvt.id;
            }
          } catch (insertErr) {
            // Ignore single calendar failure
          }
        }
      });

      // Delete event from calendars no longer assigned
      Object.keys(gcalEventIds).forEach(escapedCalId => {
        const calId = unescapeFirebaseKey(escapedCalId);
        if (!targetCalIds.has(calId)) {
          executeWithRetry(() => deleteGcalEvent(calId, gcalEventIds[escapedCalId]));
          delete gcalEventIds[escapedCalId];
        }
      });

      metadata[semanticKey] = {
        content_hash: contentHash,
        gcal_event_ids: gcalEventIds,
        last_updated: new Date().toISOString()
      };
      updatedCount++;
    } else {
      // New Event: Insert into target calendars
      const gcalEventIds = {};
      targetCalIds.forEach(calId => {
        const escapedCalId = escapeFirebaseKey(calId);
        try {
          const createdEvt = executeWithRetry(() => insertGcalEvent(payload, calId));
          if (createdEvt && createdEvt.id) {
            gcalEventIds[escapedCalId] = createdEvt.id;
          }
        } catch (err) {
          // Ignore single calendar failure
        }
      });

      metadata[semanticKey] = {
        content_hash: contentHash,
        gcal_event_ids: gcalEventIds,
        last_updated: new Date().toISOString()
      };
      addedCount++;
    }
  });

  // 4. Cleanup / Prune Pass (Deleted Spreadsheet Rows)
  Object.keys(metadata).forEach(key => {
    if (!activeKeys.has(key)) {
      const staleEntry = metadata[key];
      const gcalMap = (staleEntry && staleEntry.gcal_event_ids) || {};
      Object.keys(gcalMap).forEach(escapedCalId => {
        const calId = unescapeFirebaseKey(escapedCalId);
        executeWithRetry(() => deleteGcalEvent(calId, gcalMap[escapedCalId]));
      });
      delete metadata[key];
      prunedCount++;
    }
  });

  // 5. Save updated metadata registry to Firebase RTDB
  writeToFirebase(metadataPath, metadata);

  // 6. Single consolidated summary log
  const elapsedSec = ((Date.now() - syncStartTime) / 1000).toFixed(1);
  Logger.log("✓ Google Calendar sync complete (" + elapsedSec + "s): " + updatedCount + " updated, " + addedCount + " added, " + prunedCount + " pruned, " + unchangedCount + " unchanged.");
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

  if (timeVal instanceof Date && !isNaN(timeVal.getTime())) {
    hours = timeVal.getHours();
    minutes = timeVal.getMinutes();
  } else if (typeof timeVal === "number" && Number.isFinite(timeVal)) {
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
 * Dynamically creates missing Google Calendars and Google Groups for departments listed in the spreadsheet,
 * grants the group read access to the calendar, and writes the calendar ID back to the sheet.
 */
function provisionMissingCalendarsAndGroups(ss) {
  const sheet = ss.getSheetByName("Departments");
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader);
  const deptColIdx = headers.indexOf("department") + 1;
  const calColIdx = headers.indexOf("google_calendar_id") + 1;

  if (!deptColIdx || !calColIdx) return;

  const range = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  const values = range.getValues();
  const domain = getWorkspaceDomain();

  for (let i = 0; i < values.length; i++) {
    const rowNum = i + 2;
    const deptName = String(values[i][deptColIdx - 1]).trim();
    if (!deptName || deptName.toLowerCase() === "public") continue;

    let calId = String(values[i][calColIdx - 1]).trim();
    let cal = null;
    if (calId) {
      try {
        cal = CalendarApp.getCalendarById(calId);
      } catch (e) {
        Logger.log("Inaccessible calendar ID " + calId + " for " + deptName + ": " + e.message);
      }
    }

    // 1. Create calendar if missing or inaccessible
    if (!calId || !cal) {
      try {
        Logger.log("Creating missing/inaccessible calendar for department: " + deptName);
        const newCal = CalendarApp.createCalendar("Portal: " + deptName);
        calId = newCal.getId();
        sheet.getRange(rowNum, calColIdx).setValue(calId);
        Logger.log("✓ Created calendar: " + calId);
      } catch (err) {
        Logger.log("❌ Failed to create calendar for " + deptName + ": " + err);
        continue;
      }
    }

    // 2. Create group if missing
    const groupEmail = deptName.toLowerCase().replace(/[^a-z0-9&]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") + "@" + domain;
    let groupExists = false;
    try {
      AdminDirectory.Groups.get(groupEmail);
      groupExists = true;
    } catch (e) {
      try {
        Logger.log("Creating missing Google Group: " + groupEmail);
        AdminDirectory.Groups.insert({
          email: groupEmail,
          name: deptName + " Group",
          description: "Automated group for " + deptName
        });
        groupExists = true;
        Utilities.sleep(5000); // Replication lag sleep
        allowExternalMembers(groupEmail);
      } catch (createErr) {
        Logger.log("❌ Failed to create group " + groupEmail + ": " + createErr);
      }
    }

    // 3. Grant group read access to calendar
    if (calId && groupExists) {
      try {
        const aclList = Calendar.Acl.list(calId);
        let aclExists = false;
        if (aclList && aclList.items) {
          aclExists = aclList.items.some(rule => rule.scope && rule.scope.type === "group" && rule.scope.value === groupEmail);
        }

        if (!aclExists) {
          Logger.log("Granting group " + groupEmail + " access to calendar " + calId);
          Calendar.Acl.insert({
            role: "reader",
            scope: { type: "group", value: groupEmail }
          }, calId);
        }
      } catch (aclErr) {
        Logger.log("❌ Failed to set calendar ACL for group " + groupEmail + ": " + aclErr);
      }
    }

    // 3a. Grant "all-departments" group read access to calendar
    if (calId) {
      const allDeptsGroupEmail = "all-departments@" + domain;
      try {
        const aclList = Calendar.Acl.list(calId);
        let aclExists = false;
        if (aclList && aclList.items) {
          aclExists = aclList.items.some(rule => rule.scope && rule.scope.type === "group" && rule.scope.value === allDeptsGroupEmail);
        }

        if (!aclExists) {
          Logger.log("Granting group " + allDeptsGroupEmail + " access to calendar " + calId);
          Calendar.Acl.insert({
            role: "reader",
            scope: { type: "group", value: allDeptsGroupEmail }
          }, calId);
        }
      } catch (aclErr) {
        Logger.log("❌ Failed to set calendar ACL for group " + allDeptsGroupEmail + ": " + aclErr);
      }
    }
  }

  // Force Spreadsheet changes to flush so future reads see updated calendar IDs
  SpreadsheetApp.flush();
}

/**
 * Reads the 'Departments' sheet and returns a map of department_name (lowercase) -> google_calendar_id.
 * Dynamically populated by provisionMissingCalendarsAndGroups.
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

/**
 * UTILITY: Clears all events in the event date window (August 1, 2026 to September 15, 2026)
 * from all configured department calendars so you can start with a clean slate.
 */
function clearAllSyncCalendars() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID || SpreadsheetApp.getActiveSpreadsheet().getId());
  const deptCalMap = getDepartmentCalendarMap(ss);
  const calendarKeys = Object.keys(deptCalMap);
  
  // Date window of the event (August 1 to September 15, 2026)
  const startRange = new Date(2026, 7, 1); // August (7 is 0-indexed)
  const endRange = new Date(2026, 8, 15);  // September (8 is 0-indexed)
  
  const processedCalIds = new Set();
  calendarKeys.forEach(dept => {
    const calId = deptCalMap[dept];
    if (!calId || processedCalIds.has(calId)) return;
    processedCalIds.add(calId);

    try {
      const cal = CalendarApp.getCalendarById(calId);
      if (cal) {
        Logger.log("Clearing events from calendar: " + cal.getName() + " (" + calId + ")");
        const events = cal.getEvents(startRange, endRange);
        events.forEach(e => e.deleteEvent());
        Logger.log("✓ Deleted " + events.length + " events.");
      }
    } catch (e) {
      Logger.log("❌ Error clearing calendar " + calId + ": " + e);
    }
  });
}

/**
 * Helper to update a Google Group's settings to allow external members.
 * Requires the Groups Settings API service to be enabled in appsscript.json.
 */
function allowExternalMembers(groupEmail) {
  try {
    const settings = {
      allowExternalMembers: "true"
    };
    GroupsSettings.Groups.patch(settings, groupEmail);
    Logger.log("✓ Allowed external members for group: " + groupEmail);
  } catch (err) {
    Logger.log("❌ Failed to allow external members for " + groupEmail + ": " + err);
  }
}

