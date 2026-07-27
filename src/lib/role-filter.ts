import type { FestivalEvent } from "@/types/festival";

/**
 * Filters events based on active user role.
 * - 'admin', 'crew', 'lead': See all events.
 * - 'public', 'guest', or unauthenticated: ONLY see events explicitly tagged for public / FOH.
 */
export function filterEventsByRole(events: FestivalEvent[], role: string = "public"): FestivalEvent[] {
  const normalizedRole = (role || "").toLowerCase();

  const isInternalCrew =
    normalizedRole === "admin" ||
    normalizedRole === "crew" ||
    normalizedRole === "lead" ||
    normalizedRole === "department_lead";

  if (isInternalCrew) {
    return events;
  }

  // Public role: ONLY include events explicitly tagged as Public or FOH
  return events.filter((e) => {
    const dept = (e.department || "").toLowerCase();
    const cat = (e.scheduleCategory || "").toLowerCase();
    const action = (e.action || "").toLowerCase();
    const title = (e.title || "").toLowerCase();
    const fohBoh = String((e as any).foh_boh || "").toLowerCase();

    const isExplicitlyPublic =
      dept.includes("public") ||
      dept.includes("foh") ||
      cat.includes("public") ||
      cat.includes("foh") ||
      action.includes("public") ||
      title.includes("public") ||
      fohBoh.includes("foh") ||
      fohBoh.includes("public");

    const isInternal =
      dept.includes("admin") ||
      dept.includes("all departments") ||
      dept.includes("boh") ||
      cat.includes("boh") ||
      cat.includes("internal") ||
      fohBoh.includes("boh");

    return isExplicitlyPublic && !isInternal;
  });
}
