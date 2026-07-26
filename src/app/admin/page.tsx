import { readAdminEntries } from "@/lib/admin-entries";
import { getFestivalData } from "@/lib/festival-data";
import { LocationsDashboard } from "@/components/admin/locations-dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboardPage() {
  const entries = await readAdminEntries();
  const festivalData = await getFestivalData("admin");
  const venues = festivalData.venues || [];
  const events = festivalData.events || [];

  return (
    <LocationsDashboard
      venues={venues}
      events={events}
      entries={entries}
    />
  );
}
