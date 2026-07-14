import React from "react";
import { FestivalEvent, Venue } from "@/types/festival";

interface EventModalProps {
  modalEvent: FestivalEvent | null;
  onClose: () => void;
  getColorStyle: (category: "Location" | "Action" | "Department" | "Personnel", value: string | undefined) => React.CSSProperties;
  isStarred?: (id: string) => boolean;
  onToggleStar?: (id: string) => void;
  onShowOnMap?: (venueId: string) => void;
  venues?: Venue[];
}

export const EventModal: React.FC<EventModalProps> = ({
  modalEvent,
  onClose,
  getColorStyle,
  isStarred,
  onToggleStar,
  onShowOnMap,
  venues = []
}) => {
  if (!modalEvent) return null;

  const isEventStarred = isStarred ? isStarred(modalEvent.id) : false;

  // Find corresponding venue for coordinates check
  const venue = venues.find(
    (v) => v.id === modalEvent.venueId || (modalEvent.locationName && v.name.toLowerCase() === modalEvent.locationName.toLowerCase())
  );
  const hasCoords = venue && typeof venue.lat === "number" && typeof venue.lng === "number";

  return (
    <div className="portal-modal-overlay" onClick={onClose}>
      <div className="portal-modal-card" onClick={(e) => e.stopPropagation()}>
        <header
          className="portal-modal-header"
          style={getColorStyle(modalEvent.department ? "Department" : "Location", modalEvent.department || modalEvent.locationName)}
        >
          <div className="modal-header-actions">
            {onToggleStar && (
              <button
                type="button"
                className={`modal-star-btn ${isEventStarred ? "starred" : ""}`}
                onClick={() => onToggleStar(modalEvent.id)}
                aria-label={isEventStarred ? "Remove from schedule" : "Add to schedule"}
                title={isEventStarred ? "Remove from My Schedule" : "Add to My Schedule"}
              >
                {isEventStarred ? (
                  <svg className="modal-star-icon filled" viewBox="0 0 24 24" width="22" height="22">
                    <path fill="#facc15" stroke="#eab308" strokeWidth="1.5" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                ) : (
                  <svg className="modal-star-icon outlined" viewBox="0 0 24 24" width="22" height="22">
                    <path fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                )}
              </button>
            )}
            <button type="button" className="close-modal-btn" onClick={onClose}>×</button>
          </div>
        </header>
        <div className="portal-modal-body">
          <h2 className="modal-title font-bold text-xl mb-2">{modalEvent.title}</h2>
          
          <div className="modal-info-row">
            <span className="modal-time-range font-bold">⏰ {modalEvent.startTime} – {modalEvent.endTime}</span>
            {modalEvent.scheduleDate && (
              <span className="modal-date-tag">📅 {modalEvent.scheduleDate}</span>
            )}
          </div>
          
          <div className="modal-details-grid">
            {modalEvent.locationName && (
              <div className="modal-detail-item">
                <span className="detail-label">Location</span>
                <span className="loc-tag font-semibold" style={getColorStyle("Location", modalEvent.locationName)}>
                  {modalEvent.locationName}
                </span>
              </div>
            )}
            {modalEvent.department && (
              <div className="modal-detail-item">
                <span className="detail-label">Department</span>
                <span className="dept-tag font-semibold" style={getColorStyle("Department", modalEvent.department)}>
                  {modalEvent.department}
                </span>
              </div>
            )}
            {modalEvent.leadPointPerson && (
              <div className="modal-detail-item">
                <span className="detail-label">Lead Person</span>
                <span className="lead-tag" style={getColorStyle("Personnel", modalEvent.leadPointPerson)}>
                  {modalEvent.leadPointPerson}
                </span>
              </div>
            )}
            {modalEvent.action && (
              <div className="modal-detail-item">
                <span className="detail-label">Action Category</span>
                <span className="action-tag" style={getColorStyle("Action", modalEvent.action)}>
                  {modalEvent.action}
                </span>
              </div>
            )}
          </div>
          
          {modalEvent.description && (
            <div className="modal-description-box">
              <span className="detail-label">Description</span>
              <p className="description-text">{modalEvent.description}</p>
            </div>
          )}

          <div className="modal-bottom-actions">
            {hasCoords && onShowOnMap && (
              <button
                type="button"
                className="modal-action-btn show-on-map-btn"
                onClick={() => {
                  onShowOnMap(venue.id);
                  onClose();
                }}
              >
                🗺️ Show on Map
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
