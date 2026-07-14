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
  currentTime?: Date | null;
  onEventClick?: (event: FestivalEvent) => void;
}

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

const getCountdownLabel = (event: FestivalEvent, currentTime: Date): string | null => {
  if (!event.scheduleDate || event.scheduleDate === "Date TBD" || !event.startTime || event.startTime === "TBD") return null;
  const startMins = timeToMinutes(event.startTime);
  if (startMins === -1) return null;

  let endMins = timeToMinutes(event.endTime);
  if (endMins === -1) {
    endMins = startMins + 60;
  }

  const [y, m, d] = event.scheduleDate.split("-").map(Number);
  const startDate = new Date(y, m - 1, d, Math.floor(startMins / 60), startMins % 60, 0);
  const endDate = new Date(y, m - 1, d, Math.floor(endMins / 60), endMins % 60, 0);
  if (endMins < startMins) {
    endDate.setDate(endDate.getDate() + 1);
  }

  const diffMsStart = startDate.getTime() - currentTime.getTime();
  const diffMsEnd = endDate.getTime() - currentTime.getTime();

  if (diffMsEnd < 0) {
    return null;
  }

  if (diffMsStart <= 0 && diffMsEnd >= 0) {
    const minsLeft = Math.round(diffMsEnd / 60000);
    return minsLeft === 0 ? "ending now" : `active (ends in ${minsLeft}m)`;
  }

  const minsToStart = Math.round(diffMsStart / 60000);
  if (minsToStart < 60) {
    return `in ${minsToStart}m`;
  }
  const hoursToStart = Math.floor(minsToStart / 60);
  const remainingMins = minsToStart % 60;
  if (hoursToStart < 24) {
    return `in ${hoursToStart}h ${remainingMins}m`;
  }
  
  const daysToStart = Math.floor(hoursToStart / 24);
  return `in ${daysToStart}d`;
};

export const RunningSchedule: React.FC<RunningScheduleProps> = ({
  groupedEventsByDate,
  setModalEvent,
  getColorStyle,
  currentTime,
  onEventClick,
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
            {dateGroup.events.map((event) => {
              const countdown = currentTime ? getCountdownLabel(event, currentTime) : null;
              return (
                <div key={event.id} className="sidebar-event-card" onClick={() => onEventClick ? onEventClick(event) : setModalEvent(event)} style={{ cursor: "pointer" }}>
                  <div className="event-time-badge">
                    <span>⏰ {event.startTime} – {event.endTime}</span>
                    {countdown && (
                      <span className="card-countdown-tag">{countdown}</span>
                    )}
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
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
