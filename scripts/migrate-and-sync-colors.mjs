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

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return { red: r, green: g, blue: b };
}

async function main() {
  await loadEnv();
  
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const tabLocations = process.env.SHEETS_TAB_LOCATIONS || "Locations";
  const tabPersonnel = process.env.SHEETS_TAB_PERSONNEL || "Personnel";
  const tabDepartments = process.env.SHEETS_TAB_DEPARTMENTS || "Departments";
  const tabActions = process.env.SHEETS_TAB_ACTIONS || "Actions";
  const tabRos = process.env.SHEETS_TAB_ROS || "ROS by TIME";

  if (!spreadsheetId) {
    console.error("Error: GOOGLE_SHEETS_SPREADSHEET_ID not defined in environment.");
    process.exit(1);
  }

  try {
    console.log("Refreshing access token...");
    const accessToken = await getAccessToken();
    console.log("Access token refreshed successfully.");

    // Fetch spreadsheet structure to verify tabs and get sheetIds
    const structureRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!structureRes.ok) {
      throw new Error(`Failed to fetch spreadsheet structure: ${await structureRes.text()}`);
    }
    
    const spreadsheet = await structureRes.json();
    const sheets = spreadsheet.sheets || [];
    
    const sheetMap = {}; // Maps sheet name to sheetId
    sheets.forEach(s => {
      sheetMap[s.properties.title] = s.properties.sheetId;
    });

    console.log("Current sheets in spreadsheet:", Object.keys(sheetMap));

    const batchRequests = [];

    // 1. Create Actions tab if missing
    if (!(tabActions in sheetMap)) {
      console.log(`Creating missing Actions sheet tab: "${tabActions}"...`);
      const createSheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: tabActions
                }
              }
            }
          ]
        })
      });

      if (!createSheetRes.ok) {
        throw new Error(`Failed to create Actions sheet: ${await createSheetRes.text()}`);
      }

      const createData = await createSheetRes.json();
      const newSheetId = createData.replies[0].addSheet.properties.sheetId;
      sheetMap[tabActions] = newSheetId;
      console.log(`✓ Created Actions tab with sheetId: ${newSheetId}`);

      // Initialize with headers
      batchRequests.push({
        updateCells: {
          rows: [
            {
              values: [
                { userEnteredValue: { stringValue: "Action" } },
                { userEnteredValue: { stringValue: "Color" } }
              ]
            }
          ],
          fields: "userEnteredValue",
          range: {
            sheetId: newSheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 2
          }
        }
      });
    }

    // Run batch update to initialize the Actions sheet headers if it was just created
    if (batchRequests.length > 0) {
      await sendBatchUpdate(spreadsheetId, batchRequests, accessToken);
      batchRequests.length = 0; // Clear
    }

    // Load current local colors from JSON
    const colorsPath = path.join(process.cwd(), "src/data/sheet-colors.json");
    let initialColors = {};
    try {
      initialColors = JSON.parse(await fs.readFile(colorsPath, "utf8"));
      console.log("Loaded local colors config file.");
    } catch (err) {
      console.warn("No local sheet-colors.json found. Creating colors from defaults.");
    }

    // Helper to process a tab, check for Color column, add it if missing, and format colors
    async function processTabColors(tabName, categoryName, defaultItems) {
      const sheetId = sheetMap[tabName];
      if (sheetId === undefined) {
        console.warn(`Warning: sheet "${tabName}" not found in spreadsheet. skipping.`);
        return;
      }

      console.log(`Processing "${tabName}" sheet...`);

      // Fetch current values
      const valRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:Z500`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const valData = await valRes.json();
      const rows = valData.values || [];

      if (rows.length === 0) {
        console.warn(`Empty tab "${tabName}". Initializing headers.`);
        return;
      }

      const headers = rows[0].map(h => String(h).trim());
      let colorColIdx = headers.indexOf("Color");

      // If Color column is missing, append it
      if (colorColIdx === -1) {
        colorColIdx = headers.length;
        console.log(`Adding "Color" column at index ${colorColIdx} in "${tabName}"...`);
        
        await sendBatchUpdate(spreadsheetId, [
          {
            updateCells: {
              rows: [{ values: [{ userEnteredValue: { stringValue: "Color" } }] }],
              fields: "userEnteredValue",
              range: {
                sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: colorColIdx,
                endColumnIndex: colorColIdx + 1
              }
            }
          }
        ], accessToken);
        headers.push("Color");
      }

      // Populate list of items if the sheet has no items (like Actions tab might not)
      const existingItems = rows.slice(1).map(r => String(r[0] || "").trim()).filter(Boolean);
      if (existingItems.length === 0 && defaultItems) {
        console.log(`Sheet "${tabName}" is empty. Populating with default items...`);
        const itemRows = Object.keys(defaultItems).map(item => [item]);
        
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A2`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            values: itemRows
          }),
          params: { valueInputOption: "USER_ENTERED" } // Note: valueInputOption should be a query parameter
        });
        
        // Refetch rows
        const valRes2 = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:Z500`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const valData2 = await valRes2.json();
        const rows2 = valData2.values || [];
        rows.length = 0;
        rows.push(...rows2);
      }

      // Build formatting requests for this tab
      const catColors = initialColors[categoryName] || {};
      const tabRequests = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const primaryKey = String(row[0] || "").trim();
        if (!primaryKey) continue;

        const colorCfg = catColors[primaryKey];
        if (colorCfg) {
          const bgRgb = hexToRgb(colorCfg.bg);
          const fgRgb = hexToRgb(colorCfg.fg);

          if (bgRgb && fgRgb) {
            tabRequests.push({
              updateCells: {
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: { stringValue: colorCfg.bg },
                        userEnteredFormat: {
                          backgroundColor: bgRgb,
                          textFormat: {
                            foregroundColor: fgRgb,
                            bold: true
                          },
                          horizontalAlignment: "CENTER"
                        }
                      }
                    ]
                  }
                ],
                fields: "userEnteredValue,userEnteredFormat(backgroundColor,textFormat(foregroundColor,bold),horizontalAlignment)",
                range: {
                  sheetId,
                  startRowIndex: i,
                  endRowIndex: i + 1,
                  startColumnIndex: colorColIdx,
                  endColumnIndex: colorColIdx + 1
                }
              }
            });
          }
        }
      }

      if (tabRequests.length > 0) {
        console.log(`Applying color styles to ${tabRequests.length} rows in "${tabName}"...`);
        await sendBatchUpdate(spreadsheetId, tabRequests, accessToken);
      }
    }

    // Migrate values & formats to sheet tabs
    await processTabColors(tabLocations, "Location", null);
    await processTabColors(tabPersonnel, "Personnel", null);
    await processTabColors(tabDepartments, "Department", null);
    await processTabColors(tabActions, "Action", initialColors["Action"]);

    // 2. Synchronize conditional formatting rules back to ROS by TIME
    const rosSheetId = sheetMap[tabRos];
    if (rosSheetId === undefined) {
      console.warn(`Warning: "${tabRos}" tab not found. Cannot sync conditional formatting.`);
    } else {
      console.log(`Syncing conditional formatting rules on "${tabRos}"...`);
      
      // Fetch headers of ROS by TIME to find column indices
      const rosValRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabRos)}!A2:Z2`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const rosValData = await rosValRes.json();
      const rosHeaders = (rosValData.values?.[0] || []).map(h => String(h).trim());

      const locColIdx = rosHeaders.findIndex(h => h === "Location" || h === "SOLARIS ROS Location");
      const actColIdx = rosHeaders.indexOf("Action");
      const deptColIdx = rosHeaders.indexOf("Department");
      const leadColIdx = rosHeaders.indexOf("Lead Point Person");

      console.log("ROS by TIME column indices:", {
        Location: locColIdx,
        Action: actColIdx,
        Department: deptColIdx,
        Lead: leadColIdx
      });

      // Clear existing conditional formats
      const rosMetaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges=${encodeURIComponent(tabRos)}&fields=sheets.conditionalFormats`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const rosMeta = await rosMetaRes.json();
      const existingRosSheet = rosMeta.sheets?.find(s => s.properties?.sheetId === rosSheetId) || {};
      const currentCFCount = (existingRosSheet.conditionalFormats || []).length;

      console.log(`Found ${currentCFCount} existing conditional formatting rules. Deleting them...`);
      const deleteRequests = [];
      // Delete from last index down to 0 to preserve indices during deletion
      for (let idx = currentCFCount - 1; idx >= 0; idx--) {
        deleteRequests.push({
          deleteConditionalFormatRule: {
            sheetId: rosSheetId,
            index: idx
          }
        });
      }

      if (deleteRequests.length > 0) {
        await sendBatchUpdate(spreadsheetId, deleteRequests, accessToken);
      }

      // Re-fetch all dynamic colors from the modified tabs to make sure we construct perfect rules
      console.log("Re-fetching dynamic colors from spreadsheet tabs to build rules...");
      const fullRanges = [
        `${tabLocations}!A1:Z500`,
        `${tabPersonnel}!A1:Z500`,
        `${tabDepartments}!A1:Z500`,
        `${tabActions}!A1:Z500`
      ];
      
      const fullSpreadsheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=true&ranges=${fullRanges.map(encodeURIComponent).join('&ranges=')}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const fullSpreadsheet = await fullSpreadsheetRes.json();

      const dynamicColors = {
        Location: parseColors(fullSpreadsheet, tabLocations),
        Personnel: parseColors(fullSpreadsheet, tabPersonnel),
        Department: parseColors(fullSpreadsheet, tabDepartments),
        Action: parseColors(fullSpreadsheet, tabActions)
      };

      const addCfRequests = [];

      // Construct addConditionalFormatRule requests
      function buildCfRules(categoryColors, colIdx) {
        if (colIdx === -1) return;
        Object.entries(categoryColors).forEach(([value, style]) => {
          const bgRgb = hexToRgb(style.bg);
          const fgRgb = hexToRgb(style.fg);
          if (!bgRgb || !fgRgb) return;

          addCfRequests.push({
            addConditionalFormatRule: {
              rule: {
                ranges: [
                  {
                    sheetId: rosSheetId,
                    startRowIndex: 2, // Skip header row 2 (which is index 1, skip up to index 2)
                    endRowIndex: 1000,
                    startColumnIndex: colIdx,
                    endColumnIndex: colIdx + 1
                  }
                ],
                booleanRule: {
                  condition: {
                    type: "TEXT_EQ",
                    values: [{ userEnteredValue: value }]
                  },
                  format: {
                    backgroundColor: bgRgb,
                    textFormat: {
                      foregroundColor: fgRgb,
                      bold: true
                    }
                  }
                }
              },
              index: 0
            }
          });
        });
      }

      buildCfRules(dynamicColors.Location, locColIdx);
      buildCfRules(dynamicColors.Personnel, leadColIdx);
      buildCfRules(dynamicColors.Department, deptColIdx);
      buildCfRules(dynamicColors.Action, actColIdx);

      if (addCfRequests.length > 0) {
        console.log(`Adding ${addCfRequests.length} new conditional formatting rules to "${tabRos}"...`);
        await sendBatchUpdate(spreadsheetId, addCfRequests, accessToken);
        console.log("✓ Dynamic conditional formatting synced successfully.");
      } else {
        console.log("No conditional formatting rules to add.");
      }
    }

    console.log("\n========================================================");
    console.log("MIGRATION & SYNC COMPLETED SUCCESSFULLY!");
    console.log("========================================================");

  } catch (err) {
    console.error("Migration/Sync failed with error:", err);
    process.exit(1);
  }
}

async function sendBatchUpdate(spreadsheetId, requests, accessToken) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ requests })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`batchUpdate failed with status ${res.status}: ${errorText}`);
  }
  return await res.json();
}

function parseColors(spreadsheetObj, tabName) {
  const sheet = spreadsheetObj.sheets?.find(s => s.properties?.title === tabName);
  if (!sheet) return {};

  const rows = sheet.data?.[0]?.rowData || [];
  if (rows.length === 0) return {};

  const firstRowValues = rows[0].values || [];
  const headers = firstRowValues.map(cell =>
    String(cell.userEnteredValue?.stringValue || cell.formattedValue || "").trim()
  );

  const colorColIndex = headers.indexOf("Color");
  if (colorColIndex === -1) return {};

  const colors = {};
  const dataRows = rows.slice(1);

  dataRows.forEach(row => {
    const rowValues = row.values || [];
    const primaryKey = String(rowValues[0]?.userEnteredValue?.stringValue || rowValues[0]?.formattedValue || "").trim();
    if (primaryKey && colorColIndex < rowValues.length) {
      const colorCell = rowValues[colorColIndex];
      const effectiveFormat = colorCell?.effectiveFormat;
      const bg = rgbToHex(effectiveFormat?.backgroundColor);
      if (bg && bg !== "#ffffff") {
        let fg = rgbToHex(effectiveFormat?.textFormat?.foregroundColor);
        if (!fg || fg === bg) {
          fg = getContrastColor(bg);
        }
        colors[primaryKey] = { bg, fg };
      }
    }
  });

  return colors;
}

function rgbToHex(rgb) {
  if (!rgb) return undefined;
  const r = rgb.red !== undefined ? Math.round(rgb.red * 255) : 0;
  const g = rgb.green !== undefined ? Math.round(rgb.green * 255) : 0;
  const b = rgb.blue !== undefined ? Math.round(rgb.blue * 255) : 0;
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
}

function getContrastColor(hexBg) {
  const hex = hexBg.replace("#", "");
  if (hex.length !== 6) return "#000000";
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#000000" : "#ffffff";
}

main();
