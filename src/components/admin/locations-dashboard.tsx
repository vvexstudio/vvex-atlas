"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
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

type SelectedMapItem =
  | { type: "venue"; id: string }
  | { type: "entry"; id: string }
  | null;

const MAP_CENTER = { lat: 40.7864, lng: -119.2065 };
const MAP_DEFAULT_ZOOM = 13;

// Camera controller helper to pan and zoom when target location changes
function MapCameraController({
  targetCoord,
}: {
  targetCoord: { coord: { lat: number; lng: number }; zoom: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (map && targetCoord) {
      map.panTo(targetCoord.coord);
      map.setZoom(targetCoord.zoom);
    }
  }, [map, targetCoord]);
  return null;
}

export function LocationsDashboard({ venues, events, entries }: LocationsDashboardProps) {
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Map state
  const [selectedItem, setSelectedItem] = useState<SelectedMapItem>(null);
  const [showSheetVenues, setShowSheetVenues] = useState(true);
  const [showCustomEntries, setShowCustomEntries] = useState(true);

  const mapSectionRef = useRef<HTMLDivElement>(null);

  // Set of names and IDs from Google Sheet venues to check supersession
  const sheetVenueIds = useMemo(() => new Set(venues.map((v) => v.id.toLowerCase())), [venues]);
  const sheetVenueNames = useMemo(() => new Set(venues.map((v) => v.name.trim().toLowerCase())), [venues]);

  // Placed venues & entries with valid coordinates
  const mappableVenues = useMemo(
    () => venues.filter((v) => typeof v.lat === "number" && typeof v.lng === "number"),
    [venues]
  );
  const mappableEntries = useMemo(
    () => entries.filter((e) => e.hasLocation && typeof e.lat === "number" && typeof e.lng === "number"),
    [entries]
  );

  // Default camera center (matches MapView.tsx logic exactly)
  const defaultCenter = useMemo(() => {
    const mappableVenue = mappableVenues.find(
      (v) => typeof v.lat === "number" && typeof v.lng === "number"
    );
    if (mappableVenue && typeof mappableVenue.lat === "number" && typeof mappableVenue.lng === "number") {
      return { lat: mappableVenue.lat, lng: mappableVenue.lng };
    }

    const mappableEntry = mappableEntries.find(
      (e) => e.hasLocation && typeof e.lat === "number" && typeof e.lng === "number"
    );
    if (mappableEntry && typeof mappableEntry.lat === "number" && typeof mappableEntry.lng === "number") {
      return { lat: mappableEntry.lat, lng: mappableEntry.lng };
    }

    return MAP_CENTER;
  }, [mappableVenues, mappableEntries]);

  const [targetCoord, setTargetCoord] = useState<{ coord: { lat: number; lng: number }; zoom: number } | null>(null);

  // Inspect item from map or table
  const handleSelectVenue = (venue: Venue) => {
    setSelectedItem({ type: "venue", id: venue.id });
    if (typeof venue.lat === "number" && typeof venue.lng === "number") {
      setTargetCoord({ coord: { lat: venue.lat, lng: venue.lng }, zoom: 16 });
      mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      alert(`📍 '${venue.name}' is pending coordinates in the Google Sheet.`);
    }
  };

  const handleSelectEntry = (entry: AdminEntry) => {
    setSelectedItem({ type: "entry", id: entry.id });
    if (entry.hasLocation && typeof entry.lat === "number" && typeof entry.lng === "number") {
      setTargetCoord({ coord: { lat: entry.lat, lng: entry.lng }, zoom: 16 });
      mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      alert(`📍 Custom pin '${entry.name}' does not have location coordinates set.`);
    }
  };

  const scrollToTableRow = (item: NonNullable<SelectedMapItem>) => {
    const elId = item.type === "venue" ? `venue-row-${item.id}` : `entry-row-${item.id}`;
    const rowEl = document.getElementById(elId);
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // Selected details
  const selectedVenue = useMemo(() => {
    if (selectedItem?.type !== "venue") return null;
    return venues.find((v) => v.id === selectedItem.id) || null;
  }, [selectedItem, venues]);

  const selectedEntry = useMemo(() => {
    if (selectedItem?.type !== "entry") return null;
    return entries.find((e) => e.id === selectedItem.id) || null;
  }, [selectedItem, entries]);

  const selectedVenueEvents = useMemo(() => {
    if (!selectedVenue) return [];
    return events.filter(
      (e) => e.locationName && e.locationName.toLowerCase() === selectedVenue.name.toLowerCase()
    );
  }, [selectedVenue, events]);

  // Copy TSV string formatted for Google Sheets "Locations" tab
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
      {/* Interactive Map Visualizer & Inspector Section */}
      <div ref={mapSectionRef} className="admin-map-card">
        <div className="admin-map-controls-bar">
          <div className="admin-map-controls-left">
            <h2 className="admin-page-title" style={{ fontSize: "var(--text-lg)" }}>
              <Icon name="map" size={18} />
              Interactive Locations Map
            </h2>
            <div className="admin-pill-row" style={{ marginLeft: "8px" }}>
              <button
                type="button"
                className={`admin-pill${showSheetVenues ? " admin-pill-active" : ""}`}
                onClick={() => setShowSheetVenues((prev) => !prev)}
              >
                <Icon name="mapPin" size={12} /> Sheet Locations ({mappableVenues.length}/{venues.length})
              </button>
              <button
                type="button"
                className={`admin-pill${showCustomEntries ? " admin-pill-active" : ""}`}
                onClick={() => setShowCustomEntries((prev) => !prev)}
              >
                <Icon name="pin" size={12} /> Custom Overlays ({mappableEntries.length}/{entries.length})
              </button>
            </div>
          </div>
          <div className="admin-mlg-actions">
            <Button
              variant="secondary"
              size="sm"
              icon="map"
              onClick={() => {
                setTargetCoord({ coord: defaultCenter, zoom: MAP_DEFAULT_ZOOM });
                setSelectedItem(null);
              }}
            >
              Reset Camera
            </Button>
          </div>
        </div>

        <div className="admin-map-canvas-container">
          <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}>
            <Map
              defaultCenter={defaultCenter}
              defaultZoom={MAP_DEFAULT_ZOOM}
              mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "2f9f04bb8e9c458045b99a65"}
              disableDefaultUI={false}
              zoomControl={true}
              mapTypeControl={true}
              onClick={() => setSelectedItem(null)}
              gestureHandling="greedy"
              style={{ width: "100%", height: "100%" }}
            >
              <MapCameraController targetCoord={targetCoord} />

              {/* Mapped Sheet Venues */}
              {showSheetVenues &&
                mappableVenues.map((venue) => {
                  const isSelected = selectedItem?.type === "venue" && selectedItem.id === venue.id;
                  return (
                    <AdvancedMarker
                      key={`venue-${venue.id}`}
                      position={{ lat: venue.lat!, lng: venue.lng! }}
                      onClick={(e) => {
                        e.stop();
                        handleSelectVenue(venue);
                      }}
                    >
                      <div className={`admin-map-marker-pin admin-map-marker-sheet${isSelected ? " active" : ""}`}>
                        <Icon name="mapPin" size={12} />
                        <span>{venue.name}</span>
                      </div>
                    </AdvancedMarker>
                  );
                })}

              {/* Mapped Custom Entries */}
              {showCustomEntries &&
                mappableEntries.map((entry) => {
                  const isSelected = selectedItem?.type === "entry" && selectedItem.id === entry.id;
                  return (
                    <AdvancedMarker
                      key={`entry-${entry.id}`}
                      position={{ lat: entry.lat!, lng: entry.lng! }}
                      onClick={(e) => {
                        e.stop();
                        handleSelectEntry(entry);
                      }}
                    >
                      <div className={`admin-map-marker-pin admin-map-marker-custom${isSelected ? " active" : ""}`}>
                        <Icon name="pin" size={12} />
                        <span>{entry.name}</span>
                      </div>
                    </AdvancedMarker>
                  );
                })}
            </Map>
          </APIProvider>

          {/* Floating Inspector Panel */}
          {selectedItem && (selectedVenue || selectedEntry) && (
            <div className="admin-map-inspector-drawer">
              <div className="admin-map-inspector-header">
                <div>
                  <Chip
                    tone={selectedItem.type === "venue" ? "neutral" : selectedEntry?.serviceType ? "warn" : "accent"}
                  >
                    {selectedItem.type === "venue" ? "Google Sheet Location" : "Custom Map Pin"}
                  </Chip>
                  <h3 style={{ margin: "6px 0 0 0", fontSize: "var(--text-base)", fontWeight: 700 }}>
                    {selectedVenue ? selectedVenue.name : selectedEntry?.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
                  title="Close inspector"
                >
                  <Icon name="x" size={16} />
                </button>
              </div>

              <div className="admin-map-inspector-body">
                {selectedVenue && (
                  <>
                    <div className="admin-map-inspector-row">
                      <span className="admin-map-inspector-label">Address / Spot:</span>
                      <strong>{selectedVenue.address || "—"}</strong>
                    </div>
                    <div className="admin-map-inspector-row">
                      <span className="admin-map-inspector-label">Category:</span>
                      <span>{selectedVenue.permanence || "Standard"}</span>
                    </div>
                    <div className="admin-map-inspector-row">
                      <span className="admin-map-inspector-label">Coordinates:</span>
                      <span className="mono">
                        {selectedVenue.hasLocation && selectedVenue.lat !== undefined && selectedVenue.lng !== undefined
                          ? `${selectedVenue.lat.toFixed(5)}, ${selectedVenue.lng.toFixed(5)}`
                          : "Pending (Synthetic)"}
                      </span>
                    </div>
                    <div className="admin-map-inspector-row">
                      <span className="admin-map-inspector-label">Scheduled Events:</span>
                      <strong>{selectedVenueEvents.length} shifts</strong>
                    </div>

                    {selectedVenue.description && (
                      <p style={{ margin: "4px 0", color: "var(--muted)", fontStyle: "italic" }}>
                        &ldquo;{selectedVenue.description}&rdquo;
                      </p>
                    )}

                    {selectedVenueEvents.length > 0 && (
                      <div style={{ marginTop: "4px" }}>
                        <span className="admin-map-inspector-label">Upcoming Shifts:</span>
                        <ul style={{ margin: "4px 0 0 0", paddingLeft: "16px" }}>
                          {selectedVenueEvents.slice(0, 3).map((ev) => (
                            <li key={ev.id} style={{ marginBottom: "2px" }}>
                              <strong>{ev.startTime || "TBD"}</strong>: {ev.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                {selectedEntry && (
                  <>
                    <div className="admin-map-inspector-row">
                      <span className="admin-map-inspector-label">Type:</span>
                      <span>
                        {selectedEntry.projectType}
                        {selectedEntry.serviceType ? ` (${selectedEntry.serviceType})` : ""}
                      </span>
                    </div>
                    <div className="admin-map-inspector-row">
                      <span className="admin-map-inspector-label">Artist / Host:</span>
                      <span>{selectedEntry.artist || "—"}</span>
                    </div>
                    <div className="admin-map-inspector-row">
                      <span className="admin-map-inspector-label">Location Text:</span>
                      <span>{selectedEntry.locationInternal || "—"}</span>
                    </div>
                    <div className="admin-map-inspector-row">
                      <span className="admin-map-inspector-label">Coordinates:</span>
                      <span className="mono">
                        {selectedEntry.hasLocation && selectedEntry.lat !== undefined && selectedEntry.lng !== undefined
                          ? `${selectedEntry.lat.toFixed(5)}, ${selectedEntry.lng.toFixed(5)}`
                          : "Unplaced"}
                      </span>
                    </div>
                    {selectedEntry.hasSchedule && (
                      <div className="admin-map-inspector-row">
                        <span className="admin-map-inspector-label">Schedule:</span>
                        <span>
                          {selectedEntry.day.toUpperCase()} {selectedEntry.startTime} - {selectedEntry.endTime}
                        </span>
                      </div>
                    )}
                    {selectedEntry.abridgedProjectText && (
                      <p style={{ margin: "4px 0", color: "var(--muted)", fontStyle: "italic" }}>
                        &ldquo;{selectedEntry.abridgedProjectText}&rdquo;
                      </p>
                    )}
                  </>
                )}

                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <Button variant="secondary" size="sm" icon="clipboard" onClick={() => scrollToTableRow(selectedItem)}>
                    Highlight Row
                  </Button>

                  {selectedEntry && (
                    <Link href={`/admin/edit/${selectedEntry.id}`} className="btn btn-primary btn-sm">
                      Edit Pin
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

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
                const isSelected = selectedItem?.type === "venue" && selectedItem.id === venue.id;
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
                  <tr
                    key={venue.id}
                    id={`venue-row-${venue.id}`}
                    className={isSelected ? "admin-row-selected" : undefined}
                  >
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
                        onClick={() => handleSelectVenue(venue)}
                        style={{ background: "none", border: "none", cursor: "pointer", marginRight: "12px" }}
                      >
                        Inspect
                      </button>
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
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--color-danger, #ef4444)",
                        }}
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
                const isSelected = selectedItem?.type === "entry" && selectedItem.id === entry.id;
                const isSuperceded =
                  sheetVenueIds.has(entry.id.toLowerCase()) ||
                  sheetVenueNames.has(entry.name.trim().toLowerCase());

                return (
                  <tr
                    key={entry.id}
                    id={`entry-row-${entry.id}`}
                    className={isSuperceded ? "admin-row-superseded" : isSelected ? "admin-row-selected" : undefined}
                  >
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
                      <button
                        type="button"
                        className="admin-link"
                        onClick={() => handleSelectEntry(entry)}
                        style={{ background: "none", border: "none", cursor: "pointer", marginRight: "12px" }}
                      >
                        Inspect
                      </button>
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

