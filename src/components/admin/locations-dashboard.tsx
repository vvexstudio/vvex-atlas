"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminEntry } from "@/types/admin-entry";
import { FestivalEvent, Venue } from "@/types/festival";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/icons";

interface LocationsDashboardProps {
  venues: Venue[];
  events: FestivalEvent[];
  entries: AdminEntry[];
}

export function LocationsDashboard({ venues, events, entries }: LocationsDashboardProps) {
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Set of names and IDs from Google Sheet venues to check supersession
  const sheetVenueIds = new Set(venues.map((v) => v.id.toLowerCase()));
  const sheetVenueNames = new Set(venues.map((v) => v.name.trim().toLowerCase()));

  // Generate TSV string formatted for Google Sheets "Locations" tab
  // Columns: Location | Aliases | Address | Lat | Long | Description
  const handleCopyForGoogleSheets = () => {
    const lines = entries.map((entry) => {
      const location = entry.name.trim();
      const aliases = entry.artist ? entry.artist.trim() : "";
      const address = entry.locationInternal ? entry.locationInternal.trim() : "";
      const lat = entry.hasLocation && entry.lat !== undefined ? entry.lat.toString() : "";
      const long = entry.hasLocation && entry.lng !== undefined ? entry.lng.toString() : "";
      const description = entry.abridgedProjectText ? entry.abridgedProjectText.trim() : "";

      return `${location}\t${aliases}\t${address}\t${lat}\t${long}\t${description}`;
    });

    const tsvContent = lines.join("\n");
    navigator.clipboard.writeText(tsvContent);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(null as any), 3000);
  };

  return (
    <div className="admin-page-stack">
      {/* Master Locations Registry Section */}
      <div>
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">
              <Icon name="mapPin" size={20} />
              Event Locations Registry
            </h1>
            <p className="admin-page-subtitle">
              Active mapped locations from Google Sheet database ({venues.length} locations)
            </p>
          </div>
        </div>

        <div className="card admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Location Name</th>
                <th>Address</th>
                <th>Category</th>
                <th>Coordinates</th>
                <th>Events</th>
                <th className="admin-cell-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((venue) => {
                const venueEventsCount = events.filter(
                  (e) => e.locationName && e.locationName.toLowerCase() === venue.name.toLowerCase()
                ).length;

                const handleDeleteClick = () => {
                  alert(
                    `⚠️ Master Location Protection:\n\n'${venue.name}' is synced directly from the canonical Google Sheet.\n\nTo delete this location permanently, please remove its row directly from the 'Locations' tab of your master Google Sheet database.`
                  );
                };

                const handleEditClick = () => {
                  alert(
                    `📍 Master Location Edit Guidance:\n\n'${venue.name}' is populated from the Google Sheet Locations tab.\n\nTo update coordinates or address permanently, edit the 'Lat', 'Long', or 'Address' columns in your master Google Sheet. Alternatively, create a Custom Pin Overlay below and click 'Copy Pins for Google Sheet'.`
                  );
                };

                return (
                  <tr key={venue.id}>
                    <td>
                      <strong>{venue.name}</strong>
                    </td>
                    <td>
                      <span className="admin-link">{venue.address || "—"}</span>
                    </td>
                    <td>
                      <Chip tone="neutral">{venue.permanence || "Standard"}</Chip>
                    </td>
                    <td className="mono admin-cell-muted">
                      {venue.hasLocation && venue.lat !== undefined && venue.lng !== undefined
                        ? `${venue.lat.toFixed(5)}, ${venue.lng.toFixed(5)}`
                        : "Pending (Synthetic)"}
                    </td>
                    <td>
                      <strong>{venueEventsCount} shifts</strong>
                    </td>
                    <td className="admin-cell-right">
                      <button
                        type="button"
                        className="admin-link"
                        onClick={handleEditClick}
                        style={{ background: "none", border: "none", cursor: "pointer", marginRight: "12px" }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="admin-link"
                        onClick={handleDeleteClick}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-danger, #ef4444)" }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Local Custom Pins Table Section */}
      <div>
        <div className="admin-page-header">
          <div>
            <h2 className="admin-page-title">
              <Icon name="pin" size={18} />
              Custom Map Pin Overlays
            </h2>
            <p className="admin-page-subtitle">
              Temporary admin pins created via frontend UI ({entries.length} pins). Copy rows to
              paste into Google Sheet Locations tab.
            </p>
          </div>
          <div className="admin-mlg-actions">
            <Button
              variant="secondary"
              size="sm"
              icon={copiedSuccess ? "check" : "copy"}
              onClick={handleCopyForGoogleSheets}
            >
              {copiedSuccess ? "Copied" : "Copy Pins for Google Sheet"}
            </Button>

            <Link href="/admin/new" className="btn btn-primary btn-sm">
              Add Custom Pin
            </Link>
          </div>
        </div>

        <div className="card admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Location / Address</th>
                <th>Coordinates</th>
                <th>Sheet Status</th>
                <th className="admin-cell-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isSuperceded =
                  sheetVenueIds.has(entry.id.toLowerCase()) ||
                  sheetVenueNames.has(entry.name.trim().toLowerCase());

                return (
                  <tr key={entry.id} className={isSuperceded ? "admin-row-superseded" : undefined}>
                    <td>{entry.name}</td>
                    <td>
                      <Chip tone={entry.serviceType ? "warn" : "accent"}>
                        {entry.projectType === "services" && entry.serviceType
                          ? `Services: ${entry.serviceType}`
                          : entry.projectType}
                      </Chip>
                    </td>
                    <td>{entry.locationInternal || "—"}</td>
                    <td className="mono admin-cell-muted">
                      {entry.hasLocation && entry.lat !== undefined && entry.lng !== undefined
                        ? `${entry.lat.toFixed(5)}, ${entry.lng.toFixed(5)}`
                        : "Unplaced"}
                    </td>
                    <td>
                      {isSuperceded ? (
                        <Chip tone="success" icon="check">
                          In Sheet (Superseded)
                        </Chip>
                      ) : (
                        <Chip tone="warn" icon="zap">
                          Temporary Overlay
                        </Chip>
                      )}
                    </td>
                    <td className="admin-cell-right">
                      <Link href={`/admin/edit/${entry.id}`} className="admin-link">
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
