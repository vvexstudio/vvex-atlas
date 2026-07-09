/**
 * PortalSyncScript.js
 * 
 * Google Apps Script to sync Google Sheet data to Firebase Realtime Database,
 * provision Workspace Groups, update Google Calendar permissions, and send onboarding emails.
 */

const CONFIG = {
  FIREBASE_DB_URL: "https://your-app-default-rtdb.firebaseio.com/",
  FIREBASE_SECRET: "your-firebase-database-secret", // (Replace with Service Account credentials in production)
  SPREADSHEET_ID: "your-google-sheet-id",
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
  
  writeToFirebase("admin-data", data);
  
  // 4. Build/Update Auth Directory for authentication tokens
  const authDirectory = {};
  personnel.forEach(person => {
    if (person.email) {
      const escapedEmail = person.email.trim().toLowerCase().replace(/\./g, ",");
      authDirectory[escapedEmail] = {
        role: person.role || "guest",
        departments: parseCsvList(person.department || person.departments || "")
      };
    }
  });
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
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
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
  
  const headers = values[0].map(h => String(h).trim());
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

function writeToFirebase(path, data) {
  const url = CONFIG.FIREBASE_DB_URL + path + ".json?auth=" + CONFIG.FIREBASE_SECRET;
  const options = {
    method: "put",
    contentType: "application/json",
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
