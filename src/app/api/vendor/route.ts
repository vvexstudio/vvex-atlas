import { NextRequest, NextResponse } from "next/server";
import { getFestivalData } from "@/lib/festival-data";
import { adminDb } from "@/lib/firebase-admin";

function parseTimeToMin(timeStr: string): number {
  if (!timeStr) return -1;
  const clean = timeStr.replace(/\s+/g, "").toLowerCase();
  const match = clean.match(/^(\d{1,2})(?::(\d{2}))?([ap]m)?$/);
  if (!match) return -1;
  let h = Number(match[1]);
  const m = Number(match[2] || "0");
  const p = match[3];
  if (p === "pm" && h < 12) h += 12;
  if (p === "am" && h === 12) h = 0;
  return h * 60 + m;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing vendor access token" }, { status: 400 });
  }

  let vendorScope: {
    vendorName?: string;
    department?: string;
    departments?: string[];
    eventIds?: string[];
    locations?: string[];
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    keyword?: string;
  } = {
    vendorName: token,
    department: token,
  };

  if (adminDb) {
    try {
      const snapshot = await adminDb.ref(`crew-data/vendor-tokens/${token}`).once("value");
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.revoked) {
          return NextResponse.json({ error: "Vendor magic link token has been revoked" }, { status: 410 });
        }
        vendorScope = data;
      }
    } catch (e) {
      console.warn("Failed to lookup vendor token in RTDB:", e);
    }
  }

  const festivalData = await getFestivalData("crew");

  const eventIds = Array.isArray(vendorScope.eventIds) ? vendorScope.eventIds : [];
  const locations = Array.isArray(vendorScope.locations)
    ? vendorScope.locations.map((l) => l.toLowerCase().trim()).filter(Boolean)
    : [];
  const startDate = vendorScope.startDate?.trim() || "";
  const endDate = vendorScope.endDate?.trim() || "";
  const startTimeMin = parseTimeToMin(vendorScope.startTime || "");
  const endTimeMin = parseTimeToMin(vendorScope.endTime || "");
  const customKeyword = vendorScope.keyword?.toLowerCase().trim() || "";

  const hasSpecificEventIds = eventIds.length > 0;
  const hasSpecificLocations = locations.length > 0;
  const hasDateRange = Boolean(startDate || endDate);
  const hasTimeRange = startTimeMin !== -1 || endTimeMin !== -1;

  // Extract department queries
  let rawQueryStrings: string[] = [];
  if (Array.isArray(vendorScope.departments) && vendorScope.departments.length > 0) {
    rawQueryStrings = [...vendorScope.departments];
  } else if (!hasSpecificEventIds && !hasSpecificLocations && !hasDateRange && !hasTimeRange) {
    // Only fall back to department/vendorName string if NO granular filters are specified
    const rawTarget = vendorScope.department || vendorScope.vendorName || token;
    rawQueryStrings = rawTarget.split(",");
  }

  if (customKeyword) {
    rawQueryStrings.push(customKeyword);
  }

  const targetQueries = rawQueryStrings
    .map((q) => q.toLowerCase().trim())
    .filter(Boolean);

  const isAllDepts =
    targetQueries.some((q) => {
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
    }) ||
    (Array.isArray(vendorScope.departments) &&
      vendorScope.departments.some((d: string) => {
        const clean = String(d || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        return clean === "all" || clean === "alldepartments" || clean === "*";
      }));

  const matchingEvents = festivalData.events.filter((e) => {
    // 1. Explicit Event-ID Checkbox Filter
    if (hasSpecificEventIds) {
      const eId = (e.id || "").toLowerCase().trim();
      const eIdNum = eId.replace(/^event-/, "");
      const matchesId = eventIds.some((id) => {
        const cleanTarget = (id || "").toLowerCase().trim();
        const targetNum = cleanTarget.replace(/^event-/, "");
        return eId === cleanTarget || eIdNum === targetNum || e.id === id;
      });
      if (!matchesId) return false;
    }

    // 2. Explicit Location Filter
    if (hasSpecificLocations) {
      const eLoc = (e.locationName || "").toLowerCase().trim();
      const matchesLoc = locations.some((loc) => eLoc.includes(loc) || loc.includes(eLoc));
      if (!matchesLoc) return false;
    }

    // 3. Date Range Filter
    if (hasDateRange) {
      const eDate = e.scheduleDate || "";
      if (startDate && eDate && eDate < startDate) return false;
      if (endDate && eDate && eDate > endDate) return false;
    }

    // 4. Time Window Filter
    if (hasTimeRange) {
      const eStartMin = parseTimeToMin(e.startTime);
      if (eStartMin !== -1) {
        if (startTimeMin !== -1 && endTimeMin !== -1 && startTimeMin > endTimeMin) {
          // Overnight window (e.g. 22:00 to 06:00)
          const inWindow = eStartMin >= startTimeMin || eStartMin <= endTimeMin;
          if (!inWindow) return false;
        } else {
          if (startTimeMin !== -1 && eStartMin < startTimeMin) return false;
          if (endTimeMin !== -1 && eStartMin > endTimeMin) return false;
        }
      }
    }

    // If specific Event IDs, Locations, or Date/Time ranges matched and no extra department/keyword constraints exist, keep event
    if ((hasSpecificEventIds || hasSpecificLocations || hasDateRange || hasTimeRange) && targetQueries.length === 0) {
      return true;
    }

    // 5. Department / Keyword Query Filter
    if (isAllDepts) return true;
    if (targetQueries.length === 0) return true;

    const eDept = (e.department || "").toLowerCase();
    const eSuppDept1 = (e.supportDept1 || "").toLowerCase();
    const eSuppDept2 = (e.supportDept2 || "").toLowerCase();
    const eLead = (e.leadPointPerson || "").toLowerCase();
    const eSuppPerson1 = (e.supportPerson1 || "").toLowerCase();
    const eSuppPerson2 = (e.supportPerson2 || "").toLowerCase();
    const eTitle = (e.title || "").toLowerCase();
    const eDesc = (e.description || "").toLowerCase();
    const eHost = (e.host || "").toLowerCase();
    const eCategory = (e.scheduleCategory || "").toLowerCase();
    const eAction = ((e as any).action || "").toLowerCase();
    const eLocation = (e.locationName || "").toLowerCase();

    return targetQueries.some((q) => {
      if (!q) return false;

      if (eDept && (eDept.includes(q) || q.includes(eDept))) return true;
      if (eSuppDept1 && (eSuppDept1.includes(q) || q.includes(eSuppDept1))) return true;
      if (eSuppDept2 && (eSuppDept2.includes(q) || q.includes(eSuppDept2))) return true;
      if (eLead && (eLead.includes(q) || q.includes(eLead))) return true;
      if (eSuppPerson1 && (eSuppPerson1.includes(q) || q.includes(eSuppPerson1))) return true;
      if (eSuppPerson2 && (eSuppPerson2.includes(q) || q.includes(eSuppPerson2))) return true;
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
            eSuppDept1.includes(w) ||
            eSuppDept2.includes(w) ||
            eLead.includes(w) ||
            eSuppPerson1.includes(w) ||
            eSuppPerson2.includes(w) ||
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

  return NextResponse.json({
    vendorName: isAllDepts
      ? "All Departments"
      : hasSpecificEventIds
      ? `${matchingEvents.length} Pinned Events`
      : vendorScope.vendorName || token,
    timezone: `America/Los_Angeles (${process.env.NEXT_PUBLIC_EVENT_TIMEZONE || "PDT"})`,
    eventCount: matchingEvents.length,
    events: matchingEvents,
    venues: festivalData.venues || [],
    departments: festivalData.departments || [],
    personnel: festivalData.personnel || [],
    colors: festivalData.colors || {},
    dataSourceLabel: festivalData.sourceLabel,
  });
}
