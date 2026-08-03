import React from "react";
import { FestivalEvent, Venue } from "@/types/festival";
import { Icon } from "@/components/ui/icons";

interface EventModalProps {
  modalEvent: FestivalEvent | null;
  onClose: () => void;
  getColorStyle: (category: "Location" | "Action" | "Department" | "Personnel", value: string | undefined) => React.CSSProperties;
  isStarred?: (id: string) => boolean;
  onToggleStar?: (id: string) => void;
  onShowOnMap?: (venueId: string) => void;
  onShowOnCalendar?: (event: FestivalEvent) => void;
  onShowOnSchedule?: (event: FestivalEvent) => void;
  currentTab?: "schedule" | "calendar" | "map" | "now-next";
  venues?: Venue[];
}

export const EventModal: React.FC<EventModalProps> = ({
  modalEvent,
  onClose,
  getColorStyle,
  isStarred,
  onToggleStar,
  onShowOnMap,
  onShowOnCalendar,
  onShowOnSchedule,
  currentTab = "schedule",
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
                  <Icon name="star" size={18} filled />
                ) : (
                  <Icon name="star" size={18} />
                )}
              </button>
            )}
            <button type="button" className="close-modal-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
          </div>
        </header>
        <div className="portal-modal-body">
          <h2 className="modal-title">{modalEvent.title}</h2>
          
          <div className="modal-info-row">
            <span className="modal-time-range"><Icon name="clock" size={14} /> {modalEvent.startTime} – {modalEvent.endTime}</span>
            {modalEvent.scheduleDate && (
              <span className="modal-date-tag"><Icon name="calendar" size={14} /> {modalEvent.scheduleDate}</span>
            )}
          </div>
          
          <div className="modal-details-grid">
            {modalEvent.locationName && (
              <div className="modal-detail-item">
                <span className="detail-label">Location</span>
                <span className="loc-tag" style={getColorStyle("Location", modalEvent.locationName)}>
                  {modalEvent.locationName}
                </span>
              </div>
            )}
            {modalEvent.department && (
              <div className="modal-detail-item">
                <span className="detail-label">Department</span>
                <span className="dept-tag" style={getColorStyle("Department", modalEvent.department)}>
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
                <Icon name="map" size={14} /> Show on Map
              </button>
            )}
            {currentTab === "calendar" ? (
              onShowOnSchedule && (
                <button
                  type="button"
                  className="modal-action-btn show-on-schedule-btn"
                  onClick={() => {
                    onShowOnSchedule(modalEvent);
                    onClose();
                  }}
                >
                  <Icon name="clipboard" size={14} /> Show on Schedule
                </button>
              )
            ) : (
              onShowOnCalendar && (
                <button
                  type="button"
                  className="modal-action-btn show-on-calendar-btn"
                  onClick={() => {
                    onShowOnCalendar(modalEvent);
                    onClose();
                  }}
                >
                  <Icon name="calendar" size={14} /> Show on Calendar
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
