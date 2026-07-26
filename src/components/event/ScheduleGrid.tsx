import React from "react";
import { FestivalEvent } from "@/types/festival";

interface DateGroup {
  date: string;
  dateLabel: string;
  events: FestivalEvent[];
}

interface ScheduleGridProps {
  groupedEventsByDate: DateGroup[];
  scheduleWidthScale: number;
  getColorStyle: (category: "Location" | "Action" | "Department" | "Personnel", value: string | undefined) => React.CSSProperties;
  currentTime?: Date | null;
  setModalEvent: (event: FestivalEvent) => void;
  highlightedEventId: string | null;
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
    return minsLeft === 0 ? "ending now" : `active (${minsLeft}m left)`;
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

const renderScheduleTime = (start: string, end: string) => {
  const cleanStart = (start || "TBD").trim().toLowerCase().replace(/\s+/g, "");
  const cleanEnd = (end || "TBD").trim().toLowerCase().replace(/\s+/g, "");

  return (
    <div className="schedule-time-box">
      <span>{cleanStart}</span>
      <span className="time-dash">-</span>
      <span>{cleanEnd}</span>
    </div>
  );
};

export const ScheduleGrid: React.FC<ScheduleGridProps> = ({
  groupedEventsByDate,
  scheduleWidthScale,
  getColorStyle,
  currentTime,
  setModalEvent,
  highlightedEventId,
}) => {
  if (groupedEventsByDate.length === 0) {
    return (
      <div className="empty-schedule-state">
        <span className="empty-icon">🔍</span>
        <h3>No items match your filters</h3>
        <p>Try resetting filters or typing another search query.</p>
      </div>
    );
  }

  return (
    <div className="main-schedule-container">
      {groupedEventsByDate.map((dateGroup) => (
        <div key={dateGroup.date} className="main-schedule-day-group">
          <div className="main-schedule-day-header">
            {dateGroup.dateLabel}
          </div>
          <div className="main-schedule-table-wrap">
            <table className="main-schedule-table" style={{ width: `${scheduleWidthScale}px`, minWidth: `${scheduleWidthScale}px` }}>
              <thead>
                <tr>
                  <th style={{ width: "90px" }}>Time</th>
                  <th style={{ width: "15%" }}>Location</th>
                  <th style={{ width: "15%" }}>Action</th>
                  <th style={{ width: "15%" }}>Dept.</th>
                  <th style={{ width: "15%" }}>Lead</th>
                  <th style={{ width: "28%" }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {dateGroup.events.map((event) => {
                  const countdown = currentTime ? getCountdownLabel(event, currentTime) : null;
                  return (
                    <tr
                      key={event.id}
                      id={`event-row-${event.id}`}
                      className={`main-schedule-row ${highlightedEventId === event.id ? "highlight-active" : ""}`}
                      onClick={() => setModalEvent(event)}
                      style={{ cursor: "pointer" }}
                    >
                      <td className="time-cell">
                        {renderScheduleTime(event.startTime, event.endTime)}
                        {countdown && (
                          <div className="grid-countdown-tag">{countdown}</div>
                        )}
                      </td>
                      <td className="loc-cell font-semibold">
                        {event.locationName ? (
                          <span className="loc-tag" style={getColorStyle("Location", event.locationName)}>
                            {event.locationName}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="action-cell">
                        {event.action ? (
                          <span className="action-tag" style={getColorStyle("Action", event.action)}>
                            {event.action}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="dept-cell">
                        {event.department ? (
                          <span className="dept-tag" style={getColorStyle("Department", event.department)}>
                            {event.department}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="lead-cell font-semibold">
                        {event.leadPointPerson ? (
                          <span className="lead-tag" style={getColorStyle("Personnel", event.leadPointPerson)}>
                            {event.leadPointPerson}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="desc-cell">{event.description || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};
