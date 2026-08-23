import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebase-admin";
import { isRequestAdminAuthorized } from "@/lib/auth";
import { getFestivalData } from "@/lib/festival-data";
import { validateFestivalData } from "@/lib/schema-lint";

async function isAuthorized(): Promise<boolean> {
  const cookieStore = await cookies();
  return isRequestAdminAuthorized(cookieStore);
}

export async function GET() {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Gather festival data to inspect current state
  const festivalData = await getFestivalData("admin");
  const personnel = festivalData.personnel || [];
  const departments = festivalData.departments || [];

  // Run schema linter
  const linterReport = validateFestivalData(
    festivalData.events,
    festivalData.venues,
    personnel,
    departments
  );

  const firebaseHealth: {
    configured: boolean;
    active: boolean;
    heartbeat: {
      last_sync?: string;
      status?: string;
      last_error?: string | null;
      rows?: number;
    } | null;
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
  const onboardingFailures = personnel
    .filter((p: any) => p.invite_status && String(p.invite_status).toLowerCase().includes("fail"))
    .map((p: any) => ({
      email: p.email || "unknown",
      status: p.invite_status
    }));

  // Format personnel audit log
  const personnelLog = personnel.map((p: any) => {
    const rawActive = p.active ?? p.Active ?? p.status ?? true;
    const isActive = rawActive === true || String(rawActive).toLowerCase() === "true" || rawActive === 1;
    return {
      name: p.name || p.Name || "Unnamed",
      email: p.email || p.Email || "No Email",
      role: p.role || p.Role || p.department || p.Department || "Crew",
      department: p.department || p.Department || p.role || p.Role || "General",
      active: isActive,
      inviteStatus: p.invite_status || p.inviteStatus || (isActive ? "Active" : "Revoked"),
    };
  });

  return NextResponse.json({
    dataSource: festivalData.sourceLabel,
    firebase: firebaseHealth,
    linterReport,
    counts: {
      venues: festivalData.venues.length,
      events: festivalData.events.length,
      personnel: personnel.length,
      departments: departments.length
    },
    unmappedLocations: Array.from(unmappedLocations),
    onboardingFailures,
    personnelLog,
  });
}

