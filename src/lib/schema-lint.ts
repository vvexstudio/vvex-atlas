import type { FestivalEvent, Venue, Department } from "@/types/festival";

export interface LintIssue {
  id: string;
  severity: "error" | "warning" | "info";
  category: "time" | "location" | "department" | "duplicate" | "personnel";
  message: string;
  targetId?: string;
  details?: string;
}

export interface ValidationReport {
  timestamp: string;
  issueCounts: {
    errors: number;
    warnings: number;
    info: number;
  };
  issues: LintIssue[];
}

export function validateFestivalData(
  events: FestivalEvent[],
  venues: Venue[],
  personnel: any[] = [],
  departments: Department[] = []
): ValidationReport {
  const issues: LintIssue[] = [];
  const venueMap = new Map<string, Venue>();

  venues.forEach((v) => {
    if (v.name) venueMap.set(v.name.toLowerCase().trim(), v);
    if (v.mapLabel) venueMap.set(v.mapLabel.toLowerCase().trim(), v);
  });

  const deptNames = new Set(departments.map((d) => d.name.toLowerCase().trim()));
  const seenEventKeys = new Set<string>();

  events.forEach((event, idx) => {
    const eventId = event.id || `event-${idx}`;

    // 1. Time format & range validation
    if (!event.startTime || event.startTime.trim() === "") {
      issues.push({
        id: `time-missing-${eventId}`,
        severity: "warning",
        category: "time",
        message: `Event "${event.title}" has no start time specified.`,
        targetId: eventId,
      });
    }

    // 2. Unmapped location validation
    if (event.locationName && event.locationName.trim() !== "") {
      const locClean = event.locationName.toLowerCase().trim();
      if (!venueMap.has(locClean)) {
        issues.push({
          id: `loc-unmapped-${eventId}`,
          severity: "error",
          category: "location",
          message: `Location "${event.locationName}" referenced by "${event.title}" does not match any known venue.`,
          targetId: eventId,
          details: `Specified location string "${event.locationName}" could not be resolved to placemark coordinates.`,
        });
      }
    } else {
      issues.push({
        id: `loc-missing-${eventId}`,
        severity: "info",
        category: "location",
        message: `Event "${event.title}" is missing an assigned location.`,
        targetId: eventId,
      });
    }

    // 3. Department assignment validation
    if (event.department && event.department.trim() !== "" && deptNames.size > 0) {
      const depts = event.department.split(",").map((d) => d.trim().toLowerCase());
      depts.forEach((dept) => {
        if (dept && !deptNames.has(dept)) {
          issues.push({
            id: `dept-unknown-${eventId}-${dept}`,
            severity: "info",
            category: "department",
            message: `Event "${event.title}" specifies department "${dept}" not registered in Departments list.`,
            targetId: eventId,
          });
        }
      });
    }

    // 4. Duplicate event check
    const eventKey = `${(event.title || "").toLowerCase().trim()}|${(event.locationName || "").toLowerCase().trim()}|${event.scheduleDate}|${event.startTime}`;
    if (seenEventKeys.has(eventKey)) {
      issues.push({
        id: `dup-event-${eventId}`,
        severity: "warning",
        category: "duplicate",
        message: `Duplicate event detected: "${event.title}" on ${event.scheduleDate} at ${event.startTime}.`,
        targetId: eventId,
      });
    } else {
      seenEventKeys.add(eventKey);
    }
  });

  // 5. Personnel contact checks
  personnel.forEach((person, idx) => {
    const personId = person.contact_id || person.email || `person-${idx}`;
    if (!person.email || String(person.email).trim() === "") {
      issues.push({
        id: `person-no-email-${personId}`,
        severity: "warning",
        category: "personnel",
        message: `Personnel entry "${person.name || "Unnamed"}" has no email address.`,
        targetId: personId,
      });
    }
  });

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const info = issues.filter((i) => i.severity === "info").length;

  return {
    timestamp: new Date().toISOString(),
    issueCounts: {
      errors,
      warnings,
      info,
    },
    issues,
  };
}
