import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebase-admin";
import { isRequestAdminAuthorized } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    if (!(await isRequestAdminAuthorized(cookieStore))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      token,
      vendorName,
      departments,
      eventIds,
      locations,
      startDate,
      endDate,
      startTime,
      endTime,
      keyword,
    } = body;

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    if (adminDb) {
      await adminDb.ref(`crew-data/vendor-tokens/${token}`).set({
        token,
        vendorName: vendorName || (Array.isArray(departments) ? departments.join(", ") : departments) || token,
        department: Array.isArray(departments) ? departments.join(", ") : departments || token,
        departments: Array.isArray(departments) ? departments : [departments || token],
        eventIds: Array.isArray(eventIds) ? eventIds : [],
        locations: Array.isArray(locations) ? locations : [],
        startDate: startDate || "",
        endDate: endDate || "",
        startTime: startTime || "",
        endTime: endTime || "",
        keyword: keyword || "",
        createdAt: new Date().toISOString(),
        revoked: false,
      });
    }

    return NextResponse.json({ success: true, token });
  } catch (error: any) {
    console.error("Failed to persist vendor token:", error);
    return NextResponse.json({ error: error.message || "Failed to persist vendor token" }, { status: 500 });
  }
}
