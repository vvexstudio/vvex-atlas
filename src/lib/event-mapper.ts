import type { Venue, FestivalEvent, Department, FestivalDay } from "@/types/festival";

const DEFAULT_THUMBNAIL = "";
const DEFAULT_ACCENT = "#bc5c2d";
const DAY_BY_INDEX: FestivalDay[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function getRowValue(row: any, keys: string[]): any {
  if (!row || typeof row !== "object") return undefined;
  const cleanKeys = keys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const [k, v] of Object.entries(row)) {
    const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cleanKeys.includes(cleanK)) {
      return v;
    }
  }
  return undefined;
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
  if (value === null || value === undefined) return null;

  // 1. If it's already a number, treat as Excel time fraction
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = ((value % 1) + 1) % 1;
    return Math.round(normalized * 24 * 60);
  }

  const raw = asString(value);
  if (!raw || raw === "????" || raw.toLowerCase() === "tbd") return null;

  // 2. Check if it's an ISO / date-time string containing 'T' (e.g. "1899-12-30T14:32:00.000Z")
  if (raw.includes("T")) {
    if (raw.toUpperCase().endsWith("Z")) {
      const parsedDate = new Date(raw);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.getHours() * 60 + parsedDate.getMinutes();
      }
    }
    const tMatch = raw.match(/T(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
    if (tMatch) {
      const hours = Number(tMatch[1]);
      const minutes = Number(tMatch[2]);
      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        return hours * 60 + minutes;
      }
    }
  }

  // 3. Check if it is a standard time string like "HH:MM:SS" or "HH:MM"
  const timeMatch = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]m)?$/i);
  if (timeMatch) {
    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const ampm = timeMatch[4];
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes < 60) {
      if (ampm) {
        const lowerAmpm = ampm.toLowerCase();
        if (lowerAmpm === "pm" && hours < 12) hours += 12;
        if (lowerAmpm === "am" && hours === 12) hours = 0;
      }
      return hours * 60 + minutes;
    }
  }

  // 4. Check if it is a simple hour with meridian (e.g. "8am", "12pm", "8 pm")
  const compact = raw.replace(/\s+/g, "").toLowerCase();
  const simpleMatch = compact.match(/^(\d{1,2})([ap]m|m)?$/);
  if (simpleMatch) {
    let hours = Number(simpleMatch[1]);
    const suffix = simpleMatch[2];
    if (hours >= 0 && hours <= 23) {
      if (suffix) {
        if (suffix === "pm" && hours < 12) hours += 12;
        if ((suffix === "am" || suffix === "m") && hours === 12) hours = 0;
      }
      return hours * 60;
    }
  }

  return null;
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
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
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
  const name = asString(
    getRowValue(row, ["Location", "location", "Name", "name", "location_id", "Location Name", "location_name"])
  );
  if (!name && row && typeof row === "object" && "id" in row && "name" in row) {
    const v = row as Venue;
    if (v.hasLocation && Number.isFinite(v.lat) && Number.isFinite(v.lng)) {
      return v;
    }
  }
  let rawLat = getRowValue(row, ["Lat", "Latitude", "lat", "latitude", "LAT", "LATITUDE", "y", "Y"]);
  let rawLng = getRowValue(row, ["Long", "Lng", "Longitude", "longitude", "long", "lng", "LONG", "LNG", "x", "X"]);
  const rawCoords = getRowValue(row, [
    "Coordinates",
    "coordinates",
    "COORDINATES",
    "Coord",
    "coord",
    "Coords",
    "coords",
    "location_coordinates",
    "lat_lng",
    "latlng",
  ]);

  if ((rawLat === undefined || rawLng === undefined || rawLat === "" || rawLng === "") && rawCoords) {
    const str = asString(rawCoords);
    const coordsMatch = str.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (coordsMatch) {
      rawLat = coordsMatch[1];
      rawLng = coordsMatch[2];
    }
  }

  if (typeof rawLat === "string" && rawLat.includes(",")) {
    const coordsMatch = rawLat.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (coordsMatch) {
      rawLat = coordsMatch[1];
      rawLng = coordsMatch[2];
    }
  }

  const numLat = rawLat !== undefined && rawLat !== null && rawLat !== "" ? Number(rawLat) : undefined;
  const numLng = rawLng !== undefined && rawLng !== null && rawLng !== "" ? Number(rawLng) : undefined;
  const hasLocation = numLat !== undefined && numLng !== undefined && Number.isFinite(numLat) && Number.isFinite(numLng);

  const address = asString(getRowValue(row, ["Address", "Street Address", "Location Address", "location_address", "address"]));
  const description = asString(getRowValue(row, ["Description", "notes", "notes_internal", "description"]));
  const permanence = asString(getRowValue(row, ["Category", "category", "Permanence", "permanence", "Type", "type", "foh_boh_default", "label"])) || "Standard";

  const venueName = name || (row && typeof row === "object" && row.name ? String(row.name) : "Unnamed Location");

  return {
    id: slugify(venueName),
    name: venueName,
    label: permanence,
    mapLabel: venueName,
    shortDescription: description || "Imported location",
    description: description || `Location: ${venueName}`,
    address: address || undefined,
    x: 0,
    y: 0,
    lat: hasLocation ? numLat : undefined,
    lng: hasLocation ? numLng : undefined,
    hasLocation,
    permanence,
    thumbnailUrl: (row && row.thumbnailUrl) || DEFAULT_THUMBNAIL,
    accent: hasLocation ? DEFAULT_ACCENT : "#6b7280",
  };
}

export function createEventFromSheetRow(row: any, venuesById: Map<string, Venue>, index: number): FestivalEvent {
  if (row && typeof row === "object" && "id" in row && "title" in row && "startTime" in row) {
    return row as FestivalEvent;
  }

  const action = asString(getRowValue(row, ["Action", "action"]));
  const description = asString(getRowValue(row, ["Description", "description"]));
  const locationName = asString(getRowValue(row, ["SOLARIS ROS Location", "Location", "location_name", "location"])) || "TBD";
  
  const title = description.split(/\n|\/\//)[0].trim() || action || "Scheduled Event";

  const dateVal = getRowValue(row, ["Start Day", "start_day", "date", "start_date"]);
  const dateObj = parseDateString(dateVal);
  const dateStr = dateObj ? (isoDate(dateObj) || "") : asString(dateVal);

  const startVal = getRowValue(row, ["Start", "start", "start_time"]);
  const startMinutes = excelTimeToMinutes(startVal);
  const startStr = startMinutes !== null ? formatMinutes(startMinutes) : asString(startVal) || "TBD";

  const endVal = getRowValue(row, ["End Time", "end_time", "end"]);
  const endMinutes = excelTimeToMinutes(endVal);
  const endStr = endMinutes !== null ? formatMinutes(endMinutes) : asString(endVal) || "TBD";

  const venueId = slugify(locationName);
  const venue = venuesById.get(venueId) || venuesById.get(locationName.toLowerCase().trim());

  const projectTypes = parseEventTypes(`${action} ${description}`);

  const leadDept = asString(getRowValue(row, ["Department", "department", "lead_dept", "lead_department"]));
  const leadPerson = asString(getRowValue(row, ["Lead Point Person", "lead_point_person", "lead"]));
  const eventId = asString(getRowValue(row, ["event_id", "id"]));
  const eventType = asString(getRowValue(row, ["event_type", "type"]));

  return {
    id: eventId || `remote-${slugify(`${dateStr || "date"}-${title}-${index}`)}`,
    venueId,
    title,
    host: leadPerson || leadDept || "",
    description,
    day: getFestivalDay(dateObj),
    startTime: startStr,
    endTime: endStr,
    type: (eventType || projectTypes[0] || "community") as any,
    projectTypes: projectTypes.length > 1 ? projectTypes : undefined,
    thumbnailUrl: DEFAULT_THUMBNAIL,
    lat: venue?.lat,
    lng: venue?.lng,
    hasLocation: !!venue?.hasLocation,
    source: "schedule",
    scheduleDate: dateStr,
    scheduleCategory: action || undefined,
    action,
    department: leadDept,
    leadPointPerson: leadPerson,
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
    const act = getRowValue(row, ["Action", "action"]);
    const desc = getRowValue(row, ["Description", "description"]);
    const loc = getRowValue(row, ["SOLARIS ROS Location", "Location", "location_name", "location"]);
    return act || desc || loc;
  });

  const venues = locationsData
    .map(createVenueFromNewSheetRow)
    .filter((v) => v.name && v.name !== "All Locations");

  const venuesById = new Map<string, Venue>();
  venues.forEach((venue) => {
    venuesById.set(venue.id, venue);
    venuesById.set(venue.name.toLowerCase().trim(), venue);
    venuesById.set(slugify(venue.name), venue);
  });

  validRows.forEach((row) => {
    if (row && typeof row === "object" && "id" in row && "title" in row && "startTime" in row) {
      return;
    }
    const locName = asString(getRowValue(row, ["SOLARIS ROS Location", "Location", "location_name", "location"]));
    if (locName) {
      const id = slugify(locName);
      if (!venuesById.has(id) && !venuesById.has(locName.toLowerCase().trim())) {
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
          permanence: "Standard",
        };
        venues.push(fallbackVenue);
        venuesById.set(id, fallbackVenue);
        venuesById.set(locName.toLowerCase().trim(), fallbackVenue);
      }
    }
  });

  const events = validRows.map((row, idx) => createEventFromSheetRow(row, venuesById, idx));

  events.sort((a, b) => {
    const dateDelta = (a.scheduleDate || "").localeCompare(b.scheduleDate || "");
    if (dateDelta !== 0) return dateDelta;

    const aMin = excelTimeToMinutes(a.startTime) ?? -1;
    const bMin = excelTimeToMinutes(b.startTime) ?? -1;

    if (aMin !== bMin) {
      if (aMin === -1) return 1;
      if (bMin === -1) return -1;
      return aMin - bMin;
    }

    const aEnd = excelTimeToMinutes(a.endTime) ?? -1;
    const bEnd = excelTimeToMinutes(b.endTime) ?? -1;

    if (aEnd !== bEnd) {
      if (aEnd === -1) return 1;
      if (bEnd === -1) return -1;
      return aEnd - bEnd;
    }

    const titleDelta = (a.title || "").localeCompare(b.title || "");
    if (titleDelta !== 0) return titleDelta;

    return (a.id || "").localeCompare(b.id || "");
  });

  const personnel = personnelData.map((row) => {
    if (row && typeof row === "object" && "email" in row && "name" in row) {
      return row;
    }
    const cleanRow: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      cleanRow[k.trim()] = v;
    }
    const pName = getRowValue(row, ["Name", "name"]);
    const pEmail = getRowValue(row, ["Email", "email"]);
    if (pName) cleanRow["name"] = pName;
    if (pEmail) cleanRow["email"] = pEmail;
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
    const dDept = getRowValue(row, ["Department", "department", "dept", "dept_id"]);
    const dCal = getRowValue(row, ["google_calendar_id", "googleCalendarId", "calendar_id", "calendarId"]);
    const dColor = getRowValue(row, ["Color", "color"]);
    if (dDept) cleanRow["department"] = dDept;
    if (dCal) cleanRow["google_calendar_id"] = dCal;
    if (dColor) cleanRow["color"] = dColor;
    return cleanRow as Department;
  }).filter((d): d is Department => Boolean(d.Department || (d as any).department));

  return { venues, events, personnel, departments };
}
