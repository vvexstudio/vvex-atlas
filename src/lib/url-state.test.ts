import { describe, it, expect } from "vitest";
import { parseUrlParams, buildUrlQuery, UrlState } from "./url-state";

describe("url-state helper tests", () => {
  describe("parseUrlParams", () => {
    it("should parse empty params into empty state", () => {
      const params = new URLSearchParams("");
      const state = parseUrlParams(params);
      expect(state).toEqual({
        view: undefined,
        day: undefined,
        eventId: undefined,
        query: undefined,
        locations: [],
        actions: [],
        departments: [],
        leads: [],
        mySchedule: false,
      });
    });

    it("should parse scalar strings and integers", () => {
      const params = new URLSearchParams("v=calendar&d=2026-08-24&e=evt_101&q=lunch");
      const state = parseUrlParams(params);
      expect(state.view).toBe("calendar");
      expect(state.day).toBe("2026-08-24");
      expect(state.eventId).toBe("evt_101");
      expect(state.query).toBe("lunch");
    });

    it("should parse comma separated list arrays", () => {
      const params = new URLSearchParams("loc=HQ,Mess%20Hall&act=Meeting,Meal&dept=ATPF,Rigging&lead=Alice,Bob");
      const state = parseUrlParams(params);
      expect(state.locations).toEqual(["HQ", "Mess Hall"]);
      expect(state.actions).toEqual(["Meeting", "Meal"]);
      expect(state.departments).toEqual(["ATPF", "Rigging"]);
      expect(state.leads).toEqual(["Alice", "Bob"]);
    });

    it("should parse personal agenda starred toggle option", () => {
      const params = new URLSearchParams("my=1");
      const state = parseUrlParams(params);
      expect(state.mySchedule).toBe(true);
    });
  });

  describe("buildUrlQuery", () => {
    it("should return empty query string for empty state object", () => {
      const state: UrlState = {};
      const query = buildUrlQuery(state);
      expect(query).toBe("");
    });

    it("should serialize scalar string inputs correctly", () => {
      const state: UrlState = {
        view: "now-next",
        day: "2026-08-25",
        eventId: "event_102",
        query: "rigging",
      };
      const query = buildUrlQuery(state);
      expect(query).toContain("v=now-next");
      expect(query).toContain("d=2026-08-25");
      expect(query).toContain("e=event_102");
      expect(query).toContain("q=rigging");
    });

    it("should serialize list array values as comma separated items", () => {
      const state: UrlState = {
        locations: ["Main Stage", "Front Gate"],
        actions: ["Briefing"],
      };
      const query = buildUrlQuery(state);
      expect(query).toContain("loc=Main+Stage%2CFront+Gate");
      expect(query).toContain("act=Briefing");
    });

    it("should serialize boolean mySchedule option as 1 value", () => {
      const state: UrlState = {
        mySchedule: true,
      };
      const query = buildUrlQuery(state);
      expect(query).toBe("?my=1");
    });
  });
});
