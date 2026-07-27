import { describe, it, expect } from "vitest";
import { validateFestivalData } from "../schema-lint";
import type { FestivalEvent, Venue } from "@/types/festival";

describe("validateFestivalData schema linter", () => {
  it("should flag unmapped locations as errors", () => {
    const venues: Venue[] = [
      {
        id: "v1",
        name: "Main Stage",
        label: "Venue",
        mapLabel: "Main Stage",
        shortDescription: "",
        description: "",
        x: 0,
        y: 0,
        lat: 40.0,
        lng: -119.0,
        hasLocation: true,
        thumbnailUrl: "",
        accent: "#8b5cf6",
        permanence: "venue",
      },
    ];

    const events: FestivalEvent[] = [
      {
        id: "e1",
        venueId: "v1",
        title: "Opening Ceremony",
        host: "Portal Crew",
        description: "",
        day: "fri",
        startTime: "12:00",
        endTime: "14:00",
        type: "ceremony",
        thumbnailUrl: "",
        hasLocation: true,
        scheduleDate: "2026-08-24",
        locationName: "Mystic Forest", // Unmapped location
      },
    ];

    const report = validateFestivalData(events, venues, [], []);
    expect(report.issueCounts.errors).toBe(1);
    expect(report.issues[0].category).toBe("location");
    expect(report.issues[0].message).toContain("Mystic Forest");
  });

  it("should detect duplicate events", () => {
    const events: FestivalEvent[] = [
      {
        id: "e1",
        venueId: "v1",
        title: "Sunset Set",
        host: "DJ",
        description: "",
        day: "fri",
        startTime: "18:00",
        endTime: "20:00",
        type: "music",
        thumbnailUrl: "",
        hasLocation: true,
        scheduleDate: "2026-08-24",
        locationName: "Main Stage",
      },
      {
        id: "e2",
        venueId: "v1",
        title: "Sunset Set",
        host: "DJ",
        description: "",
        day: "fri",
        startTime: "18:00",
        endTime: "20:00",
        type: "music",
        thumbnailUrl: "",
        hasLocation: true,
        scheduleDate: "2026-08-24",
        locationName: "Main Stage",
      },
    ];

    const report = validateFestivalData(events, [], [], []);
    expect(report.issueCounts.warnings).toBeGreaterThanOrEqual(1);
    const dupIssue = report.issues.find((i) => i.category === "duplicate");
    expect(dupIssue).toBeDefined();
    expect(dupIssue?.message).toContain("Duplicate event detected");
  });
});
