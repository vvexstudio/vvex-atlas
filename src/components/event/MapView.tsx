import React, { useMemo, useState, useEffect } from "react";
import { APIProvider, Map, AdvancedMarker, AdvancedMarkerAnchorPoint, InfoWindow, useMap } from "@vis.gl/react-google-maps";
import { Venue, FestivalEvent } from "@/types/festival";
import mapStyles from "@/data/map-styles.json";

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
}

const getCategoryIcon = (category: string): string => {
  const clean = (category || "").toLowerCase().trim();
  if (clean.includes("hotel") || clean.includes("lodging") || clean.includes("housing")) return "🏨";
  if (clean.includes("forest") || clean.includes("wood") || clean.includes("nature")) return "🌲";
  if (clean.includes("transport") || clean.includes("shuttle") || clean.includes("bus")) return "🚌";
  if (clean.includes("crew") || clean.includes("ops") || clean.includes("office")) return "⚙️";
  if (clean.includes("venue") || clean.includes("stage") || clean.includes("bar")) return "🎪";
  if (clean.includes("service") || clean.includes("toilet") || clean.includes("water") || clean.includes("medical")) return "🛠️";
  return "📍";
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
}) => {
  const map = useMap();
  const [activeVenue, setActiveVenue] = useState<Venue | null>(null);

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

  // Find events at this location
  const locationEvents = useMemo(() => {
    if (!activeVenue) return [];
    return events.filter(
      (e) => e.locationName && e.locationName.toLowerCase() === activeVenue.name.toLowerCase()
    );
  }, [events, activeVenue]);

  return (
    <Map
      defaultCenter={mapCenterCoords}
      defaultZoom={defaultZoom}
      mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "2f9f04bb8e9c458045b99a65"}
      disableDefaultUI={false}
      style={{ width: "100%", height: "100%" }}
      styles={mapStyles}
    >
      {visibleMappableVenues.map((venue) => {
        const icon = getCategoryIcon(venue.permanence || "");
        const style = getColorStyle ? getColorStyle("Location", venue.permanence) : {};
        return (
          <AdvancedMarker
            key={venue.id}
            position={{ lat: venue.lat!, lng: venue.lng! }}
            anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
            onClick={() => setActiveVenue(venue)}
          >
            <div className="custom-map-marker" style={{ borderColor: style.color || "var(--accent)" }}>
              <span className="marker-dot-icon">{icon}</span>
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
            {activeVenue.permanence && (
              <span className="infowindow-category-badge">{activeVenue.permanence}</span>
            )}
            {activeVenue.description && (
              <p className="infowindow-desc">{activeVenue.description}</p>
            )}

            {/* Directions Link */}
            <div className="infowindow-actions">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${activeVenue.lat},${activeVenue.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="infowindow-btn directions-btn"
              >
                🚗 Get Directions
              </a>
              {setSelectedLocations && setMainTab && (
                <button
                  type="button"
                  className="infowindow-btn filter-btn"
                  onClick={() => {
                    setSelectedLocations([activeVenue.name]);
                    setMainTab("schedule");
                  }}
                >
                  📋 Filter Events Here
                </button>
              )}
            </div>

            {/* Event List */}
            <div className="infowindow-events">
              <h4>Upcoming Today ({locationEvents.length})</h4>
              {locationEvents.length === 0 ? (
                <p className="no-events-text">No scheduled events at this location.</p>
              ) : (
                <ul className="infowindow-event-list">
                  {locationEvents.slice(0, 5).map((e) => (
                    <li key={e.id}>
                      <span className="ev-time">⏰ {e.startTime}</span>
                      <span className="ev-title">{e.title}</span>
                    </li>
                  ))}
                  {locationEvents.length > 5 && (
                    <li className="more-events-indicator">and {locationEvents.length - 5} more...</li>
                  )}
                </ul>
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
}) => {
  // Filter venues based on coordinates existence and legend category visibility toggles
  const visibleMappableVenues = useMemo(() => {
    return venues.filter((v) => {
      const hasCoords = typeof v.lat === "number" && typeof v.lng === "number";
      if (!hasCoords) return false;
      if (activeCategories && activeCategories.length > 0) {
        // permanence contains category string e.g. "Hotel" / "Venue"
        return activeCategories.includes(v.permanence || "");
      }
      return true;
    });
  }, [venues, activeCategories]);

  const mapCenterCoords = useMemo(() => {
    const mappable = visibleMappableVenues.find((v) => typeof v.lat === "number" && typeof v.lng === "number");
    if (mappable && mappable.lat && mappable.lng) {
      return { lat: mappable.lat, lng: mappable.lng };
    }
    return mapCenter;
  }, [visibleMappableVenues, mapCenter]);

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
          />
        </APIProvider>
      ) : (
        /* Greyed-out Blueprint Placeholder Map View */
        <div className="map-placeholder-container">
          <div className="map-placeholder-grid" />
          <div className="map-placeholder-card">
            <div className="map-placeholder-icon">🗺️</div>
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
