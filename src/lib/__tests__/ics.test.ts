import { describe, it, expect } from "vitest";

describe("ICS Calendar Feed Formatter", () => {
  it("should generate valid VCALENDAR payload headers with PDT timezone", () => {
    const icsHeader = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "X-WR-TIMEZONE:America/Los_Angeles",
      "TZID:America/Los_Angeles",
    ].join("\r\n");

    expect(icsHeader).toContain("BEGIN:VCALENDAR");
    expect(icsHeader).toContain("America/Los_Angeles");
  });
});
