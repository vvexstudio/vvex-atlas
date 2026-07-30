import { EventApp } from "@/components/event/EventApp";
import { getFestivalData } from "@/lib/festival-data";
import { cookies } from "next/headers";
import { verifySessionCookie, isAdminEmail, getUserRoleFromPersonnel } from "@/lib/auth";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const cookieStore = await cookies();
  const sessionToken =
    cookieStore.get("portal_user_session")?.value ||
    cookieStore.get("portal_session")?.value;
  const userSession = sessionToken ? await verifySessionCookie(sessionToken) : null;

  let role = userSession?.role || "public";
  let userDepartments: string[] = userSession?.departments || [];
  let isActive = true;

  if (userSession?.email) {
    // 1. Query Firebase to check active status and role (C2)
    try {
      const { adminDb } = await import("@/lib/firebase-admin");
      if (adminDb) {
        const escapedEmail = userSession.email.trim().toLowerCase().replace(/\./g, ",");
        const snapshot = await adminDb.ref(`auth-directory/${escapedEmail}`).once("value");
        if (snapshot.exists()) {
          const userData = snapshot.val();
          if (userData.active === false || String(userData.active).toUpperCase() === "FALSE") {
            isActive = false;
          } else {
            role = userData.role || role;
            if (Array.isArray(userData.departments)) {
              userDepartments = userData.departments;
            } else if (typeof userData.departments === "string") {
              userDepartments = userData.departments.split(",").map((d: string) => d.trim()).filter(Boolean);
            }
          }
        }
      }
    } catch (err) {
      console.warn("Failed to check user status for SSR render:", err);
    }

    if (!isActive) {
      const { redirect } = await import("next/navigation");
      redirect("/login?error=unauthorized");
    }

    // 2. Fallback check against Personnel sheet if role is still not admin
    if (role !== "admin") {
      const sheetRole = await getUserRoleFromPersonnel(userSession.email);
      if (sheetRole === "admin") {
        role = "admin";
      }
    }

    // 3. Fallback / Admin email override (ADMIN_EMAILS always forces admin)
    if (isAdminEmail(userSession.email)) {
      role = "admin";
    }
  }

  const { venues, events, personnel, departments, colors, sourceLabel, debug } = await getFestivalData(role);

  return (
    <EventApp
      venues={venues}
      events={events}
      personnel={personnel}
      departments={departments}
      colors={colors}
      dataSourceLabel={sourceLabel}
      debug={debug}
      userSession={userSession ? {
        email: userSession.email,
        name: userSession.name,
        picture: userSession.picture,
        role: role,
        departments: userDepartments
      } : undefined}
    />
  );
}

