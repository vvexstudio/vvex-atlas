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
}

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
            <table className="main-schedule-table" style={{ minWidth: `${scheduleWidthScale}px` }}>
              <thead>
                <tr>
                  <th style={{ width: "70px" }}>Time</th>
                  <th style={{ width: "15%" }}>Location</th>
                  <th style={{ width: "15%" }}>Action</th>
                  <th style={{ width: "15%" }}>Dept.</th>
                  <th style={{ width: "15%" }}>Lead</th>
                  <th style={{ width: "28%" }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {dateGroup.events.map((event) => (
                  <tr key={event.id} className="main-schedule-row">
                    <td className="time-cell">{renderScheduleTime(event.startTime, event.endTime)}</td>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};
