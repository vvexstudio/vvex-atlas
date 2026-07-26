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
  const targetQuery = (vendorScope.vendorName || vendorScope.department || token).toLowerCase().trim();

  const matchingEvents = festivalData.events.filter((e) => {
    const deptMatch = e.department ? e.department.toLowerCase().includes(targetQuery) : false;
    const leadMatch = e.leadPointPerson ? e.leadPointPerson.toLowerCase().includes(targetQuery) : false;
    const titleMatch = e.title ? e.title.toLowerCase().includes(targetQuery) : false;
    return deptMatch || leadMatch || titleMatch;
  });

  return NextResponse.json({
    vendorName: vendorScope.vendorName || token,
    timezone: "America/Los_Angeles (PDT)",
    eventCount: matchingEvents.length,
    events: matchingEvents,
  });
}
