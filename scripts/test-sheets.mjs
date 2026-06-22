import * as XLSX from "xlsx";
import fs from "node:fs/promises";
import path from "node:path";

// Load environment variables from .env.local manually
async function loadEnv() {
  try {
    const content = await fs.readFile(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    }
  } catch (err) {
    console.warn("No .env.local found, using process.env directly.");
  }
}

async function getAccessToken() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Google OAuth credentials in environment.");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function getSpreadsheetValues(spreadsheetId, range, accessToken) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets API call failed: ${text}`);
  }

  const data = await res.json();
  return data.values || [];
}

async function main() {
  await loadEnv();

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "1rpmzT4_6NlAOSryN86ROv3mv1Jf4ydColAlk6MrY1zw";
  
  console.log("=========================================");
  console.log("Verifying Google Sheets API Connection");
  console.log("=========================================");
  console.log(`Spreadsheet ID: ${spreadsheetId}`);

  // Test 1: OAuth Sheets API
  try {
    console.log("\n[Test 1] Testing OAuth Workspace API...");
    const accessToken = await getAccessToken();
    console.log("✓ Successfully refreshed OAuth access token.");

    console.log("Fetching 'Locations' via API range 'Locations!A1:Z500'...");
    const values = await getSpreadsheetValues(spreadsheetId, "Locations!A1:Z500", accessToken);
    console.log(`✓ Successfully retrieved ${values.length} rows using OAuth API.`);
    if (values.length > 0) {
      console.log("Headers:", values[0]);
    }
  } catch (err) {
    console.error("❌ OAuth Test failed:", err.message);
  }

  // Test 2: Public Fallback URL
  try {
    console.log("\n[Test 2] Testing Public CSV Fallback URL...");
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=Locations`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP status ${res.status}`);
    const csvText = await res.text();
    const workbook = XLSX.read(csvText, { type: "string" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);
    console.log(`✓ Successfully retrieved ${rows.length} rows using Public CSV fallback.`);
  } catch (err) {
    console.error("❌ Public Fallback Test failed:", err.message);
  }
}

main();
