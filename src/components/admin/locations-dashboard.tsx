"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { APIProvider, Map, AdvancedMarker, useMap, MapMouseEvent } from "@vis.gl/react-google-maps";
import { AdminEntry } from "@/types/admin-entry";
import { FestivalEvent, Venue } from "@/types/festival";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/icons";
import { clearOfflineSnapshots } from "@/lib/offline-cache";

if (typeof window !== "undefined") {
  const origError = console.error;
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (
      msg.includes("without a valid Map ID") ||
      msg.includes("Unable to fetch configuration for mapId")
    ) {
      console.warn(...args);
      return;
    }
    origError.apply(console, args);
  };
}

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

export function LocationsDashboard({ venues: initialVenues, events, entries: initialEntries }: LocationsDashboardProps) {
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [venues, setVenues] = useState<Venue[]>(initialVenues);
  const [entries, setEntries] = useState<AdminEntry[]>(initialEntries);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    setVenues(initialVenues);
  }, [initialVenues]);

  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  // Map state
  const [selectedItem, setSelectedItem] = useState<SelectedMapItem>(null);
  const [showSheetVenues, setShowSheetVenues] = useState(true);
  const [showCustomEntries, setShowCustomEntries] = useState(true);

  const mapSectionRef = useRef<HTMLDivElement>(null);

  const handleDeleteLocation = async (item: { id: string; name: string }) => {
    if (!window.confirm(`Delete location '${item.name}' from Admin Panel? This will remove it from the map and database.`)) {
      return;
    }
    try {
      const res = await fetch("/api/admin-entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, name: item.name }),
      });
      if (!res.ok) {
        alert(`Failed to delete '${item.name}'. Status: ${res.status}`);
        return;
      }
      const cleanId = item.id.toLowerCase().trim();
      const cleanName = item.name.toLowerCase().trim();

      setVenues((prev) =>
        prev.filter(
          (v) => v.id.toLowerCase().trim() !== cleanId && v.name.toLowerCase().trim() !== cleanName
        )
      );
      setEntries((prev) =>
        prev.filter(
          (e) => e.id.toLowerCase().trim() !== cleanId && e.name.toLowerCase().trim() !== cleanName
        )
      );
      clearOfflineSnapshots();
      if (selectedItem?.id === item.id) {
        setSelectedItem(null);
      }
    } catch (err: any) {
      alert(`Error deleting location: ${err?.message || "Unknown error"}`);
    }
  };

  const handleCopySingleRow = (entry: AdminEntry) => {
    const location = entry.name.trim();
    const aliases = entry.artist ? entry.artist.trim() : "";
    const address = entry.locationInternal ? entry.locationInternal.trim() : "";
    const lat = entry.hasLocation && entry.lat !== undefined ? entry.lat.toString() : "";
    const long = entry.hasLocation && entry.lng !== undefined ? entry.lng.toString() : "";
    const description = entry.abridgedProjectText ? entry.abridgedProjectText.trim() : "";

    const tsvLine = `${location}\t${aliases}\t${address}\t${lat}\t${long}\t${description}`;
    navigator.clipboard.writeText(tsvLine);
    setCopiedRowId(entry.id);
    setTimeout(() => setCopiedRowId(null), 2500);
  };

  const handleSaveVenueEdit = async (updatedData: {
    id: string;
    name: string;
    aliases?: string;
    address: string;
    permanence: string;
    lat?: number;
    lng?: number;
    description: string;
  }) => {
    setSavingEdit(true);
    try {
      const entryId = updatedData.id.startsWith("entry-") ? updatedData.id : `entry-${updatedData.id}`;
      const newEntry: Partial<AdminEntry> = {
        id: entryId,
        name: updatedData.name,
        artist: updatedData.aliases || "",
        locationInternal: updatedData.address,
        projectType: (updatedData.permanence || "venue") as any,
        lat: updatedData.lat,
        lng: updatedData.lng,
        hasLocation: typeof updatedData.lat === "number" && typeof updatedData.lng === "number",
        abridgedProjectText: updatedData.description,
      };

      const res = await fetch("/api/admin-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry: newEntry }),
      });

      if (!res.ok) {
        alert(`Failed to save location update. Status: ${res.status}`);
        setSavingEdit(false);
        return;
      }

      const createdRes = await res.json();
      const savedEntry: AdminEntry = createdRes.entry || {
        ...newEntry,
        id: entryId,
        artist: updatedData.aliases || "",
        hasSchedule: false,
        day: "fri",
      };

      setEntries((prev) => {
        const filtered = prev.filter(
          (e) => e.id !== savedEntry.id && e.name.toLowerCase().trim() !== savedEntry.name.toLowerCase().trim()
        );
        return [...filtered, savedEntry];
      });

      clearOfflineSnapshots();
      setEditingVenue(null);
      setSelectedItem({ type: "entry", id: savedEntry.id });

      if (typeof savedEntry.lat === "number" && typeof savedEntry.lng === "number") {
        setTargetCoord({ coord: { lat: savedEntry.lat, lng: savedEntry.lng }, zoom: 16 });
        mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } catch (err: any) {
      alert(`Error saving location edit: ${err?.message || "Unknown error"}`);
    } finally {
      setSavingEdit(false);
    }
  };

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
              mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID"}
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

        {/* Mobile View: Cards */}
        <div className="admin-mobile-cards-list">
          {venues.map((venue) => {
            const venueEventsCount = events.filter(
              (e) => e.locationName && e.locationName.toLowerCase() === venue.name.toLowerCase()
            ).length;
            return (
              <div className="admin-mobile-card" key={`mobile-venue-${venue.id}`}>
                <div className="admin-mobile-card-header">
                  <div>
                    <strong className="admin-mobile-card-title">{venue.name}</strong>
                    <div className="admin-mobile-card-sub">
                      {venue.address ? <span>{venue.address} • </span> : null}
                      <Chip tone="neutral">{venue.permanence || "Standard"}</Chip>
                    </div>
                  </div>
                  <span className="admin-mobile-card-badge">{venueEventsCount} shifts</span>
                </div>

                <div className="admin-mobile-card-meta mono">
                  {venue.hasLocation && venue.lat !== undefined && venue.lng !== undefined
                    ? `${venue.lat.toFixed(5)}, ${venue.lng.toFixed(5)}`
                    : "Pending (Synthetic)"}
                </div>

                <div className="admin-mobile-card-actions">
                  <button
                    type="button"
                    className="admin-btn-action"
                    onClick={() => handleSelectVenue(venue)}
                  >
                    <Icon name="eye" size={14} />
                    <span>Inspect</span>
                  </button>
                  <button
                    type="button"
                    className="admin-btn-action"
                    onClick={() => setEditingVenue(venue)}
                  >
                    <Icon name="pencil" size={14} />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    className="admin-btn-action admin-btn-action-danger"
                    onClick={() => handleDeleteLocation(venue)}
                  >
                    <Icon name="trash" size={14} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop View: Table */}
        <div className="card admin-table-wrap admin-desktop-table">
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
                      <div className="admin-action-group">
                        <button
                          type="button"
                          className="admin-btn-action"
                          onClick={() => handleSelectVenue(venue)}
                          title="Inspect location on map"
                        >
                          <Icon name="eye" size={13} />
                          <span>Inspect</span>
                        </button>
                        <button
                          type="button"
                          className="admin-btn-action"
                          onClick={() => setEditingVenue(venue)}
                          title="Edit location details & move to custom overlays"
                        >
                          <Icon name="pencil" size={13} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          className="admin-btn-action admin-btn-action-danger"
                          onClick={() => handleDeleteLocation(venue)}
                          title="Delete location permanently"
                        >
                          <Icon name="trash" size={13} />
                          <span>Delete</span>
                        </button>
                      </div>
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
              {copiedSuccess ? "Copied All" : "Copy All Pins for Google Sheet"}
            </Button>

            <Link href="/admin/new" className="btn btn-primary btn-sm">
              Add Custom Pin
            </Link>
          </div>
        </div>

        {/* Mobile View: Cards */}
        <div className="admin-mobile-cards-list">
          {entries.map((entry) => {
            const isSuperceded =
              sheetVenueIds.has(entry.id.toLowerCase()) ||
              sheetVenueNames.has(entry.name.trim().toLowerCase());
            return (
              <div className="admin-mobile-card" key={`mobile-entry-${entry.id}`}>
                <div className="admin-mobile-card-header">
                  <div>
                    <strong className="admin-mobile-card-title">{entry.name}</strong>
                    <div className="admin-mobile-card-sub">
                      <Chip tone={entry.serviceType ? "warn" : "accent"}>
                        {entry.projectType === "services" && entry.serviceType
                          ? `Services: ${entry.serviceType}`
                          : entry.projectType}
                      </Chip>
                      {isSuperceded ? (
                        <Chip tone="success" icon="check">In Sheet</Chip>
                      ) : (
                        <Chip tone="warn" icon="zap">Temporary</Chip>
                      )}
                    </div>
                  </div>
                </div>

                <div className="admin-mobile-card-meta">
                  {entry.locationInternal ? <div>{entry.locationInternal}</div> : null}
                  <div className="mono" style={{ marginTop: "2px" }}>
                    {entry.hasLocation && entry.lat !== undefined && entry.lng !== undefined
                      ? `${entry.lat.toFixed(5)}, ${entry.lng.toFixed(5)}`
                      : "Unplaced"}
                  </div>
                </div>

                <div className="admin-mobile-card-actions">
                  <button
                    type="button"
                    className="admin-btn-action"
                    onClick={() => handleSelectEntry(entry)}
                  >
                    <Icon name="eye" size={14} />
                    <span>Inspect</span>
                  </button>
                  <button
                    type="button"
                    className="admin-btn-action"
                    onClick={() => handleCopySingleRow(entry)}
                    title="Copy single TSV row for Google Sheet"
                  >
                    <Icon name={copiedRowId === entry.id ? "check" : "copy"} size={14} />
                    <span>{copiedRowId === entry.id ? "Copied" : "Copy Row"}</span>
                  </button>
                  <Link
                    href={`/admin/edit/${entry.id}`}
                    className="admin-btn-action"
                  >
                    <Icon name="pencil" size={14} />
                    <span>Edit</span>
                  </Link>
                  <button
                    type="button"
                    className="admin-btn-action admin-btn-action-danger"
                    onClick={() => handleDeleteLocation(entry)}
                  >
                    <Icon name="trash" size={14} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop View: Table */}
        <div className="card admin-table-wrap admin-desktop-table">
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
                      <div className="admin-action-group">
                        <button
                          type="button"
                          className="admin-btn-action"
                          onClick={() => handleSelectEntry(entry)}
                          title="Inspect pin on map"
                        >
                          <Icon name="eye" size={13} />
                          <span>Inspect</span>
                        </button>
                        <button
                          type="button"
                          className="admin-btn-action"
                          onClick={() => handleCopySingleRow(entry)}
                          title="Copy single TSV row for Google Sheet"
                        >
                          <Icon name={copiedRowId === entry.id ? "check" : "copy"} size={13} />
                          <span>{copiedRowId === entry.id ? "Copied" : "Copy Row"}</span>
                        </button>
                        <Link
                          href={`/admin/edit/${entry.id}`}
                          className="admin-btn-action"
                          title="Edit pin details"
                        >
                          <Icon name="pencil" size={13} />
                          <span>Edit</span>
                        </Link>
                        <button
                          type="button"
                          className="admin-btn-action admin-btn-action-danger"
                          onClick={() => handleDeleteLocation(entry)}
                          title="Delete pin permanently"
                        >
                          <Icon name="trash" size={13} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Location Modal */}
      {editingVenue && (
        <EditLocationModal
          venue={editingVenue}
          onClose={() => setEditingVenue(null)}
          onSave={handleSaveVenueEdit}
          isSaving={savingEdit}
        />
      )}
    </div>
  );
}

function EditLocationModal({
  venue,
  onClose,
  onSave,
  isSaving,
}: {
  venue: Venue;
  onClose: () => void;
  onSave: (updated: {
    id: string;
    name: string;
    aliases: string;
    address: string;
    permanence: string;
    lat?: number;
    lng?: number;
    description: string;
  }) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(venue.name);
  const [aliases, setAliases] = useState("");
  const [address, setAddress] = useState(venue.address || "");
  const [permanence, setPermanence] = useState(venue.permanence || "Standard");
  const [description, setDescription] = useState(venue.description || "");
  const [latVal, setLatVal] = useState<string>(venue.lat !== undefined ? String(venue.lat) : "");
  const [lngVal, setLngVal] = useState<string>(venue.lng !== undefined ? String(venue.lng) : "");

  const parsedLat = latVal ? parseFloat(latVal) : undefined;
  const parsedLng = lngVal ? parseFloat(lngVal) : undefined;
  const hasCoord = !isNaN(parsedLat as number) && !isNaN(parsedLng as number);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Location Name is required.");
      return;
    }
    onSave({
      id: venue.id,
      name: name.trim(),
      aliases: aliases.trim(),
      address: address.trim(),
      permanence: permanence.trim(),
      lat: hasCoord ? parsedLat : undefined,
      lng: hasCoord ? parsedLng : undefined,
      description: description.trim(),
    });
  };

  const centerCoord = hasCoord
    ? { lat: parsedLat!, lng: parsedLng! }
    : MAP_CENTER;

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3 className="admin-modal-title">
            <Icon name="pencil" size={18} />
            Edit Location &amp; Move to Custom Overlays
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div className="admin-modal-body">
            <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
              Editing this location will create a modified overlay under <strong>Custom Map Pin Overlays</strong> so you can copy it directly back into the Google Sheet.
            </p>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">Location Name *</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Will Call, Le Salon, Gerlach Store"
                  required
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Aliases / Alternate Names</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={aliases}
                  onChange={(e) => setAliases(e.target.value)}
                  placeholder="e.g. Main Gate, Box Office"
                />
              </div>
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">Address / Spot Location</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 2:15 & K or Gerlach, NV"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Category / Type</label>
                <select
                  className="admin-form-select"
                  value={permanence}
                  onChange={(e) => setPermanence(e.target.value)}
                >
                  <option value="Standard">Standard</option>
                  <option value="Venue">Venue</option>
                  <option value="Installation">Installation</option>
                  <option value="Services">Services</option>
                </select>
              </div>
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">Latitude (Lat)</label>
                <input
                  type="number"
                  step="any"
                  className="admin-form-input mono"
                  value={latVal}
                  onChange={(e) => setLatVal(e.target.value)}
                  placeholder="40.78640"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Longitude (Lng)</label>
                <input
                  type="number"
                  step="any"
                  className="admin-form-input mono"
                  value={lngVal}
                  onChange={(e) => setLngVal(e.target.value)}
                  placeholder="-119.20650"
                />
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Search Place or Click Map to Set Coordinates</label>
              <ModalMapSearchBox
                onSelectLocation={({ lat, lng, address: searchedAddress }) => {
                  setLatVal(lat.toFixed(6));
                  setLngVal(lng.toFixed(6));
                  if (searchedAddress && !address) {
                    setAddress(searchedAddress);
                  }
                }}
              />
              <div style={{ width: "100%", height: "190px", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--line)" }}>
                <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}>
                  <Map
                    defaultCenter={centerCoord}
                    defaultZoom={15}
                    mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID"}
                    disableDefaultUI={true}
                    zoomControl={true}
                    onClick={(ev: MapMouseEvent) => {
                      if (ev.detail.latLng) {
                        setLatVal(ev.detail.latLng.lat.toFixed(6));
                        setLngVal(ev.detail.latLng.lng.toFixed(6));
                      }
                    }}
                    gestureHandling="greedy"
                    style={{ width: "100%", height: "100%" }}
                  >
                    {hasCoord && (
                      <AdvancedMarker position={{ lat: parsedLat!, lng: parsedLng! }}>
                        <div className="admin-map-marker-pin admin-map-marker-custom active">
                          <Icon name="pin" size={12} />
                          <span>{name || "Pin Location"}</span>
                        </div>
                      </AdvancedMarker>
                    )}
                  </Map>
                </APIProvider>
              </div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Description / Notes</label>
              <textarea
                className="admin-form-textarea"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed location description or operational notes..."
              />
            </div>
          </div>

          <div className="admin-modal-footer">
            <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" icon="check" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save & Move to Custom Overlays"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalMapSearchBox({
  onSelectLocation,
}: {
  onSelectLocation: (loc: { lat: number; lng: number; address?: string }) => void;
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setSearching(true);
    setSearchError(null);

    try {
      if (typeof window !== "undefined" && window.google?.maps?.Geocoder) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: q }, (results, status) => {
          setSearching(false);
          if (status === "OK" && results && results[0]) {
            const loc = results[0].geometry.location;
            onSelectLocation({
              lat: loc.lat(),
              lng: loc.lng(),
              address: results[0].formatted_address,
            });
          } else {
            setSearchError(`No place found for "${q}". Try adding city/state (e.g. Gerlach, NV).`);
          }
        });
      } else {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setSearching(false);
        if (Array.isArray(data) && data.length > 0) {
          onSelectLocation({
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            address: data[0].display_name,
          });
        } else {
          setSearchError(`No results found for "${q}".`);
        }
      }
    } catch (err: any) {
      setSearching(false);
      setSearchError(`Search error: ${err?.message || "Unknown error"}`);
    }
  };

  return (
    <div style={{ marginBottom: "6px" }}>
      <div style={{ display: "flex", gap: "6px" }}>
        <input
          type="text"
          className="admin-form-input"
          style={{ flex: 1 }}
          placeholder="🔍 Search place/landmark (e.g. Airport, Gerlach Store, Bruno's)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSearch(e);
            }
          }}
        />
        <Button variant="secondary" size="sm" type="button" onClick={handleSearch} disabled={searching}>
          {searching ? "..." : "Search"}
        </Button>
      </div>
      {searchError && (
        <div style={{ color: "var(--danger)", fontSize: "11px", marginTop: "3px" }}>
          {searchError}
        </div>
      )}
    </div>
  );
}

