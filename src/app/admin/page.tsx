import { readAdminEntries } from "@/lib/admin-entries";
import { getFestivalData } from "@/lib/festival-data";
import { LocationsDashboard } from "@/components/admin/locations-dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboardPage() {
  let entries: any[] = [];
  let venues: any[] = [];
  let events: any[] = [];

  try {
    entries = await readAdminEntries();
  } catch (e) {
    console.error("Failed to read admin entries:", e);
  }

  try {
    const festivalData = await getFestivalData("admin");
    venues = festivalData?.venues || [];
    events = festivalData?.events || [];
  } catch (e) {
    console.error("Failed to read festival data for admin:", e);
  }

  return (
    <LocationsDashboard
      venues={venues}
      events={events}
      entries={entries}
    />
  );
}
