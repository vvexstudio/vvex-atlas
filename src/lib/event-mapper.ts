import type { Venue, FestivalEvent, Department, FestivalDay } from "@/types/festival";

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

function parseDateString(val: unknown): Date | null {
  if (val instanceof Date && !Number.isNaN(val.getTime())) return val;
  if (typeof val === "number" && Number.isFinite(val)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + val * 24 * 60 * 60 * 1000);
  }
  const raw = asString(val);
  if (!raw) return null;

  const cleaned = raw.replace(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s*/i, "").trim();
  if (!cleaned) return null;

  const dateWithYear = new Date(`${cleaned}, 2026`);
  if (!Number.isNaN(dateWithYear.getTime())) {
    return dateWithYear;
  }

  const dateFallback = new Date(raw);
  if (!Number.isNaN(dateFallback.getTime())) {
    return dateFallback;
  }

  return null;
}

export function createVenueFromNewSheetRow(row: any): Venue {
  if (row && typeof row === "object" && "id" in row && "name" in row && "hasLocation" in row) {
    return row as Venue;
  }
  const cleanRow: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    cleanRow[k.trim()] = v;
  }
  const name = asString(cleanRow["Location"]);
  const lat = Number(cleanRow["Lat"]);
  const lng = Number(cleanRow["Long"]);
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);

  return {
    id: slugify(name),
    name,
    label: "Location",
    mapLabel: name,
    shortDescription: asString(cleanRow["Description"]) || "Imported location",
    description: asString(cleanRow["Description"]) || `Location: ${name}`,
    x: 0,
    y: 0,
    lat: hasLocation ? lat : undefined,
    lng: hasLocation ? lng : undefined,
    hasLocation,
    thumbnailUrl: DEFAULT_THUMBNAIL,
    accent: hasLocation ? DEFAULT_ACCENT : "#6b7280",
  };
}

export function createEventFromSheetRow(row: any, venuesById: Map<string, Venue>, index: number): FestivalEvent {
  if (row && typeof row === "object" && "id" in row && "title" in row && "startTime" in row) {
    return row as FestivalEvent;
  }
  const cleanRow: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    cleanRow[k.trim()] = v;
  }

  const action = asString(cleanRow["Action"]);
  const description = asString(cleanRow["Description"]);
  const locationName = asString(cleanRow["SOLARIS ROS Location"] || cleanRow["Location"]) || "TBD";
  
  const title = description.split(/\n|\/\//)[0].trim() || action || "Scheduled Event";

  const dateObj = parseDateString(cleanRow["Start Day"]);
  const dateStr = dateObj ? (isoDate(dateObj) || "") : asString(cleanRow["Start Day"]);

  const startMinutes = excelTimeToMinutes(cleanRow["Start"]);
  const startStr = startMinutes !== null ? formatMinutes(startMinutes) : asString(cleanRow["Start"]) || "TBD";

  const endMinutes = excelTimeToMinutes(cleanRow["End Time"]);
  const endStr = endMinutes !== null ? formatMinutes(endMinutes) : asString(cleanRow["End Time"]) || "TBD";

  const venueId = slugify(locationName);
  const venue = venuesById.get(venueId);

  const projectTypes = parseEventTypes(`${action} ${description}`);

  return {
    id: cleanRow["event_id"] || `remote-${slugify(`${dateStr || "date"}-${title}-${index}`)}`,
    venueId,
    title,
    host: asString(cleanRow["Lead Point Person"]) || asString(cleanRow["Department"]) || "",
    description,
    day: getFestivalDay(dateObj),
    startTime: startStr,
    endTime: endStr,
    type: (cleanRow["event_type"] || projectTypes[0] || "community") as any,
    projectTypes: projectTypes.length > 1 ? projectTypes : undefined,
    thumbnailUrl: DEFAULT_THUMBNAIL,
    lat: venue?.lat,
    lng: venue?.lng,
    hasLocation: !!venue?.hasLocation,
    source: "schedule",
    scheduleDate: dateStr,
    scheduleCategory: action || undefined,
    action,
    department: asString(cleanRow["Department"]),
    leadPointPerson: asString(cleanRow["Lead Point Person"]),
    locationName,
  };
}

export function parseSpreadsheetData(
  locationsData: any[],
  rosData: any[],
  personnelData: any[],
  departmentsData: any[]
): {
  venues: Venue[];
  events: FestivalEvent[];
  personnel: any[];
  departments: Department[];
} {
  const validRows = rosData.filter((row) => {
    if (row && typeof row === "object" && "id" in row && "title" in row && "startTime" in row) {
      return true;
    }
    const cleanRow: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      cleanRow[k.trim()] = v;
    }
    return cleanRow["Action"] || cleanRow["Description"] || cleanRow["SOLARIS ROS Location"] || cleanRow["Location"];
  });

  const venues = locationsData
    .map(createVenueFromNewSheetRow)
    .filter((v) => v.name && v.name !== "All Locations");

  const venuesById = new Map(venues.map((venue) => [venue.id, venue]));

  validRows.forEach((row) => {
    if (row && typeof row === "object" && "id" in row && "title" in row && "startTime" in row) {
      return;
    }
    const cleanRow: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      cleanRow[k.trim()] = v;
    }
    const locName = asString(cleanRow["SOLARIS ROS Location"] || cleanRow["Location"]);
    if (locName) {
      const id = slugify(locName);
      if (!venuesById.has(id)) {
        const fallbackVenue: Venue = {
          id,
          name: locName,
          label: "Location",
          mapLabel: locName,
          shortDescription: "Dynamic from ROS by TIME",
          description: `Location referenced in schedule: ${locName}`,
          x: 0,
          y: 0,
          hasLocation: false,
          thumbnailUrl: DEFAULT_THUMBNAIL,
          accent: "#6b7280",
        };
        venues.push(fallbackVenue);
        venuesById.set(id, fallbackVenue);
      }
    }
  });

  const events = validRows.map((row, idx) => createEventFromSheetRow(row, venuesById, idx));

  events.sort((a, b) => {
    const dateDelta = (a.scheduleDate || "").localeCompare(b.scheduleDate || "");
    if (dateDelta !== 0) return dateDelta;
    return (a.startTime || "").localeCompare(b.startTime || "");
  });

  const personnel = personnelData.map((row) => {
    if (row && typeof row === "object" && "email" in row && "name" in row) {
      return row;
    }
    const cleanRow: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      cleanRow[k.trim()] = v;
    }
    return cleanRow;
  }).filter(p => p.Name || p.name);

  const departments = departmentsData.map((row) => {
    if (row && typeof row === "object" && "google_calendar_id" in row && "department" in row) {
      return row as Department;
    }
    const cleanRow: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      cleanRow[k.trim()] = v;
    }
    return cleanRow as Department;
  }).filter((d): d is Department => Boolean(d.Department || (d as any).department));

  return { venues, events, personnel, departments };
}
