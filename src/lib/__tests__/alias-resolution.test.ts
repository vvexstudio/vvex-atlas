import { describe, it, expect } from "vitest";
import { parseSpreadsheetData } from "../event-mapper";

describe("parseSpreadsheetData - Canonical Alias Resolution", () => {
  it("should resolve location aliases to canonical location names and coordinates", () => {
    const locationsData = [
      {
        Location: "Main Stage",
        Aliases: "Stage 1 | Big Tent, Sunset Arena",
        Lat: "43.05",
        Long: "11.54",
        Category: "Venue",
      },
    ];

    const rosData = [
      {
        Action: "Sound Check",
        Description: "Band A Rehearsal",
        Location: "Stage 1",
        "Start Day": "2026-08-23",
        Start: "09:00",
        Department: "Sound",
        "Lead Point Person": "Vince",
      },
    ];

    const personnelData = [
      {
        Name: "Vincent Naples",
        Aliases: "Vince | V-Nap",
        Department: "Audio",
      },
    ];

    const departmentsData = [
      {
        Department: "Audio",
        Aliases: "Sound | A/V",
        google_calendar_id: "cal-audio@group.calendar.google.com",
      },
    ];

    const actionsData = [
      {
        Action: "Sound Check",
        Aliases: "Rehearsal | Audio Test",
      },
    ];

    const { venues, events } = parseSpreadsheetData(
      locationsData,
      rosData,
      personnelData,
      departmentsData,
      actionsData
    );

    // 1. Should not create duplicate unmapped venues
    expect(venues).toHaveLength(1);
    expect(venues[0].name).toBe("Main Stage");

    // 2. Event location should resolve alias "Stage 1" to canonical "Main Stage" with coordinates
    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.locationName).toBe("Main Stage");
    expect(ev.venueId).toBe("main-stage");
    expect(ev.lat).toBe(43.05);
    expect(ev.lng).toBe(11.54);
    expect(ev.hasLocation).toBe(true);

    // 3. Event department should resolve alias "Sound" to canonical "Audio"
    expect(ev.department).toBe("Audio");

    // 4. Event lead person should resolve alias "Vince" to canonical "Vincent Naples"
    expect(ev.leadPointPerson).toBe("Vincent Naples");

    // 5. Event action should resolve "Sound Check"
    expect(ev.action).toBe("Sound Check");
  });

  it("should perform case-insensitive and space/punctuation-insensitive alias resolution", () => {
    const locationsData = [
      {
        Location: "Main Stage",
        Aliases: "Stage 1 | Big-Tent",
        Lat: "43.05",
        Long: "11.54",
      },
    ];

    const rosData = [
      {
        Action: "audio test",
        Description: "Rehearsal",
        Location: "STAGE 1", // All caps
        Department: "a/v", // Lowercase with slash
        "Lead Point Person": "VINCE", // All caps
      },
      {
        Action: "rehearsal",
        Description: "Second Sound Check",
        Location: "big tent", // Lowercase & space variations
        Department: "sound",
        "Lead Point Person": "v-nap",
      },
    ];

    const personnelData = [
      { Name: "Vincent Naples", Aliases: "Vince | V-Nap" },
    ];

    const departmentsData = [
      { Department: "Audio", Aliases: "Sound | A/V" },
    ];

    const actionsData = [
      { Action: "Sound Check", Aliases: "Rehearsal | Audio Test" },
    ];

    const { events } = parseSpreadsheetData(
      locationsData,
      rosData,
      personnelData,
      departmentsData,
      actionsData
    );

    expect(events).toHaveLength(2);

    // Row 1: "STAGE 1" -> "Main Stage", "a/v" -> "Audio", "VINCE" -> "Vincent Naples", "audio test" -> "Sound Check"
    expect(events[0].locationName).toBe("Main Stage");
    expect(events[0].venueId).toBe("main-stage");
    expect(events[0].department).toBe("Audio");
    expect(events[0].leadPointPerson).toBe("Vincent Naples");
    expect(events[0].action).toBe("Sound Check");

    // Row 2: "big tent" -> "Main Stage", "sound" -> "Audio", "v-nap" -> "Vincent Naples"
    expect(events[1].locationName).toBe("Main Stage");
    expect(events[1].department).toBe("Audio");
    expect(events[1].leadPointPerson).toBe("Vincent Naples");
  });

  it("should create fallback venue only when location and aliases fail to match", () => {
    const locationsData = [
      {
        Location: "Main Stage",
        Aliases: "Stage 1",
        Lat: "43.05",
        Long: "11.54",
      },
    ];

    const rosData = [
      {
        Action: "Setup",
        Description: "Info Kiosk Setup",
        Location: "Unknown Gate",
        "Start Day": "2026-08-23",
        Start: "10:00",
      },
    ];

    const { venues, events } = parseSpreadsheetData(
      locationsData,
      rosData,
      [],
      []
    );

    // Should contain original location + 1 dynamic fallback venue
    expect(venues).toHaveLength(2);
    const fallback = venues.find((v) => v.id === "unknown-gate");
    expect(fallback).toBeDefined();
    expect(fallback?.hasLocation).toBe(false);
    expect(events[0].locationName).toBe("Unknown Gate");
  });
});
