export interface UrlState {
  view?: string;
  day?: string;
  eventId?: string;
  query?: string;
  locations?: string[];
  actions?: string[];
  departments?: string[];
  leads?: string[];
  mySchedule?: boolean;
}

/**
 * Parses URL search parameters into a structured UrlState object.
 */
export function parseUrlParams(params: URLSearchParams): UrlState {
  return {
    view: params.get("v") || undefined,
    day: params.get("d") || undefined,
    eventId: params.get("e") || undefined,
    query: params.get("q") || undefined,
    locations: params.get("loc")?.split(",").filter(Boolean) || [],
    actions: params.get("act")?.split(",").filter(Boolean) || [],
    departments: params.get("dept")?.split(",").filter(Boolean) || [],
    leads: params.get("lead")?.split(",").filter(Boolean) || [],
    mySchedule: params.get("my") === "1",
  };
}

/**
 * Encodes a UrlState object into a URL search parameters query string.
 */
export function buildUrlQuery(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.view) params.set("v", state.view);
  if (state.day) params.set("d", state.day);
  if (state.eventId) params.set("e", state.eventId);
  if (state.query) params.set("q", state.query);
  if (state.locations && state.locations.length > 0) params.set("loc", state.locations.join(","));
  if (state.actions && state.actions.length > 0) params.set("act", state.actions.join(","));
  if (state.departments && state.departments.length > 0) params.set("dept", state.departments.join(","));
  if (state.leads && state.leads.length > 0) params.set("lead", state.leads.join(","));
  if (state.mySchedule) params.set("my", "1");
  
  const queryStr = params.toString();
  return queryStr ? `?${queryStr}` : "";
}
