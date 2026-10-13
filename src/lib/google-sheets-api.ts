import { unstable_noStore as noStore } from "next/cache";
import * as XLSX from "xlsx";

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface SheetResponse {
  range: string;
  majorDimension: string;
  values?: any[][];
}

let cachedAccessToken: string | null = null;
let tokenExpiryTime: number = 0;

/**
 * Gets a valid OAuth access token by refreshing the refresh token
 */
async function getAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing Google OAuth environment variables (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)."
    );
  }

  const now = Date.now();
  // Return cached token if it has more than 5 minutes of life left
  if (cachedAccessToken && tokenExpiryTime > now + 300 * 1000) {
    return cachedAccessToken;
  }

  console.log("Refreshing Google OAuth access token...");
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Token refresh failed with status ${res.status}: ${errorText}`);
    }

    const data = (await res.json()) as TokenResponse;
    cachedAccessToken = data.access_token;
    tokenExpiryTime = Date.now() + data.expires_in * 1000;
    return cachedAccessToken;
  } catch (err) {
    console.error("Error refreshing access token:", err);
    throw err;
  }
}

/**
 * Fetches raw values from a Google Sheet range using Workspace API (OAuth)
 */
export async function getSpreadsheetValues(spreadsheetId: string, range: string): Promise<any[][]> {
  noStore(); // Disable server-side caching

  const accessToken = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Sheets API request failed with status ${res.status}: ${errorText}`);
    }

    const data = (await res.json()) as SheetResponse;
    return data.values || [];
  } catch (err) {
    console.error(`Error fetching spreadsheet values for range '${range}':`, err);
    throw err;
  }
}

/**
 * Matches a target tab pattern (which may contain wildcards like '*' or '?') against actual available sheet titles.
 * If no pattern matches with wildcards or exact match, it also falls back to checking if sheet title starts with or contains the target pattern.
 * Respects exact match or pattern match (e.g. "ROS by TIME" or "ROS by TIME*" matching "ROS by TIME - 08/08 DO NOT DELETE").
 */
export function matchTabTitle(targetPattern: string, availableTitles: string[] = []): string {
  if (!targetPattern) return "";
  const trimmedPattern = targetPattern.trim();
  const cleanFallback = trimmedPattern.replace(/[*?]/g, "").trim();

  if (!availableTitles || availableTitles.length === 0) {
    return cleanFallback;
  }

  const lowerPattern = trimmedPattern.toLowerCase();

  // 1. Exact match (case-insensitive)
  const exactMatch = availableTitles.find(
    (t) => t.trim().toLowerCase() === lowerPattern
  );
  if (exactMatch) return exactMatch;

  // 2. Wildcard pattern matching (if pattern contains * or ?)
  if (trimmedPattern.includes("*") || trimmedPattern.includes("?")) {
    const regexPattern = "^" + trimmedPattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".") + "$";
    const wildcardRegex = new RegExp(regexPattern, "i");
    const wildcardMatch = availableTitles.find((t) => wildcardRegex.test(t.trim()));
    if (wildcardMatch) return wildcardMatch;

    if (cleanFallback) {
      const cleanLower = cleanFallback.toLowerCase();
      const prefixMatch = availableTitles.find((t) =>
        t.trim().toLowerCase().startsWith(cleanLower)
      );
      if (prefixMatch) return prefixMatch;
    }
  }

  // 3. Fallback: Prefix / substring match if sheet title starts with or contains targetPattern
  const prefixMatch = availableTitles.find((t) =>
    t.trim().toLowerCase().startsWith(lowerPattern)
  );
  if (prefixMatch) return prefixMatch;

  const containsMatch = availableTitles.find((t) =>
    t.trim().toLowerCase().includes(lowerPattern)
  );
  if (containsMatch) return containsMatch;

  return cleanFallback || trimmedPattern;
}

/**
 * Fetches and parses Google Sheet tab data into objects using Workspace API (OAuth),
 * with automatic, resilient fallback to public CSV export if OAuth credentials are
 * absent, expired, or rejected (e.g. 401 UNAUTHENTICATED).
 */
export async function getParsedSheetData<T extends Record<string, any>>(
  spreadsheetId: string,
  tabName: string
): Promise<T[]> {
  const hasCredentials = Boolean(
    (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) ||
    (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN)
  );

  if (!hasCredentials) {
    return getParsedSheetDataFromPublicCsv<T>(spreadsheetId, tabName);
  }

  let matchedTabName = matchTabTitle(tabName, []);
  try {
    const availableSheets = await getSpreadsheetSheets(spreadsheetId);
    if (availableSheets.length > 0) {
      matchedTabName = matchTabTitle(tabName, availableSheets);
    }
  } catch (err) {
    console.warn(`Failed to resolve sheet tab titles list for '${tabName}':`, err);
  }

  try {
    const rows = await getSpreadsheetValues(spreadsheetId, `${matchedTabName}!A1:Z`);
    if (rows.length === 0) {
      return getParsedSheetDataFromPublicCsv<T>(spreadsheetId, tabName);
    }

    // Auto-detect header row index within first 10 rows
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const rowVals = (rows[i] || []).map((cell: any) =>
        String(cell || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "")
      );
      const hasKnownHeader = rowVals.some((v: string) =>
        ["startday", "action", "location", "loaction", "department", "leaddept", "description", "start"].includes(v)
      );
      if (hasKnownHeader) {
        headerRowIndex = i;
        break;
      }
    }

    const headers = (rows[headerRowIndex] || []).map((h: any) => String(h || "").trim());
    const dataRows = rows.slice(headerRowIndex + 1);

    const result = dataRows
      .map((row) => {
        const item: Record<string, any> = {};
        headers.forEach((header, index) => {
          if (header) {
            item[header] = row[index] !== undefined ? row[index] : "";
          }
        });
        return item as T;
      })
      .filter((item) => Object.values(item).some((val) => val !== "" && val !== undefined));

    if (result.length === 0) {
      return getParsedSheetDataFromPublicCsv<T>(spreadsheetId, tabName);
    }

    return result;
  } catch (err) {
    console.warn(`OAuth fetch failed for tab '${tabName}', falling back to public CSV:`, err);
    return getParsedSheetDataFromPublicCsv<T>(spreadsheetId, tabName);
  }
}

/**
 * Fallback: Fetches and parses Google Sheet tab data using public CSV export URL
 */
export async function getParsedSheetDataFromPublicCsv<T extends Record<string, any>>(
  spreadsheetId: string,
  tabName: string
): Promise<T[]> {
  noStore();
  const resolvedTab = matchTabTitle(tabName, []);
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(resolvedTab)}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP status ${res.status}: ${res.statusText}`);
    }
    const csvText = await res.text();
    const workbook = XLSX.read(csvText, { type: "string" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<T>(worksheet, { defval: "" });
  } catch (err) {
    console.error(`Error fetching/parsing public CSV sheet for tab '${tabName}' (resolved as '${resolvedTab}'):`, err);
    throw err;
  }
}

function rgbToHex(rgb: any): string | undefined {
  if (!rgb) return undefined;
  // Google Sheets API returns colors as floats between 0 and 1
  const r = rgb.red !== undefined ? Math.round(rgb.red * 255) : 0;
  const g = rgb.green !== undefined ? Math.round(rgb.green * 255) : 0;
  const b = rgb.blue !== undefined ? Math.round(rgb.blue * 255) : 0;

  // Format to standard 6-digit hex string
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
}

function getContrastColor(hexBg: string): string {
  const hex = hexBg.replace("#", "");
  if (hex.length !== 6) return "#000000";
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#000000" : "#ffffff";
}

/**
 * Fetches the titles of all sheets in a spreadsheet using Workspace API (OAuth)
 */
export async function getSpreadsheetSheets(spreadsheetId: string): Promise<string[]> {
  noStore();

  const hasCredentials = Boolean(
    (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) ||
    (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN)
  );

  if (!hasCredentials) {
    return [];
  }

  try {
    const accessToken = await getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;

    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.warn(`Sheets API getSpreadsheetSheets returned ${res.status}: ${errorText}`);
      return [];
    }

    const data = await res.json();
    return (data.sheets || []).map((sheet: any) => sheet.properties?.title).filter(Boolean);
  } catch (err) {
    console.warn(`Error fetching spreadsheet sheets list:`, err);
    return [];
  }
}

/**
 * Fetches spreadsheet data including grid formatting data for the given ranges using Workspace API (OAuth)
 */
export async function getSpreadsheetWithFormatting(
  spreadsheetId: string,
  ranges: string[]
): Promise<any> {
  noStore();

  const accessToken = await getAccessToken();
  const rangeParams = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join("&");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=true&${rangeParams}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Sheets API request failed with status ${res.status}: ${errorText}`);
    }

    return await res.json();
  } catch (err) {
    console.error(`Error fetching spreadsheet with formatting for ranges ${ranges.join(", ")}:`, err);
    throw err;
  }
}

export interface ParsedSheetDataWithColors<T> {
  data: T[];
  colors: Record<string, { bg: string; fg: string }>;
}

/**
 * Parses sheet from the formatting-aware API response and extracts values & color styles from a 'Color' column.
 */
export function parseSheetDataWithColors<T extends Record<string, any>>(
  spreadsheetObj: any,
  tabName: string
): ParsedSheetDataWithColors<T> {
  const availableTitles = (spreadsheetObj.sheets || [])
    .map((s: any) => s.properties?.title)
    .filter(Boolean);
  const matchedTitle = matchTabTitle(tabName, availableTitles);
  const sheet = spreadsheetObj.sheets?.find(
    (s: any) => s.properties?.title === matchedTitle || s.properties?.title === tabName
  );
  if (!sheet) {
    throw new Error(`Sheet tab "${tabName}" (matched as "${matchedTitle}") not found in response`);
  }

  const rows = sheet.data?.[0]?.rowData || [];
  if (rows.length === 0) {
    return { data: [], colors: {} };
  }

  // Parse headers by finding the row containing expected column names
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const rowVals = (rows[i].values || []).map((cell: any) =>
      String(cell.userEnteredValue?.stringValue || cell.formattedValue || "").trim().toLowerCase()
    );
    const hasKnownHeader = rowVals.some((v: string) =>
      ["action", "description", "location", "name", "department", "start day", "start", "end time", "role"].includes(v)
    );
    if (hasKnownHeader) {
      headerRowIndex = i;
      break;
    }
  }

  const firstRowValues = rows[headerRowIndex]?.values || [];
  const headers = firstRowValues.map((cell: any) =>
    String(cell.userEnteredValue?.stringValue || cell.formattedValue || "").trim()
  );

  const colorColIndex = headers.indexOf("Color");
  const dataRows = rows.slice(headerRowIndex + 1);
  const data: T[] = [];
  const colors: Record<string, { bg: string; fg: string }> = {};

  dataRows.forEach((row: any) => {
    const rowValues = row.values || [];
    // Skip empty rows
    const hasValues = rowValues.some((cell: any) => cell.userEnteredValue !== undefined || cell.formattedValue);
    if (!hasValues) return;

    const item: Record<string, any> = {};
    headers.forEach((header: string, index: number) => {
      if (header) {
        const cell = rowValues[index];
        let val: any = "";
        if (cell) {
          if (cell.userEnteredValue?.stringValue !== undefined) {
            val = cell.userEnteredValue.stringValue;
          } else if (cell.userEnteredValue?.numberValue !== undefined) {
            val = cell.userEnteredValue.numberValue;
          } else if (cell.userEnteredValue?.boolValue !== undefined) {
            val = cell.userEnteredValue.boolValue;
          } else {
            val = cell.formattedValue || "";
          }
        }
        item[header] = val;
      }
    });
    data.push(item as T);

    // Extract colors if Color column exists
    const primaryKey = String(rowValues[0]?.userEnteredValue?.stringValue || rowValues[0]?.formattedValue || "").trim();
    if (primaryKey && colorColIndex !== -1 && colorColIndex < rowValues.length) {
      const colorCell = rowValues[colorColIndex];
      const effectiveFormat = colorCell?.effectiveFormat;
      const bg = rgbToHex(effectiveFormat?.backgroundColor);
      // We only store the color style if there is a background color set that is not pure white or missing
      if (bg && bg !== "#ffffff") {
        let fg = rgbToHex(effectiveFormat?.textFormat?.foregroundColor);
        // Default to high-contrast color if foreground matches background or is invalid
        if (!fg || fg === bg) {
          fg = getContrastColor(bg);
        }
        colors[primaryKey] = { bg, fg };
      }
    }
  });

  return { data, colors };
}

/**
 * Updates values in a Google Sheet range
 */
export async function updateSpreadsheetValues(
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<any> {
  const accessToken = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Sheets API update failed with status ${res.status}: ${errorText}`);
    }

    return await res.json();
  } catch (err) {
    console.error(`Error updating spreadsheet values for range '${range}':`, err);
    throw err;
  }
}

/**
 * Clears values in a Google Sheet range
 */
export async function clearSpreadsheetValues(
  spreadsheetId: string,
  range: string
): Promise<any> {
  const accessToken = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Sheets API clear failed with status ${res.status}: ${errorText}`);
    }

    return await res.json();
  } catch (err) {
    console.error(`Error clearing spreadsheet values for range '${range}':`, err);
    throw err;
  }
}


