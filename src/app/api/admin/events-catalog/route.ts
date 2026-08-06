import { NextResponse } from "next/server";
import { getFestivalData } from "@/lib/festival-data";

export async function GET() {
  try {
    const festivalData = await getFestivalData("crew");
    
    // 1. Process distinct departments
    const deptSet = new Set<string>();
    (festivalData.departments || []).forEach((d: any) => {
      const name = d.department || d.Department || d.dept || d.name;
      if (name && typeof name === "string") {
        const trimmed = name.trim();
        if (trimmed) deptSet.add(trimmed);
      }
    });

    // 2. Process distinct locations
    const locationSet = new Set<string>();
    (festivalData.venues || []).forEach((v: any) => {
      if (v.name && typeof v.name === "string") {
        locationSet.add(v.name.trim());
      }
    });

    // 3. Process events catalog
    const eventsCatalog = (festivalData.events || []).map((e) => {
      if (e.department) {
        e.department.split(",").forEach((d) => {
          const trimmed = d.trim();
          if (trimmed) deptSet.add(trimmed);
        });
      }
      if (e.locationName) {
        locationSet.add(e.locationName.trim());
      }

      return {
        id: e.id,
        title: e.title,
        department: e.department || "",
        locationName: e.locationName || "",
        day: e.day || "",
        scheduleDate: e.scheduleDate || "",
        startTime: e.startTime || "",
        endTime: e.endTime || "",
        host: e.host || "",
      };
    });

    const departments = Array.from(deptSet).sort((a, b) => a.localeCompare(b));
    const locations = Array.from(locationSet).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      departments,
      locations,
      events: eventsCatalog,
    });
  } catch (error: any) {
    console.error("Failed to fetch events catalog:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch events catalog" }, { status: 500 });
  }
}
