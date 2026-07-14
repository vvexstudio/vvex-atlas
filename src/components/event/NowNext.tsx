import React, { useMemo } from "react";
import { FestivalEvent } from "@/types/festival";

interface NowNextProps {
  events: FestivalEvent[];
  currentTime: Date;
  effectiveDateStr: string;
  isSimulated: boolean;
  setModalEvent: (event: FestivalEvent) => void;
  getColorStyle: (category: "Location" | "Action" | "Department" | "Personnel", value: string | undefined) => React.CSSProperties;
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

const getEventDateTimes = (event: FestivalEvent) => {
  if (!event.scheduleDate || event.scheduleDate === "Date TBD") return null;
  const startMins = timeToMinutes(event.startTime);
  if (startMins === -1) return null;
  
  let endMins = timeToMinutes(event.endTime);
  if (endMins === -1) {
    endMins = startMins + 60; // default 1h duration
  }
  
  const [y, m, d] = event.scheduleDate.split("-").map(Number);
  const startDate = new Date(y, m - 1, d, Math.floor(startMins / 60), startMins % 60, 0);
  
  const endDate = new Date(y, m - 1, d, Math.floor(endMins / 60), endMins % 60, 0);
  if (endMins < startMins) {
    endDate.setDate(endDate.getDate() + 1);
  }
  
  return { start: startDate, end: endDate };
};

export const NowNext: React.FC<NowNextProps> = ({
  events,
  currentTime,
  effectiveDateStr,
  isSimulated,
  setModalEvent,
  getColorStyle,
}) => {
  // Filter events into Now and Next (next 2 hours)
  const { nowEvents, nextEvents } = useMemo(() => {
    const now: { event: FestivalEvent; start: Date; end: Date }[] = [];
    const next: { event: FestivalEvent; start: Date; end: Date }[] = [];
    
    const nextLimit = new Date(currentTime.getTime() + 2 * 60 * 60 * 1000); // +2 hours

    events.forEach((event) => {
      const times = getEventDateTimes(event);
      if (!times) return;

      const { start, end } = times;

      if (start <= currentTime && end >= currentTime) {
        now.push({ event, start, end });
      } else if (start > currentTime && start <= nextLimit) {
        next.push({ event, start, end });
      }
    });

    // Sort Now events by end time (ending soonest first)
    now.sort((a, b) => a.end.getTime() - b.end.getTime());
    // Sort Next events by start time (starting soonest first)
    next.sort((a, b) => a.start.getTime() - b.start.getTime());

    return {
      nowEvents: now,
      nextEvents: next,
    };
  }, [events, currentTime]);

  const formatCountdown = (target: Date, type: "start" | "end") => {
    const diffMs = target.getTime() - currentTime.getTime();
    const diffMins = Math.round(Math.abs(diffMs) / 60000);

    if (diffMins === 0) {
      return type === "start" ? "starting now" : "ending now";
    }

    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    let timeStr = "";
    if (hours > 0) {
      timeStr += `${hours}h `;
    }
    timeStr += `${mins}m`;

    if (type === "start") {
      return `starts in ${timeStr}`;
    } else {
      return diffMs < 0 ? `ended ${timeStr} ago` : `ends in ${timeStr}`;
    }
  };

  const getProgressPercent = (start: Date, end: Date) => {
    const total = end.getTime() - start.getTime();
    const elapsed = currentTime.getTime() - start.getTime();
    if (total <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  };

  const displayDateStr = currentTime.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="now-next-dashboard">
      {/* Dashboard Top Banner */}
      <div className="now-next-header">
        <div className="now-next-time-panel">
          <div className="now-next-clock-row">
            <span className="clock-icon">🕒</span>
            <span className="now-next-time">
              {currentTime.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
          <div className="now-next-date">{displayDateStr}</div>
        </div>

        {isSimulated && (
          <div className="now-next-sim-badge">
            <span className="sim-dot"></span>
            <span>Simulated Demo Date</span>
          </div>
        )}
      </div>

      <div className="now-next-grid">
        {/* Happening Now Column */}
        <div className="now-next-column now-col">
          <div className="column-title-row">
            <span className="col-indicator-dot now-dot"></span>
            <h2>Happening Now</h2>
            <span className="col-count">{nowEvents.length}</span>
          </div>

          <div className="now-next-card-list">
            {nowEvents.length === 0 ? (
              <div className="now-next-empty-state">
                <span className="empty-emoji">☕</span>
                <p>Nothing scheduled at this exact moment.</p>
              </div>
            ) : (
              nowEvents.map(({ event, start, end }) => {
                const progress = getProgressPercent(start, end);
                const startedAgo = formatCountdown(start, "end").replace("ends in", "started");
                return (
                  <div
                    key={`now-${event.id}`}
                    className="now-next-card now-card clickable"
                    onClick={() => setModalEvent(event)}
                  >
                    <div className="card-top-row">
                      <span className="countdown-badge started-badge">
                        🟢 Active ({formatCountdown(end, "end")})
                      </span>
                      <span className="event-time">
                        {event.startTime} - {event.endTime}
                      </span>
                    </div>

                    <h3 className="card-title">{event.title}</h3>

                    <div className="card-tags">
                      {event.locationName && (
                        <span className="tag loc-tag-sm" style={getColorStyle("Location", event.locationName)}>
                          📍 {event.locationName}
                        </span>
                      )}
                      {event.department && (
                        <span className="tag dept-badge" style={getColorStyle("Department", event.department)}>
                          🏢 {event.department}
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="progress-bar-container">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>

                    {event.description && (
                      <p className="card-description-preview">{event.description}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Upcoming Next Column */}
        <div className="now-next-column next-col">
          <div className="column-title-row">
            <span className="col-indicator-dot next-dot"></span>
            <h2>Upcoming Next (Next 2h)</h2>
            <span className="col-count">{nextEvents.length}</span>
          </div>

          <div className="now-next-card-list">
            {nextEvents.length === 0 ? (
              <div className="now-next-empty-state">
                <span className="empty-emoji">💤</span>
                <p>No upcoming events in the next 2 hours.</p>
              </div>
            ) : (
              nextEvents.map(({ event, start }) => (
                <div
                  key={`next-${event.id}`}
                  className="now-next-card next-card clickable"
                  onClick={() => setModalEvent(event)}
                >
                  <div className="card-top-row">
                    <span className="countdown-badge next-badge">
                      ⏳ {formatCountdown(start, "start")}
                    </span>
                    <span className="event-time">
                      {event.startTime} - {event.endTime}
                    </span>
                  </div>

                  <h3 className="card-title">{event.title}</h3>

                  <div className="card-tags">
                    {event.locationName && (
                      <span className="tag loc-tag-sm" style={getColorStyle("Location", event.locationName)}>
                        📍 {event.locationName}
                      </span>
                    )}
                    {event.department && (
                      <span className="tag dept-badge" style={getColorStyle("Department", event.department)}>
                        🏢 {event.department}
                      </span>
                    )}
                  </div>

                  {event.description && (
                    <p className="card-description-preview">{event.description}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
