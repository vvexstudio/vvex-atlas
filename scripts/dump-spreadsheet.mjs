import fs from "node:fs/promises";
import path from "node:path";

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
    console.warn("No .env.local found.");
  }
}

async function getAccessToken() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

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

async function main() {
  await loadEnv();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "19Xs3TScHhS369n_A8VvUGxszoxncx1p32T8iwNHSKTU";
  
  try {
    const accessToken = await getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties,sheets.conditionalFormats,sheets.merges`;
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sheets API failed: ${text}`);
    }
    
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
    
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
