import React, { useState, useMemo } from "react";
import { Venue, FestivalEvent } from "@/types/festival";
import { Icon } from "@/components/ui/icons";

interface LegendProps {
  categories: string[];
  activeCategories: string[];
  onToggleCategory: (category: string) => void;
  getColorStyle: (category: "Location" | "Action" | "Department" | "Personnel", value: string | undefined) => React.CSSProperties;
  venues?: Venue[];
  events?: FestivalEvent[];
  focusedVenueId?: string | null;
  onSelectVenue?: (venueId: string) => void;
  isCollapsed?: boolean;
  setIsCollapsed?: (collapsed: boolean) => void;
}

export const Legend: React.FC<LegendProps> = ({
  categories,
  activeCategories,
  onToggleCategory,
  getColorStyle,
  venues = [],
  events = [],
  focusedVenueId,
  onSelectVenue,
  isCollapsed: controlledIsCollapsed,
  setIsCollapsed: controlledSetIsCollapsed,
}) => {
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
  const isCollapsed = controlledIsCollapsed !== undefined ? controlledIsCollapsed : internalIsCollapsed;
  const setIsCollapsed = controlledSetIsCollapsed || setInternalIsCollapsed;
  const [activeTab, setActiveTab] = useState<"locations" | "categories">("locations");
  const [search, setSearch] = useState("");

  const mappableVenues = useMemo(() => {
    return venues.filter((v) => typeof v.lat === "number" && typeof v.lng === "number");
  }, [venues]);

  const filteredVenues = useMemo(() => {
    if (!search.trim()) return mappableVenues;
    const q = search.toLowerCase();
    return mappableVenues.filter(
      (v) => v.name.toLowerCase().includes(q) || (v.address && v.address.toLowerCase().includes(q))
    );
  }, [mappableVenues, search]);

  return (
    <div className={`map-legend-card ${isCollapsed ? "is-collapsed" : ""}`}>
      <div className="legend-card-header">
        <h3 className="legend-title">
          <Icon name="mapPin" size={14} /> Map Explorer
        </h3>
        <button
          type="button"
          className="legend-collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "Expand legend & locations" : "Collapse panel"}
        >
          <Icon name={isCollapsed ? "chevronDown" : "chevronUp"} size={14} />
        </button>
      </div>

      {!isCollapsed && (
        <>
          <div className="legend-tabs">
            <button
              type="button"
              className={`legend-tab ${activeTab === "locations" ? "active" : ""}`}
              onClick={() => setActiveTab("locations")}
            >
              Locations ({mappableVenues.length})
            </button>
            <button
              type="button"
              className={`legend-tab ${activeTab === "categories" ? "active" : ""}`}
              onClick={() => setActiveTab("categories")}
            >
              Categories ({categories.length})
            </button>
          </div>

          {activeTab === "categories" && (
            <div className="legend-categories">
              {categories.map((cat) => {
                const isActive = activeCategories.includes(cat);
                const style = getColorStyle("Location", cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`legend-item ${isActive ? "active" : "inactive"}`}
                    onClick={() => onToggleCategory(cat)}
                  >
                    <span 
                      className="legend-color-dot" 
                      style={{ backgroundColor: style.backgroundColor || "var(--accent)" }}
                    ></span>
                    <span className="legend-label">{cat}</span>
                    <span className="legend-toggle-status">
                      {isActive ? <Icon name="eye" size={12} /> : <Icon name="eyeOff" size={12} />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === "locations" && (
            <div className="legend-locations-container">
              {mappableVenues.length > 5 && (
                <div className="legend-search-box">
                  <Icon name="search" size={12} />
                  <input
                    type="text"
                    placeholder="Filter locations..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="legend-search-input"
                  />
                </div>
              )}
              <div className="legend-locations-list">
                {filteredVenues.length === 0 ? (
                  <div className="legend-empty-text">No locations found</div>
                ) : (
                  filteredVenues.map((venue) => {
                    const isSelected = focusedVenueId === venue.id;
                    const shiftCount = events.filter(
                      (e) => e.locationName && e.locationName.toLowerCase() === venue.name.toLowerCase()
                    ).length;
                    const style = getColorStyle("Location", venue.permanence);

                    return (
                      <button
                        key={venue.id}
                        type="button"
                        className={`legend-location-item ${isSelected ? "selected" : ""}`}
                        onClick={() => {
                          onSelectVenue?.(venue.id);
                          if (typeof window !== "undefined" && window.innerWidth <= 768) {
                            setIsCollapsed(true);
                          }
                        }}
                      >
                        <span
                          className="legend-color-dot"
                          style={{ backgroundColor: style.backgroundColor || "var(--accent)" }}
                        ></span>
                        <div className="legend-location-info">
                          <span className="legend-location-name">{venue.name}</span>
                          {venue.address && (
                            <span className="legend-location-subtext">{venue.address}</span>
                          )}
                        </div>
                        {shiftCount > 0 && (
                          <span className="legend-shift-badge">{shiftCount}</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
