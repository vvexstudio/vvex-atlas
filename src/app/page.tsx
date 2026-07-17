import { EventApp } from "@/components/event/EventApp";
import { getFestivalData } from "@/lib/festival-data";
import { cookies } from "next/headers";
import { verifySessionCookie, isAdminEmail } from "@/lib/auth";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("portal_user_session")?.value;
  const userSession = sessionToken ? await verifySessionCookie(sessionToken) : null;

  let role = "guest";
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
            role = userData.role || "guest";
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

    // 2. Fallback / Admin email override
    if (isAdminEmail(userSession.email)) {
      role = "admin";
    } else if (userSession.role && role === "guest") {
      role = userSession.role;
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
        role: role
      } : undefined}
    />
  );
}

