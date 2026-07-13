import { describe, it, expect } from "vitest";
import { parseCsv } from "../csv";

describe("parseCsv utility", () => {
  it("should parse standard comma-separated rows", () => {
    const csv = "name,role,department\nAlice,admin,Lighting\nBob,crew,Catering";
    const result = parseCsv(csv);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: "Alice", role: "admin", department: "Lighting" });
    expect(result[1]).toEqual({ name: "Bob", role: "crew", department: "Catering" });
  });

  it("should handle spaces and normalize header names to lowercase and underscores", () => {
    const csv = "  Full Name  ,  Role Title  \nAlice,admin";
    const result = parseCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ full_name: "Alice", role_title: "admin" });
  });

  it("should handle quoted fields with commas", () => {
    const csv = 'name,role,departments\nAlice,admin,"Lighting, Catering, Rigging"';
    const result = parseCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].departments).toBe("Lighting, Catering, Rigging");
  });

  it("should handle empty fields gracefully", () => {
    const csv = "name,role,department\nAlice,,Lighting";
    const result = parseCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: "Alice", role: "", department: "Lighting" });
  });
});
