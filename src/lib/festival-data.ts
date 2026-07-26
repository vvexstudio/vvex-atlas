import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import * as XLSX from "xlsx";
import type { Department, FestivalDay, FestivalEvent, Venue, EventHistoryEntry } from "@/types/festival";
import {
  getParsedSheetData,
  getParsedSheetDataFromPublicCsv,
  getSpreadsheetSheets,
  getSpreadsheetWithFormatting,
  parseSheetDataWithColors,
} from "./google-sheets-api";
import { adminDb } from "./firebase-admin";
import { parseSpreadsheetData } from "./event-mapper";

export type LocationMatchDebug = {
  totalRows: number;
  confirmedRows: number;
  matchedRows: number;
  unmatchedLocations: string[];
};

export type FestivalDataResult = {
  venues: Venue[];
  events: FestivalEvent[];
  personnel?: any[];
  departments?: Department[];
  colors?: Record<string, Record<string, { bg: string; fg: string }>>;
  sourceLabel: string;
  debug: LocationMatchDebug;
};

import { AdminEntry } from "@/types/admin-entry";
import { readAdminEntries } from "./admin-entries";

function mergeAdminEntries(
  venues: Venue[],
  events: FestivalEvent[],
  adminEntries: AdminEntry[]
) {
  const adminVenues: Venue[] = [];
  const adminEvents: FestivalEvent[] = [];

  adminEntries.forEach((entry) => {
    const hasLocation = entry.hasLocation && entry.lat !== undefined && entry.lng !== undefined;
    if (hasLocation) {
      adminVenues.push({
        id: entry.id,
        name: entry.name,
        label: entry.serviceType ? "Service" : (entry.projectType === "venue" ? "Venue" : "Installation"),
        mapLabel: entry.name,
        shortDescription: entry.artist ? `By ${entry.artist}` : "",
        description: entry.abridgedProjectText || "",
        x: 0,
        y: 0,
        lat: Number(entry.lat),
        lng: Number(entry.lng),
        hasLocation: true,
        thumbnailUrl: "",
        accent: entry.projectType === "services" ? "#f97316" : "#8b5cf6",
        permanence: entry.permanence || entry.projectType || "venue",
      });
    }

    if (entry.hasSchedule) {
      const matchEvent = events.find(e => e.day === entry.day);
      const scheduleDate = matchEvent ? matchEvent.scheduleDate : (entry.day === "fri" ? "2026-08-28" : (entry.day === "sat" ? "2026-08-29" : "2026-08-30"));
      
      adminEvents.push({
        id: `event-${entry.id}`,
        venueId: entry.id,
        title: entry.name,
        host: entry.artist || "",
        description: entry.abridgedProjectText || "",
        day: entry.day,
        startTime: entry.startTime,
        endTime: entry.endTime,
        type: entry.projectType,
        thumbnailUrl: "",
        hasLocation,
        lat: entry.lat,
        lng: entry.lng,
        source: "admin",
        scheduleDate,
        locationName: entry.locationInternal || "",
        department: entry.projectType === "services" ? "Services" : "Art",
        leadPointPerson: entry.artist || "",
      });
    }
  });

  return {
    venues: [...venues, ...adminVenues],
    events: [...events, ...adminEvents],
  };
}

type KmzPlacemark = {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
};

type RosRow = Record<string, unknown>;

const KMZ_PATH = path.join(process.cwd(), "MARTIANS map.kmz");
const XLSX_PATH = path.join(process.cwd(), "ROS  - MARTIANS.xlsx");
const ROS_SHEET_NAME = "ROS by TIME";
const DEFAULT_THUMBNAIL = "";
const DEFAULT_ACCENT = "#8b5cf6";

const DAY_BY_INDEX: FestivalDay[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string): string {
  return normalizeText(value).replace(/\s+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

function stripHtml(value: string): string {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getFirstText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return asString(value);
  if (Array.isArray(value)) return getFirstText(value[0]);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return getFirstText(record["#text"] ?? record.text ?? record._text);
  }
  return "";
}

function parseCoordinates(raw: string): { lat: number; lng: number } | null {
  const firstCoordinate = raw.trim().split(/\s+/)[0];
  if (!firstCoordinate) return null;
  const [lngRaw, latRaw] = firstCoordinate.split(",");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function parseEventTypes(value: string): FestivalEvent["type"][] {
  const normalized = value.toLowerCase();
  const types = new Set<FestivalEvent["type"]>();
  if (normalized.includes("transport") || normalized.includes("vehicle") || normalized.includes("parking")) {
    types.add("services");
  }
  if (normalized.includes("music") || normalized.includes("sound")) types.add("music");
  if (normalized.includes("performance") || normalized.includes("ceremony")) types.add("performance");
  if (normalized.includes("dinner") || normalized.includes("bar") || normalized.includes("food")) types.add("food");
  if (normalized.includes("guest") || normalized.includes("hospitality")) types.add("community");
  if (normalized.includes("setup") || normalized.includes("load") || normalized.includes("rehearsal")) {
    types.add("venue");
  }
  if (types.size === 0) types.add("community");
  return [...types];
}

function excelDateToDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d);
  }
  const raw = asString(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function excelTimeToMinutes(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = ((value % 1) + 1) % 1;
    return Math.round(normalized * 24 * 60);
  }

  const raw = asString(value);
  if (!raw || raw === "????") return null;
  const compact = raw.replace(/\s+/g, "").toLowerCase();
  const match = compact.match(/^(\d{1,2})(?::(\d{2}))?([ap]m|m)?$/);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  const suffix = match[3];
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) return null;
  if (suffix === "pm" && hours < 12) hours += 12;
  if ((suffix === "am" || suffix === "m") && hours === 12) hours = 0;
  if (hours > 23) return null;
  return hours * 60 + minutes;
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "TBD";
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return mins === 0 ? `${displayHour} ${suffix}` : `${displayHour}:${String(mins).padStart(2, "0")} ${suffix}`;
}

function isoDate(date: Date | null): string | undefined {
  if (!date) return undefined;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getFestivalDay(date: Date | null): FestivalDay {
  if (!date) return "fri";
  return DAY_BY_INDEX[date.getDay()] ?? "fri";
}

function getCell(row: RosRow, names: string[]): unknown {
  for (const name of names) {
    if (name in row) return row[name];
  }
  return "";
}

function buildLocationAliases(name: string): string[] {
  const aliases = new Set<string>();
  const normalized = normalizeText(name);
  if (normalized) aliases.add(normalized);

  for (const part of name.split(/[/-]/)) {
    const partNormalized = normalizeText(part);
    if (partNormalized) aliases.add(partNormalized);
  }

  const withoutParenthetical = normalizeText(name.replace(/\([^)]*\)/g, ""));
  if (withoutParenthetical) aliases.add(withoutParenthetical);
  return [...aliases];
}

function findMatchingPlacemark(locationName: string, placemarks: KmzPlacemark[]): KmzPlacemark | null {
  const normalized = normalizeText(locationName);
  if (!normalized) return null;

  let best: { placemark: KmzPlacemark; score: number } | null = null;
  for (const placemark of placemarks) {
    const aliases = buildLocationAliases(placemark.name);
    for (const alias of aliases) {
      if (!alias) continue;
      let score = 0;
      if (alias === normalized) score = 100;
      else if (normalized.includes(alias) || alias.includes(normalized)) score = Math.min(alias.length, normalized.length);
      if (score > (best?.score ?? 0)) {
        best = { placemark, score };
      }
    }
  }

  return best && best.score >= 4 ? best.placemark : null;
}

async function readKmzPlacemarks(): Promise<KmzPlacemark[]> {
  const buffer = await readFile(KMZ_PATH);
  const zip = await JSZip.loadAsync(buffer);
  const kmlEntry = Object.values(zip.files).find((entry) => entry.name.toLowerCase().endsWith(".kml"));
  if (!kmlEntry) throw new Error("KMZ does not contain a KML document");

  const kml = await kmlEntry.async("string");
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    trimValues: true,
  });
  const parsed = parser.parse(kml) as {
    kml?: {
      Document?: {
        Placemark?: unknown;
      };
    };
  };

  const placemarks = toArray(parsed.kml?.Document?.Placemark as Record<string, unknown> | Record<string, unknown>[] | undefined);
  const usedIds = new Set<string>();

  return placemarks.flatMap((placemark) => {
    const point = placemark.Point as Record<string, unknown> | undefined;
    const rawCoordinates = getFirstText(point?.coordinates);
    const coordinates = parseCoordinates(rawCoordinates);
    const name = getFirstText(placemark.name);
    if (!name || !coordinates) return [];

    const baseId = `kmz-${slugify(name)}`;
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);

    return [{
      id,
      name,
      description: stripHtml(getFirstText(placemark.description)),
      lat: coordinates.lat,
      lng: coordinates.lng,
    }];
  });
}

async function readRosRows(): Promise<RosRow[]> {
  const buffer = await readFile(XLSX_PATH);
  const workbook = XLSX.read(buffer, { cellDates: false, type: "buffer" });
  const worksheet = workbook.Sheets[ROS_SHEET_NAME];
  if (!worksheet) {
    throw new Error(`Workbook does not contain "${ROS_SHEET_NAME}"`);
  }
  return XLSX.utils.sheet_to_json<RosRow>(worksheet, { defval: "", raw: true });
}

function createVenue(placemark: KmzPlacemark): Venue {
  return {
    id: placemark.id,
    name: placemark.name,
    label: "Venue",
    mapLabel: placemark.name,
    shortDescription: "Imported from MARTIANS map.kmz",
    description: placemark.description || "Mapped from MARTIANS map.kmz.",
    x: 0,
    y: 0,
    lat: placemark.lat,
    lng: placemark.lng,
    hasLocation: true,
    thumbnailUrl: DEFAULT_THUMBNAIL,
    accent: DEFAULT_ACCENT,
  };
}

function createFallbackVenue(locationName: string, usedIds: Set<string>): Venue {
  const baseId = `xlsx-${slugify(locationName || "location-tbd")}`;
  let id = baseId;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);

  return {
    id,
    name: locationName || "Location TBD",
    label: "Unmapped location",
    shortDescription: "No matching placemark in MARTIANS map.kmz",
    description: "Derived from ROS  - MARTIANS.xlsx.",
    x: 0,
    y: 0,
    hasLocation: false,
    thumbnailUrl: DEFAULT_THUMBNAIL,
    accent: "#6b7280",
  };
}


export async function getFestivalData(role: string = "guest"): Promise<FestivalDataResult> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "19Xs3TScHhS369n_A8VvUGxszoxncx1p32T8iwNHSKTU";
  const useOAuth = !!(process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const tabLocations = process.env.SHEETS_TAB_LOCATIONS || "Locations";
  const tabPersonnel = process.env.SHEETS_TAB_PERSONNEL || "Personnel";
  const tabDepartments = process.env.SHEETS_TAB_DEPARTMENTS || "Departments";
  const tabActions = process.env.SHEETS_TAB_ACTIONS || "Actions";
  const tabRos = process.env.SHEETS_TAB_ROS || "ROS by TIME";

  // Try to load data from Firebase RTD first (Option B cache & real-time sync)
  try {
    if (adminDb) {
      const nodePath = role === "admin" ? "admin-data" : (role === "crew" ? "crew-data" : "public-data");
      const snapshot = await adminDb.ref(nodePath).once("value");
      if (snapshot.exists()) {
        const data = snapshot.val();
        
        let colorsObj = {};
        try {
          const cachedColorsPath = path.join(process.cwd(), "src/data/sheet-colors.json");
          const cachedColorsContent = await readFile(cachedColorsPath, "utf8");
          colorsObj = JSON.parse(cachedColorsContent);
        } catch (err) {}

        const locationsData = data.venues || [];
        const rosData = data.events || [];
        const personnelData = data.personnel || [];
        const departmentsData = data.departments || [];
        const adminEntriesMap = data.entries || {};

        const mapped = parseSpreadsheetData(locationsData, rosData, personnelData, departmentsData);
        const adminEntries = Object.values(adminEntriesMap) as AdminEntry[];
        const merged = mergeAdminEntries(mapped.venues, mapped.events, adminEntries);

        return {
          venues: merged.venues,
          events: merged.events,
          personnel: mapped.personnel,
          departments: mapped.departments,
          colors: colorsObj,
          sourceLabel: `Firebase RTD (${role.toUpperCase()} View)`,
          debug: {
            totalRows: merged.events.length,
            confirmedRows: merged.events.length,
            matchedRows: merged.events.filter((e: any) => e.hasLocation || e.lat !== undefined).length,
            unmatchedLocations: [],
          },
        };
      }
    }
  } catch (firebaseErr) {
    console.warn("Failed to load from Firebase Realtime Database. Falling back to Google Sheets API:", firebaseErr);
  }

  let locationsData: any[] = [];
  let personnelData: any[] = [];
  let departmentsData: any[] = [];
  let rosData: any[] = [];
  let colorsObj: Record<string, Record<string, { bg: string; fg: string }>> = {};
  let sourceLabel = "";

  try {
    if (useOAuth) {
      try {
        const existingSheets = await getSpreadsheetSheets(spreadsheetId);

        const ranges: string[] = [];
        if (existingSheets.includes(tabLocations)) ranges.push(`${tabLocations}!A1:Z500`);
        if (existingSheets.includes(tabPersonnel)) ranges.push(`${tabPersonnel}!A1:Z500`);
        if (existingSheets.includes(tabDepartments)) ranges.push(`${tabDepartments}!A1:Z500`);
        if (existingSheets.includes(tabActions)) ranges.push(`${tabActions}!A1:Z500`);
        if (existingSheets.includes(tabRos)) ranges.push(`${tabRos}!A2:Z500`);

        const spreadsheetObj = await getSpreadsheetWithFormatting(spreadsheetId, ranges);

        let locationsColors: Record<string, { bg: string; fg: string }> = {};
        if (existingSheets.includes(tabLocations)) {
          const parsedLocations = parseSheetDataWithColors<any>(spreadsheetObj, tabLocations);
          locationsData = parsedLocations.data;
          locationsColors = parsedLocations.colors;
        }

        let personnelColors: Record<string, { bg: string; fg: string }> = {};
        if (existingSheets.includes(tabPersonnel)) {
          const parsedPersonnel = parseSheetDataWithColors<any>(spreadsheetObj, tabPersonnel);
          personnelData = parsedPersonnel.data;
          personnelColors = parsedPersonnel.colors;
        }

        let departmentsColors: Record<string, { bg: string; fg: string }> = {};
        if (existingSheets.includes(tabDepartments)) {
          const parsedDepartments = parseSheetDataWithColors<any>(spreadsheetObj, tabDepartments);
          departmentsData = parsedDepartments.data;
          departmentsColors = parsedDepartments.colors;
        }

        let actionsColors: Record<string, { bg: string; fg: string }> = {};
        if (existingSheets.includes(tabActions)) {
          try {
            const parsedActions = parseSheetDataWithColors<any>(spreadsheetObj, tabActions);
            actionsColors = parsedActions.colors;
          } catch (actionsErr) {
            console.warn("Could not load/parse Actions sheet styling. Skipping dynamic Action colors.", actionsErr);
          }
        }

        if (existingSheets.includes(tabRos)) {
          const rosSheet = spreadsheetObj.sheets?.find((s: any) => s.properties?.title === tabRos);
          if (rosSheet) {
            const rows = rosSheet.data?.[0]?.rowData || [];
            if (rows.length > 0) {
              const headers = (rows[0].values || []).map((cell: any) =>
                String(cell.userEnteredValue?.stringValue || cell.formattedValue || "").trim()
              );
              rosData = rows.slice(1).map((row: any) => {
                const item: Record<string, any> = {};
                headers.forEach((header: string, index: number) => {
                  if (header) {
                    const cell = row.values?.[index];
                    let val = "";
                    if (cell) {
                      if (cell.userEnteredValue?.stringValue !== undefined) val = cell.userEnteredValue.stringValue;
                      else if (cell.userEnteredValue?.numberValue !== undefined) val = cell.userEnteredValue.numberValue;
                      else if (cell.userEnteredValue?.boolValue !== undefined) val = cell.userEnteredValue.boolValue;
                      else val = cell.formattedValue || "";
                    }
                    item[header] = val;
                  }
                });
                return item;
              }).filter((item: any) => {
                const cleanRow: Record<string, any> = {};
                for (const [k, v] of Object.entries(item)) {
                  cleanRow[k.trim()] = v;
                }
                return cleanRow["Action"] || cleanRow["Description"] || cleanRow["SOLARIS ROS Location"] || cleanRow["Location"];
              });
            }
          }
        }

        try {
          const cachedColorsPath = path.join(process.cwd(), "src/data/sheet-colors.json");
          let mergedColors: Record<string, Record<string, { bg: string; fg: string }>> = {};
          try {
            const existingContent = await readFile(cachedColorsPath, "utf8");
            mergedColors = JSON.parse(existingContent);
          } catch {
          }

          const categories = ["Location", "Personnel", "Department", "Action"] as const;
          const newColors = {
            Location: locationsColors,
            Personnel: personnelColors,
            Department: departmentsColors,
            Action: actionsColors
          };

          let hasNewColors = false;
          categories.forEach(cat => {
            if (!mergedColors[cat]) {
              mergedColors[cat] = {};
            }
            const catNew = newColors[cat] || {};
            if (Object.keys(catNew).length > 0) {
              mergedColors[cat] = { ...mergedColors[cat], ...catNew };
              hasNewColors = true;
            }
          });

          colorsObj = mergedColors;

          if (hasNewColors) {
            await writeFile(cachedColorsPath, JSON.stringify(colorsObj, null, 2), "utf8");
          }
        } catch (writeErr) {
          console.warn("Failed to write dynamic colors update to local cache file:", writeErr);
        }

        sourceLabel = `Google Sheet ${spreadsheetId.substring(0, 8)}... (OAuth + Dynamic Colors)`;
      } catch (oauthError) {
        if (oauthError && typeof oauthError === "object" && ((oauthError as any).digest === "DYNAMIC_SERVER_USAGE" || (oauthError as any).message?.includes("DYNAMIC_SERVER_USAGE"))) {
          throw oauthError;
        }
        console.warn("OAuth spreadsheet fetch with formatting failed, attempting public CSV fallback...", oauthError);
        
        try {
          locationsData = await getParsedSheetDataFromPublicCsv(spreadsheetId, tabLocations);
        } catch (err) {
          console.warn(`Failed to fetch Locations from public CSV fallback:`, err);
        }
        try {
          personnelData = await getParsedSheetDataFromPublicCsv(spreadsheetId, tabPersonnel);
        } catch (err) {
          console.warn(`Failed to fetch Personnel from public CSV fallback:`, err);
        }
        try {
          departmentsData = await getParsedSheetDataFromPublicCsv(spreadsheetId, tabDepartments);
        } catch (err) {
          console.warn(`Failed to fetch Departments from public CSV fallback:`, err);
        }
        try {
          rosData = await getParsedSheetDataFromPublicCsv(spreadsheetId, tabRos);
        } catch (err) {
          console.warn(`Failed to fetch ROS from public CSV fallback:`, err);
        }
        
        try {
          const cachedColorsPath = path.join(process.cwd(), "src/data/sheet-colors.json");
          const cachedColorsContent = await readFile(cachedColorsPath, "utf8");
          colorsObj = JSON.parse(cachedColorsContent);
        } catch (err) {
          console.warn("Failed to load cached sheet-colors.json, using empty fallback", err);
        }
        
        sourceLabel = `Google Sheet ${spreadsheetId.substring(0, 8)}... (Public CSV Fallback)`;
      }
    } else {
      try {
        locationsData = await getParsedSheetDataFromPublicCsv(spreadsheetId, tabLocations);
      } catch (err) {
        console.warn(`Failed to fetch Locations from public CSV:`, err);
      }
      try {
        personnelData = await getParsedSheetDataFromPublicCsv(spreadsheetId, tabPersonnel);
      } catch (err) {
        console.warn(`Failed to fetch Personnel from public CSV:`, err);
      }
      try {
        departmentsData = await getParsedSheetDataFromPublicCsv(spreadsheetId, tabDepartments);
      } catch (err) {
        console.warn(`Failed to fetch Departments from public CSV:`, err);
      }
      try {
        rosData = await getParsedSheetDataFromPublicCsv(spreadsheetId, tabRos);
      } catch (err) {
        console.warn(`Failed to fetch ROS from public CSV:`, err);
      }
      
      try {
        const cachedColorsPath = path.join(process.cwd(), "src/data/sheet-colors.json");
        const cachedColorsContent = await readFile(cachedColorsPath, "utf8");
        colorsObj = JSON.parse(cachedColorsContent);
      } catch (err) {
        console.warn("Failed to load cached sheet-colors.json, using empty fallback", err);
      }

      sourceLabel = `Google Sheet ${spreadsheetId.substring(0, 8)}... (Public CSV)`;
    }

    const { venues, events, personnel, departments } = parseSpreadsheetData(locationsData, rosData, personnelData, departmentsData);

    const adminEntries = await readAdminEntries();
    const merged = mergeAdminEntries(venues, events, adminEntries);

    return {
      venues: merged.venues,
      events: merged.events,
      personnel,
      departments,
      colors: colorsObj,
      sourceLabel,
      debug: {
        totalRows: rosData.length + adminEntries.length,
        confirmedRows: merged.events.length,
        matchedRows: merged.events.filter((e) => e.hasLocation).length,
        unmatchedLocations: [...new Set(merged.events.filter((e) => !e.hasLocation).map((e) => e.locationName || ""))].filter(Boolean),
      },
    };
  } catch (error) {
    if (error && typeof error === "object" && ("digest" in error || (error as any).message?.includes("DYNAMIC_SERVER_USAGE"))) {
      const err = error as any;
      if (err.digest === "DYNAMIC_SERVER_USAGE") {
        throw error;
      }
    }
    console.warn("Failed to load remote Google Sheet data, attempting empty fallback...", error);
    
    // Load cached colors for emergency fallback
    try {
      const cachedColorsPath = path.join(process.cwd(), "src/data/sheet-colors.json");
      const cachedColorsContent = await readFile(cachedColorsPath, "utf8");
      colorsObj = JSON.parse(cachedColorsContent);
    } catch (err) {}

    const adminEntries = await readAdminEntries().catch(() => []);
    const merged = mergeAdminEntries([], [], adminEntries);

    return {
      venues: merged.venues,
      events: merged.events,
      personnel: [],
      departments: [],
      colors: colorsObj,
      sourceLabel: "Unavailable",
      debug: {
        totalRows: adminEntries.length,
        confirmedRows: merged.events.length,
        matchedRows: merged.events.filter((e) => e.hasLocation).length,
        unmatchedLocations: [],
      },
    };
  }
}
