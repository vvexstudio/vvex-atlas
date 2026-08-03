import { NextRequest, NextResponse } from "next/server";
import { getFestivalData } from "@/lib/festival-data";
import { adminDb } from "@/lib/firebase-admin";

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

function escapeIcalText(str: string): string {
  if (!str) return "";
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

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

  const festivalData = await getFestivalData("crew");
  let events = festivalData.events;

  if (tokenDeptScope) {
    const targetQueries = tokenDeptScope
      .split(",")
      .map((d) => d.toLowerCase().trim())
      .filter(Boolean);

    const isAllDepts = targetQueries.some((q) => {
      const clean = q.replace(/[^a-z0-9]/g, "");
      return (
        clean === "all" ||
        clean === "alldepartments" ||
        clean.startsWith("alldepartments") ||
        q === "*" ||
        q === "everyone" ||
        q === "master" ||
        q === "inclusive"
      );
    });

    if (!isAllDepts) {
      events = events.filter((e) => {
        const eDept = (e.department || "").toLowerCase();
        const eLead = (e.leadPointPerson || "").toLowerCase();
        const eTitle = (e.title || "").toLowerCase();
        const eDesc = (e.description || "").toLowerCase();
        const eHost = (e.host || "").toLowerCase();
        const eCategory = (e.scheduleCategory || "").toLowerCase();
        const eAction = ((e as any).action || "").toLowerCase();
        const eLocation = (e.locationName || "").toLowerCase();

        return targetQueries.some((q) => {
          if (!q) return false;

          if (eDept && (eDept.includes(q) || q.includes(eDept))) return true;
          if (eLead && (eLead.includes(q) || q.includes(eLead))) return true;
          if (eTitle && (eTitle.includes(q) || q.includes(eTitle))) return true;
          if (eDesc && eDesc.includes(q)) return true;
          if (eHost && (eHost.includes(q) || q.includes(eHost))) return true;
          if (eCategory && (eCategory.includes(q) || q.includes(eCategory))) return true;
          if (eAction && (eAction.includes(q) || q.includes(eAction))) return true;
          if (eLocation && (eLocation.includes(q) || q.includes(eLocation))) return true;

          const queryWords = q.split(/[^a-z0-9]+/i).filter((w) => w.length > 2);
          if (queryWords.length > 0) {
            return queryWords.some(
              (w) =>
                eDept.includes(w) ||
                eLead.includes(w) ||
                eTitle.includes(w) ||
                eDesc.includes(w) ||
                eHost.includes(w) ||
                eCategory.includes(w) ||
                eAction.includes(w) ||
                eLocation.includes(w)
            );
          }

          return false;
        });
      });
    }
  }

  const isAllDeptsFeed = !tokenDeptScope || tokenDeptScope.split(",").some((q) => {
    const clean = q.toLowerCase().replace(/[^a-z0-9]/g, "");
    return clean === "all" || clean === "alldepartments" || clean === "*" || clean === "everyone" || clean === "master" || clean === "inclusive";
  });

  const calName = isAllDeptsFeed
    ? "The Portal - Master Schedule (All Departments)"
    : `The Portal - ${tokenDeptScope} Schedule`;

  const icsLines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Portal//Black Rock City Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${calName}`,
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
    const dtStart = parseTimeToIcalFormat(e.scheduleDate, e.startTime, 9);
    const dtEnd = parseTimeToIcalFormat(
      e.scheduleDate,
      e.endTime || e.startTime,
      10
    );

    const summary = escapeIcalText(e.title || "Portal Event");
    const location = escapeIcalText(e.locationName || "Black Rock City");
    const description = escapeIcalText(
      e.description || (e.department ? `Department: ${e.department}` : "The Portal Schedule")
    );

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
