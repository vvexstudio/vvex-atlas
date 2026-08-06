"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

export interface MagicLinkGeneratorProps {
  /** Compact single-row variant used on the health dashboard. */
  compact?: boolean;
}

interface CatalogEvent {
  id: string;
  title: string;
  department?: string;
  locationName?: string;
  day?: string;
  scheduleDate?: string;
  startTime?: string;
  endTime?: string;
  host?: string;
}

function generateHighEntropyToken(prefix: string) {
  const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const sanitized = prefix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "token";
  return `v_${sanitized}_${randomHex}`;
}

/**
 * Granular vendor magic-link + iCal feed URL generator.
 * Provides event-by-event checkbox picking, location filtering, date/time ranges, and department selection.
 */
export function MagicLinkGenerator({ compact = false }: MagicLinkGeneratorProps) {
  // Data Catalog State
  const [departments, setDepartments] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [catalogEvents, setCatalogEvents] = useState<CatalogEvent[]>([]);

  // Granular Filter Selection States
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [customToken, setCustomToken] = useState("");
  const [eventSearchQuery, setEventSearchQuery] = useState("");

  // Dropdown UI Open States
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [isEventPickerOpen, setIsEventPickerOpen] = useState(false);

  // Token Generation States
  const [secureToken, setSecureToken] = useState("");
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [copiedType, setCopiedType] = useState<"magic" | "ics" | "secure" | null>(null);

  const deptRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);
  const [activeOrigin, setActiveOrigin] = useState<string>("https://portal.is");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setActiveOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    async function loadCatalog() {
      try {
        const res = await fetch("/api/admin/events-catalog");
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.departments)) setDepartments(json.departments);
          if (Array.isArray(json.locations)) setLocations(json.locations);
          if (Array.isArray(json.events)) setCatalogEvents(json.events);
        }
      } catch (err) {
        console.error("Failed to load catalog for Magic Link Generator:", err);
      }
    }
    loadCatalog();
  }, []);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (deptRef.current && !deptRef.current.contains(e.target as Node)) {
        setIsDeptDropdownOpen(false);
      }
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setIsLocationDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAllDeptsSelected =
    selectedDepts.includes("All Departments") ||
    (departments.length > 0 && selectedDepts.length === departments.length);

  const toggleDepartment = (dept: string) => {
    if (dept === "All Departments") {
      if (isAllDeptsSelected) {
        setSelectedDepts([]);
      } else {
        setSelectedDepts(["All Departments"]);
      }
      return;
    }

    const withoutAll = selectedDepts.filter((d) => d !== "All Departments");
    let updated: string[];
    if (withoutAll.includes(dept)) {
      updated = withoutAll.filter((d) => d !== dept);
    } else {
      updated = [...withoutAll, dept];
    }

    if (departments.length > 0 && updated.length === departments.length) {
      setSelectedDepts(["All Departments"]);
    } else {
      setSelectedDepts(updated);
    }
  };

  const toggleLocation = (loc: string) => {
    if (selectedLocations.includes(loc)) {
      setSelectedLocations(selectedLocations.filter((l) => l !== loc));
    } else {
      setSelectedLocations([...selectedLocations, loc]);
    }
  };

  const toggleEventId = (id: string) => {
    if (selectedEventIds.includes(id)) {
      setSelectedEventIds(selectedEventIds.filter((eId) => eId !== id));
    } else {
      setSelectedEventIds([...selectedEventIds, id]);
    }
  };

  // Filtered Events inside Picker
  const filteredCatalogEvents = catalogEvents.filter((evt) => {
    if (!eventSearchQuery.trim()) return true;
    const q = eventSearchQuery.toLowerCase();
    return (
      (evt.title && evt.title.toLowerCase().includes(q)) ||
      (evt.department && evt.department.toLowerCase().includes(q)) ||
      (evt.locationName && evt.locationName.toLowerCase().includes(q)) ||
      (evt.day && evt.day.toLowerCase().includes(q))
    );
  });

  const handleSelectAllFilteredEvents = () => {
    const idsToAdd = filteredCatalogEvents.map((e) => e.id);
    const combined = Array.from(new Set([...selectedEventIds, ...idsToAdd]));
    setSelectedEventIds(combined);
  };

  const handleClearAllEvents = () => setSelectedEventIds([]);

  // Compute primary tag/label
  const primaryPrefix =
    customToken.trim() ||
    (selectedEventIds.length > 0
      ? `${selectedEventIds.length}_events`
      : isAllDeptsSelected
      ? "All_Departments"
      : selectedDepts.join("_") || "custom");

  const magicLinkUrl = `${activeOrigin}/vendor?token=${encodeURIComponent(customToken.trim() || (isAllDeptsSelected ? "All Departments" : selectedDepts.join(",")) || "vendor")}`;
  const icsFeedUrl = `${activeOrigin}/api/ics?token=demo-token&dept=${encodeURIComponent(customToken.trim() || selectedDepts.join(",") || "all")}`;
  const secureMagicUrl = secureToken ? `${activeOrigin}/vendor?token=${secureToken}` : "";

  const handleGenerateSecureToken = async () => {
    setIsSavingToken(true);
    const token = generateHighEntropyToken(primaryPrefix);
    setSecureToken(token);

    try {
      await fetch("/api/admin/vendor-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          vendorName: customToken.trim() || (selectedEventIds.length > 0 ? `${selectedEventIds.length} Pinned Events` : selectedDepts.join(", ") || "Custom Magic Link"),
          departments: isAllDeptsSelected ? ["All Departments"] : selectedDepts,
          eventIds: selectedEventIds,
          locations: selectedLocations,
          startDate,
          endDate,
          startTime,
          endTime,
          keyword: customToken.trim(),
        }),
      });
    } catch (e) {
      console.warn("Failed to persist secure vendor token to RTDB:", e);
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleCopy = (type: "magic" | "ics" | "secure", url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  if (compact) {
    return (
      <>
        <div className="admin-form-row admin-mlg-compact-row">
          <div style={{ minWidth: "240px" }}>
            <label className="admin-label">Select Department(s):</label>
            <div className="admin-multiselect-container" ref={deptRef}>
              <button
                type="button"
                className="admin-multiselect-trigger"
                onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
              >
                <span>
                  {selectedDepts.length === 0
                    ? "Select Departments..."
                    : isAllDeptsSelected
                    ? "All Departments"
                    : `${selectedDepts.length} Selected`}
                </span>
                <Icon name={isDeptDropdownOpen ? "chevronUp" : "chevronDown"} size={14} />
              </button>
              {isDeptDropdownOpen && (
                <div className="admin-multiselect-menu">
                  <div className="admin-multiselect-list">
                    {departments.map((dept) => (
                      <label key={dept} className="admin-multiselect-item">
                        <input
                          type="checkbox"
                          checked={isAllDeptsSelected || selectedDepts.includes(dept)}
                          onChange={() => toggleDepartment(dept)}
                        />
                        <span>{dept}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="admin-mlg-actions">
            <Button
              variant="secondary"
              size="sm"
              icon={copiedType === "magic" ? "check" : "copy"}
              onClick={() => handleCopy("magic", magicLinkUrl)}
            >
              {copiedType === "magic" ? "Copied" : "Copy Magic Link"}
            </Button>
            <a href={magicLinkUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
              <Icon name="externalLink" size={14} /> Test
            </a>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="admin-mlg">
      {/* 1. Primary Filter Controls Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        {/* Department Multi-Select */}
        <div ref={deptRef} className="admin-multiselect-container">
          <label className="admin-label">1. Department Scope Multi-Select:</label>
          <button
            type="button"
            className="admin-multiselect-trigger"
            onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
          >
            <span>
              {selectedDepts.length === 0
                ? "Select Departments..."
                : isAllDeptsSelected
                ? "✨ All Departments (Inclusive Feed)"
                : `${selectedDepts.length} Department(s) Selected`}
            </span>
            <Icon name={isDeptDropdownOpen ? "chevronUp" : "chevronDown"} size={14} />
          </button>

          {isDeptDropdownOpen && (
            <div className="admin-multiselect-menu">
              <div className="admin-multiselect-actions">
                <Button variant="ghost" size="sm" onClick={() => setSelectedDepts(["All Departments"])}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedDepts([])}>
                  Clear
                </Button>
              </div>
              <div className="admin-multiselect-list">
                <label className="admin-multiselect-item" style={{ fontWeight: 600, color: "var(--accent, #f97316)" }}>
                  <input
                    type="checkbox"
                    checked={isAllDeptsSelected}
                    onChange={() => toggleDepartment("All Departments")}
                  />
                  <span>✨ All Departments (Inclusive Feed)</span>
                </label>
                {departments.map((dept) => (
                  <label key={dept} className="admin-multiselect-item">
                    <input
                      type="checkbox"
                      checked={isAllDeptsSelected || selectedDepts.includes(dept)}
                      onChange={() => toggleDepartment(dept)}
                    />
                    <span>{dept}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Location / Venue Multi-Select */}
        <div ref={locationRef} className="admin-multiselect-container">
          <label className="admin-label">2. Location / Venue Multi-Select:</label>
          <button
            type="button"
            className="admin-multiselect-trigger"
            onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
          >
            <span>
              {selectedLocations.length === 0
                ? "All Locations (No Location Filter)"
                : `${selectedLocations.length} Location(s) Selected`}
            </span>
            <Icon name={isLocationDropdownOpen ? "chevronUp" : "chevronDown"} size={14} />
          </button>

          {isLocationDropdownOpen && (
            <div className="admin-multiselect-menu">
              <div className="admin-multiselect-actions">
                <Button variant="ghost" size="sm" onClick={() => setSelectedLocations([...locations])}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedLocations([])}>
                  Clear
                </Button>
              </div>
              <div className="admin-multiselect-list">
                {locations.map((loc) => (
                  <label key={loc} className="admin-multiselect-item">
                    <input
                      type="checkbox"
                      checked={selectedLocations.includes(loc)}
                      onChange={() => toggleLocation(loc)}
                    />
                    <span>{loc}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Granular Event-by-Event Checkbox Selector Accordion */}
      <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid var(--line, rgba(255,255,255,0.1))", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong style={{ color: "var(--ink)", fontSize: "0.95rem" }}>
              🎯 Event-by-Event Checkbox Selector ({selectedEventIds.length} Pinned)
            </strong>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
              Pick specific individual schedule items to create a pinpoint magic link.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsEventPickerOpen(!isEventPickerOpen)}
          >
            <Icon name={isEventPickerOpen ? "chevronUp" : "chevronDown"} size={14} />
            {isEventPickerOpen ? "Hide Event Checklist" : `Open Event Checklist (${selectedEventIds.length})`}
          </Button>
        </div>

        {isEventPickerOpen && (
          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--line, rgba(255,255,255,0.1))" }}>
            <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
              <input
                type="text"
                className="admin-input"
                placeholder="Search events by title, department, or venue..."
                value={eventSearchQuery}
                onChange={(e) => setEventSearchQuery(e.target.value)}
                style={{ flex: 1 }}
              />
              <Button variant="ghost" size="sm" onClick={handleSelectAllFilteredEvents}>
                Select All Filtered ({filteredCatalogEvents.length})
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClearAllEvents}>
                Clear Events
              </Button>
            </div>

            <div style={{ maxHeight: "240px", overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", background: "rgba(0,0,0,0.2)", padding: "8px", borderRadius: "6px" }}>
              {filteredCatalogEvents.length === 0 ? (
                <div style={{ gridColumn: "1 / -1", padding: "12px", textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>
                  No events found matching &quot;{eventSearchQuery}&quot;
                </div>
              ) : (
                filteredCatalogEvents.map((evt) => {
                  const isChecked = selectedEventIds.includes(evt.id);
                  return (
                    <label
                      key={evt.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 8px",
                        borderRadius: "4px",
                        background: isChecked ? "rgba(249, 115, 22, 0.15)" : "transparent",
                        border: isChecked ? "1px solid rgba(249, 115, 22, 0.3)" : "1px solid transparent",
                        cursor: "pointer",
                        fontSize: "0.82rem",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleEventId(evt.id)}
                      />
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <strong>{evt.title}</strong>
                        <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                          {evt.day?.toUpperCase()} {evt.startTime} • {evt.locationName || "No venue"}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Date & Time Range Pickers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <div>
          <label className="admin-label">📅 Date Range Filter:</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <input
              type="date"
              className="admin-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Start Date"
            />
            <input
              type="date"
              className="admin-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="End Date"
            />
          </div>
          <span className="admin-hint">Restricts link to events within date range.</span>
        </div>

        <div>
          <label className="admin-label">⏰ Daily Time Window Filter:</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <input
              type="time"
              className="admin-input"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <input
              type="time"
              className="admin-input"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          <span className="admin-hint">Filters events by daily start/end window (e.g. 22:00 to 06:00).</span>
        </div>
      </div>

      {/* 4. Custom Keyword Override Field */}
      <div style={{ marginBottom: "16px" }}>
        <label className="admin-label" htmlFor="vendor-custom-token">
          🏷️ Custom Keyword / Vendor Tag Override:
        </label>
        <input
          id="vendor-custom-token"
          type="text"
          className="admin-input"
          value={customToken}
          onChange={(e) => setCustomToken(e.target.value)}
          placeholder="e.g. Catering, Night Shift, WonderBros"
        />
        <span className="admin-hint">Optional keyword tag to associate with this token.</span>
      </div>

      {/* 5. Granular Scope Summary Chips */}
      <div style={{ background: "rgba(139, 92, 246, 0.08)", border: "1px solid rgba(139, 92, 246, 0.25)", borderRadius: "8px", padding: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong style={{ color: "#a78bfa" }}>🔒 High-Entropy Cryptographic Token Generator</strong>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
              Generates an unguessable 128-bit secure token enforcing all active granular filters above.
            </p>
          </div>
          <Button variant="primary" size="sm" icon="lock" onClick={handleGenerateSecureToken} disabled={isSavingToken}>
            {isSavingToken ? "Saving Token..." : "Generate Secure 128-bit Token"}
          </Button>
        </div>

        {/* Active Constraints Summary */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "12px" }}>
          {selectedEventIds.length > 0 && (
            <span className="chip chip-accent" style={{ fontSize: "0.75rem" }}>
              🎯 {selectedEventIds.length} Pinned Events
            </span>
          )}
          {selectedLocations.length > 0 && (
            <span className="chip chip-accent" style={{ fontSize: "0.75rem" }}>
              📍 {selectedLocations.length} Locations ({selectedLocations.join(", ")})
            </span>
          )}
          {(startDate || endDate) && (
            <span className="chip chip-accent" style={{ fontSize: "0.75rem" }}>
              📅 Dates: {startDate || "Start"} ➔ {endDate || "End"}
            </span>
          )}
          {(startTime || endTime) && (
            <span className="chip chip-accent" style={{ fontSize: "0.75rem" }}>
              ⏰ Time Window: {startTime || "00:00"} - {endTime || "23:59"}
            </span>
          )}
          {selectedDepts.length > 0 && (
            <span className="chip chip-accent" style={{ fontSize: "0.75rem" }}>
              🏷️ Depts: {isAllDeptsSelected ? "All Departments" : selectedDepts.join(", ")}
            </span>
          )}
        </div>

        {secureToken && (
          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="admin-mlg-url-head">
              <strong className="admin-mlg-url-label">Secure Token Link:</strong>
              <Button
                variant="secondary"
                size="sm"
                icon={copiedType === "secure" ? "check" : "copy"}
                onClick={() => handleCopy("secure", secureMagicUrl)}
              >
                {copiedType === "secure" ? "Copied" : "Copy Secure Link"}
              </Button>
            </div>
            <code className="admin-mlg-code mono" suppressHydrationWarning>{secureMagicUrl}</code>
          </div>
        )}
      </div>

      {/* Standard URLs & Action */}
      <div className="admin-mlg-urls">
        <div>
          <div className="admin-mlg-url-head">
            <strong className="admin-mlg-url-label">
              <Icon name="link" size={14} />
              Vendor Schedule Magic Link:
            </strong>
            <Button
              variant="secondary"
              size="sm"
              icon={copiedType === "magic" ? "check" : "copy"}
              onClick={() => handleCopy("magic", magicLinkUrl)}
            >
              {copiedType === "magic" ? "Copied" : "Copy Link"}
            </Button>
          </div>
          <code className="admin-mlg-code mono" suppressHydrationWarning>{magicLinkUrl}</code>
        </div>
      </div>

      <div className="admin-mlg-actions">
        <a href={magicLinkUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
          <Icon name="externalLink" size={16} /> Open Mobile View
        </a>
      </div>
    </div>
  );
}
