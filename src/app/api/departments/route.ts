import { NextResponse } from "next/server";
import { getFestivalData } from "@/lib/festival-data";

export async function GET() {
  try {
    const festivalData = await getFestivalData("admin");
    const deptSet = new Set<string>();

    // 1. From Departments tab in Google Sheet
    (festivalData.departments || []).forEach((d: any) => {
      const name = d.department || d.Department || d.dept || d.name;
      if (name && typeof name === "string") {
        const trimmed = name.trim();
        if (trimmed) deptSet.add(trimmed);
      }
    });

    // 2. From ROS events
    (festivalData.events || []).forEach((e) => {
      if (e.department) {
        e.department.split(",").forEach((deptStr) => {
          const trimmed = deptStr.trim();
          if (trimmed) deptSet.add(trimmed);
        });
      }
    });

    const departments = Array.from(deptSet).sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ departments });
  } catch (error) {
    console.error("Failed to fetch departments list:", error);
    return NextResponse.json({ departments: [] }, { status: 500 });
  }
}
