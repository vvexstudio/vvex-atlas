import { NextRequest, NextResponse } from "next/server";
import { getFestivalData } from "@/lib/festival-data";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const departmentFilter = searchParams.get("dept");

  let tokenDeptScope: string | null = departmentFilter;

  if (token) {
    if (adminDb) {
      try {
        const tokenSnapshot = await adminDb.ref(`crew-data/vendor-tokens/${token}`).once("value");
        if (tokenSnapshot.exists()) {
          const tokenData = tokenSnapshot.val();
          if (tokenData.revoked) {
            return new NextResponse("Calendar subscription token has been revoked.", { status: 410 });
          }
          if (tokenData.department || tokenData.departments) {
            tokenDeptScope = Array.isArray(tokenData.departments) ? tokenData.departments.join(",") : tokenData.department;
          }
        }
      } catch (e) {
        console.warn("Failed to check token status in RTDB:", e);
      }
    }
  }

  const festivalData = await getFestivalData("public");
  let events = festivalData.events;

  if (tokenDeptScope) {
    const depts = tokenDeptScope.split(",").map((d) => d.toLowerCase().trim()).filter(Boolean);
    events = events.filter((e) => {
      if (!e.department) return false;
      const eDept = e.department.toLowerCase();
      return depts.some((d) => eDept.includes(d));
    });
  }

  const icsLines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Portal//Black Rock City Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:The Portal - Run of Show (PDT)",
    "X-WR-TIMEZONE:America/Los_Angeles",
    "BEGIN:VTIMEZONE",
    "TZID:America/Los_Angeles",
    "X-LIC-LOCATION:America/Los_Angeles",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:-0800",
    "TZOFFSETTO:-0700",
    "TZNAME:PDT",
    "DTSTART:19700308T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:-0700",
    "TZOFFSETTO:-0800",
    "TZNAME:PST",
    "DTSTART:19701101T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  events.forEach((e) => {
    if (!e.startTime) return;
    const dateFormatted = (e.scheduleDate || "2026-08-24").replace(/-/g, "");
    const startTimeClean = e.startTime.replace(":", "") + "00";
    const endTimeClean = (e.endTime ? e.endTime.replace(":", "") : e.startTime.replace(":", "")) + "00";

    const dtStart = `${dateFormatted}T${startTimeClean}`;
    const dtEnd = `${dateFormatted}T${endTimeClean}`;

    const summary = (e.title || "Portal Event").replace(/\n/g, " ");
    const location = (e.locationName || "Black Rock City").replace(/\n/g, " ");
    const description = (e.description || `Department: ${e.department || "General"}`).replace(/\n/g, "\\n");

    icsLines.push(
      "BEGIN:VEVENT",
      `UID:event-${e.id || Math.random().toString(36).substring(2)}@theportal.is`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `DTSTART;TZID=America/Los_Angeles:${dtStart}`,
      `DTEND;TZID=America/Los_Angeles:${dtEnd}`,
      `SUMMARY:${summary}`,
      `LOCATION:${location}`,
      `DESCRIPTION:${description}`,
      "STATUS:CONFIRMED",
      "END:VEVENT"
    );
  });

  icsLines.push("END:VCALENDAR");

  const icsBody = icsLines.join("\r\n");

  return new NextResponse(icsBody, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="the-portal-schedule.ics"',
      "Cache-Control": "public, max-age=300",
    },
  });
}
