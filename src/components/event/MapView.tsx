import React, { useMemo } from "react";
import { APIProvider, Map, AdvancedMarker, AdvancedMarkerAnchorPoint } from "@vis.gl/react-google-maps";
import { Venue } from "@/types/festival";

interface MapViewProps {
  venues: Venue[];
  mapCenter: { lat: number; lng: number };
  defaultZoom: number;
}

export const MapView: React.FC<MapViewProps> = ({
  venues,
  mapCenter,
  defaultZoom
}) => {
  const visibleMappableVenues = useMemo(() => {
    return venues.filter((v) => typeof v.lat === "number" && typeof v.lng === "number");
  }, [venues]);

  const mapCenterCoords = useMemo(() => {
    const mappable = venues.find((v) => typeof v.lat === "number" && typeof v.lng === "number");
    if (mappable && mappable.lat && mappable.lng) {
      return { lat: mappable.lat, lng: mappable.lng };
    }
    return mapCenter;
  }, [venues, mapCenter]);

  return (
    <div className="main-map-container" style={{ height: "100%", width: "100%" }}>
      {visibleMappableVenues.length > 0 ? (
        <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}>
          <Map
            center={mapCenterCoords}
            zoom={defaultZoom}
            mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "2f9f04bb8e9c458045b99a65"}
            disableDefaultUI={false}
            style={{ width: "100%", height: "100%" }}
          >
            {visibleMappableVenues.map((venue) => (
              <AdvancedMarker
                key={venue.id}
                position={{ lat: venue.lat!, lng: venue.lng! }}
                anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
              >
                <div className="custom-map-marker">
                  <span className="marker-dot"></span>
                  <span className="marker-label">{venue.name}</span>
                </div>
              </AdvancedMarker>
            ))}
          </Map>
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
