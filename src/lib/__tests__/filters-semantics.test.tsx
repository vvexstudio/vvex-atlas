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
      host: "Production",
      thumbnailUrl: "",
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
      host: "Catering",
      thumbnailUrl: "",
    },
  ];

  const mockVenues: Venue[] = [
    {
      id: "forest",
      name: "Forest",
      label: "Location",
      mapLabel: "Forest",
      x: 0,
      y: 0,
      lat: 43,
      lng: 11,
      hasLocation: true,
      shortDescription: "Forest area",
      description: "Forest area",
      thumbnailUrl: "",
      accent: "#6b7280",
    },
    {
      id: "catering-area",
      name: "Catering Area",
      label: "Location",
      mapLabel: "Catering Area",
      x: 0,
      y: 0,
      lat: 43,
      lng: 11,
      hasLocation: true,
      shortDescription: "Catering area",
      description: "Catering area",
      thumbnailUrl: "",
      accent: "#6b7280",
    },
  ];

  function TestWrapper({ events, venues }: { events: FestivalEvent[]; venues: Venue[] }) {
    const res = useFilters({ events, venues, mapCenter: { lat: 0, lng: 0 } });
    React.useEffect(() => {
      hookResult = res;
    });
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

  it("should split and filter comma-separated departments correctly", () => {
    const multiDeptEvents: FestivalEvent[] = [
      {
        id: "e3",
        title: "Rigging Setup",
        description: "Rigging lights on main stage",
        startTime: "12:00",
        endTime: "14:00",
        day: "sun",
        scheduleDate: "2026-08-23",
        type: "performance",
        hasLocation: true,
        venueId: "forest",
        locationName: "Forest",
        department: "Lighting, Rigging, Production",
        leadPointPerson: "Alice",
        source: "schedule",
        action: "Setup",
        host: "Production",
        thumbnailUrl: "",
      }
    ];

    act(() => {
      const root = createRoot(container!);
      root.render(<TestWrapper events={multiDeptEvents} venues={mockVenues} />);
    });

    // Check dropdown options
    expect(hookResult.departmentOptions).toContain("Lighting");
    expect(hookResult.departmentOptions).toContain("Rigging");
    expect(hookResult.departmentOptions).toContain("Production");

    // Check filtering
    act(() => {
      hookResult.setSelectedDepartments(["Rigging"]);
    });
    expect(hookResult.filteredEvents).toHaveLength(1);
    expect(hookResult.filteredEvents[0].id).toBe("e3");
  });

  it("should hide date-unassigned TBD events by default and show them when toggled off", () => {
    const unscheduledEvents: FestivalEvent[] = [
      {
        id: "scheduled-1",
        title: "Scheduled Show",
        startTime: "10:00",
        endTime: "11:00",
        day: "sun",
        scheduleDate: "2026-08-23",
        hasLocation: false,
        venueId: "",
        locationName: "",
        department: "Production",
        source: "schedule",
        thumbnailUrl: "",
      },
      {
        id: "unscheduled-1",
        title: "TBD Planning Session",
        startTime: "TBD",
        endTime: "TBD",
        day: "sun",
        scheduleDate: "Date TBD",
        hasLocation: false,
        venueId: "",
        locationName: "",
        department: "Production",
        source: "schedule",
        thumbnailUrl: "",
      },
      {
        id: "date-assigned-time-tbd",
        title: "All-Day Production Load-in",
        startTime: "TBD",
        endTime: "TBD",
        day: "sun",
        scheduleDate: "2026-08-23",
        hasLocation: false,
        venueId: "",
        locationName: "",
        department: "Production",
        source: "schedule",
        thumbnailUrl: "",
      },
    ];

    act(() => {
      const root = createRoot(container!);
      root.render(<TestWrapper events={unscheduledEvents} venues={mockVenues} />);
    });

    // Default: hideUnscheduled is true -> date-unassigned event is hidden, date-assigned items (even time TBD) remain
    expect(hookResult.hideUnscheduled).toBe(true);
    expect(hookResult.filteredEvents.map((e: FestivalEvent) => e.id)).toEqual(["scheduled-1", "date-assigned-time-tbd"]);

    // Toggle hideUnscheduled to false -> all events shown
    act(() => {
      hookResult.setHideUnscheduled(false);
    });
    expect(hookResult.filteredEvents).toHaveLength(3);
    expect(hookResult.filteredEvents.map((e: FestivalEvent) => e.id)).toContain("unscheduled-1");
  });
});
