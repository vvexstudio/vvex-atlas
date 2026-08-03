import { NextRequest, NextResponse } from "next/server";
import { getFestivalData } from "@/lib/festival-data";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing vendor access token" }, { status: 400 });
  }

  let vendorScope: { vendorName?: string; department?: string; email?: string } = {
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
  
  // Extract search terms (handles array or comma-separated multi-department queries)
  let rawQueryStrings: string[] = [];
  if (Array.isArray((vendorScope as any).departments) && (vendorScope as any).departments.length > 0) {
    rawQueryStrings = (vendorScope as any).departments;
  } else {
    const rawTarget = vendorScope.department || vendorScope.vendorName || token;
    rawQueryStrings = rawTarget.split(",");
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
    (Array.isArray((vendorScope as any).departments) &&
      (vendorScope as any).departments.some((d: string) => {
        const clean = String(d || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        return clean === "all" || clean === "alldepartments" || clean === "*";
      }));

  const matchingEvents = festivalData.events.filter((e) => {
    if (isAllDepts) return true;

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

      // 1. Direct or inverse substring matches
      if (eDept && (eDept.includes(q) || q.includes(eDept))) return true;
      if (eLead && (eLead.includes(q) || q.includes(eLead))) return true;
      if (eTitle && (eTitle.includes(q) || q.includes(eTitle))) return true;
      if (eDesc && eDesc.includes(q)) return true;
      if (eHost && (eHost.includes(q) || q.includes(eHost))) return true;
      if (eCategory && (eCategory.includes(q) || q.includes(eCategory))) return true;
      if (eAction && (eAction.includes(q) || q.includes(eAction))) return true;
      if (eLocation && (eLocation.includes(q) || q.includes(eLocation))) return true;

      // 2. Tokenized word matching for multi-word queries like "Heavy Equipment (WonderBros)"
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

  return NextResponse.json({
    vendorName: isAllDepts ? "All Departments" : (vendorScope.vendorName || token),
    timezone: "America/Los_Angeles (PDT)",
    eventCount: matchingEvents.length,
    events: matchingEvents,
    venues: festivalData.venues || [],
    departments: festivalData.departments || [],
    personnel: festivalData.personnel || [],
    colors: festivalData.colors || {},
    dataSourceLabel: festivalData.sourceLabel,
  });
}
