import React from "react";
import { FestivalEvent } from "@/types/festival";
import { Icon } from "@/components/ui/icons";

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

const getDayCountdownLabel = (dateGroup: DateGroup, currentTime: Date): string | null => {
  const rawDate = dateGroup.events.find(e => e.scheduleDate && e.scheduleDate !== "Date TBD")?.scheduleDate || dateGroup.date;
  if (!rawDate) return null;

  let y: number, m: number, d: number;
  const ymdMatch = rawDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymdMatch) {
    y = Number(ymdMatch[1]);
    m = Number(ymdMatch[2]);
    d = Number(ymdMatch[3]);
  } else {
    const parsed = new Date(rawDate);
    if (isNaN(parsed.getTime())) {
      const parsedWithYear = new Date(`${rawDate}, ${currentTime.getFullYear()}`);
      if (isNaN(parsedWithYear.getTime())) return null;
      y = parsedWithYear.getFullYear();
      m = parsedWithYear.getMonth() + 1;
      d = parsedWithYear.getDate();
    } else {
      y = parsed.getFullYear();
      m = parsed.getMonth() + 1;
      d = parsed.getDate();
    }
  }

  const dayStart = new Date(y, m - 1, d, 0, 0, 0);
  const nowDayStart = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate(), 0, 0, 0);
  const diffMs = dayStart.getTime() - nowDayStart.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return null;
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  return `in ${diffDays}d`;
};

const renderScheduleTime = (start: string, end: string) => {
  const cleanStart = (start || "TBD").trim().toLowerCase().replace(/\s+/g, "");
  const cleanEnd = (end || "TBD").trim().toLowerCase().replace(/\s+/g, "");

  return (
    <div className="schedule-time-box">
      <span className="time-start">{cleanStart}</span>
      <span className="time-dash">-</span>
      <span className="time-end">{cleanEnd}</span>
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
        <span className="empty-icon"><Icon name="search" size={28} /></span>
        <h3>No items match your filters</h3>
        <p>Try resetting filters or typing another search query.</p>
      </div>
    );
  }

  return (
    <div className="main-schedule-container">
      {groupedEventsByDate.map((dateGroup) => {
        const dayCountdown = currentTime ? getDayCountdownLabel(dateGroup, currentTime) : null;
        return (
          <div key={dateGroup.date} data-date={dateGroup.date} className="main-schedule-day-group">
            <div className="main-schedule-day-header">
              <span>{dateGroup.dateLabel}</span>
              {dayCountdown && (
                <span className="day-header-countdown-tag">{dayCountdown}</span>
              )}
            </div>
            <div className="main-schedule-table-wrap">
              <table className="main-schedule-table" style={{ width: "100%", minWidth: `${scheduleWidthScale}px` }}>
                <thead>
                  <tr>
                    <th style={{ width: "90px" }}>Time</th>
                    <th style={{ width: "13%" }}>Location</th>
                    <th style={{ width: "14%" }}>Action</th>
                    <th style={{ width: "13%" }}>Dept.</th>
                    <th style={{ width: "13%" }}>Lead</th>
                    <th style={{ width: "auto" }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {dateGroup.events.map((event) => {
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
                        </td>

                      {/* Desktop Table Cells */}
                      <td className="loc-cell desktop-only">
                        {event.locationName ? (
                          <span className="loc-tag" style={getColorStyle("Location", event.locationName)}>
                            {event.locationName}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="action-cell desktop-only">
                        {event.action ? (
                          <span className="action-tag" style={getColorStyle("Action", event.action)}>
                            {event.action}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="dept-cell desktop-only">
                        {event.department ? (
                          <span className="dept-tag" style={getColorStyle("Department", event.department)}>
                            {event.department}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="lead-cell desktop-only">
                        {event.leadPointPerson ? (
                          <span className="lead-tag" style={getColorStyle("Personnel", event.leadPointPerson)}>
                            {event.leadPointPerson}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="desc-cell desktop-only">{event.description || "-"}</td>

                      {/* Mobile Layout Details Cell */}
                      <td className="mobile-details-cell mobile-only">
                        {(event.locationName || event.action || event.department || event.leadPointPerson) && (
                          <div className="mobile-badges-row">
                            {event.locationName && (
                              <span className="loc-tag" style={getColorStyle("Location", event.locationName)}>
                                {event.locationName}
                              </span>
                            )}
                            {event.action && (
                              <span className="action-tag" style={getColorStyle("Action", event.action)}>
                                {event.action}
                              </span>
                            )}
                            {event.department && (
                              <span className="dept-tag" style={getColorStyle("Department", event.department)}>
                                {event.department}
                              </span>
                            )}
                            {event.leadPointPerson && (
                              <span className="lead-tag" style={getColorStyle("Personnel", event.leadPointPerson)}>
                                {event.leadPointPerson}
                              </span>
                            )}
                          </div>
                        )}
                        {event.description && (
                          <div className="mobile-event-desc">
                            {event.description}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    })}
    </div>
  );
};
