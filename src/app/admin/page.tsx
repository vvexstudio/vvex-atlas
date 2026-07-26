import Link from "next/link";
import { readAdminEntries } from "@/lib/admin-entries";
import { getFestivalData } from "@/lib/festival-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboardPage() {
  const entries = await readAdminEntries();
  const festivalData = await getFestivalData("admin");
  const venues = festivalData.venues || [];
  const events = festivalData.events || [];

  return (
    <div style={{ display: "grid", gap: "2.5rem", color: "#111827" }}>
      {/* Master Locations Registry Section */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>📍 Event Locations Registry</h1>
            <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
              Active mapped locations from Google Sheet database ({venues.length} locations)
            </p>
          </div>
        </div>

        <div style={{ background: "white", borderRadius: "8px", boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)", overflowX: "auto" }}>
          <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600, color: "#374151" }}>Location Name</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600, color: "#374151" }}>Address</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600, color: "#374151" }}>Category</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600, color: "#374151" }}>Coordinates</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 600, color: "#374151" }}>Events</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((venue) => {
                const venueEventsCount = events.filter(
                  (e) => e.locationName && e.locationName.toLowerCase() === venue.name.toLowerCase()
                ).length;

                return (
                  <tr key={venue.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "0.85rem 1rem", fontWeight: 600 }}>{venue.name}</td>
                    <td style={{ padding: "0.85rem 1rem", color: "#4f46e5", fontWeight: 500 }}>
                      {venue.address || "—"}
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <span style={{
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        backgroundColor: "#f3f4f6",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#4b5563"
                      }}>
                        {venue.permanence || "Standard"}
                      </span>
                    </td>
                    <td style={{ padding: "0.85rem 1rem", color: "#6b7280", fontFamily: "monospace", fontSize: "0.8rem" }}>
                      {venue.hasLocation && venue.lat !== undefined && venue.lng !== undefined
                        ? `${venue.lat.toFixed(5)}, ${venue.lng.toFixed(5)}`
                        : "Pending (Synthetic)"}
                    </td>
                    <td style={{ padding: "0.85rem 1rem", color: "#374151", fontWeight: 600 }}>
                      {venueEventsCount} shifts
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Local Custom Pins Table */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>📍 Custom Map Pin Overlays</h2>
            <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
              Manually created admin pins ({entries.length} pins)
            </p>
          </div>
          <Link 
            href="/admin/new"
            style={{ 
              padding: "0.45rem 0.9rem", 
              backgroundColor: "#10b981", 
              color: "white", 
              borderRadius: "6px",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.85rem"
            }}
          >
            + Add New Custom Pin
          </Link>
        </div>

        <div style={{ background: "white", borderRadius: "8px", boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)", overflowX: "auto" }}>
          <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 500, color: "#6b7280" }}>Name</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 500, color: "#6b7280" }}>Type</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 500, color: "#6b7280" }}>Location</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 500, color: "#6b7280" }}>Coordinates</th>
                <th style={{ padding: "0.85rem 1rem", fontWeight: 500, color: "#6b7280", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "0.85rem 1rem", fontWeight: 500 }}>{entry.name}</td>
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <span style={{ 
                      display: "inline-block", 
                      padding: "0.2rem 0.6rem", 
                      borderRadius: "9999px", 
                      backgroundColor: entry.serviceType ? "#f97316" : "#8b5cf6",
                      color: "white",
                      fontSize: "0.75rem",
                      fontWeight: 600
                    }}>
                      {entry.projectType === "services" && entry.serviceType
                        ? `Services: ${entry.serviceType}`
                        : entry.projectType}
                    </span>
                  </td>
                  <td style={{ padding: "0.85rem 1rem", color: "#374151" }}>
                    {entry.locationInternal || "—"}
                  </td>
                  <td style={{ padding: "0.85rem 1rem", color: "#6b7280", fontFamily: "monospace", fontSize: "0.8rem" }}>
                    {entry.hasLocation && entry.lat !== undefined && entry.lng !== undefined 
                      ? `${entry.lat.toFixed(5)}, ${entry.lng.toFixed(5)}` 
                      : "Unplaced"}
                  </td>
                  <td style={{ padding: "0.85rem 1rem", textAlign: "right" }}>
                    <Link 
                      href={`/admin/edit/${entry.id}`}
                      style={{ color: "#2563eb", textDecoration: "none", fontWeight: 500 }}
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
