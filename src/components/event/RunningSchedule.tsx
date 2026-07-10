import React from "react";
import { FestivalEvent } from "@/types/festival";

interface DateGroup {
  date: string;
  dateLabel: string;
  events: FestivalEvent[];
}

interface RunningScheduleProps {
  groupedEventsByDate: DateGroup[];
  setModalEvent: (event: FestivalEvent) => void;
  getColorStyle: (category: "Location" | "Action" | "Department" | "Personnel", value: string | undefined) => React.CSSProperties;
}

export const RunningSchedule: React.FC<RunningScheduleProps> = ({
  groupedEventsByDate,
  setModalEvent,
  getColorStyle,
}) => {
  if (groupedEventsByDate.length === 0) {
    return <div className="sidebar-scroll-container"><div className="sidebar-empty-state">No events match filters.</div></div>;
  }

  return (
    <div className="sidebar-scroll-container">
      {groupedEventsByDate.map((dateGroup) => (
        <div key={dateGroup.date} className="sidebar-date-group">
          <div className="sidebar-date-header">{dateGroup.dateLabel}</div>
          <div className="sidebar-event-list">
            {dateGroup.events.map((event) => (
              <div key={event.id} className="sidebar-event-card" onClick={() => setModalEvent(event)} style={{ cursor: "pointer" }}>
                <div className="event-time-badge">
                  ⏰ {event.startTime} – {event.endTime}
                </div>
                <div className="event-card-title">{event.title}</div>
                
                <div className="event-card-details">
                  {event.locationName && (
                    <span className="card-detail-badge loc-tag-sm" style={getColorStyle("Location", event.locationName)}>
                      📍 {event.locationName}
                    </span>
                  )}
                  {event.action && (
                    <span className="card-detail-badge action-tag-sm" style={getColorStyle("Action", event.action)}>
                      ⚡ {event.action}
                    </span>
                  )}
                </div>

                {(event.leadPointPerson || event.department) && (
                  <div className="event-card-badges">
                    {event.leadPointPerson && (
                      <span className="card-badge lead-badge" style={getColorStyle("Personnel", event.leadPointPerson)}>
                        👤 {event.leadPointPerson}
                      </span>
                    )}
                    {event.department && (
                      <span className="card-badge dept-badge" style={getColorStyle("Department", event.department)}>
                        🏢 {event.department}
                      </span>
                    )}
                  </div>
                )}

                {event.description && (
                  <div className="event-card-desc">{event.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
