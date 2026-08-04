import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Department, FestivalEvent, Venue } from "@/types/festival";
import {
  getParsedSheetData,
  getParsedSheetDataFromPublicCsv,
  getSpreadsheetWithFormatting,
  parseSheetDataWithColors,
} from "./google-sheets-api";
import { adminDb } from "./firebase-admin";
import { parseSpreadsheetData } from "./event-mapper";
import { AdminEntry } from "@/types/admin-entry";
import { readAdminEntries } from "./admin-entries";

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

function mergeAdminEntries(
  venues: Venue[],
  events: FestivalEvent[],
  adminEntries: AdminEntry[]
) {
  const adminVenues: Venue[] = [];
  const adminEvents: FestivalEvent[] = [];

  const sheetVenueIds = new Set(venues.map((v) => v.id.toLowerCase()));
  const sheetVenueNames = new Set(venues.map((v) => v.name.trim().toLowerCase()));

  adminEntries.forEach((entry) => {
    const isSuperceded = sheetVenueIds.has(entry.id.toLowerCase()) || sheetVenueNames.has(entry.name.trim().toLowerCase());
    const hasLocation = entry.hasLocation && entry.lat !== undefined && entry.lng !== undefined;
    if (hasLocation && !isSuperceded) {
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
        accent: entry.projectType === "services" ? "#9a6a1b" : "#bc5c2d",
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

export async function getFestivalDataFromRtdb(role: string = "public"): Promise<FestivalDataResult> {
  const nodePath = role === "admin" ? "admin-data" : (role === "crew" ? "crew-data" : "public-data");
  if (adminDb) {
    try {
      const snapshot = await adminDb.ref(nodePath).once("value");
      if (snapshot.exists()) {
        const data = snapshot.val();
        const locationsData = data.venues || [];
        const rosData = data.events || [];
        const personnelData = data.personnel || [];
        const departmentsData = data.departments || [];
        const adminEntriesMap = data.entries || {};

        const mapped = parseSpreadsheetData(locationsData, rosData, personnelData, departmentsData);
        const adminEntriesList = Object.values(adminEntriesMap) as AdminEntry[];
        const merged = mergeAdminEntries(mapped.venues, mapped.events, adminEntriesList);

        return {
          venues: merged.venues,
          events: merged.events,
          personnel: mapped.personnel,
          departments: mapped.departments,
          colors: {},
          sourceLabel: `Firebase RTDB (/${nodePath})`,
          debug: {
            totalRows: rosData.length,
            confirmedRows: merged.events.length,
            matchedRows: merged.events.filter(e => e.hasLocation).length,
            unmatchedLocations: [...new Set(merged.events.filter(e => !e.hasLocation).map(e => e.locationName || ""))].filter(Boolean)
          }
        };
      }
    } catch (e) {
      console.warn("Failed to read from RTDB, falling back...", e);
    }
  }
  return getFestivalDataFromSheets(role);
}

export async function getFestivalDataFromSheets(role: string = "public"): Promise<FestivalDataResult> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "1rpmzT4_6NlAOSryN86ROv3mv1Jf4ydColAlk6MrY1zw";
  const tabLocations = process.env.GOOGLE_SHEETS_TAB_LOCATIONS || process.env.SHEETS_TAB_LOCATIONS || "Locations";
  const tabPersonnel = process.env.GOOGLE_SHEETS_TAB_PERSONNEL || process.env.SHEETS_TAB_PERSONNEL || "Personnel";
  const tabDepartments = process.env.GOOGLE_SHEETS_TAB_DEPARTMENTS || process.env.SHEETS_TAB_DEPARTMENTS || "Departments";
  const tabActions = process.env.GOOGLE_SHEETS_TAB_ACTIONS || process.env.SHEETS_TAB_ACTIONS || "Actions";
  const tabRos = process.env.GOOGLE_SHEETS_TAB_ROS || process.env.SHEETS_TAB_ROS || "ROS by TIME";

  let locationsData: any[] = [];
  let personnelData: any[] = [];
  let departmentsData: any[] = [];
  let actionsData: any[] = [];
  let rosData: any[] = [];
  const colorsObj: Record<string, Record<string, { bg: string; fg: string }>> = {};
  let sourceLabel = "";

  const hasCredentials = Boolean(
    (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) ||
    (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN)
  );

  if (hasCredentials) {
    try {
      // Fetch grid formatting only for small metadata tabs (Locations, Personnel, Departments, Actions)
      const formattingSpreadsheet = await getSpreadsheetWithFormatting(spreadsheetId, [
        tabLocations,
        tabPersonnel,
        tabDepartments,
        tabActions,
      ]).catch(() => null);

      if (formattingSpreadsheet && formattingSpreadsheet.sheets) {
        const findSheet = (name: string) =>
          formattingSpreadsheet.sheets.find(
            (s: any) => s.properties?.title?.trim().toLowerCase() === name.trim().toLowerCase()
          );

        const locSheet = findSheet(tabLocations);
        const perSheet = findSheet(tabPersonnel);
        const depSheet = findSheet(tabDepartments);
        const actSheet = findSheet(tabActions);

        if (locSheet) locationsData = parseSheetDataWithColors(formattingSpreadsheet, tabLocations).data;
        if (perSheet) personnelData = parseSheetDataWithColors(formattingSpreadsheet, tabPersonnel).data;
        if (depSheet) departmentsData = parseSheetDataWithColors(formattingSpreadsheet, tabDepartments).data;
        if (actSheet) actionsData = parseSheetDataWithColors(formattingSpreadsheet, tabActions).data;
      }

      // Fetch ROS values directly without giant grid formatting payload to avoid stack overflow
      rosData = await getParsedSheetData(spreadsheetId, tabRos).catch(() => []);
      sourceLabel = `Google Sheet ${spreadsheetId.substring(0, 8)}... (OAuth)`;
    } catch {
      return getFestivalDataFromCsv();
    }
  } else {
    return getFestivalDataFromCsv();
  }

  const { venues, events, personnel, departments } = parseSpreadsheetData(locationsData, rosData, personnelData, departmentsData, actionsData);
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
      matchedRows: merged.events.filter(e => e.hasLocation).length,
      unmatchedLocations: [...new Set(merged.events.filter(e => !e.hasLocation).map(e => e.locationName || ""))].filter(Boolean),
    },
  };
}

export async function getFestivalDataFromCsv(): Promise<FestivalDataResult> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "1rpmzT4_6NlAOSryN86ROv3mv1Jf4ydColAlk6MrY1zw";
  const tabLocations = process.env.GOOGLE_SHEETS_TAB_LOCATIONS || "Locations";
  const tabPersonnel = process.env.GOOGLE_SHEETS_TAB_PERSONNEL || "Personnel";
  const tabDepartments = process.env.GOOGLE_SHEETS_TAB_DEPARTMENTS || "Departments";
  const tabActions = process.env.GOOGLE_SHEETS_TAB_ACTIONS || "Actions";
  const tabRos = process.env.GOOGLE_SHEETS_TAB_ROS || "ROS by TIME";

  let locationsData: any[] = [];
  let personnelData: any[] = [];
  let departmentsData: any[] = [];
  let actionsData: any[] = [];
  let rosData: any[] = [];

  try { locationsData = await getParsedSheetDataFromPublicCsv(spreadsheetId, tabLocations); } catch {}
  try { personnelData = await getParsedSheetDataFromPublicCsv(spreadsheetId, tabPersonnel); } catch {}
  try { departmentsData = await getParsedSheetDataFromPublicCsv(spreadsheetId, tabDepartments); } catch {}
  try { actionsData = await getParsedSheetDataFromPublicCsv(spreadsheetId, tabActions); } catch {}
  try { rosData = await getParsedSheetDataFromPublicCsv(spreadsheetId, tabRos); } catch {}

  const { venues, events, personnel, departments } = parseSpreadsheetData(locationsData, rosData, personnelData, departmentsData, actionsData);
  const adminEntries = await readAdminEntries().catch(() => []);
  const merged = mergeAdminEntries(venues, events, adminEntries);

  return {
    venues: merged.venues,
    events: merged.events,
    personnel,
    departments,
    colors: {},
    sourceLabel: `Google Sheet ${spreadsheetId.substring(0, 8)}... (Public CSV)`,
    debug: {
      totalRows: rosData.length + adminEntries.length,
      confirmedRows: merged.events.length,
      matchedRows: merged.events.filter(e => e.hasLocation).length,
      unmatchedLocations: [...new Set(merged.events.filter(e => !e.hasLocation).map(e => e.locationName || ""))].filter(Boolean),
    },
  };
}

import { filterEventsByRole } from "./role-filter";
export { filterEventsByRole };

export async function getFestivalData(role: string = "public"): Promise<FestivalDataResult> {
  const result = await getFestivalDataFromRtdb(role);
  return {
    ...result,
    events: filterEventsByRole(result.events, role),
  };
}
