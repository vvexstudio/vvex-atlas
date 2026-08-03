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

  const festivalData = await getFestivalData("public");
  
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

  const matchingEvents = festivalData.events.filter((e) => {
    const eDept = e.department ? e.department.toLowerCase() : "";
    const eLead = e.leadPointPerson ? e.leadPointPerson.toLowerCase() : "";
    const eTitle = e.title ? e.title.toLowerCase() : "";

    return targetQueries.some((q) => eDept.includes(q) || eLead.includes(q) || eTitle.includes(q));
  });

  return NextResponse.json({
    vendorName: vendorScope.vendorName || token,
    timezone: "America/Los_Angeles (PDT)",
    eventCount: matchingEvents.length,
    events: matchingEvents,
  });
}
