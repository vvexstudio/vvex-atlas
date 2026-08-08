import { describe, it, expect } from "vitest";
import { matchTabTitle } from "../google-sheets-api";

describe("matchTabTitle wildcard & fuzzy sheet tab resolver", () => {
  const mockSheetTitles = [
    "ROS by TIME - updated 08/08 DO NOT DELETE",
    "Locations - DO NOT DELETE",
    "Personnel - last update 08.08.26",
    "Departments DO NOT DELETE",
    "Actions - DO NOT DELETE",
    "Notes & Scratch",
  ];

  it("should match exact tab titles when identical", () => {
    expect(matchTabTitle("Locations", ["Locations", "Personnel"])).toBe("Locations");
    expect(matchTabTitle("ROS by TIME", ["ROS by TIME", "ROS by AREA"])).toBe("ROS by TIME");
  });

  it("should resolve wildcard patterns with trailing asterisk (*)", () => {
    expect(matchTabTitle("ROS by TIME*", mockSheetTitles)).toBe("ROS by TIME - updated 08/08 DO NOT DELETE");
    expect(matchTabTitle("Locations*", mockSheetTitles)).toBe("Locations - DO NOT DELETE");
    expect(matchTabTitle("Personnel*", mockSheetTitles)).toBe("Personnel - last update 08.08.26");
    expect(matchTabTitle("Departments*", mockSheetTitles)).toBe("Departments DO NOT DELETE");
    expect(matchTabTitle("Actions*", mockSheetTitles)).toBe("Actions - DO NOT DELETE");
  });

  it("should perform case-insensitive wildcard matching", () => {
    expect(matchTabTitle("ros by time*", mockSheetTitles)).toBe("ROS by TIME - updated 08/08 DO NOT DELETE");
    expect(matchTabTitle("LOCATIONS*", mockSheetTitles)).toBe("Locations - DO NOT DELETE");
  });

  it("should fall back to prefix match when no wildcard symbol is in pattern but title starts with pattern", () => {
    expect(matchTabTitle("ROS by TIME", mockSheetTitles)).toBe("ROS by TIME - updated 08/08 DO NOT DELETE");
    expect(matchTabTitle("Locations", mockSheetTitles)).toBe("Locations - DO NOT DELETE");
  });

  it("should fall back to clean base name when available titles list is empty or unmatched", () => {
    expect(matchTabTitle("ROS by TIME*", [])).toBe("ROS by TIME");
    expect(matchTabTitle("Locations*", ["Unrelated Tab"])).toBe("Locations");
    expect(matchTabTitle("Personnel*", undefined as any)).toBe("Personnel");
  });
});
