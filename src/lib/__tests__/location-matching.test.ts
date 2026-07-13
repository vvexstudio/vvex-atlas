import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { getFestivalData } from "../festival-data";

describe("getFestivalData - location-matching logic", () => {
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

  it("should match events to venues with the same slugified ID", async () => {
    const mockFetch = globalThis.fetch as any;
    mockFetch.mockImplementation(async (url: string) => {
      let csv = "";
      if (url.includes("sheet=Locations")) {
        csv = "Location,Lat,Long,Description\nThe Forest,43.05,11.54,A dense green space";
      } else if (url.includes("sheet=Personnel")) {
        csv = "name,role,department,email\nJohn,admin,Lighting,john@example.com";
      } else if (url.includes("sheet=Departments")) {
        csv = "department,google_calendar_id\nLighting,cal-123";
      } else if (url.includes("sheet=ROS")) {
        csv = "Action,Description,Location,Start Day,Start,End Time,Lead Point Person,Lead Dept,foh_boh\n" +
              "Tree Planting,Planting,the-forest,2026-08-23,09:00,12:00,John,Lighting,FOH";
      }
      return {
        ok: true,
        text: async () => csv,
      };
    });

    const result = await getFestivalData("guest");
    expect(result.events).toHaveLength(1);
    const event = result.events[0];
    
    // Check that event matches the venue id "the-forest"
    expect(event.venueId).toBe("the-forest");
    expect(event.lat).toBe(43.05);
    expect(event.lng).toBe(11.54);
    expect(event.hasLocation).toBe(true);
  });

  it("should generate a fallback venue when location is unmatched", async () => {
    const mockFetch = globalThis.fetch as any;
    mockFetch.mockImplementation(async (url: string) => {
      let csv = "";
      if (url.includes("sheet=Locations")) {
        // No locations provided
        csv = "Location,Lat,Long,Description\n";
      } else if (url.includes("sheet=Personnel")) {
        csv = "name,role,department,email\nJohn,admin,Lighting,john@example.com";
      } else if (url.includes("sheet=Departments")) {
        csv = "department,google_calendar_id\nLighting,cal-123";
      } else if (url.includes("sheet=ROS")) {
        csv = "Action,Description,Location,Start Day,Start,End Time,Lead Point Person,Lead Dept,foh_boh\n" +
              "Mystery Stage Event,Show,Mystery Stage,2026-08-23,09:00,12:00,John,Lighting,FOH";
      }
      return {
        ok: true,
        text: async () => csv,
      };
    });

    const result = await getFestivalData("guest");
    expect(result.events).toHaveLength(1);
    const event = result.events[0];
    
    // Checks that fallback venue is created dynamically
    expect(event.venueId).toBe("mystery-stage");
    expect(event.hasLocation).toBe(false);
    expect(event.lat).toBeUndefined();
    
    // Check that this venue is added to venues list
    const venue = result.venues.find(v => v.id === "mystery-stage");
    expect(venue).toBeDefined();
    expect(venue?.name).toBe("Mystery Stage");
    expect(venue?.hasLocation).toBe(false);
  });
});
