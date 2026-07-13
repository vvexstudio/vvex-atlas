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
  const approvedEmails = readSheetToJson(ss.getSheetByName("Approved Emails") || ss.getSheetByName("Approved_Emails"));

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

  writeToFirebase("admin-data", data);

  // 4. Build/Update Auth Directory for authentication tokens
  const authDirectory = {};

  Logger.log("Approved Emails count: " + approvedEmails.length);
  Logger.log("Personnel count: " + personnel.length);

  // 4a. Initialize with Approved Emails as guests
  approvedEmails.forEach(entry => {
    const emailKey = Object.keys(entry).find(k => k.toLowerCase().includes("email"));
    const email = emailKey ? String(entry[emailKey]).trim() : "";
    if (email) {
      const escapedEmail = email.toLowerCase().replace(/\./g, ",");
      authDirectory[escapedEmail] = {
        role: "guest",
        departments: []
      };
    }
  });

  // 4b. Overlay/Merge details from Personnel (which have specific roles/departments)
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
      
      // Merge or create
      if (!authDirectory[escapedEmail]) {
        authDirectory[escapedEmail] = {
          role: role || "guest",
          departments: parseCsvList(departmentsList)
        };
      } else {
        if (role) authDirectory[escapedEmail].role = role;
        if (departmentsList) authDirectory[escapedEmail].departments = parseCsvList(departmentsList);
      }
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
function processOnboardingInvites() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Personnel");
  if (!sheet) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, "_"));
  const emailColIdx = headers.indexOf("email") + 1;
  const sendInviteColIdx = headers.indexOf("send_invite") + 1;
  const inviteStatusColIdx = headers.indexOf("invite_status") + 1;
  const roleColIdx = headers.indexOf("role") + 1;
  const deptColIdx = headers.indexOf("department") + 1;

  if (!emailColIdx || !sendInviteColIdx || !inviteStatusColIdx) {
    Logger.log("Required onboarding columns (email, send_invite, invite_status) not found.");
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
    const sendInvite = row[sendInviteColIdx - 1];
    const role = row[roleColIdx - 1];
    const departmentsList = row[deptColIdx - 1];

    if (sendInvite === true && email) {
      Logger.log("Processing invite for: " + email);
      try {
        const depts = parseCsvList(departmentsList);

        depts.forEach(dept => {
          const groupEmail = dept.toLowerCase().replace(/\s+/g, "-") + "@yourdomain.com";

          let group = null;
          try {
            group = AdminDirectory.Groups.get(groupEmail);
          } catch (e) {
            group = AdminDirectory.Groups.insert({
              email: groupEmail,
              name: dept + " Group",
              description: "Automated group for " + dept
            });
            Utilities.sleep(5000); // Sleep for replication

            const calendarId = "primary"; // placeholder
            try {
              Calendar.Acl.insert({
                role: "reader",
                scope: { type: "group", value: groupEmail }
              }, calendarId);
            } catch (calErr) {
              Logger.log("Could not set calendar ACL for new group: " + calErr);
            }
          }

          try {
            AdminDirectory.Members.insert({
              email: email,
              role: "MEMBER"
            }, groupEmail);
          } catch (memberErr) {
            Logger.log("Could not add user to group: " + memberErr);
          }
        });

        const subject = "Welcome to The Portal Map & Run of Show!";
        const body = `
          <h2>Welcome!</h2>
          <p>You have been onboarded to the following departments: <strong>${departmentsList}</strong>.</p>
          <p>You can access the live map and schedule here: <a href="https://your-domain.vercel.app">Map Web App</a></p>
        `;
        MailApp.sendEmail({
          to: email,
          subject: subject,
          htmlBody: body
        });

        sheet.getRange(rowNum, inviteStatusColIdx).setValue("Onboarded on " + new Date().toISOString());
        sheet.getRange(rowNum, sendInviteColIdx).setValue(false);
      } catch (err) {
        Logger.log("Failed to process invite for " + email + ": " + err);
        sheet.getRange(rowNum, inviteStatusColIdx).setValue("Failed: " + err.message);
      }
    }
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
