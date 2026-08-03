import React, { useMemo, useState, useEffect, useRef } from "react";
import { APIProvider, Map, AdvancedMarker, AdvancedMarkerAnchorPoint, ColorScheme, InfoWindow, useMap } from "@vis.gl/react-google-maps";
import { Venue, FestivalEvent } from "@/types/festival";
import { Icon, type IconName } from "@/components/ui/icons";

interface MapViewProps {
  venues: Venue[];
  mapCenter: { lat: number; lng: number };
  defaultZoom: number;
  focusedVenueId?: string | null;
  setFocusedVenueId?: (id: string | null) => void;
  setSelectedLocations?: (locations: string[]) => void;
  setMainTab?: (tab: "schedule" | "calendar" | "map" | "now-next") => void;
  events?: FestivalEvent[];
  getColorStyle?: (category: "Location" | "Action" | "Department" | "Personnel", value: string | undefined) => React.CSSProperties;
  activeCategories?: string[];
  isDarkMode?: boolean;
  currentTime?: Date | null;
  effectiveDateStr?: string;
  hideUnscheduled?: boolean;
  setModalEvent?: (event: FestivalEvent) => void;
}

const getCategoryIcon = (category: string): IconName => {
  const clean = (category || "").toLowerCase().trim();
  if (clean.includes("hotel") || clean.includes("lodging") || clean.includes("housing")) return "hotel";
  if (clean.includes("forest") || clean.includes("wood") || clean.includes("nature")) return "trees";
  if (clean.includes("transport") || clean.includes("shuttle") || clean.includes("bus")) return "bus";
  if (clean.includes("crew") || clean.includes("ops") || clean.includes("office")) return "settings";
  if (clean.includes("venue") || clean.includes("stage") || clean.includes("bar")) return "tent";
  if (clean.includes("service") || clean.includes("toilet") || clean.includes("water") || clean.includes("medical")) return "wrench";
  return "mapPin";
};

const timeToMinutes = (timeStr: string): number => {
  if (!timeStr || timeStr === "TBD") return -1;
  const compact = timeStr.replace(/\s+/g, "").toLowerCase();
  const match = compact.match(/^(\d{1,2})(?::(\d{2}))?([ap]m|m)?$/);
  if (!match) return -1;
  
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  const suffix = match[3];
  
  if (suffix === "pm" && hours < 12) hours += 12;
  if ((suffix === "am" || suffix === "m") && hours === 12) hours = 0;
  
  return hours * 60 + minutes;
};

const getEventStartMs = (e: FestivalEvent): number => {
  if (!e.scheduleDate || e.scheduleDate === "Date TBD") return Infinity;
  const parts = e.scheduleDate.split("-").map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return Infinity;
  const [y, m, d] = parts;
  const mins = timeToMinutes(e.startTime);
  const hours = mins !== -1 ? Math.floor(mins / 60) : 0;
  const minutes = mins !== -1 ? mins % 60 : 0;
  return new Date(y, m - 1, d, hours, minutes, 0, 0).getTime();
};

const formatEventDateLabel = (dateStr?: string): string => {
  if (!dateStr || dateStr === "Date TBD") return "Date TBD";
  const parts = dateStr.split("-").map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

// MapContent wrapper to have access to useMap hook
const MapContent: React.FC<{
  visibleMappableVenues: Venue[];
  mapCenterCoords: { lat: number; lng: number };
  defaultZoom: number;
  focusedVenueId?: string | null;
  setFocusedVenueId?: (id: string | null) => void;
  setSelectedLocations?: (locations: string[]) => void;
  setMainTab?: (tab: "schedule" | "calendar" | "map" | "now-next") => void;
  events?: FestivalEvent[];
  getColorStyle?: (category: "Location" | "Action" | "Department" | "Personnel", value: string | undefined) => React.CSSProperties;
  isDarkMode?: boolean;
  currentTime?: Date | null;
  effectiveDateStr?: string;
  hideUnscheduled?: boolean;
  setModalEvent?: (event: FestivalEvent) => void;
}> = ({
  visibleMappableVenues,
  mapCenterCoords,
  defaultZoom,
  focusedVenueId,
  setFocusedVenueId,
  setSelectedLocations,
  setMainTab,
  events = [],
  getColorStyle,
  isDarkMode = true,
  currentTime,
  effectiveDateStr,
  hideUnscheduled = true,
  setModalEvent,
}) => {
  const map = useMap();
  const [activeVenue, setActiveVenue] = useState<Venue | null>(null);
  // colorScheme is fixed at map init, so theme changes remount the <Map>.
  // Camera tracking lives in a ref (state here would re-render every marker
  // on each pan); it is snapshotted into state only when the theme flips,
  // so the remounted map keeps its position.
  const cameraRef = useRef<{ center: { lat: number; lng: number }; zoom: number } | null>(null);
  const [mapDark, setMapDark] = useState(isDarkMode);
  const [savedCamera, setSavedCamera] = useState<{ center: { lat: number; lng: number }; zoom: number } | null>(null);

  useEffect(() => {
    if (mapDark !== isDarkMode) {
      setSavedCamera(cameraRef.current);
      setMapDark(isDarkMode);
    }
  }, [isDarkMode, mapDark]);

  // Sync programmatically focused venue (e.g. from event modal)
  useEffect(() => {
    if (!map || !focusedVenueId) return;
    const venue = visibleMappableVenues.find((v) => v.id === focusedVenueId);
    if (venue && typeof venue.lat === "number" && typeof venue.lng === "number") {
      map.panTo({ lat: venue.lat, lng: venue.lng });
      map.setZoom(16);
      setTimeout(() => {
        setActiveVenue(venue);
      }, 0);
    }
  }, [map, focusedVenueId, visibleMappableVenues]);

  // Clean focus state when popup closed
  const handleCloseInfoWindow = () => {
    setActiveVenue(null);
    if (setFocusedVenueId) {
      setFocusedVenueId(null);
    }
  };

  const [isDescExpanded, setIsDescExpanded] = useState(false);

  // Find events at this location
  const locationEvents = useMemo(() => {
    if (!activeVenue) return [];
    let matched = events.filter(
      (e) => e.locationName && e.locationName.toLowerCase().trim() === activeVenue.name.toLowerCase().trim()
    );
    if (hideUnscheduled) {
      matched = matched.filter((e) => e.scheduleDate && e.scheduleDate !== "Date TBD");
    }
    // Sort chronologically
    return [...matched].sort((a, b) => {
      const aMs = getEventStartMs(a);
      const bMs = getEventStartMs(b);
      if (aMs !== bMs) return aMs - bMs;
      return (a.title || "").localeCompare(b.title || "");
    });
  }, [events, activeVenue, hideUnscheduled]);

  const { nextEvent, otherEvents } = useMemo(() => {
    if (locationEvents.length === 0) return { nextEvent: null, otherEvents: [] };
    const nowMs = currentTime ? currentTime.getTime() : 0;

    // Find first event starting in the future or currently active
    const upcoming = locationEvents.find((e) => {
      const startMs = getEventStartMs(e);
      return startMs >= nowMs || (startMs !== Infinity && startMs + 3600000 >= nowMs);
    });

    const primary = upcoming || locationEvents[0];
    const rest = locationEvents.filter((e) => e.id !== primary.id);
    return { nextEvent: primary, otherEvents: rest };
  }, [locationEvents, currentTime]);

  // Group other events by date for visual dividers inside scrolling menu
  const groupedOtherEvents = useMemo(() => {
    const groups: { dateStr: string; dateLabel: string; events: FestivalEvent[] }[] = [];
    const dateMap = new globalThis.Map<string, FestivalEvent[]>();
    otherEvents.forEach((e) => {
      const d = e.scheduleDate || "Date TBD";
      if (!dateMap.has(d)) dateMap.set(d, []);
      dateMap.get(d)!.push(e);
    });
    dateMap.forEach((eventsForDate, dateStr) => {
      groups.push({
        dateStr,
        dateLabel: formatEventDateLabel(dateStr),
        events: eventsForDate,
      });
    });
    return groups;
  }, [otherEvents]);

  return (
    <Map
      key={mapDark ? "map-dark" : "map-light"}
      defaultCenter={savedCamera?.center ?? mapCenterCoords}
      defaultZoom={savedCamera?.zoom ?? defaultZoom}
      mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "2f9f04bb8e9c458045b99a65"}
      colorScheme={mapDark ? ColorScheme.DARK : ColorScheme.LIGHT}
      disableDefaultUI={false}
      style={{ width: "100%", height: "100%" }}
      onClick={() => setActiveVenue(null)}
      onIdle={(ev) => {
        const center = ev.map.getCenter()?.toJSON();
        const zoom = ev.map.getZoom();
        if (center && typeof zoom === "number") {
          cameraRef.current = { center, zoom };
        }
      }}
    >
      {visibleMappableVenues.map((venue) => {
        const icon = getCategoryIcon(venue.permanence || "");
        const style = getColorStyle ? getColorStyle("Location", venue.permanence) : {};
        return (
          <AdvancedMarker
            key={venue.id}
            position={{ lat: venue.lat!, lng: venue.lng! }}
            anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
            onClick={(e) => {
              e.stop();
              setActiveVenue(venue);
              setIsDescExpanded(false);
            }}
          >
            <div className="custom-map-marker" style={{ borderColor: style.color || "var(--accent)" }}>
              <span className="marker-dot-icon"><Icon name={icon} size={12} /></span>
              <span className="marker-label">{venue.name}</span>
            </div>
          </AdvancedMarker>
        );
      })}

      {activeVenue && (
        <InfoWindow
          position={{ lat: activeVenue.lat!, lng: activeVenue.lng! }}
          onCloseClick={handleCloseInfoWindow}
        >
          <div className="map-infowindow">
            <h3 className="infowindow-title">{activeVenue.name}</h3>
            {activeVenue.address && (
              <div className="infowindow-address">
                <Icon name="mapPin" size={12} /> {activeVenue.address}
              </div>
            )}
            {activeVenue.permanence && (
              <span className="infowindow-category-badge">{activeVenue.permanence}</span>
            )}
            {activeVenue.description && (
              <div className="infowindow-desc">
                {activeVenue.description.length > 80 && !isDescExpanded ? (
                  <>
                    {activeVenue.description.slice(0, 80)}...
                    <button
                      type="button"
                      className="infowindow-desc-toggle"
                      onClick={() => setIsDescExpanded(true)}
                    >
                      Read more
                    </button>
                  </>
                ) : (
                  <>
                    {activeVenue.description}
                    {activeVenue.description.length > 80 && (
                      <button
                        type="button"
                        className="infowindow-desc-toggle"
                        onClick={() => setIsDescExpanded(false)}
                      >
                        Show less
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Directions & Action Links */}
            <div className="infowindow-actions">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${activeVenue.lat},${activeVenue.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="infowindow-btn directions-btn"
              >
                <Icon name="car" size={12} /> Directions
              </a>
              {setSelectedLocations && setMainTab && (
                <button
                  type="button"
                  className="infowindow-btn filter-btn"
                  onClick={() => {
                    setSelectedLocations([activeVenue.name]);
                    setMainTab("schedule");
                  }}
                  title="Filter main schedule grid to this location"
                >
                  <Icon name="clipboard" size={12} /> Filter Events
                </button>
              )}
              {setSelectedLocations && setMainTab && (
                <button
                  type="button"
                  className="infowindow-btn calendar-btn"
                  onClick={() => {
                    setSelectedLocations([activeVenue.name]);
                    setMainTab("calendar");
                  }}
                  title="View this location on Spatial Calendar"
                >
                  <Icon name="calendar" size={12} /> View on Calendar
                </button>
              )}
            </div>

            {/* Scheduled Events Section */}
            <div className="infowindow-events">
              <h4>Location Schedule ({locationEvents.length})</h4>

              {locationEvents.length === 0 ? (
                <p className="no-events-text">No scheduled events at this location.</p>
              ) : (
                <>
                  {/* Full Next Event Highlight Card */}
                  {nextEvent && (
                    <div
                      className="infowindow-next-card"
                      onClick={() => setModalEvent && setModalEvent(nextEvent)}
                      style={{ cursor: setModalEvent ? "pointer" : "default" }}
                      title="Click to view full event details"
                    >
                      <div className="next-card-kicker">
                        <Icon name="zap" size={11} /> Next Event
                      </div>
                      <div className="next-card-date-time">
                        <span className="next-card-date">{formatEventDateLabel(nextEvent.scheduleDate)}</span>
                        <span className="next-card-dot">•</span>
                        <span className="next-card-time"><Icon name="clock" size={11} /> {nextEvent.startTime || "TBD"}</span>
                      </div>
                      <h4 className="next-card-title">{nextEvent.title}</h4>
                      {(nextEvent.department || nextEvent.action || nextEvent.leadPointPerson) && (
                        <div className="next-card-tags">
                          {nextEvent.department && (
                            <span className="ev-tag" style={getColorStyle ? getColorStyle("Department", nextEvent.department) : {}}>
                              {nextEvent.department}
                            </span>
                          )}
                          {nextEvent.action && (
                            <span className="ev-tag" style={getColorStyle ? getColorStyle("Action", nextEvent.action) : {}}>
                              {nextEvent.action}
                            </span>
                          )}
                          {nextEvent.leadPointPerson && (
                            <span className="ev-tag" style={getColorStyle ? getColorStyle("Personnel", nextEvent.leadPointPerson) : {}}>
                              <Icon name="user" size={10} /> {nextEvent.leadPointPerson}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inset Scrollable List for All Other Events */}
                  {otherEvents.length > 0 && (
                    <div className="infowindow-inset-section">
                      <div className="inset-section-title">All Other Events ({otherEvents.length})</div>
                      <div className="infowindow-inset-scroll">
                        {groupedOtherEvents.map((group) => (
                          <div key={group.dateStr} className="inset-date-group">
                            <div className="inset-date-divider">
                              <Icon name="calendar" size={10} />
                              <span>{group.dateLabel}</span>
                            </div>
                            <ul className="infowindow-event-list">
                              {group.events.map((e) => (
                                <li
                                  key={e.id}
                                  onClick={() => setModalEvent && setModalEvent(e)}
                                  style={{ cursor: setModalEvent ? "pointer" : "default" }}
                                  title="Click to view full event details"
                                >
                                  <span className="ev-time"><Icon name="clock" size={11} /> {e.startTime || "TBD"}</span>
                                  <span className="ev-title">{e.title}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </InfoWindow>
      )}
    </Map>
  );
};

export const MapView: React.FC<MapViewProps> = ({
  venues,
  mapCenter,
  defaultZoom,
  focusedVenueId,
  setFocusedVenueId,
  setSelectedLocations,
  setMainTab,
  events = [],
  getColorStyle,
  activeCategories,
  isDarkMode = true,
  currentTime,
  effectiveDateStr,
  hideUnscheduled = true,
  setModalEvent,
}) => {
  // Filter venues based on coordinates existence and legend category visibility toggles
  const visibleMappableVenues = useMemo(() => {
    return venues.filter((v) => {
      const hasCoords = typeof v.lat === "number" && typeof v.lng === "number";
      if (!hasCoords) return false;
      if (activeCategories && activeCategories.length > 0) {
        // permanence contains category string e.g. "Standard" / "installation"
        const category = v.permanence || "Standard";
        return activeCategories.includes(category);
      }
      return true;
    });
  }, [venues, activeCategories]);

  const [mapAuthError, setMapAuthError] = useState(false);

  useEffect(() => {
    const previousHandler = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      setMapAuthError(true);
      if (typeof previousHandler === "function") previousHandler();
    };
    return () => {
      (window as any).gm_authFailure = previousHandler;
    };
  }, []);

  const mapCenterCoords = useMemo(() => {
    const mappable = visibleMappableVenues.find((v) => typeof v.lat === "number" && typeof v.lng === "number");
    if (mappable && mappable.lat && mappable.lng) {
      return { lat: mappable.lat, lng: mappable.lng };
    }
    return mapCenter;
  }, [visibleMappableVenues, mapCenter]);

  if (mapAuthError) {
    return (
      <div className="map-placeholder-container" style={{ padding: "2rem" }}>
        <div className="map-placeholder-card" style={{ maxWidth: "550px", borderLeft: "4px solid var(--danger)" }}>
          <div className="map-placeholder-icon"><Icon name="warning" size={40} /></div>
          <h2 style={{ color: "var(--danger)", fontSize: "1.15rem" }}>Google Maps API Key Error (ApiProjectMapError)</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--ink)", textAlign: "left", lineHeight: 1.5 }}>
            The Google Maps JavaScript API returned an <strong>ApiProjectMapError</strong> authentication failure.
          </p>
          <div style={{ textAlign: "left", fontSize: "0.8rem", color: "var(--muted)", background: "var(--danger-soft)", padding: "0.75rem", borderRadius: "var(--radius-sm)", margin: "1rem 0" }}>
            <strong>How to resolve this in Google Cloud Console:</strong>
            <ol style={{ margin: "0.5rem 0 0 0", paddingLeft: "1.2rem" }}>
              <li>Ensure <strong>Maps JavaScript API</strong> is enabled on your GCP project.</li>
              <li>Confirm <strong>Billing</strong> is enabled for the Google Cloud project.</li>
              <li>Check API Key Application Restrictions to ensure current domain/localhost is authorized.</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-map-container" style={{ height: "100%", width: "100%" }}>
      {visibleMappableVenues.length > 0 ? (
        <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}>
          <MapContent
            visibleMappableVenues={visibleMappableVenues}
            mapCenterCoords={mapCenterCoords}
            defaultZoom={defaultZoom}
            focusedVenueId={focusedVenueId}
            setFocusedVenueId={setFocusedVenueId}
            setSelectedLocations={setSelectedLocations}
            setMainTab={setMainTab}
            events={events}
            getColorStyle={getColorStyle}
            isDarkMode={isDarkMode}
            currentTime={currentTime}
            effectiveDateStr={effectiveDateStr}
            hideUnscheduled={hideUnscheduled}
            setModalEvent={setModalEvent}
          />
        </APIProvider>
      ) : (
        /* Greyed-out Blueprint Placeholder Map View */
        <div className="map-placeholder-container">
          <div className="map-placeholder-grid" />
          <div className="map-placeholder-card">
            <div className="map-placeholder-icon"><Icon name="map" size={40} /></div>
            <h2>Interactive Map Scaffolded</h2>
            <p>
              The interactive map interface is pre-configured and ready. Geographical coordinates (Lat/Long) are currently pending in the Google Sheet database.
            </p>
            <div className="map-placeholder-badge">
              <span className="badge-dot"></span>
              Coordinates Pending (Scaffolded)
            </div>
            <div className="map-placeholder-hint">
              Populating latitude and longitude coordinates in the <strong>Locations</strong> sheet will automatically enable mapping layout markers.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
