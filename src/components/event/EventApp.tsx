"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { Venue, FestivalEvent, Department } from "@/types/festival";
import sheetColors from "@/data/sheet-colors.json";
import { EventModal } from "./EventModal";
import { FilterBar } from "./FilterBar";
import { MapView } from "./MapView";
import { ScheduleGrid } from "./ScheduleGrid";
import { RunningSchedule } from "./RunningSchedule";
import { CalendarView } from "./CalendarView";
import { Icon } from "@/components/ui/icons";
import { useAuthProfile } from "@/hooks/useAuthProfile";
import { useEventData } from "@/hooks/useEventData";
import { useFilters } from "@/hooks/useFilters";

import { useStarredEvents } from "@/hooks/useStarredEvents";
import { NowNext } from "./NowNext";
import { Toasts, ToastMessage } from "./Toasts";
import { parseUrlParams, buildUrlQuery, UrlState } from "@/lib/url-state";
import { Legend } from "./Legend";

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


type EventAppProps = {
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
    role?: string;
  };
};



export function EventApp({
  venues: initialVenues,
  events: initialEvents,
  personnel: initialPersonnel = [],
  departments: initialDepartments = [],
  colors: initialColors,
  dataSourceLabel,
  debug,
  userSession: initialUserSession,
}: EventAppProps) {
  // 1. Auth Hook
  const { userSession, role } = useAuthProfile(initialUserSession);

  // 2. Event Data Hook
  const { venues, events, personnel, departments, sourceLabel, isOffline, lastSynced } = useEventData(role, {
    venues: initialVenues,
    events: initialEvents,
    personnel: initialPersonnel,
    departments: initialDepartments,
    dataSourceLabel,
  });

  // 2b. Starred Personal Agenda Hook
  const { starredIds, toggleStar, isStarred } = useStarredEvents(userSession?.email);

  // 2c. Custom States for Day-of-Show and Linkage
  const [isMyScheduleOnly, setIsMyScheduleOnly] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [focusedVenueId, setFocusedVenueId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const prevEventsRef = useRef<FestivalEvent[]>([]);

  // 2d. Live Ticker / Clock / Simulated Time states
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isTimeSimulated, setIsTimeSimulated] = useState(false);
  const [effectiveDateStr, setEffectiveDateStr] = useState("");

  const getEffectiveTime = (evtList: FestivalEvent[]) => {
    const now = new Date();
    const eventDates = evtList.map(e => e.scheduleDate).filter(Boolean) as string[];
    if (eventDates.length === 0) return { time: now, isSimulated: false, dateStr: "" };

    const sortedDates = [...new Set(eventDates)].sort();
    const startDateStr = sortedDates[0];
    const endDateStr = sortedDates[sortedDates.length - 1];

    const start = new Date(`${startDateStr}T00:00:00`);
    const end = new Date(`${endDateStr}T23:59:59`);

    if (now >= start && now <= end) {
      return { time: now, isSimulated: false, dateStr: now.toISOString().split("T")[0] };
    }

    // Fall back to simulated time: first day of event, keeping current HH:MM:SS
    const simulatedTime = new Date(now);
    const [y, m, d] = startDateStr.split("-").map(Number);
    simulatedTime.setFullYear(y, m - 1, d);
    return { time: simulatedTime, isSimulated: true, dateStr: startDateStr };
  };

  useEffect(() => {
    if (events.length === 0) return;

    const updateClock = () => {
      const { time, isSimulated, dateStr } = getEffectiveTime(events);
      setCurrentTime(time);
      setIsTimeSimulated(isSimulated);
      setEffectiveDateStr(dateStr);
    };

    updateClock();
    const timer = setInterval(updateClock, 60000);
    return () => clearInterval(timer);
  }, [events]);

  // Toast adder helper
  const addToast = (title: string, message: string, type: "info" | "warning" | "success" = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, message, type, timestamp: new Date() }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Diff successive snapshots to trigger toasts
  useEffect(() => {
    if (events.length === 0) return;

    if (prevEventsRef.current.length === 0) {
      prevEventsRef.current = events;
      return;
    }

    const prevEvents = prevEventsRef.current;
    events.forEach((curr) => {
      const prev = prevEvents.find((p) => p.id === curr.id);
      if (!prev) return;

      const timeChanged = prev.startTime !== curr.startTime || prev.endTime !== curr.endTime;
      const locChanged = prev.locationName !== curr.locationName;
      const dateChanged = prev.scheduleDate !== curr.scheduleDate;

      if (timeChanged || locChanged || dateChanged) {
        let msg = "";
        if (dateChanged) msg += `Date: ${curr.scheduleDate} (was ${prev.scheduleDate}) `;
        if (timeChanged) msg += `Time: ${curr.startTime}-${curr.endTime} (was ${prev.startTime}-${prev.endTime}) `;
        if (locChanged) msg += `Location: ${curr.locationName || "TBD"} (was ${prev.locationName || "TBD"}) `;
        addToast("Event Updated", `"${curr.title}" updated: ${msg.trim()}`, "warning");
      }
    });

    prevEventsRef.current = events;
  }, [events]);

  // Extract unique categories from venues
  const categoriesList = useMemo(() => {
    return Array.from(new Set(venues.map(v => v.permanence).filter((p): p is string => !!p))).sort();
  }, [venues]);

  // 2e. Filter events by Personal Agenda if toggled
  const activeEventList = useMemo(() => {
    if (isMyScheduleOnly) {
      return events.filter(e => starredIds.includes(e.id));
    }
    return events;
  }, [events, isMyScheduleOnly, starredIds]);

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
    availableDates,
    activeDepartments,
    activeLocations,
    calendarEventPlacements,
    activeFiltersCount,
  } = useFilters({
    events: activeEventList,
    venues,
    mapCenter: MAP_CENTER,
  });

  const colors = initialColors || {};
  // Tag coloring: the designed, theme-aware palette in sheet-colors.json
  // wins; runtime Google-Sheet swatches only cover keys the palette does
  // not know about (they are single light-polarity pairs).
  const getColorStyle = (category: "Location" | "Action" | "Department" | "Personnel", value: string | undefined) => {
    if (!value) return {};
    const trimmed = value.trim();

    const designed = (sheetColors as Record<
      string,
      Record<string, { light: { bg: string; fg: string }; dark: { bg: string; fg: string } }>
    >)[category]?.[trimmed];
    const colorsMatch = designed
      ? designed[isDarkMode ? "dark" : "light"]
      : colors?.[category]?.[trimmed];

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
  const [mainTab, setMainTab] = useState<"now-next" | "schedule" | "calendar" | "map">("schedule");
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScrollCapture = () => {
      if (isProgrammaticScrollRef.current) return;
      if (highlightedEventId) {
        setHighlightedEventId(null);
      }
    };
    window.addEventListener("scroll", handleScrollCapture, true);
    return () => {
      window.removeEventListener("scroll", handleScrollCapture, true);
    };
  }, [highlightedEventId]);

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [isMobileScheduleOpen, setIsMobileScheduleOpen] = useState(false);

  // Register PWA Service Worker
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").then(
          (reg) => console.log("ServiceWorker registered with scope: ", reg.scope),
          (err) => console.error("ServiceWorker registration failed: ", err)
        );
      });
    }
  }, []);

  // URL state synchronization
  const [urlInitialized, setUrlInitialized] = useState(false);

  // Restore state from URL on client mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const state = parseUrlParams(params);

    setTimeout(() => {
      if (state.view && ["now-next", "schedule", "calendar", "map"].includes(state.view)) {
        setMainTab(state.view as any);
      }
      if (state.day) {
        setSelectedDay(state.day);
      }
      if (state.eventId) {
        const found = initialEvents.find(e => e.id === state.eventId);
        if (found) setModalEvent(found);
      }
      if (state.query) setSearchQuery(state.query);
      if (state.locations && state.locations.length > 0) setSelectedLocations(state.locations);
      if (state.actions && state.actions.length > 0) setSelectedActions(state.actions);
      if (state.departments && state.departments.length > 0) setSelectedDepartments(state.departments);
      if (state.leads && state.leads.length > 0) setSelectedLeads(state.leads);
      if (state.mySchedule) setIsMyScheduleOnly(true);

      setUrlInitialized(true);
    }, 0);
  }, [initialEvents, setSearchQuery, setSelectedLocations, setSelectedActions, setSelectedDepartments, setSelectedLeads]);

  // Save changes back to URL params
  useEffect(() => {
    if (!urlInitialized || typeof window === "undefined") return;

    const state: UrlState = {
      view: mainTab,
      day: selectedDay || undefined,
      eventId: modalEvent?.id || undefined,
      query: searchQuery || undefined,
      locations: selectedLocations.length > 0 ? selectedLocations : undefined,
      actions: selectedActions.length > 0 ? selectedActions : undefined,
      departments: selectedDepartments.length > 0 ? selectedDepartments : undefined,
      leads: selectedLeads.length > 0 ? selectedLeads : undefined,
      mySchedule: isMyScheduleOnly || undefined,
    };

    const newQuery = buildUrlQuery(state);
    const newUrl = window.location.pathname + newQuery;
    window.history.replaceState(null, "", newUrl);
  }, [
    urlInitialized,
    mainTab,
    selectedDay,
    modalEvent,
    searchQuery,
    selectedLocations,
    selectedActions,
    selectedDepartments,
    selectedLeads,
    isMyScheduleOnly,
  ]);

  // Compute filtered groupedEventsByDate matching day tabs
  const dayFilteredGroupedEvents = useMemo(() => {
    if (selectedDay) {
      return groupedEventsByDate.filter((g) => g.date === selectedDay);
    }
    return groupedEventsByDate;
  }, [groupedEventsByDate, selectedDay]);


  // Sync dark mode class on document body
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("portal-dark", isDarkMode);
    return () => {
      document.body.classList.remove("portal-dark");
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
    
    // Find target date to focus: selectedDay or today fallback
    const targetDate = selectedDay || (availableDates.some(d => d.date === effectiveDateStr) ? effectiveDateStr : availableDates[0].date);
    
    const dayEvents = filteredEvents.filter(
      (e) => e.scheduleDate === targetDate && timeToMinutes(e.startTime) !== -1
    );
    
    if (dayEvents.length > 0) {
      let scrollOffset = 60;
      const earliestStart = Math.min(...dayEvents.map((e) => timeToMinutes(e.startTime)));
      
      const currentMinutes = currentTime ? currentTime.getHours() * 60 + currentTime.getMinutes() : -1;
      const isTargetToday = targetDate === effectiveDateStr;
      
      if (isTargetToday && currentMinutes !== -1) {
        const hoursArray = Array.from({ length: 24 }, (_, i) => i);
        const activeHours = hideEmptyHours ? getActiveHoursForDay(dayEvents) : hoursArray;
        const activeCurrent = hideEmptyHours
          ? getActiveMinuteOffset(currentMinutes, activeHours)
          : currentMinutes;
        // Center on the line (scroll minus 2 hours for context)
        scrollOffset = (Math.max(0, activeCurrent - 120) / 60) * hourHeightScale;
      } else {
        if (hideEmptyHours) {
          const activeHours = getActiveHoursForDay(dayEvents);
          const activeStart = getActiveMinuteOffset(earliestStart, activeHours);
          scrollOffset = (Math.max(0, activeStart - 60) / 60) * hourHeightScale;
        } else {
          scrollOffset = (Math.max(0, earliestStart - 60) / 60) * hourHeightScale;
        }
      }
      
      if (calendarScrollContainerRef.current) {
        calendarScrollContainerRef.current.scrollTop = scrollOffset + 60;
      }
    }
  }, [mainTab, availableDates, filteredEvents, hourHeightScale, hideEmptyHours, selectedDay, effectiveDateStr, currentTime]);


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
        selectedDay={selectedDay}
        setSelectedDay={setSelectedDay}
        availableDates={availableDates}
      />
    );
  };

  const handleRunningScheduleEventClick = (event: FestivalEvent) => {
    setModalEvent(event);

    if (programmaticScrollTimeoutRef.current) {
      clearTimeout(programmaticScrollTimeoutRef.current);
    }
    isProgrammaticScrollRef.current = true;
    setHighlightedEventId(event.id);

    if (mainTab === "schedule") {
      setTimeout(() => {
        const el = document.getElementById(`event-row-${event.id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 50);
    } else if (mainTab === "calendar") {
      setTimeout(() => {
        const el = document.getElementById(`event-card-dept-${event.id}`) ||
                   document.getElementById(`event-card-loc-${event.id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 50);
    }

    programmaticScrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 1000);
  };

  // Helper to render the body of the running schedule
  const renderScheduleBody = () => {
    return (
      <RunningSchedule
        groupedEventsByDate={dayFilteredGroupedEvents}
        setModalEvent={setModalEvent}
        getColorStyle={getColorStyle}
        currentTime={currentTime}
        onEventClick={handleRunningScheduleEventClick}
      />
    );
  };

  return (
    <main className="legacy-app">
      {isOffline && (
        <div className="offline-banner">
          <span className="offline-icon"><Icon name="warning" size={14} /></span>
          <span>Offline Mode. Displaying cached data (last synced: {lastSynced ? new Date(lastSynced).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Never"}).</span>
        </div>
      )}
      {/* Header Banner */}
      <header className="legacy-banner">
        <div className="legacy-banner-title">
          {/* eslint-disable-next-line @next/next/no-img-element -- static 26px brand mark, next/image is overkill */}
          <img src="/icon.png" alt="" className="banner-brand-mark" width={26} height={26} />
          <h1 className="legacy-banner-heading">The Portal</h1>
          <span className="chip chip-accent eyebrow eyebrow-accent">
            PDT • Black Rock City
          </span>
          {sourceLabel && (
            <span className="banner-source-label">({sourceLabel})</span>
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
                  style={{ width: "30px", height: "30px", borderRadius: "50%", border: "1.5px solid var(--accent)" }}
                />
              ) : (
                <div
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "50%",
                    backgroundColor: "var(--accent)",
                    color: "var(--accent-ink)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "bold",
                    fontSize: "0.8rem",
                    border: "1.5px solid var(--line)",
                  }}
                >
                  {(userSession.name || userSession.email)[0].toUpperCase()}
                </div>
              )}
              <div className="user-profile-info">
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--ink)", lineHeight: "1.2" }}>
                  {userSession.name || userSession.email.split("@")[0]}
                </span>
                <span style={{ fontSize: "0.65rem", color: "var(--muted)" }}>
                  {userSession.email}
                </span>
              </div>
              {role === "admin" && (
                <Link
                  href="/admin"
                  className="btn btn-ghost btn-sm"
                  style={{ marginRight: "0.5rem" }}
                >
                  <Icon name="settings" size={12} /> Admin Panel
                </Link>
              )}
              <a href="/api/auth/logout" className="btn btn-danger btn-sm">
                <Icon name="logout" size={12} /> Logout
              </a>
            </div>
          )}
          <button
            type="button"
            className="legacy-theme-switch"
            onClick={() => setIsDarkMode(!isDarkMode)}
            aria-label="Toggle dark theme"
          >
            <Icon name={isDarkMode ? "sun" : "moon"} size={16} />
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
            <Icon name={isSidebarOpen ? "chevronRight" : "chevronLeft"} size={14} />
          </button>
          {/* Main Tab Switcher */}
          <div className="main-tabs-header">
            <div className="main-tabs-header-buttons">
              <button
                type="button"
                className={`main-tab-btn ${mainTab === "schedule" ? "active" : ""}`}
                onClick={() => setMainTab("schedule")}
              >
                <Icon name="clipboard" size={14} /> Schedule List
              </button>
              <button
                type="button"
                className={`main-tab-btn ${mainTab === "calendar" ? "active" : ""}`}
                onClick={() => setMainTab("calendar")}
              >
                <Icon name="calendar" size={14} /> Calendar Grid
              </button>
              <button
                type="button"
                className={`main-tab-btn map-tab-btn ${mainTab === "map" ? "active" : ""}`}
                onClick={() => setMainTab("map")}
              >
                <Icon name="map" size={14} /> Map View {visibleMappableVenues.length === 0 ? "(Scaffolded)" : ""}
              </button>
              <button
                type="button"
                className={`main-tab-btn ${mainTab === "now-next" ? "active" : ""}`}
                onClick={() => setMainTab("now-next")}
              >
                <Icon name="zap" size={14} /> Now &amp; Next
              </button>
              <button
                type="button"
                className={`main-tab-btn starred-tab-btn ${isMyScheduleOnly ? "active" : ""}`}
                onClick={() => setIsMyScheduleOnly(!isMyScheduleOnly)}
                title={isMyScheduleOnly ? "Showing Starred Only" : "Show Starred"}
                aria-label={isMyScheduleOnly ? "Showing starred only" : "Show starred"}
                style={{ minWidth: "40px", padding: "0" }}
              >
                <Icon name="star" size={16} filled={isMyScheduleOnly} />
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
                  >
                    <Icon name={hideEmptyHours ? "eyeOff" : "eye"} size={12} />
                    <span>Hide Empty Hours</span>
                  </button>
                </>
              )}
            </div>
          </div>



          {/* Main Content Render */}
          <div ref={mainContentRef} className={`main-tab-content tab-${mainTab}`}>
            {mainTab === "now-next" ? (
              currentTime && (
                <NowNext
                  events={events}
                  currentTime={currentTime}
                  effectiveDateStr={effectiveDateStr}
                  isSimulated={isTimeSimulated}
                  setModalEvent={setModalEvent}
                  getColorStyle={getColorStyle}
                />
              )
            ) : mainTab === "schedule" ? (
              <ScheduleGrid
                groupedEventsByDate={dayFilteredGroupedEvents}
                scheduleWidthScale={scheduleWidthScale}
                getColorStyle={getColorStyle}
                currentTime={currentTime}
                setModalEvent={setModalEvent}
                highlightedEventId={highlightedEventId}
              />
            ) : mainTab === "calendar" ? (
              <CalendarView
                groupedEventsByDate={dayFilteredGroupedEvents}
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
                currentTime={currentTime}
                effectiveDateStr={effectiveDateStr}
                highlightedEventId={highlightedEventId}
              />
            ) : (
              <div style={{ position: "relative", width: "100%", height: "100%" }}>
                <MapView
                  venues={venues}
                  mapCenter={MAP_CENTER}
                  defaultZoom={MAP_DEFAULT_ZOOM}
                  focusedVenueId={focusedVenueId}
                  setFocusedVenueId={setFocusedVenueId}
                  setSelectedLocations={setSelectedLocations}
                  setMainTab={setMainTab}
                  events={events}
                  getColorStyle={getColorStyle}
                  activeCategories={activeCategories.length > 0 ? activeCategories : categoriesList}
                  isDarkMode={isDarkMode}
                />
                {categoriesList.length > 0 && (
                  <Legend
                    categories={categoriesList}
                    activeCategories={activeCategories.length > 0 ? activeCategories : categoriesList}
                    onToggleCategory={(cat) => {
                      const active = activeCategories.length > 0 ? activeCategories : [...categoriesList];
                      const newActive = active.includes(cat)
                        ? active.filter((c) => c !== cat)
                        : [...active, cat];
                      setActiveCategories(newActive.length === categoriesList.length ? [] : newActive);
                    }}
                    getColorStyle={getColorStyle}
                  />
                )}
              </div>
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
              <span><Icon name="search" size={14} /> Filters & Search</span>
              <span><Icon name={isMobileFiltersOpen ? "chevronUp" : "chevronDown"} size={14} /> {isMobileFiltersOpen ? "Collapse" : "Expand"}</span>
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
              <span><Icon name="clipboard" size={14} /> Running Schedule</span>
              <span><Icon name={isMobileScheduleOpen ? "chevronUp" : "chevronDown"} size={14} /> {isMobileScheduleOpen ? "Collapse" : "Expand"}</span>
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
          <Icon name="search" size={14} /> Filters &amp; Search {activeFiltersCount > 0 && <span className="mobile-badge">{activeFiltersCount}</span>}
        </button>
        {mainTab === "calendar" && (
          <button
            type="button"
            className={`mobile-bar-btn hide-empty-btn ${hideEmptyHours ? "active" : ""}`}
            onClick={() => setHideEmptyHours(!hideEmptyHours)}
          >
            <Icon name={hideEmptyHours ? "eyeOff" : "eye"} size={14} /> {hideEmptyHours ? "Hide Empty Hours" : "Show All Hours"}
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
          <Icon name="clipboard" size={14} /> Running Schedule
        </button>
      </div>

      {/* Mobile Filters Drawer */}
      {isMobileFiltersOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setIsMobileFiltersOpen(false)}>
          <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <h3><Icon name="search" size={14} /> Filters &amp; Search</h3>
              <button type="button" className="mobile-drawer-close" aria-label="Close" onClick={() => setIsMobileFiltersOpen(false)}>
                <Icon name="x" size={16} />
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
              <h3><Icon name="clipboard" size={14} /> Running Schedule ({filteredAndSortedEvents.length})</h3>
              <button type="button" className="mobile-drawer-close" aria-label="Close" onClick={() => setIsMobileScheduleOpen(false)}>
                <Icon name="x" size={16} />
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

      <Toasts toasts={toasts} onRemove={removeToast} />

      <EventModal
        modalEvent={modalEvent}
        onClose={() => setModalEvent(null)}
        getColorStyle={getColorStyle}
        isStarred={isStarred}
        onToggleStar={toggleStar}
        onShowOnMap={(venueId) => {
          setFocusedVenueId(venueId);
          setMainTab("map");
        }}
        venues={venues}
      />
    </main>
  );
}
