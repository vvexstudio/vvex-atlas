import { FestivalMapApp } from "@/components/festival-map-app";
import { getFestivalData } from "@/lib/festival-data";
import { cookies } from "next/headers";
import { verifySessionCookie } from "@/lib/auth";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const { venues, events, personnel, departments, colors, sourceLabel, debug } = await getFestivalData();
  
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("portal_user_session")?.value;
  const userSession = sessionToken ? await verifySessionCookie(sessionToken) : null;

  return (
    <FestivalMapApp
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
        picture: userSession.picture
      } : undefined}
    />
  );
}

