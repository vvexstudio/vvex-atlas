export type FestivalDay = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export type EventType =
  | "music"
  | "performance"
  | "installation"
  | "exhibition"
  | "lecture"
  | "community"
  | "social"
  | "object"
  | "experience"
  | "film"
  | "dj"
  | "venue"
  | "food"
  | "services"
  | "ceremony";

export type Venue = {
  id: string;
  name: string;
  aliases?: string;
  label: string;
  mapLabel?: string;
  shortDescription: string;
  description: string;
  address?: string;
  x: number;
  y: number;
  lat?: number;
  lng?: number;
  hasLocation?: boolean;
  permanence?: string;
  serviceType?: "garbage" | "water" | "toilets" | "medic";
  thumbnailUrl: string;
  accent: string;
};

export type FestivalEvent = {
  id: string;
  venueId: string;
  title: string;
  host: string;
  description: string;
  day: FestivalDay;
  startTime: string;
  endTime: string;
  type: EventType;
  projectTypes?: EventType[];
  thumbnailUrl: string;
  lat?: number;
  lng?: number;
  hasLocation?: boolean;
  permanence?: string;
  serviceType?: "garbage" | "water" | "toilets" | "medic";
  source?: "schedule" | "admin";
  scheduleDate?: string;
  scheduleCategory?: string;
  action?: string;
  department?: string;
  supportDept1?: string;
  supportDept2?: string;
  leadPointPerson?: string;
  supportPerson1?: string;
  supportPerson2?: string;
  locationName?: string;
  history?: EventHistoryEntry[];
};

export interface Department {
  Department: string;
  Aliases?: string;
  "Lead Point Person"?: string;
  "Lead Phone"?: string;
  "Lead Email"?: string;
  Lat?: number;
  Long?: number;
}

export type EventHistoryEntry = {
  timestamp: string;
  eventId: string;
  changedBy: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
};

