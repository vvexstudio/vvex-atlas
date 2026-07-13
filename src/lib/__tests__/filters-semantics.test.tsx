// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useFilters } from "../../hooks/useFilters";
import { FestivalEvent, Venue } from "@/types/festival";

describe("useFilters - event filtering semantics", () => {
  let container: HTMLDivElement | null = null;
  let hookResult: any = null;

  const mockEvents: FestivalEvent[] = [
    {
      id: "e1",
      title: "Music Show",
      description: "Live concert in the forest",
      startTime: "10:00",
      endTime: "12:00",
      day: "sun",
      scheduleDate: "2026-08-23",
      type: "music",
      hasLocation: true,
      venueId: "forest",
      locationName: "Forest",
      department: "Production",
      leadPointPerson: "Alice",
      source: "schedule",
      action: "Show",
    },
    {
      id: "e2",
      title: "Food Truck Setup",
      description: "Setting up catering area",
      startTime: "11:00",
      endTime: "13:00",
      day: "sun",
      scheduleDate: "2026-08-23",
      type: "food",
      hasLocation: true,
      venueId: "catering-area",
      locationName: "Catering Area",
      department: "Catering",
      leadPointPerson: "Bob",
      source: "schedule",
      action: "Setup",
    },
  ];

  const mockVenues: Venue[] = [
    { id: "forest", name: "Forest", label: "Location", mapLabel: "Forest", x: 0, y: 0, lat: 43, lng: 11, hasLocation: true },
    { id: "catering-area", name: "Catering Area", label: "Location", mapLabel: "Catering Area", x: 0, y: 0, lat: 43, lng: 11, hasLocation: true },
  ];

  function TestWrapper({ events, venues }: { events: FestivalEvent[]; venues: Venue[] }) {
    hookResult = useFilters({ events, venues, mapCenter: { lat: 0, lng: 0 } });
    return null;
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container) {
      document.body.removeChild(container);
      container = null;
    }
    hookResult = null;
  });

  it("should return all events when no filters are set", () => {
    act(() => {
      const root = createRoot(container!);
      root.render(<TestWrapper events={mockEvents} venues={mockVenues} />);
    });

    expect(hookResult.filteredEvents).toHaveLength(2);
  });

  it("should filter events by search query (text matching)", () => {
    act(() => {
      const root = createRoot(container!);
      root.render(<TestWrapper events={mockEvents} venues={mockVenues} />);
    });

    act(() => {
      hookResult.setSearchQuery("concert");
    });
    expect(hookResult.filteredEvents).toHaveLength(1);
    expect(hookResult.filteredEvents[0].id).toBe("e1");

    act(() => {
      hookResult.setSearchQuery("catering");
    });
    expect(hookResult.filteredEvents).toHaveLength(1);
    expect(hookResult.filteredEvents[0].id).toBe("e2");
  });

  it("should filter events by selected departments", () => {
    act(() => {
      const root = createRoot(container!);
      root.render(<TestWrapper events={mockEvents} venues={mockVenues} />);
    });

    act(() => {
      hookResult.setSelectedDepartments(["Catering"]);
    });
    expect(hookResult.filteredEvents).toHaveLength(1);
    expect(hookResult.filteredEvents[0].id).toBe("e2");
  });

  it("should apply multiple category filters as AND (intersection)", () => {
    act(() => {
      const root = createRoot(container!);
      root.render(<TestWrapper events={mockEvents} venues={mockVenues} />);
    });

    act(() => {
      hookResult.setSelectedLeads(["Bob"]);
      hookResult.setSelectedDepartments(["Production"]);
    });
    expect(hookResult.filteredEvents).toHaveLength(0);
  });
});
