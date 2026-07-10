"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { Venue, FestivalEvent, FestivalDay, Department } from "@/types/festival";
import sheetColors from "@/data/sheet-colors.json";
import { EventModal } from "./event/EventModal";
import { FilterBar } from "./event/FilterBar";
import { MapView } from "./event/MapView";
import { ScheduleGrid } from "./event/ScheduleGrid";
import { RunningSchedule } from "./event/RunningSchedule";
import { CalendarView } from "./event/CalendarView";
import { useAuthProfile } from "@/hooks/useAuthProfile";
import { useEventData } from "@/hooks/useEventData";
import { useFilters } from "@/hooks/useFilters";

const MAP_CENTER = { lat: 40.7864, lng: -119.2065 }; // Default Playa (BRC) coordinates
const MAP_DEFAULT_ZOOM = 13;

// Helper utilities for time filtering
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


type FestivalMapAppProps = {
  venues: Venue[];
  events: FestivalEvent[];
  personnel?: unknown[];
  departments?: Department[];
  colors?: Record<string, Record<string, { bg: string; fg: string }>>;
  dataSourceLabel?: string;
  debug?: unknown;
  userSession?: {
    email: string;
    name?: string;
    picture?: string;
  };
};



export function FestivalMapApp({
  venues: initialVenues,
  events: initialEvents,
  personnel: initialPersonnel = [],
  departments: initialDepartments = [],
  colors: initialColors,
  dataSourceLabel,
  debug,
  userSession: initialUserSession,
}: FestivalMapAppProps) {
  // 1. Auth Hook
  const { userSession, role } = useAuthProfile(initialUserSession);

  // 2. Event Data Hook
  const { venues, events, personnel, departments, sourceLabel } = useEventData(role, {
    venues: initialVenues,
    events: initialEvents,
    personnel: initialPersonnel,
    departments: initialDepartments,
    dataSourceLabel,
  });

  // 3. Filters Hook
  const {
    searchQuery,
    setSearchQuery,
    selectedLocations,
    setSelectedLocations,
    selectedActions,
    setSelectedActions,
    selectedDepartments,
    setSelectedDepartments,
    selectedLeads,
    setSelectedLeads,
    startTimeFilter,
    setStartTimeFilter,
    endTimeFilter,
    setEndTimeFilter,
    locationOptions,
    actionOptions,
    departmentOptions,
    leadOptions,
    filteredEvents,
    filteredAndSortedEvents,
    groupedEventsByDate,
    visibleMappableVenues,
    mapCenterCoords,
    availableDates,
    activeDepartments,
    activeLocations,
    calendarEventPlacements,
    activeFiltersCount,
  } = useFilters({
    events,
    venues,
    mapCenter: MAP_CENTER,
  });

  const colors = initialColors || {};
  // Helper for tag coloring with dynamic sheets support and static fallback
  const getColorStyle = (category: "Location" | "Action" | "Department" | "Personnel", value: string | undefined) => {
    if (!value) return {};
    const trimmed = value.trim();
    
    // Try dynamic colors from Google Sheet first
    let colorsMatch = colors?.[category]?.[trimmed];
    
    // Fall back to static sheet-colors.json configuration
    if (!colorsMatch) {
      colorsMatch = (sheetColors as Record<string, Record<string, { bg: string; fg: string }>>)[category]?.[trimmed];
    }
    
    if (colorsMatch) {
      return {
        backgroundColor: colorsMatch.bg,
        color: colorsMatch.fg,
        borderColor: colorsMatch.fg + "33", // subtle border with opacity
      };
    }
    return {};
  };
  // Tabs & Layout States
  const [mainTab, setMainTab] = useState<"schedule" | "calendar" | "map">("schedule");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [columnWidthScale, setColumnWidthScale] = useState<number>(180);
  const [hourHeightScale, setHourHeightScale] = useState<number>(60);
  const [scheduleWidthScale, setScheduleWidthScale] = useState<number>(750);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef({ columnWidthScale, hourHeightScale, scheduleWidthScale });
  useEffect(() => {
    scaleRef.current = { columnWidthScale, hourHeightScale, scheduleWidthScale };
  }, [columnWidthScale, hourHeightScale, scheduleWidthScale]);
  const [modalEvent, setModalEvent] = useState<FestivalEvent | null>(null);
  const [hideEmptyHours, setHideEmptyHours] = useState(true);
  const hideEmptyColumns = true;
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isMobileScheduleOpen, setIsMobileScheduleOpen] = useState(false);


  // Sync dark mode class on document body
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("legacy-theme-dark", isDarkMode);
    return () => {
      document.body.classList.remove("legacy-theme-dark");
    };
  }, [isDarkMode]);

  // Prevent default Safari iOS pinch-to-zoom gestures globally
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleGestureStart = (e: Event) => {
      e.preventDefault();
    };
    document.addEventListener("gesturestart", handleGestureStart);
    return () => {
      document.removeEventListener("gesturestart", handleGestureStart);
    };
  }, []);

  // Handle custom pinch-to-zoom for scale features in main content tabs
  useEffect(() => {
    const el = mainContentRef.current;
    if (!el) return;

    let initialDist = 0;
    let initialColScale = 0;
    let initialHourScale = 0;
    let initialSchedScale = 0;
    
    let initialTouch0 = { x: 0, y: 0 };
    let initialTouch1 = { x: 0, y: 0 };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        
        initialTouch0 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        initialTouch1 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
        
        initialDist = Math.hypot(
          initialTouch0.x - initialTouch1.x,
          initialTouch0.y - initialTouch1.y
        );
        
        const scales = scaleRef.current;
        initialColScale = scales.columnWidthScale;
        initialHourScale = scales.hourHeightScale;
        initialSchedScale = scales.scheduleWidthScale;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        
        const touch0 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        const touch1 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
        
        const currentDist = Math.hypot(
          touch0.x - touch1.x,
          touch0.y - touch1.y
        );

        if (initialDist > 0) {
          const ratio = currentDist / initialDist;
          
          if (mainTab === "calendar") {
            const initialDeltaX = Math.abs(initialTouch0.x - initialTouch1.x);
            const initialDeltaY = Math.abs(initialTouch0.y - initialTouch1.y);
            
            const currentDeltaX = Math.abs(touch0.x - touch1.x);
            const currentDeltaY = Math.abs(touch0.y - touch1.y);
            
            if (initialDeltaX > 10) {
              const scaleRatioX = currentDeltaX / (initialDeltaX || 1);
              const newColScale = Math.min(400, Math.max(100, Math.round(initialColScale * scaleRatioX)));
              setColumnWidthScale(newColScale);
            }
            if (initialDeltaY > 10) {
              const scaleRatioY = currentDeltaY / (initialDeltaY || 1);
              const newHourScale = Math.min(300, Math.max(30, Math.round(initialHourScale * scaleRatioY)));
              setHourHeightScale(newHourScale);
            }
          } else if (mainTab === "schedule") {
            const newSchedScale = Math.min(1500, Math.max(500, Math.round(initialSchedScale * ratio)));
            setScheduleWidthScale(newSchedScale);
          }
        }
      }
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
    };
  }, [mainTab]);



  const calendarScrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mainTab !== "calendar" || availableDates.length === 0) return;
    
    const firstDate = availableDates[0].date;
    const dayEvents = filteredEvents.filter(
      (e) => e.scheduleDate === firstDate && timeToMinutes(e.startTime) !== -1
    );
    
    if (dayEvents.length > 0) {
      const earliestStart = Math.min(...dayEvents.map((e) => timeToMinutes(e.startTime)));
      if (calendarScrollContainerRef.current) {
        let scrollOffset = 0;
        if (hideEmptyHours) {
          const activeHours = getActiveHoursForDay(dayEvents);
          const activeStart = getActiveMinuteOffset(earliestStart, activeHours);
          scrollOffset = (Math.max(0, activeStart - 60) / 60) * hourHeightScale;
        } else {
          scrollOffset = (Math.max(0, earliestStart - 60) / 60) * hourHeightScale;
        }
        calendarScrollContainerRef.current.scrollTop = scrollOffset + 60;
      }
    }
  }, [mainTab, availableDates, filteredEvents, hourHeightScale, hideEmptyHours]);


  // Prevent body scroll when mobile drawers are open
  useEffect(() => {
    if (isMobileFiltersOpen || isMobileScheduleOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileFiltersOpen, isMobileScheduleOpen]);

  // Helper to render the body of filters & search
  const renderFiltersBody = () => {
    return (
      <FilterBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedLocations={selectedLocations}
        setSelectedLocations={setSelectedLocations}
        selectedActions={selectedActions}
        setSelectedActions={setSelectedActions}
        selectedDepartments={selectedDepartments}
        setSelectedDepartments={setSelectedDepartments}
        selectedLeads={selectedLeads}
        setSelectedLeads={setSelectedLeads}
        startTimeFilter={startTimeFilter}
        setStartTimeFilter={setStartTimeFilter}
        endTimeFilter={endTimeFilter}
        setEndTimeFilter={setEndTimeFilter}
        locationOptions={locationOptions}
        actionOptions={actionOptions}
        departmentOptions={departmentOptions}
        leadOptions={leadOptions}
        getColorStyle={getColorStyle}
      />
    );
  };

  // Helper to render the body of the running schedule
  const renderScheduleBody = () => {
    return (
      <RunningSchedule
        groupedEventsByDate={groupedEventsByDate}
        setModalEvent={setModalEvent}
        getColorStyle={getColorStyle}
      />
    );
  };

  const hoursArray = Array.from({ length: 24 }, (_, i) => i);

  return (
    <main className={`legacy-app ${isDarkMode ? "dark-theme" : ""}`}>
      {/* Header Banner */}
      <header className="legacy-banner">
        <div className="legacy-banner-title" style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <h1 className="legacy-banner-heading">The Portal</h1>
          {sourceLabel && (
            <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "normal" }}>
              ({sourceLabel})
            </span>
          )}
        </div>
        <div className="legacy-banner-actions">
          {userSession && (
            <div className="user-profile-section">
              {userSession.picture ? (
                <img
                  src={userSession.picture}
                  alt={userSession.name || userSession.email}
                  referrerPolicy="no-referrer"
                  style={{ width: "30px", height: "30px", borderRadius: "50%", border: "1.5px solid #a855f7" }}
                />
              ) : (
                <div
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "50%",
                    backgroundColor: "#6366f1",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "bold",
                    fontSize: "0.8rem",
                    border: "1.5px solid #a855f7",
                  }}
                >
                  {(userSession.name || userSession.email)[0].toUpperCase()}
                </div>
              )}
              <div className="user-profile-info">
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: isDarkMode ? "#f3f4f6" : "#1f2937", lineHeight: "1.2" }}>
                  {userSession.name || userSession.email.split("@")[0]}
                </span>
                <span style={{ fontSize: "0.65rem", color: isDarkMode ? "#9ca3af" : "#6b7280" }}>
                  {userSession.email}
                </span>
              </div>
              <a
                href="/api/auth/logout"
                style={{
                  padding: "0.25rem 0.6rem",
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#f87171",
                  borderRadius: "5px",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  transition: "background-color 0.2s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
                }}
              >
                Logout
              </a>
            </div>
          )}
          <button
            type="button"
            className="legacy-theme-switch"
            onClick={() => setIsDarkMode(!isDarkMode)}
            aria-label="Toggle dark theme"
            style={{ width: "32px", height: "32px", padding: "0", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", fontSize: "1rem" }}
          >
            {isDarkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      {/* Main Layout Shell */}
      <div className="legacy-shell">
        {/* Main Content Area: Tabbed Schedule & Map */}
        <section className="legacy-map-panel">
          {/* Desktop-only floating sidebar toggle */}
          <button
            type="button"
            className={`legacy-sidebar-toggle-edge ${isSidebarOpen ? "is-open" : "is-closed"}`}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? "Hide filters & running schedule" : "Show filters & running schedule"}
          >
            {isSidebarOpen ? "➡️" : "⬅️"}
          </button>
          {/* Main Tab Switcher */}
          <div className="main-tabs-header">
            <div className="main-tabs-header-buttons">
              <button
                type="button"
                className={`main-tab-btn ${mainTab === "schedule" ? "active" : ""}`}
                onClick={() => setMainTab("schedule")}
              >
                📋 Schedule List
              </button>
              <button
                type="button"
                className={`main-tab-btn ${mainTab === "calendar" ? "active" : ""}`}
                onClick={() => setMainTab("calendar")}
              >
                📅 Calendar Grid
              </button>
              <button
                type="button"
                className={`main-tab-btn map-tab-btn ${mainTab === "map" ? "active" : ""}`}
                onClick={() => setMainTab("map")}
              >
                🗺️ Map View {visibleMappableVenues.length === 0 ? "(Scaffolded)" : ""}
              </button>
            </div>
            
            <div className="main-tabs-header-controls">
              {mainTab === "schedule" && (
                <div className="tab-header-scale-item">
                  <label htmlFor="sched-zoom-slider-header">W: <span className="scale-value">{scheduleWidthScale}px</span></label>
                  <input
                    id="sched-zoom-slider-header"
                    type="range"
                    min="500"
                    max="1500"
                    step="50"
                    value={scheduleWidthScale}
                    onChange={(e) => setScheduleWidthScale(Number(e.target.value))}
                    className="zoom-slider"
                  />
                </div>
              )}
              {mainTab === "calendar" && (
                <>
                  <div className="tab-header-scale-item">
                    <label htmlFor="horz-zoom-slider-header">W: <span className="scale-value">{columnWidthScale}px</span></label>
                    <input
                      id="horz-zoom-slider-header"
                      type="range"
                      min="100"
                      max="400"
                      step="10"
                      value={columnWidthScale}
                      onChange={(e) => setColumnWidthScale(Number(e.target.value))}
                      className="zoom-slider"
                    />
                  </div>
                  <div className="tab-header-scale-item">
                    <label htmlFor="vert-zoom-slider-header">H: <span className="scale-value">{hourHeightScale}px</span></label>
                    <input
                      id="vert-zoom-slider-header"
                      type="range"
                      min="30"
                      max="300"
                      step="5"
                      value={hourHeightScale}
                      onChange={(e) => setHourHeightScale(Number(e.target.value))}
                      className="zoom-slider"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setHideEmptyHours(!hideEmptyHours)}
                    className={`calendar-toggle-btn ${hideEmptyHours ? "active" : ""}`}
                    aria-pressed={hideEmptyHours}
                    style={{ padding: "4px 8px", fontSize: "0.75rem", borderRadius: "6px" }}
                  >
                    {hideEmptyHours ? (
                      <svg className="control-icon-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle", marginRight: "4px" }}>
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                        <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                        <line x1="2" y1="2" x2="22" y2="22" />
                      </svg>
                    ) : (
                      <svg className="control-icon-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle", marginRight: "4px" }}>
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                    <span>Hide Empty Hours</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Main Content Render */}
          <div ref={mainContentRef} className={`main-tab-content tab-${mainTab}`}>
            {mainTab === "schedule" ? (
              <ScheduleGrid
                groupedEventsByDate={groupedEventsByDate}
                scheduleWidthScale={scheduleWidthScale}
                getColorStyle={getColorStyle}
              />
            ) : mainTab === "calendar" ? (
              <CalendarView
                groupedEventsByDate={groupedEventsByDate}
                hideEmptyHours={hideEmptyHours}
                activeDepartments={activeDepartments}
                activeLocations={activeLocations}
                columnWidthScale={columnWidthScale}
                hourHeightScale={hourHeightScale}
                scrollContainerRef={calendarScrollContainerRef}
                searchQuery={searchQuery}
                calendarEventPlacements={calendarEventPlacements}
                setModalEvent={setModalEvent}
                departments={departments}
                getColorStyle={getColorStyle}
              />
            ) : (
              <MapView
                venues={venues}
                mapCenter={MAP_CENTER}
                defaultZoom={MAP_DEFAULT_ZOOM}
              />
            )}
          </div>
        </section>

        {/* Right Sidebar Section */}
        <aside className={`legacy-list-panel ${isSidebarOpen ? "" : "collapsed"}`}>
          {/* Filters Panel */}
          <section className="legacy-list-block legacy-list-controls">
            {/* Mobile collapsible filters header toggle */}
            <button
              type="button"
              className="legacy-mobile-filters-toggle"
              onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
              title={isMobileFiltersOpen ? "Hide filters" : "Show filters"}
            >
              <span>🔍 Filters & Search</span>
              <span>{isMobileFiltersOpen ? "🔼 Collapse" : "🔽 Expand"}</span>
            </button>

            <div className={`legacy-mobile-filter-body ${isMobileFiltersOpen ? "is-open" : ""}`}>
              {renderFiltersBody()}
            </div>
          </section>

          {/* Running Chronological Schedule */}
          <section className="legacy-list-block sidebar-schedule-block">
            {/* Mobile collapsible schedule header toggle */}
            <button
              type="button"
              className="legacy-mobile-schedule-toggle"
              onClick={() => setIsMobileScheduleOpen(!isMobileScheduleOpen)}
              title={isMobileScheduleOpen ? "Hide schedule list" : "Show schedule list"}
            >
              <span>📋 Running Schedule</span>
              <span>{isMobileScheduleOpen ? "🔼 Collapse" : "🔽 Expand"}</span>
            </button>

            <div className={`legacy-mobile-schedule-body ${isMobileScheduleOpen ? "is-open" : ""}`}>
              <div className="legacy-list-title">
                <h2>Running Schedule</h2>
                <span>{filteredAndSortedEvents.length} items</span>
              </div>
              {renderScheduleBody()}
            </div>
          </section>
        </aside>
      </div>

      {/* Mobile Sticky Bottom Bar */}
      <div className="mobile-sticky-bottom-bar">
        <button
          type="button"
          className={`mobile-bar-btn ${isMobileFiltersOpen ? "active" : ""}`}
          onClick={() => {
            setIsMobileFiltersOpen(!isMobileFiltersOpen);
            setIsMobileScheduleOpen(false);
          }}
        >
          🔍 Filters &amp; Search {activeFiltersCount > 0 && <span className="mobile-badge">{activeFiltersCount}</span>}
        </button>
        {mainTab === "calendar" && (
          <button
            type="button"
            className={`mobile-bar-btn hide-empty-btn ${hideEmptyHours ? "active" : ""}`}
            onClick={() => setHideEmptyHours(!hideEmptyHours)}
          >
            {hideEmptyHours ? "👁️ Hide Empty Hours" : "👁️ Show All Hours"}
          </button>
        )}
        <button
          type="button"
          className={`mobile-bar-btn ${isMobileScheduleOpen ? "active" : ""}`}
          onClick={() => {
            setIsMobileScheduleOpen(!isMobileScheduleOpen);
            setIsMobileFiltersOpen(false);
          }}
        >
          📋 Running Schedule
        </button>
      </div>

      {/* Mobile Filters Drawer */}
      {isMobileFiltersOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setIsMobileFiltersOpen(false)}>
          <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <h3>🔍 Filters &amp; Search</h3>
              <button type="button" className="mobile-drawer-close" onClick={() => setIsMobileFiltersOpen(false)}>
                ✕
              </button>
            </div>
            <div className="mobile-drawer-body">
              {renderFiltersBody()}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Running Schedule Drawer */}
      {isMobileScheduleOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setIsMobileScheduleOpen(false)}>
          <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <h3>📋 Running Schedule ({filteredAndSortedEvents.length})</h3>
              <button type="button" className="mobile-drawer-close" onClick={() => setIsMobileScheduleOpen(false)}>
                ✕
              </button>
            </div>
            <div className="mobile-drawer-body">
              {renderScheduleBody()}
            </div>
          </div>
        </div>
      )}

      {/* Debug Footer info */}
      {!!debug && (
        <footer className="portal-debug-footer font-mono">
          Loaded {events.length} events from ROS. Locations: {venues.length}. Contacts: {personnel.length}. Depts: {departments.length}.
        </footer>
      )}

      <EventModal
        modalEvent={modalEvent}
        onClose={() => setModalEvent(null)}
        getColorStyle={getColorStyle}
      />
    </main>
  );
}
