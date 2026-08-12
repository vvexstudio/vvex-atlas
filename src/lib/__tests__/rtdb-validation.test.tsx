// @vitest-environment happy-dom
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useEventData } from "../../hooks/useEventData";

let mockOnValueCallback: any = null;
vi.mock("firebase/database", () => {
  return {
    ref: vi.fn(),
    onValue: vi.fn((ref, callback) => {
      mockOnValueCallback = callback;
      return vi.fn(); // Unsubscribe mock function
    }),
  };
});

vi.mock("@/lib/firebase-client", () => {
  return {
    clientDb: {},
    clientAuth: null,
  };
});

describe("useEventData hook RTDB robustness tests", () => {
  let container: HTMLDivElement | null = null;
  let hookResult: any = null;

  const initialData = {
    venues: [
      {
        id: "v1",
        name: "Initial Venue",
        label: "Location",
        mapLabel: "v1",
        x: 0,
        y: 0,
        lat: 10,
        lng: 10,
        hasLocation: true,
        shortDescription: "Initial Venue",
        description: "Initial Venue",
        thumbnailUrl: "",
        accent: "#6b7280",
      },
    ],
    events: [],
    personnel: [],
    departments: [],
  };

  function TestWrapper({ role }: { role: string | null }) {
    const res = useEventData(role, initialData);
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
    mockOnValueCallback = null;
  });

  it("should initialize with initialData and remain stable without active user role", () => {
    act(() => {
      const root = createRoot(container!);
      root.render(<TestWrapper role={null} />);
    });

    expect(hookResult.venues).toHaveLength(1);
    expect(hookResult.venues[0].name).toBe("Initial Venue");
    expect(hookResult.sourceLabel).toBe("Static Init");
  });

  it("should update hook state when database triggers with valid payload", () => {
    act(() => {
      const root = createRoot(container!);
      root.render(<TestWrapper role="admin" />);
    });

    expect(mockOnValueCallback).toBeDefined();

    act(() => {
      mockOnValueCallback({
        exists: () => true,
        val: () => ({
          venues: [
            {
              id: "v2",
              name: "Updated Venue",
              label: "Location",
              mapLabel: "v2",
              x: 0,
              y: 0,
              lat: 20,
              lng: 20,
              hasLocation: true,
              shortDescription: "Updated Venue",
              description: "Updated Venue",
              thumbnailUrl: "",
              accent: "#6b7280",
            },
          ],
          events: [],
          personnel: [],
          departments: [],
        }),
      });
    });

    expect(hookResult.venues).toHaveLength(1);
    expect(hookResult.venues[0].name).toBe("Updated Venue");
    expect(hookResult.sourceLabel).toBe("Firebase RTD Live (ADMIN)");
  });

  it("should ignore invalid/partial database updates gracefully without throwing", () => {
    act(() => {
      const root = createRoot(container!);
      root.render(<TestWrapper role="admin" />);
    });

    // Send null val update (when DB node doesn't exist, exists() returns false)
    expect(() => {
      act(() => {
        mockOnValueCallback({
          exists: () => false,
          val: () => null,
        });
      });
    }).not.toThrow();

    // Send empty payload update
    expect(() => {
      act(() => {
        mockOnValueCallback({
          exists: () => true,
          val: () => ({}),
        });
      });
    }).not.toThrow();
  });
});
