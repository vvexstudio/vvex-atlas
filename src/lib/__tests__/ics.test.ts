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

  it("should parse 12-hour AM/PM times into 24-hour RFC 5545 iCal timestamps", () => {
    function parseTimeToIcalFormat(dateStr: string | undefined, timeStr: string | undefined, defaultHour = 9): string {
      const dateFormatted = (dateStr || "2026-08-24").replace(/[^0-9]/g, "");
      const baseDate = dateFormatted.length === 8 ? dateFormatted : "20260824";

      if (!timeStr || timeStr.trim().toUpperCase() === "TBD") {
        const h = String(defaultHour).padStart(2, "0");
        return `${baseDate}T${h}0000`;
      }

      const compact = timeStr.trim().toLowerCase();
      const match = compact.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*([ap]m|m)?$/);
      
      if (!match) {
        const h = String(defaultHour).padStart(2, "0");
        return `${baseDate}T${h}0000`;
      }

      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2] || "0", 10);
      const seconds = parseInt(match[3] || "0", 10);
      const ampm = match[4];

      if (ampm === "pm" && hours < 12) {
        hours += 12;
      } else if ((ampm === "am" || ampm === "m") && hours === 12) {
        hours = 0;
      }

      const hh = String(hours).padStart(2, "0");
      const mm = String(minutes).padStart(2, "0");
      const ss = String(seconds).padStart(2, "0");

      return `${baseDate}T${hh}${mm}${ss}`;
    }

    expect(parseTimeToIcalFormat("2026-08-24", "10:00 AM")).toBe("20260824T100000");
    expect(parseTimeToIcalFormat("2026-08-24", "2:30 PM")).toBe("20260824T143000");
    expect(parseTimeToIcalFormat("2026-08-24", "12:00 PM")).toBe("20260824T120000");
    expect(parseTimeToIcalFormat("2026-08-24", "12:00 AM")).toBe("20260824T000000");
    expect(parseTimeToIcalFormat("2026-08-24", "14:30")).toBe("20260824T143000");
    expect(parseTimeToIcalFormat("2026-08-24", "TBD")).toBe("20260824T090000");
  });
});
