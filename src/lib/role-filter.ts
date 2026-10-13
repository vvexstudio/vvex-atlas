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

  if (
    isInternalCrew ||
    process.env.PUBLIC_SHOW_ALL_EVENTS === "true" ||
    process.env.NEXT_PUBLIC_SHOW_ALL_EVENTS === "true"
  ) {
    return events;
  }

  // Public role: ONLY include events explicitly tagged as Public or FOH / Front
  return events.filter((e) => {
    const dept = (e.department || "").toLowerCase();
    const cat = (e.scheduleCategory || "").toLowerCase();
    const action = (e.action || "").toLowerCase();
    const title = (e.title || "").toLowerCase();
    const fohBoh = String(e.foh_boh || (e as any).foh_boh || "").toLowerCase();

    const isExplicitlyPublic =
      dept.includes("public") ||
      dept.includes("foh") ||
      cat.includes("public") ||
      cat.includes("foh") ||
      action.includes("public") ||
      title.includes("public") ||
      fohBoh.includes("foh") ||
      fohBoh.includes("public") ||
      fohBoh.includes("front");

    const isInternal =
      dept.includes("admin") ||
      dept.includes("all departments") ||
      dept.includes("boh") ||
      cat.includes("boh") ||
      cat.includes("internal") ||
      fohBoh.includes("boh") ||
      fohBoh.includes("back");

    return isExplicitlyPublic && !isInternal;
  });
}
