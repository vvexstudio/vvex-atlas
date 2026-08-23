import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AdminEntriesFile, AdminEntry, ServiceType } from "@/types/admin-entry";
import { EventType, FestivalDay } from "@/types/festival";

const ADMIN_ENTRIES_PATH = path.join(process.cwd(), "portal-admin-entries.json");

const VALID_DAYS: FestivalDay[] = ["fri", "sat", "sun"];
const VALID_TYPES: EventType[] = [
  "music",
  "performance",
  "installation",
  "exhibition",
  "lecture",
  "community",
  "social",
  "object",
  "experience",
  "film",
  "dj",
  "venue",
  "food",
  "services",
];
const VALID_SERVICES: ServiceType[] = ["garbage", "water", "toilets", "medic"];

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function parseDay(value: unknown): FestivalDay {
  const day = asString(value).toLowerCase();
  return VALID_DAYS.includes(day as FestivalDay) ? (day as FestivalDay) : "fri";
}

function parseType(value: unknown): EventType {
  const type = asString(value).toLowerCase();
  return VALID_TYPES.includes(type as EventType) ? (type as EventType) : "venue";
}

function parseTypeList(value: unknown): EventType[] {
  if (Array.isArray(value)) {
    const parsed = value
      .map((entry) => parseType(entry))
      .filter((entry, index, all) => all.indexOf(entry) === index);
    return parsed;
  }

  if (typeof value === "string") {
    const parts = value
      .split(/[,/|+&]/)
      .map((part) => parseType(part))
      .filter((entry, index, all) => all.indexOf(entry) === index);
    return parts;
  }

  return [];
}

function parseServiceType(value: unknown): ServiceType | undefined {
  const service = asString(value).toLowerCase();
  return VALID_SERVICES.includes(service as ServiceType) ? (service as ServiceType) : undefined;
}

function normalizeEntry(raw: unknown, index: number): AdminEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const lat = asNumber(obj.lat);
  const lng = asNumber(obj.lng);
  const hasLocation = typeof obj.hasLocation === "boolean" ? obj.hasLocation : lat !== undefined && lng !== undefined;
  const projectType = parseType(obj.projectType ?? obj.type);
  const parsedProjectTypes = parseTypeList(obj.projectTypes);
  const mergedProjectTypes = [
    projectType,
    ...parsedProjectTypes,
  ].filter((entry, index, all) => all.indexOf(entry) === index);
  const serviceType = parseServiceType(obj.serviceType);
  const fallbackName = serviceType
    ? `${serviceType.charAt(0).toUpperCase()}${serviceType.slice(1)}`
    : "Admin Entry";
  const name = asString(obj.name) || fallbackName;
  const hasSchedule = typeof obj.hasSchedule === "boolean" ? obj.hasSchedule : false;

  return {
    id: asString(obj.id) || `admin-${index + 1}`,
    name,
    artist: asString(obj.artist),
    locationInternal: asString(obj.locationInternal ?? obj.location),
    projectType: projectType === "services" || serviceType ? "services" : projectType,
    projectTypes:
      projectType === "services" || serviceType
        ? undefined
        : mergedProjectTypes.length > 1
          ? mergedProjectTypes
          : undefined,
    serviceType,
    abridgedProjectText: asString(obj.abridgedProjectText),
    day: parseDay(obj.day),
    startTime: hasSchedule ? asString(obj.startTime) || "TBD" : "",
    endTime: hasSchedule ? asString(obj.endTime) || "TBD" : "",
    hasSchedule,
    permanence: asString(obj.permanence),
    lat,
    lng,
    hasLocation,
  };
}

import { adminDb } from "@/lib/firebase-admin";

export async function readAdminEntries(): Promise<AdminEntry[]> {
  if (adminDb) {
    try {
      const snapshot = await adminDb.ref("admin-data/entries").once("value");
      if (snapshot.exists()) {
        const val = snapshot.val();
        if (val && typeof val === "object") {
          const list = Array.isArray(val) ? val : Object.values(val);
          const fbEntries = list
            .map((entry, index) => normalizeEntry(entry, index))
            .filter((entry): entry is AdminEntry => Boolean(entry));
          if (fbEntries.length > 0) {
            return fbEntries;
          }
        }
      }
    } catch (e) {
      console.error("Failed to read admin entries from Firebase:", e);
    }
  }

  let raw = "";
  try {
    raw = await readFile(ADMIN_ENTRIES_PATH, "utf-8");
  } catch {
    return [];
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object") return [];
  const entries = Array.isArray((parsed as AdminEntriesFile).entries) ? (parsed as AdminEntriesFile).entries : [];
  const localEntries = entries
    .map((entry, index) => normalizeEntry(entry, index))
    .filter((entry): entry is AdminEntry => Boolean(entry));

  if (adminDb && localEntries.length > 0) {
    try {
      const entriesMap: Record<string, AdminEntry> = {};
      localEntries.forEach((e) => {
        entriesMap[e.id] = e;
      });
      const sanitizedEntriesMap = JSON.parse(JSON.stringify(entriesMap));
      await adminDb.ref("admin-data/entries").set(sanitizedEntriesMap);
      await adminDb.ref("crew-data/entries").set(sanitizedEntriesMap);
      await adminDb.ref("public-data/entries").set(sanitizedEntriesMap);
    } catch (e) {
      console.error("Failed to sync local admin entries to Firebase:", e);
    }
  }

  return localEntries;
}

async function writeAdminEntries(entries: AdminEntry[]): Promise<void> {
  const payload: AdminEntriesFile = { entries };
  await writeFile(ADMIN_ENTRIES_PATH, JSON.stringify(payload, null, 2), "utf-8");

  if (adminDb) {
    try {
      const entriesMap: Record<string, AdminEntry> = {};
      entries.forEach((e) => {
        entriesMap[e.id] = e;
      });
      const sanitizedEntriesMap = JSON.parse(JSON.stringify(entriesMap));
      await adminDb.ref("admin-data/entries").set(sanitizedEntriesMap);
      await adminDb.ref("crew-data/entries").set(sanitizedEntriesMap);
      await adminDb.ref("public-data/entries").set(sanitizedEntriesMap);
    } catch (e) {
      console.error("Failed to write admin entries to Firebase:", e);
    }
  }
}

export type UpsertInput = Partial<AdminEntry> & { id?: string; name?: string };

export async function createAdminEntry(input: UpsertInput): Promise<AdminEntry> {
  const entries = await readAdminEntries();
  const created = normalizeEntry({ ...input, id: `admin-${randomUUID()}` }, entries.length);
  if (!created) {
    throw new Error("Invalid admin entry payload");
  }
  const nextEntries = [...entries, created];
  await writeAdminEntries(nextEntries);
  return created;
}

export async function createManyAdminEntries(inputs: UpsertInput[]): Promise<AdminEntry[]> {
  const entries = await readAdminEntries();
  const created: AdminEntry[] = [];
  for (const input of inputs) {
    const normalized = normalizeEntry({ ...input, id: `admin-${randomUUID()}` }, entries.length + created.length);
    if (!normalized) {
      throw new Error("Invalid admin entry payload");
    }
    created.push(normalized);
  }
  const nextEntries = [...entries, ...created];
  await writeAdminEntries(nextEntries);
  return created;
}

export async function updateAdminEntry(id: string, input: Partial<AdminEntry>): Promise<AdminEntry | null> {
  const entries = await readAdminEntries();
  const idx = entries.findIndex((entry) => entry.id === id);
  if (idx < 0) return null;

  const merged = normalizeEntry({ ...entries[idx], ...input, id }, idx);
  if (!merged) {
    throw new Error("Invalid admin entry payload");
  }

  const nextEntries = [...entries];
  nextEntries[idx] = merged;
  await writeAdminEntries(nextEntries);
  return merged;
}

export async function deleteAdminEntry(id: string, name?: string): Promise<boolean> {
  const entries = await readAdminEntries();
  const cleanId = String(id).toLowerCase().trim();
  const cleanName = name ? String(name).toLowerCase().trim() : "";

  const nextEntries = entries.filter(
    (entry) =>
      entry.id.toLowerCase().trim() !== cleanId &&
      (!cleanName || entry.name.toLowerCase().trim() !== cleanName)
  );

  await writeAdminEntries(nextEntries);

  if (adminDb) {
    try {
      await adminDb.ref(`admin-data/entries/${id}`).remove();
      await adminDb.ref(`crew-data/entries/${id}`).remove();
      await adminDb.ref(`public-data/entries/${id}`).remove();

      for (const node of ["crew-data/venues", "public-data/venues", "admin-data/venues"]) {
        const snap = await adminDb.ref(node).once("value");
        if (snap.exists()) {
          const val = snap.val();
          if (Array.isArray(val)) {
            const filtered = val.filter(
              (v: any) =>
                v &&
                String(v.id || "").toLowerCase().trim() !== cleanId &&
                (!cleanName || String(v.name || "").toLowerCase().trim() !== cleanName)
            );
            await adminDb.ref(node).set(filtered);
          } else if (typeof val === "object") {
            for (const [k, v] of Object.entries(val as Record<string, any>)) {
              if (
                v &&
                (String(v.id || "").toLowerCase().trim() === cleanId ||
                  (cleanName && String(v.name || "").toLowerCase().trim() === cleanName))
              ) {
                await adminDb.ref(`${node}/${k}`).remove();
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to delete admin entry from Firebase RTDB:", e);
    }
  }

  return true;
}

export async function getAdminEntryById(id: string): Promise<AdminEntry | null> {
  const entries = await readAdminEntries();
  return entries.find((entry) => entry.id === id) ?? null;
}
