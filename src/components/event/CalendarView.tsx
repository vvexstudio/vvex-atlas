import React, { useState } from "react";
import { FestivalEvent, Department } from "@/types/festival";
import { CalendarChip } from "./CalendarChip";
import { Icon, departmentIcon } from "@/components/ui/icons";

interface DateGroup {
  date: string;
  dateLabel: string;
  events: FestivalEvent[];
}

interface CalendarViewProps {
  groupedEventsByDate: DateGroup[];
  hideEmptyHours: boolean;
  activeDepartments: string[];
  activeLocations: string[];
  columnWidthScale: number;
  hourHeightScale: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  searchQuery: string;
  calendarEventPlacements: Map<string, { top: number; height: number; left: number; width: number }>;
  setModalEvent: (event: FestivalEvent) => void;
  departments: Department[];
  getColorStyle: (category: "Location" | "Action" | "Department" | "Personnel", value: string | undefined) => React.CSSProperties;
  currentTime: Date | null;
  effectiveDateStr: string;
  highlightedEventId: string | null;
}

const getDepartmentIcon = (dept: string): React.ReactNode => (
  <Icon name={departmentIcon(dept)} size={12} />
);

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

const getActiveHoursForDay = (dayEvents: FestivalEvent[]): number[] => {
  const active = new Set<number>();
  dayEvents.forEach((e) => {
    const startMin = timeToMinutes(e.startTime);
    if (startMin === -1) return;
    let endMin = timeToMinutes(e.endTime);
    if (endMin === -1) {
      endMin = startMin + 60;
    } else if (endMin < startMin) {
      endMin = 24 * 60;
    }
    
    const startHour = Math.floor(startMin / 60);
    const endHour = Math.ceil(endMin / 60) - 1;
    for (let h = startHour; h <= endHour; h++) {
      if (h >= 0 && h < 24) {
        active.add(h);
      }
    }
  });
  return Array.from(active).sort((a, b) => a - b);
};

const getActiveMinuteOffset = (t: number, activeHours: number[]): number => {
  let activeMinutes = 0;
  for (const h of activeHours) {
    if (t >= (h + 1) * 60) {
      activeMinutes += 60;
    } else if (t > h * 60) {
      activeMinutes += (t - h * 60);
    }
  }
  return activeMinutes;
};

const hoursArray = Array.from({ length: 24 }, (_, i) => i);

export const CalendarView: React.FC<CalendarViewProps> = ({
  groupedEventsByDate,
  hideEmptyHours,
  activeDepartments,
  activeLocations,
  columnWidthScale,
  hourHeightScale,
  scrollContainerRef,
  searchQuery,
  calendarEventPlacements,
  setModalEvent,
  departments,
  getColorStyle,
  currentTime,
  effectiveDateStr,
  highlightedEventId,
}) => {
  const [activeTbdDropdown, setActiveTbdDropdown] = useState<{ day: string; colKey: string } | null>(null);

  if (activeDepartments.length === 0 && activeLocations.length === 0) {
    return (
      <div className="empty-calendar-state">
        <span className="empty-icon"><Icon name="search" size={28} /></span>
        <h3>No columns to display</h3>
        <p>No locations or departments match your current filters.</p>
      </div>
    );
  }

  return (
    <div className="spatial-calendar-container">
      <div ref={scrollContainerRef} className="spatial-calendar-grid">
        <div className="spatial-calendar-grid-content">
          {groupedEventsByDate.length === 0 ? (
            <div className="empty-calendar-state">
              <span className="empty-icon"><Icon name="search" size={28} /></span>
              <h3>No items match your filters</h3>
              <p>Try resetting filters or typing another search query.</p>
            </div>
          ) : (
            groupedEventsByDate.map((dateGroup) => {
              const activeHours = hideEmptyHours ? getActiveHoursForDay(dateGroup.events) : hoursArray;
              
              const currentMinutes = currentTime ? currentTime.getHours() * 60 + currentTime.getMinutes() : -1;
              const isToday = dateGroup.date === effectiveDateStr;
              const activeCurrent = isToday && currentMinutes !== -1 && hideEmptyHours
                ? getActiveMinuteOffset(currentMinutes, activeHours)
                : currentMinutes;
              const lineTop = (activeCurrent / 60) * hourHeightScale;
              
              const displayDeptsForDay = hideEmptyHours
                ? activeDepartments.filter(dept =>
                    dateGroup.events.some(e => e.department === dept)
                  )
                : activeDepartments;

              const displayLocsForDay = hideEmptyHours
                ? activeLocations.filter(loc =>
                    dateGroup.events.some(e => e.locationName === loc)
                  )
                : activeLocations;

              const numCols = displayDeptsForDay.length + displayLocsForDay.length;
              const totalGridWidth = numCols === 0 ? "100%" : `max(100%, ${70 + numCols * columnWidthScale}px)`;

              return (
                <div key={dateGroup.date} className="calendar-day-section" style={{ width: "100%", minWidth: totalGridWidth }}>
                  {/* Sticky Date/Day Banner */}
                  <div className="calendar-day-header">
                    <span className="sticky-date-label">{dateGroup.dateLabel}</span>
                  </div>

                  {/* Sticky Columns Headers */}
                  <div className="calendar-day-headers-wrapper">
                    {/* Parent Row */}
                    <div className="calendar-parent-header-row">
                      <div className="calendar-time-axis-header parent" style={{ width: "70px" }}></div>
                      {displayDeptsForDay.length > 0 && (
                        <div 
                          className="calendar-parent-header-cell departments" 
                          style={{ 
                            flex: `${displayDeptsForDay.length} ${displayDeptsForDay.length} 0%`, 
                            minWidth: `${displayDeptsForDay.length * columnWidthScale}px`,
                            maxWidth: `${displayDeptsForDay.length * columnWidthScale * 1.25}px`
                          }}
                        >
                          <span className="sticky-parent-label"><Icon name="building" size={12} /> Departments</span>
                        </div>
                      )}
                      {displayLocsForDay.length > 0 && (
                        <div 
                          className="calendar-parent-header-cell locations" 
                          style={{ 
                            flex: `${displayLocsForDay.length} ${displayLocsForDay.length} 0%`, 
                            minWidth: `${displayLocsForDay.length * columnWidthScale}px`,
                            maxWidth: `${displayLocsForDay.length * columnWidthScale * 1.25}px`
                          }}
                        >
                          <span className="sticky-parent-label"><Icon name="mapPin" size={12} /> Locations</span>
                        </div>
                      )}
                    </div>

                    {/* Specific Column Headers (Column names + TBD Shelves) */}
                    <div className="calendar-grid-header-row">
                      <div className="calendar-time-axis-header" style={{ width: "70px" }}></div>
                      
                      {displayDeptsForDay.map((dept) => {
                        const tbdEvents = dateGroup.events.filter(
                          (e) => e.department === dept && timeToMinutes(e.startTime) === -1
                        );
                        const deptInfo = departments.find((d) => d.Department?.trim() === dept.trim());
                        const icon = getDepartmentIcon(dept);

                        const isDropdownOpen = activeTbdDropdown?.day === dateGroup.date && activeTbdDropdown?.colKey === dept;
                        return (
                          <div 
                            key={`hdr-dept-${dept}`} 
                            className="calendar-column-header-cell department" 
                            style={{ 
                              flex: "1 1 0%", 
                              minWidth: `${columnWidthScale}px`,
                              maxWidth: `${columnWidthScale * 1.25}px`
                            }}
                          >
                            <CalendarChip
                              variant="header"
                              style={getColorStyle("Department", dept)}
                              label={dept}
                              icon={icon}
                              tooltipContent={deptInfo ? (
                                <div className="tooltip-body">
                                  {deptInfo["Lead Point Person"] && (
                                    <div className="tooltip-item">
                                      <span className="tooltip-icon"><Icon name="user" size={12} /></span>
                                      <span className="tooltip-text">{deptInfo["Lead Point Person"]}</span>
                                    </div>
                                  )}
                                  {deptInfo["Lead Phone"] && (
                                    <div className="tooltip-item">
                                      <span className="tooltip-icon"><Icon name="phone" size={12} /></span>
                                      <span className="tooltip-text">{deptInfo["Lead Phone"]}</span>
                                    </div>
                                  )}
                                  {deptInfo["Lead Email"] && (
                                    <div className="tooltip-item">
                                      <span className="tooltip-icon"><Icon name="mail" size={12} /></span>
                                      <span className="tooltip-text">{deptInfo["Lead Email"]}</span>
                                    </div>
                                  )}
                                  {!deptInfo["Lead Point Person"] && !deptInfo["Lead Phone"] && !deptInfo["Lead Email"] && (
                                    <div className="tooltip-empty">No contact details</div>
                                  )}
                                </div>
                              ) : null}
                            />
                            {tbdEvents.length > 0 && (
                              <div className="header-tbd-wrapper">
                                <button
                                  type="button"
                                  className={`header-tbd-toggle-btn ${isDropdownOpen ? "active" : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isDropdownOpen) {
                                      setActiveTbdDropdown(null);
                                    } else {
                                      setActiveTbdDropdown({ day: dateGroup.date, colKey: dept });
                                    }
                                  }}
                                  title="View unassigned/TBD time events"
                                >
                                  ⏳ {tbdEvents.length} TBD
                                </button>
                                {isDropdownOpen && (
                                  <div className="header-tbd-dropdown-menu">
                                    <div className="dropdown-title">Unassigned Items ({tbdEvents.length})</div>
                                    {tbdEvents.map((event) => (
                                      <button
                                        key={event.id}
                                        type="button"
                                        className="dropdown-item"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setModalEvent(event);
                                          setActiveTbdDropdown(null);
                                        }}
                                      >
                                        <Icon name="pin" size={12} /> {event.title}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {displayLocsForDay.map((loc) => {
                        const tbdEvents = dateGroup.events.filter(
                          (e) => e.locationName === loc && timeToMinutes(e.startTime) === -1
                        );
                        const isDropdownOpen = activeTbdDropdown?.day === dateGroup.date && activeTbdDropdown?.colKey === loc;
                        return (
                          <div 
                            key={`hdr-loc-${loc}`} 
                            className="calendar-column-header-cell location" 
                            style={{ 
                              flex: "1 1 0%", 
                              minWidth: `${columnWidthScale}px`,
                              maxWidth: `${columnWidthScale * 1.25}px`
                            }}
                          >
                            <CalendarChip
                              variant="header"
                              style={getColorStyle("Location", loc)}
                              label={loc}
                            />
                            {tbdEvents.length > 0 && (
                              <div className="header-tbd-wrapper">
                                <button
                                  type="button"
                                  className={`header-tbd-toggle-btn ${isDropdownOpen ? "active" : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isDropdownOpen) {
                                      setActiveTbdDropdown(null);
                                    } else {
                                      setActiveTbdDropdown({ day: dateGroup.date, colKey: loc });
                                    }
                                  }}
                                  title="View unassigned/TBD time events"
                                >
                                  ⏳ {tbdEvents.length} TBD
                                </button>
                                {isDropdownOpen && (
                                  <div className="header-tbd-dropdown-menu">
                                    <div className="dropdown-title">Unassigned Items ({tbdEvents.length})</div>
                                    {tbdEvents.map((event) => (
                                      <button
                                        key={event.id}
                                        type="button"
                                        className="dropdown-item"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setModalEvent(event);
                                          setActiveTbdDropdown(null);
                                        }}
                                      >
                                        <Icon name="pin" size={12} /> {event.title}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Timeline + Grid Columns Body */}
                  <div className="calendar-day-grid-body" style={{ height: activeHours.length * hourHeightScale, width: "100%" }}>
                    {/* Left Time Axis */}
                    <div className="calendar-time-axis" style={{ width: "70px" }}>
                      {activeHours.map((hour) => {
                        const ampm = hour >= 12 ? "PM" : "AM";
                        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
                        
                        if (hourHeightScale >= 110) {
                          // 15-minute increments
                          return (
                            <div key={hour} className="hour-group" style={{ height: hourHeightScale, display: "flex", flexDirection: "column" }}>
                              <div className="time-axis-slot main-hour" style={{ height: hourHeightScale / 4 }}>
                                <span className="time-label">{displayHour}:00 {ampm}</span>
                              </div>
                              <div className="time-axis-slot sub-hour" style={{ height: hourHeightScale / 4 }}>
                                <span className="time-label time-label-sub">{displayHour}:15</span>
                              </div>
                              <div className="time-axis-slot sub-hour" style={{ height: hourHeightScale / 4 }}>
                                <span className="time-label time-label-sub">{displayHour}:30</span>
                              </div>
                              <div className="time-axis-slot sub-hour" style={{ height: hourHeightScale / 4 }}>
                                <span className="time-label time-label-sub">{displayHour}:45</span>
                              </div>
                            </div>
                          );
                        } else if (hourHeightScale >= 70) {
                          // 30-minute increments
                          return (
                            <div key={hour} className="hour-group" style={{ height: hourHeightScale, display: "flex", flexDirection: "column" }}>
                              <div className="time-axis-slot main-hour" style={{ height: hourHeightScale / 2 }}>
                                <span className="time-label">{displayHour}:00 {ampm}</span>
                              </div>
                              <div className="time-axis-slot sub-hour" style={{ height: hourHeightScale / 2 }}>
                                <span className="time-label time-label-sub">{displayHour}:30</span>
                              </div>
                            </div>
                          );
                        } else {
                          // 60-minute increments (zoomed out)
                          return (
                            <div key={hour} className="time-axis-slot" style={{ height: hourHeightScale }}>
                              <span className="time-label">{displayHour} {ampm}</span>
                            </div>
                          );
                        }
                      })}
                    </div>

                    {/* Background grid lines */}
                    <div className="calendar-grid-lines">
                      {activeHours.map((hour) => {
                        if (hourHeightScale >= 110) {
                          // 15-minute grid lines
                          return (
                            <div key={`line-${hour}`} style={{ height: hourHeightScale, display: "flex", flexDirection: "column" }}>
                              <div className="grid-line sub-hour-line" style={{ height: hourHeightScale / 4 }} />
                              <div className="grid-line sub-hour-line" style={{ height: hourHeightScale / 4 }} />
                              <div className="grid-line sub-hour-line" style={{ height: hourHeightScale / 4 }} />
                              <div className="grid-line hour-line" style={{ height: hourHeightScale / 4 }} />
                            </div>
                          );
                        } else if (hourHeightScale >= 70) {
                          // 30-minute grid lines
                          return (
                            <div key={`line-${hour}`} style={{ height: hourHeightScale, display: "flex", flexDirection: "column" }}>
                              <div className="grid-line sub-hour-line" style={{ height: hourHeightScale / 2 }} />
                              <div className="grid-line hour-line" style={{ height: hourHeightScale / 2 }} />
                            </div>
                          );
                        } else {
                          // Hourly grid lines
                          return (
                            <div key={`line-${hour}`} className="grid-line hour-line" style={{ height: hourHeightScale }} />
                          );
                        }
                      })}
                    </div>

                    {/* Lanes Wrapper */}
                    <div className="calendar-columns-wrapper">
                      {/* Department Lanes */}
                      {displayDeptsForDay.map((dept) => {
                        const timedEvents = dateGroup.events.filter(
                          (e) => e.department === dept && timeToMinutes(e.startTime) !== -1
                        );
                        return (
                          <div 
                            key={`lane-dept-${dept}`} 
                            className="calendar-grid-column department-lane" 
                            style={{ 
                              flex: "1 1 0%", 
                              minWidth: `${columnWidthScale}px`,
                              maxWidth: `${columnWidthScale * 1.25}px`
                            }}
                          >
                            {timedEvents.map((event) => {
                              const placement = calendarEventPlacements.get(`${event.id}::department::${dept}`);
                              if (!placement) return null;
                              
                              const isHighlighted = searchQuery.trim() !== "" && (
                                event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                (event.description && event.description.toLowerCase().includes(searchQuery.toLowerCase()))
                              );

                              const activeTop = hideEmptyHours ? getActiveMinuteOffset(placement.top, activeHours) : placement.top;
                              const activeHeight = hideEmptyHours
                                ? Math.max(44, getActiveMinuteOffset(placement.top + placement.height, activeHours) - activeTop)
                                : placement.height;

                              const rawColorStyle = getColorStyle("Department", dept);
                              const computedHeight = Math.max(44, (activeHeight / 60) * hourHeightScale);
                              const cleanTitle = (event.title || "").replace(/^[\s\-–—]+|[\s\-–—]+$/g, "").trim() || "Untitled Event";

                              const cardStyle: React.CSSProperties = {
                                top: `${(activeTop / 60) * hourHeightScale}px`,
                                height: `${computedHeight}px`,
                                left: `${placement.left}%`,
                                width: `${placement.width}%`,
                                borderLeft: `4px solid ${rawColorStyle.borderColor || rawColorStyle.color || "var(--accent)"}`,
                                ...rawColorStyle,
                              };

                              return (
                                <div
                                  key={`card-dept-${event.id}`}
                                  id={`event-card-dept-${event.id}`}
                                  className={`calendar-event-card ${isHighlighted ? "highlighted" : ""} ${searchQuery.trim() !== "" && !isHighlighted ? "dimmed" : ""} ${highlightedEventId === event.id ? "highlight-active" : ""}`}
                                  style={cardStyle}
                                  onClick={() => setModalEvent(event)}
                                >
                                  <div className="card-inner">
                                    <div className="event-card-time">
                                      {event.startTime} – {event.endTime}
                                    </div>
                                    <div className="event-card-title">{cleanTitle}</div>
                                    <div className="event-card-meta">
                                      {event.locationName && <span className="meta-loc"><Icon name="mapPin" size={12} /> {event.locationName}</span>}
                                      {event.leadPointPerson && <span className="meta-lead"><Icon name="user" size={12} /> {event.leadPointPerson}</span>}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}

                      {/* Location Lanes */}
                      {displayLocsForDay.map((loc) => {
                        const timedEvents = dateGroup.events.filter(
                          (e) => e.locationName === loc && timeToMinutes(e.startTime) !== -1
                        );
                        return (
                          <div 
                            key={`lane-loc-${loc}`} 
                            className="calendar-grid-column location-lane" 
                            style={{ 
                              flex: "1 1 0%", 
                              minWidth: `${columnWidthScale}px`,
                              maxWidth: `${columnWidthScale * 1.25}px`
                            }}
                          >
                            {timedEvents.map((event) => {
                              const placement = calendarEventPlacements.get(`${event.id}::location::${loc}`);
                              if (!placement) return null;
                              
                              const isHighlighted = searchQuery.trim() !== "" && (
                                event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                (event.description && event.description.toLowerCase().includes(searchQuery.toLowerCase()))
                              );

                              const activeTop = hideEmptyHours ? getActiveMinuteOffset(placement.top, activeHours) : placement.top;
                              const activeHeight = hideEmptyHours
                                ? Math.max(44, getActiveMinuteOffset(placement.top + placement.height, activeHours) - activeTop)
                                : placement.height;

                              const rawColorStyle = getColorStyle("Location", loc);
                              const computedHeight = Math.max(44, (activeHeight / 60) * hourHeightScale);
                              const cleanTitle = (event.title || "").replace(/^[\s\-–—]+|[\s\-–—]+$/g, "").trim() || "Untitled Event";

                              const cardStyle: React.CSSProperties = {
                                top: `${(activeTop / 60) * hourHeightScale}px`,
                                height: `${computedHeight}px`,
                                left: `${placement.left}%`,
                                width: `${placement.width}%`,
                                borderLeft: `4px solid ${rawColorStyle.borderColor || rawColorStyle.color || "var(--accent)"}`,
                                ...rawColorStyle,
                              };

                              return (
                                 <div
                                   key={`card-loc-${event.id}`}
                                   id={`event-card-loc-${event.id}`}
                                   className={`calendar-event-card ${isHighlighted ? "highlighted" : ""} ${searchQuery.trim() !== "" && !isHighlighted ? "dimmed" : ""} ${highlightedEventId === event.id ? "highlight-active" : ""}`}
                                   style={cardStyle}
                                   onClick={() => setModalEvent(event)}
                                 >
                                  <div className="card-inner">
                                    <div className="event-card-time">
                                      {event.startTime} – {event.endTime}
                                    </div>
                                    <div className="event-card-title">{cleanTitle}</div>
                                    <div className="event-card-meta">
                                      {event.department && <span className="meta-dept"><Icon name="building" size={12} /> {event.department}</span>}
                                      {event.leadPointPerson && <span className="meta-lead"><Icon name="user" size={12} /> {event.leadPointPerson}</span>}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                    {isToday && activeCurrent >= 0 && activeCurrent <= activeHours.length * 60 && (
                      <div
                        className="calendar-live-time-line"
                        style={{ top: `${lineTop}px` }}
                      >
                        <span className="live-line-dot"></span>
                        <span className="live-line-label">
                          {currentTime!.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
