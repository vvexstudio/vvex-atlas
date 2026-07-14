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
  if (userSession?.email) {
    if (isAdminEmail(userSession.email)) {
      role = "admin";
    } else if (userSession.role) {
      role = userSession.role;
    } else {
      try {
        const { adminDb } = await import("@/lib/firebase-admin");
        if (adminDb) {
          const escapedEmail = userSession.email.trim().toLowerCase().replace(/\./g, ",");
          const snapshot = await adminDb.ref(`auth-directory/${escapedEmail}`).once("value");
          if (snapshot.exists()) {
            role = snapshot.val().role || "guest";
          }
        }
      } catch (err) {
        console.warn("Failed to check user role for SSR render. Defaulting to 'guest':", err);
      }
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

