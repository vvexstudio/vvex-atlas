import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebase-admin";
import { verifySessionCookie, isAdminEmail } from "@/lib/auth";
import { getFestivalData } from "@/lib/festival-data";

async function isAuthorized(): Promise<boolean> {
  const cookieStore = await cookies();
  const hasAdminCookie = cookieStore.get("admin_access")?.value === "true";
  if (hasAdminCookie) return true;

  const sessionToken = cookieStore.get("portal_user_session")?.value;
  if (sessionToken) {
    const session = await verifySessionCookie(sessionToken);
    if (session && isAdminEmail(session.email)) {
      return true;
    }
  }
  return false;
}

export async function GET() {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Gather festival data to inspect current state
  const festivalData = await getFestivalData("admin");

  const firebaseHealth: {
    configured: boolean;
    active: boolean;
    heartbeat: any;
    heartbeatAgeSeconds: number | null;
  } = {
    configured: Boolean(adminDb),
    active: false,
    heartbeat: null,
    heartbeatAgeSeconds: null,
  };

  if (adminDb) {
    try {
      const hbSnapshot = await adminDb.ref("crew-data/metadata/heartbeat").once("value");
      if (hbSnapshot.exists()) {
        const hb = hbSnapshot.val();
        firebaseHealth.active = true;
        firebaseHealth.heartbeat = hb;
        if (hb.last_sync) {
          firebaseHealth.heartbeatAgeSeconds = Math.floor((Date.now() - new Date(hb.last_sync).getTime()) / 1000);
        }
      }
    } catch (e) {
      console.error("Failed to query Firebase heartbeat:", e);
    }
  }

  // Identify events with unmapped locations
  const venueNames = new Set(festivalData.venues.map(v => v.name.toLowerCase().trim()));
  const unmappedLocations = new Set<string>();
  festivalData.events.forEach(e => {
    if (e.locationName && !venueNames.has(e.locationName.toLowerCase().trim())) {
      unmappedLocations.add(e.locationName);
    }
  });

  // Identify failed invites
  const personnel = festivalData.personnel || [];
  const onboardingFailures = personnel
    .filter((p: any) => p.invite_status && String(p.invite_status).toLowerCase().includes("fail"))
    .map((p: any) => ({
      email: p.email || "unknown",
      status: p.invite_status
    }));

  return NextResponse.json({
    dataSource: festivalData.sourceLabel,
    firebase: firebaseHealth,
    counts: {
      venues: festivalData.venues.length,
      events: festivalData.events.length,
      personnel: personnel.length,
      departments: (festivalData.departments || []).length
    },
    unmappedLocations: Array.from(unmappedLocations),
    onboardingFailures
  });
}
