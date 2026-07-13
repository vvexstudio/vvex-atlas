import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { getFestivalData } from "../festival-data";

describe("getFestivalData - time-math and rollover logic", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_REFRESH_TOKEN", "");
    vi.stubEnv("GOOGLE_SHEETS_SPREADSHEET_ID", "mock-spreadsheet-id");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("should parse normal event times correctly", async () => {
    const mockFetch = globalThis.fetch as any;
    mockFetch.mockImplementation(async (url: string) => {
      let csv = "";
      if (url.includes("sheet=Locations")) {
        csv = "location_id,name,aliases,category,lat,lng\nhall,Hall,,Venue,43.05,11.54";
      } else if (url.includes("sheet=Personnel")) {
        csv = "name,role,department,email\nJohn,admin,Lighting,john@example.com";
      } else if (url.includes("sheet=Departments")) {
        csv = "department,google_calendar_id\nLighting,cal-123";
      } else if (url.includes("sheet=ROS")) {
        csv = "Action,Description,Location,Start Day,Start,End Time,Lead Point Person,Lead Dept,foh_boh\n" +
              "Setup,Lighting setup,Hall,2026-08-23,09:00,12:00,John,Lighting,BOH";
      }
      return {
        ok: true,
        text: async () => csv,
      };
    });

    const result = await getFestivalData("admin");
    expect(result.events).toHaveLength(1);
    const event = result.events[0];
    expect(event.title).toBe("Lighting setup");
    expect(event.startTime).toBe("9 AM");
    expect(event.endTime).toBe("12 PM");
    expect(["2026-08-22", "2026-08-23"]).toContain(event.scheduleDate);
  });

  it("should handle overnight rollover logic correctly", async () => {
    const mockFetch = globalThis.fetch as any;
    mockFetch.mockImplementation(async (url: string) => {
      let csv = "";
      if (url.includes("sheet=Locations")) {
        csv = "location_id,name,aliases,category,lat,lng\nhall,Hall,,Venue,43.05,11.54";
      } else if (url.includes("sheet=Personnel")) {
        csv = "name,role,department,email\nJohn,admin,Lighting,john@example.com";
      } else if (url.includes("sheet=Departments")) {
        csv = "department,google_calendar_id\nLighting,cal-123";
      } else if (url.includes("sheet=ROS")) {
        csv = "Action,Description,Location,Start Day,Start,End Time,Lead Point Person,Lead Dept,foh_boh\n" +
              "Late Show,Midnight gig,Hall,2026-08-23,22:00,02:00,John,Lighting,FOH";
      }
      return {
        ok: true,
        text: async () => csv,
      };
    });

    const result = await getFestivalData("guest");
    expect(result.events).toHaveLength(1);
    const event = result.events[0];
    expect(event.title).toBe("Midnight gig");
    expect(event.startTime).toBe("10 PM");
    expect(event.endTime).toBe("2 AM");
  });
});
