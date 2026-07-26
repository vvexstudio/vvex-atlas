"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { APIProvider, Map, AdvancedMarker, MapMouseEvent } from "@vis.gl/react-google-maps";
import { AdminEntry, ServiceType } from "@/types/admin-entry";
import { EventType, FestivalDay } from "@/types/festival";
import { PredefinedLocation } from "@/lib/predefined-locations";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/icons";

type PinEditorProps = {
  initialData?: AdminEntry;
  locationOptions?: PredefinedLocation[];
};

const SERVICE_ICONS: Record<ServiceType, IconName> = {
  toilets: "toilet",
  water: "droplets",
  garbage: "trash",
  medic: "cross",
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bthe\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findLocationByName(input: string, options: PredefinedLocation[]): PredefinedLocation | null {
  const normalized = normalizeText(input);
  if (!normalized) return null;
  const exact = options.find((option) => normalizeText(option.name) === normalized);
  if (exact) return exact;
  return null;
}

export function PinEditor({ initialData, locationOptions = [] }: PinEditorProps) {
  const projectTypeOptions: EventType[] = [
    "installation",
    "exhibition",
    "performance",
    "music",
    "lecture",
    "community",
    "social",
    "object",
    "experience",
    "film",
    "dj",
    "venue",
    "food",
    "services",
  ];
  const dayOptions: FestivalDay[] = ["fri", "sat", "sun"];
  const serviceOptions: ServiceType[] = ["garbage", "water", "toilets", "medic"];
  const isEditing = Boolean(initialData);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: initialData?.name ?? "",
    artist: initialData?.artist ?? "",
    locationInternal: initialData?.locationInternal ?? "",
    projectType: initialData?.projectType ?? "installation",
    serviceType: initialData?.serviceType ?? "",
    abridgedProjectText: initialData?.abridgedProjectText ?? "",
    hasSchedule: initialData?.hasSchedule ?? false,
    day: initialData?.day ?? "fri",
    startTime: initialData?.startTime ?? "",
    endTime: initialData?.endTime ?? "",
    permanence: initialData?.permanence || "",
  });
  const matchedPredefinedLocation = findLocationByName(formData.locationInternal, locationOptions);

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    initialData && initialData.hasLocation && initialData.lat !== undefined && initialData.lng !== undefined
      ? { lat: initialData.lat, lng: initialData.lng }
      : null
  );
  const [selectedServiceTool, setSelectedServiceTool] = useState<ServiceType>("toilets");
  const [servicePins, setServicePins] = useState<Array<{ id: string; serviceType: ServiceType; lat: number; lng: number }>>([]);

  const isServicesBatchMode = !isEditing && formData.projectType === "services";

  const handleMapClick = (e: MapMouseEvent) => {
    if (e.detail.latLng) {
      const lat = e.detail.latLng.lat;
      const lng = e.detail.latLng.lng;
      if (isServicesBatchMode) {
        setServicePins((current) => [
          ...current,
          {
            id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            serviceType: selectedServiceTool,
            lat,
            lng,
          },
        ]);
        return;
      }
      setLocation({ lat, lng });
      setFormData((f) => {
        const trimmedVal = f.locationInternal.trim();
        const isCoordPattern = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(trimmedVal);
        if (!trimmedVal || isCoordPattern) {
          return { ...f, locationInternal: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
        }
        return f;
      });
    }
  };

  const handlePendingPinDragEnd = (
    pinId: string,
    event: { latLng?: { lat: () => number; lng: () => number } | null }
  ) => {
    const latLng = event.latLng;
    if (!latLng) return;
    setServicePins((current) =>
      current.map((pin) =>
        pin.id === pinId
          ? {
              ...pin,
              lat: latLng.lat(),
              lng: latLng.lng(),
            }
          : pin
      )
    );
  };

  const handleSingleLocationDragEnd = (
    event: { latLng?: { lat: () => number; lng: () => number } | null }
  ) => {
    const latLng = event.latLng;
    if (!latLng) return;
    const lat = latLng.lat();
    const lng = latLng.lng();
    setLocation({ lat, lng });
    setFormData((f) => {
      const trimmedVal = f.locationInternal.trim();
      const isCoordPattern = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(trimmedVal);
      if (!trimmedVal || isCoordPattern) {
        return { ...f, locationInternal: `${lat.toFixed(6)}, ${lng.toFixed(6)}` };
      }
      return f;
    });
  };

  const removePendingServicePin = (pinId: string) => {
    setServicePins((current) => current.filter((pin) => pin.id !== pinId));
  };

  const handleDeleteSavedEntry = async () => {
    if (!initialData) return;
    if (!window.confirm("Delete this entry? This cannot be undone.")) return;
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin-entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: initialData.id }),
      });
      if (!res.ok) {
        throw new Error("Failed to delete entry.");
      }
      router.push("/admin");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete entry.";
      setError(message);
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (isServicesBatchMode) {
      if (servicePins.length === 0) {
        setError("Add at least one service icon to the map before saving.");
        setIsSubmitting(false);
        return;
      }
      const payloadEntries = servicePins.map((pin, index) => ({
        name: `${pin.serviceType.charAt(0).toUpperCase()}${pin.serviceType.slice(1)} ${index + 1}`,
        artist: "",
        projectType: "services" as EventType,
        serviceType: pin.serviceType,
        abridgedProjectText: "",
        hasSchedule: false,
        day: "fri" as FestivalDay,
        startTime: "",
        endTime: "",
        permanence: "",
        lat: pin.lat,
        lng: pin.lng,
        hasLocation: true,
      }));
      try {
        const res = await fetch("/api/admin-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: payloadEntries }),
        });
        if (!res.ok) {
          throw new Error("Failed to save service pins.");
        }
        router.push("/admin");
        router.refresh();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to save service pins.";
        setError(message);
        setIsSubmitting(false);
      }
      return;
    }

    const payloadEntry = {
      name: formData.name,
      artist: formData.artist,
      locationInternal: formData.locationInternal,
      projectType: formData.projectType,
      serviceType:
        formData.projectType === "services"
          ? ((formData.serviceType || undefined) as ServiceType | undefined)
          : undefined,
      abridgedProjectText: formData.abridgedProjectText,
      hasSchedule: formData.hasSchedule,
      day: formData.day,
      startTime: formData.hasSchedule ? formData.startTime || "TBD" : "",
      endTime: formData.hasSchedule ? formData.endTime || "TBD" : "",
      permanence: formData.permanence,
      lat: location?.lat,
      lng: location?.lng,
      hasLocation: Boolean(location),
    };

    try {
      if (!isServicesBatchMode && !formData.name.trim()) {
        throw new Error("Project / Title is required.");
      }
      if (formData.projectType === "services" && !formData.serviceType) {
        throw new Error("Service Type is required when Project Type is Services.");
      }
      if (formData.hasSchedule && (!formData.startTime.trim() || !formData.endTime.trim())) {
        throw new Error("Start Time and End Time are required when schedule is enabled.");
      }

      const res = await fetch("/api/admin-entries", {
        method: initialData ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: initialData?.id,
          entry: payloadEntry,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save local admin entry.");
      }

      router.push("/admin");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save local admin entry.";
      setError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-editor">
      <form onSubmit={handleSubmit} className="card admin-editor-form">
        <h2 className="admin-editor-title">{initialData ? "Edit Pin" : "Add New Pin"}</h2>

        {error && <div className="admin-error">{error}</div>}

        {!isServicesBatchMode ? (
          <div>
            <label className="admin-label">Project / Title *</label>
            <input
              required
              type="text"
              className="admin-input"
              value={formData.name}
              onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
            />
          </div>
        ) : (
          <div className="admin-editor-note">Service pin names are auto-generated on save.</div>
        )}

        {!isServicesBatchMode && (
          <div>
            <label className="admin-label">Artist / Host</label>
            <input
              type="text"
              className="admin-input"
              value={formData.artist}
              onChange={e => setFormData(f => ({ ...f, artist: e.target.value }))}
            />
          </div>
        )}

        {!isServicesBatchMode && (
          <div>
            <label className="admin-label">Location</label>
            <input
              type="text"
              list="predefined-locations"
              className="admin-input"
              value={formData.locationInternal}
              onChange={(e) => {
                const nextValue = e.target.value;
                setFormData((f) => ({ ...f, locationInternal: nextValue }));
                const matched = findLocationByName(nextValue, locationOptions);
                if (matched) {
                  setLocation({ lat: matched.lat, lng: matched.lng });
                }
              }}
              placeholder="Choose or type a location"
            />
            <datalist id="predefined-locations">
              {locationOptions.map((option, index) => (
                <option key={`${option.name}:${option.lat}:${option.lng}:${index}`} value={option.name}>
                  {option.category}
                </option>
              ))}
            </datalist>
            <p className="admin-hint">
              {matchedPredefinedLocation
                ? `Mapped to ${matchedPredefinedLocation.category}: ${matchedPredefinedLocation.lat.toFixed(5)}, ${matchedPredefinedLocation.lng.toFixed(5)}`
                : "Selecting a predefined location auto-fills map coordinates."}
            </p>
          </div>
        )}

        <div>
          <label className="admin-label">Project Type *</label>
          <select
            className="admin-input"
            value={formData.projectType}
            onChange={e => setFormData(f => ({ ...f, projectType: e.target.value as EventType }))}
          >
            {projectTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {formData.projectType === "services" && !isServicesBatchMode && (
          <div>
            <label className="admin-label">Service Type *</label>
            <select
              className="admin-input"
              value={formData.serviceType}
              onChange={e => setFormData(f => ({ ...f, serviceType: e.target.value }))}
            >
              <option value="">Select service type...</option>
              {serviceOptions.map((serviceType) => (
                <option key={serviceType} value={serviceType}>
                  {serviceType}
                </option>
              ))}
            </select>
          </div>
        )}

        {!isServicesBatchMode && (
          <>
            <div>
              <label className="admin-label">Abridged Project Text</label>
              <textarea
                rows={5}
                className="admin-input"
                value={formData.abridgedProjectText}
                onChange={e => setFormData(f => ({ ...f, abridgedProjectText: e.target.value }))}
              />
            </div>

            <div className="admin-checkbox-row">
              <input
                id="hasSchedule"
                type="checkbox"
                checked={formData.hasSchedule}
                onChange={(e) => setFormData((f) => ({ ...f, hasSchedule: e.target.checked }))}
              />
              <label htmlFor="hasSchedule" className="admin-label admin-label-inline">
                Include schedule (day/start/end)
              </label>
            </div>

            {formData.hasSchedule && (
              <div className="admin-form-grid-3">
                <div>
                  <label className="admin-label">Day *</label>
                  <select
                    className="admin-input"
                    value={formData.day}
                    onChange={e => setFormData(f => ({ ...f, day: e.target.value as FestivalDay }))}
                  >
                    {dayOptions.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="admin-label">Start Time *</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={formData.startTime}
                    onChange={e => setFormData(f => ({ ...f, startTime: e.target.value }))}
                    placeholder="e.g. 03/28/2026 2:00 PM"
                  />
                </div>
                <div>
                  <label className="admin-label">End Time *</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={formData.endTime}
                    onChange={e => setFormData(f => ({ ...f, endTime: e.target.value }))}
                    placeholder="e.g. 4:00 PM"
                  />
                </div>
              </div>
            )}
          </>
        )}

        {isServicesBatchMode && (
          <div className="admin-toolbar-box">
            <p className="admin-label">Service Placement Toolbar *</p>
            <div className="admin-pill-row">
              {serviceOptions.map((serviceType) => (
                <button
                  key={serviceType}
                  type="button"
                  onClick={() => setSelectedServiceTool(serviceType)}
                  className={`admin-pill${selectedServiceTool === serviceType ? " admin-pill-active" : ""}`}
                >
                  {serviceType}
                </button>
              ))}
            </div>
            <p className="admin-hint">
              Click the map to drop {selectedServiceTool} markers. Pending markers: {servicePins.length}
            </p>
            <Button variant="ghost" size="sm" icon="trash" onClick={() => setServicePins([])}>
              Clear Pending Service Markers
            </Button>
            {servicePins.length > 0 && (
              <div className="admin-pin-list">
                {servicePins.map((pin, idx) => (
                  <div key={pin.id} className="admin-pin-row">
                    <span>
                      {idx + 1}. {pin.serviceType}{" "}
                      <span className="mono">
                        ({pin.lat.toFixed(5)}, {pin.lng.toFixed(5)})
                      </span>
                    </span>
                    <Button variant="danger" size="sm" onClick={() => removePendingServicePin(pin.id)}>
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!isServicesBatchMode && (
          <div>
            <label className="admin-label">Permanence (e.g. Permanent, Temporary)</label>
            <input
              type="text"
              className="admin-input"
              value={formData.permanence}
              onChange={e => setFormData(f => ({ ...f, permanence: e.target.value }))}
            />
          </div>
        )}

        <div className="admin-editor-actions">
          <Button variant="secondary" onClick={() => router.push("/admin")}>
            Cancel
          </Button>
          {isEditing && (
            <Button variant="danger" onClick={handleDeleteSavedEntry} disabled={isDeleting || isSubmitting}>
              {isDeleting ? "Deleting..." : "Delete Entry"}
            </Button>
          )}
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save admin entry"}
          </Button>
        </div>
      </form>

      <div className="admin-editor-map">
        <div className="admin-map-header">
          <p className="admin-label">Click on the map to set the exact coordinates.</p>
          <p className="admin-hint">
            {isServicesBatchMode
              ? `Pending markers: ${servicePins.length}`
              : `Current location: ${location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : "Not set (will be marked as Unplaced)"}`}
          </p>
          {!isServicesBatchMode && location && (
            <Button variant="danger" size="sm" icon="trash" onClick={() => setLocation(null)}>
              Clear Location
            </Button>
          )}
        </div>
        <div className="admin-map-canvas">
          <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}>
            <Map
              defaultCenter={location || { lat: 40.7864, lng: -119.2065 }}
              defaultZoom={location ? 16 : 14}
              mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "2f9f04bb8e9c458045b99a65"}
              disableDefaultUI={false}
              zoomControl={true}
              mapTypeControl={true}
              onClick={handleMapClick}
              gestureHandling="greedy"
              style={{ width: "100%", height: "100%" }}
            >
              {!isServicesBatchMode && location && (
                <AdvancedMarker position={location} draggable onDragEnd={handleSingleLocationDragEnd}>
                  <div className="admin-map-dot" />
                </AdvancedMarker>
              )}
              {isServicesBatchMode &&
                servicePins.map((pin) => (
                  <AdvancedMarker
                    key={pin.id}
                    position={{ lat: pin.lat, lng: pin.lng }}
                    draggable
                    onDragEnd={(event) => handlePendingPinDragEnd(pin.id, event as { latLng?: { lat: () => number; lng: () => number } | null })}
                  >
                    <button
                      type="button"
                      onClick={() => removePendingServicePin(pin.id)}
                      className="admin-map-marker"
                      title="Click to delete marker"
                    >
                      <Icon name={SERVICE_ICONS[pin.serviceType]} size={14} />
                    </button>
                  </AdvancedMarker>
                ))}
            </Map>
          </APIProvider>
        </div>
      </div>
    </div>
  );
}
