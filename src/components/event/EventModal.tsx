import React from "react";
import { FestivalEvent } from "@/types/festival";

interface EventModalProps {
  modalEvent: FestivalEvent | null;
  onClose: () => void;
  getColorStyle: (category: "Location" | "Action" | "Department" | "Personnel", value: string | undefined) => React.CSSProperties;
}

export const EventModal: React.FC<EventModalProps> = ({
  modalEvent,
  onClose,
  getColorStyle
}) => {
  if (!modalEvent) return null;

  return (
    <div className="portal-modal-overlay" onClick={onClose}>
      <div className="portal-modal-card" onClick={(e) => e.stopPropagation()}>
        <header
          className="portal-modal-header"
          style={getColorStyle(modalEvent.department ? "Department" : "Location", modalEvent.department || modalEvent.locationName)}
        >
          <button type="button" className="close-modal-btn" onClick={onClose}>×</button>
        </header>
        <div className="portal-modal-body">
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
        </div>
      </div>
    </div>
  );
};
