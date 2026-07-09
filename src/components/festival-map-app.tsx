"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { APIProvider, Map, AdvancedMarker, AdvancedMarkerAnchorPoint } from "@vis.gl/react-google-maps";
import { Venue, FestivalEvent, FestivalDay, Department } from "@/types/festival";
import sheetColors from "@/data/sheet-colors.json";

const MAP_CENTER = { lat: 40.7864, lng: -119.2065 }; // Default Playa (BRC) coordinates
const MAP_DEFAULT_ZOOM = 13;

const DEPARTMENT_ICONS: Record<string, string> = {
  "ATPF": "🎪",
  "Electricity": "⚡",
  "F&B": "🍽️",
  "Fly Fleet": "🚁",
  "Heavy Equipment (WonderBros)": "🚜",
  "Heavy Equipment (WonderBros) ": "🚜",
  "Hospitality": "🛎️",
  "Med / Sec": "🏥",
  "Rigging": "⚓",
  "Set Design": "🎨",
  "Structural": "🏗️",
  "SolarPunks": "☀️"
};

const getDepartmentIcon = (dept: string): string => {
  if (!dept) return "🏢";
  const clean = dept.trim();
  return DEPARTMENT_ICONS[clean] || "🏢";
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

const getEventDateTime = (dateStr: string | undefined, timeStr: string | undefined): Date | null => {
  if (!dateStr || dateStr === "Date TBD" || !timeStr || timeStr === "TBD") return null;
  const mins = timeToMinutes(timeStr);
  if (mins === -1) return null;
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
};

const getEventEndDateTime = (dateStr: string | undefined, startTimeStr: string | undefined, endTimeStr: string | undefined): Date | null => {
  if (!dateStr || dateStr === "Date TBD" || !endTimeStr || endTimeStr === "TBD") return null;
  const startMins = startTimeStr ? timeToMinutes(startTimeStr) : -1;
  const endMins = timeToMinutes(endTimeStr);
  if (endMins === -1) return null;
  
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  
  // If end time is earlier in the day than start time, it likely rolls over to the next day
  if (startMins !== -1 && endMins < startMins) {
    date.setDate(date.getDate() + 1);
  }
  
  const hours = Math.floor(endMins / 60);
  const minutes = endMins % 60;
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const formatFilterDateTime = (dtStr: string): string => {
  if (!dtStr) return "";
  const dateObj = new Date(dtStr);
  if (Number.isNaN(dateObj.getTime())) return dtStr;
  return dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

interface CalendarChipProps {
  variant: "header" | "status-tag";
  style?: React.CSSProperties;
  label?: string;
  icon?: string;
  status?: string;
  onClick?: () => void;
  title?: string;
  tooltipContent?: React.ReactNode;
}

export function CalendarChip({
  variant,
  style,
  label,
  icon,
  status = "TBD",
  onClick,
  title,
  tooltipContent
}: CalendarChipProps) {
  if (variant === "header") {
    return (
      <div 
        className="calendar-chip variant-header" 
        style={style}
        title={title}
      >
        {icon && <span className="calendar-chip-icon">{icon}</span>}
        <span className="calendar-chip-label">{label}</span>
        {tooltipContent && (
          <div className="dept-contact-tooltip">
            <div className="tooltip-header" style={style}>
              <span>{icon} {label}</span>
            </div>
            {tooltipContent}
          </div>
        )}
      </div>
    );
  }

  // Variant 2: status-tag
  return (
    <div 
      className="calendar-chip variant-tag" 
      style={style}
      onClick={onClick}
      title={title}
    >
      <span className="calendar-chip-badge">{status}</span>
      <span className="calendar-chip-label">{label}</span>
    </div>
  );
}

export function FestivalMapApp({
  venues,
  events,
  personnel = [],
  departments = [],
  colors,
  dataSourceLabel: _dataSourceLabel,
  debug,
  userSession,
}: FestivalMapAppProps) {
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
  const [activeTbdDropdown, setActiveTbdDropdown] = useState<{ day: string; colKey: string } | null>(null);

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

  // Dropdown Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [startTimeFilter, setStartTimeFilter] = useState("");
  const [endTimeFilter, setEndTimeFilter] = useState("");



  // Dynamic Options for dropdown filters
  const locationOptions = useMemo(() => {
    const unique = new Set<string>();
    events.forEach((e) => {
      if (e.locationName) unique.add(e.locationName);
    });
    return Array.from(unique).sort();
  }, [events]);

  const actionOptions = useMemo(() => {
    const unique = new Set<string>();
    events.forEach((e) => {
      if (e.action) unique.add(e.action);
    });
    return Array.from(unique).sort();
  }, [events]);

  const departmentOptions = useMemo(() => {
    const unique = new Set<string>();
    events.forEach((e) => {
      if (e.department) unique.add(e.department);
    });
    return Array.from(unique).sort();
  }, [events]);

  const leadOptions = useMemo(() => {
    const unique = new Set<string>();
    events.forEach((e) => {
      if (e.leadPointPerson) unique.add(e.leadPointPerson);
    });
    return Array.from(unique).sort();
  }, [events]);

  // Event Filtering Logic
  const filteredEvents = useMemo(() => {
    const filterStart = startTimeFilter ? new Date(startTimeFilter).getTime() : -Infinity;
    const filterEnd = endTimeFilter ? new Date(endTimeFilter).getTime() : Infinity;

    return events.filter((event) => {
      // 1. Text Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesQuery =
          event.title.toLowerCase().includes(query) ||
          (event.description && event.description.toLowerCase().includes(query)) ||
          (event.locationName && event.locationName.toLowerCase().includes(query)) ||
          (event.department && event.department.toLowerCase().includes(query)) ||
          (event.leadPointPerson && event.leadPointPerson.toLowerCase().includes(query)) ||
          (event.action && event.action.toLowerCase().includes(query));
        if (!matchesQuery) return false;
      }

      // 2. Location Dropdown Filter
      if (selectedLocations.length > 0 && (!event.locationName || !selectedLocations.includes(event.locationName))) {
        return false;
      }

      // 3. Action Dropdown Filter
      if (selectedActions.length > 0 && (!event.action || !selectedActions.includes(event.action))) {
        return false;
      }

      // 4. Department Dropdown Filter
      if (selectedDepartments.length > 0 && (!event.department || !selectedDepartments.includes(event.department))) {
        return false;
      }

      // 5. Lead Dropdown Filter
      if (selectedLeads.length > 0 && (!event.leadPointPerson || !selectedLeads.includes(event.leadPointPerson))) {
        return false;
      }

      // 6. Time Range Filter (Overlap Check)
      if (startTimeFilter || endTimeFilter) {
        const eventStart = getEventDateTime(event.scheduleDate, event.startTime);
        const eventEnd = getEventEndDateTime(event.scheduleDate, event.startTime, event.endTime) || eventStart;
        if (!eventStart || !eventEnd) {
          return false; // exclude events without valid times if time filter is active
        }
        
        // Overlap: event starts before filter ends, and ends after filter starts
        const overlaps = eventStart.getTime() < filterEnd && eventEnd.getTime() > filterStart;
        if (!overlaps) return false;
      }

      return true;
    });
  }, [events, searchQuery, selectedLocations, selectedActions, selectedDepartments, selectedLeads, startTimeFilter, endTimeFilter]);

  // Sort Filtered Events Chronologically
  const filteredAndSortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const dateDelta = (a.scheduleDate || "").localeCompare(b.scheduleDate || "");
      if (dateDelta !== 0) return dateDelta;
      return (a.startTime || "").localeCompare(b.startTime || "");
    });
  }, [filteredEvents]);

  // Group events by date for main Schedule Grid and sidebar
  const groupedEventsByDate = useMemo(() => {
    const groups: { date: string; dateLabel: string; day: FestivalDay; events: FestivalEvent[] }[] = [];
    const dateToGroup = new globalThis.Map<string, typeof groups[number]>();

    filteredAndSortedEvents.forEach((event) => {
      const dateStr = event.scheduleDate || "Date TBD";
      let group = dateToGroup.get(dateStr);
      if (!group) {
        let label = dateStr;
        if (dateStr !== "Date TBD") {
          const dateObj = new Date(`${dateStr}T00:00:00`);
          if (!Number.isNaN(dateObj.getTime())) {
            label = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
          }
        }
        group = {
          date: dateStr,
          dateLabel: label,
          day: event.day,
          events: [],
        };
        groups.push(group);
        dateToGroup.set(dateStr, group);
      }
      group.events.push(event);
    });

    return groups;
  }, [filteredAndSortedEvents]);

  // Mappable Venues (locations with coordinates)
  const visibleMappableVenues = useMemo(() => {
    return venues.filter((v) => typeof v.lat === "number" && typeof v.lng === "number");
  }, [venues]);

  const mapCenterCoords = useMemo(() => {
    const mappable = venues.find((v) => typeof v.lat === "number" && typeof v.lng === "number");
    if (mappable && mappable.lat && mappable.lng) {
      return { lat: mappable.lat, lng: mappable.lng };
    }
    return MAP_CENTER;
  }, [venues]);

  // Spatial Calendar Helper Logic
  const availableDates = useMemo(() => {
    const dates = new globalThis.Map<string, { weekday: string; shortDate: string; fullLabel: string }>();
    events.forEach((e) => {
      const dateStr = e.scheduleDate;
      if (dateStr && dateStr !== "Date TBD" && !dates.has(dateStr)) {
        const dateObj = new Date(`${dateStr}T00:00:00`);
        if (!Number.isNaN(dateObj.getTime())) {
          const weekday = dateObj.toLocaleDateString("en-US", { weekday: "short" });
          const shortDate = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const fullLabel = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
          dates.set(dateStr, { weekday, shortDate, fullLabel });
        }
      }
    });
    return Array.from(dates.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, info]) => ({ date, ...info }));
  }, [events]);

  const allDepartments = useMemo(() => {
    const unique = new Set<string>();
    events.forEach((e) => {
      if (e.department) unique.add(e.department);
    });
    return Array.from(unique).sort();
  }, [events]);

  const allLocations = useMemo(() => {
    const unique = new Set<string>();
    events.forEach((e) => {
      if (e.locationName) unique.add(e.locationName);
    });
    return Array.from(unique).sort();
  }, [events]);

  const activeDepartments = useMemo(() => {
    if (selectedDepartments.length > 0) {
      return allDepartments.filter((d) => selectedDepartments.includes(d));
    }
    return allDepartments;
  }, [allDepartments, selectedDepartments]);

  const activeLocations = useMemo(() => {
    if (selectedLocations.length > 0) {
      return allLocations.filter((l) => selectedLocations.includes(l));
    }
    return allLocations;
  }, [allLocations, selectedLocations]);

  const calendarEventPlacements = useMemo(() => {
    const placements = new globalThis.Map<string, { top: number; height: number; left: number; width: number }>();
    
    // Group events by day and column
    const eventsByDayCol = new globalThis.Map<string, FestivalEvent[]>();
    
    filteredEvents.forEach((e) => {
      const dateStr = e.scheduleDate;
      if (!dateStr || dateStr === "Date TBD") return;
      
      if (e.department) {
        const key = `${dateStr}::department::${e.department}`;
        if (!eventsByDayCol.has(key)) eventsByDayCol.set(key, []);
        eventsByDayCol.get(key)!.push(e);
      }
      if (e.locationName) {
        const key = `${dateStr}::location::${e.locationName}`;
        if (!eventsByDayCol.has(key)) eventsByDayCol.set(key, []);
        eventsByDayCol.get(key)!.push(e);
      }
    });

    // Run overlap-packing algorithm for each day/col group
    eventsByDayCol.forEach((colEvents, key) => {
      const parts = key.split("::");
      const colType = parts[1];
      const colName = parts[2];
      
      const timedEvents = colEvents.filter((e) => timeToMinutes(e.startTime) !== -1);
      
      timedEvents.sort((a, b) => {
        const aStart = timeToMinutes(a.startTime);
        const bStart = timeToMinutes(b.startTime);
        return aStart - bStart;
      });

      const columns: FestivalEvent[][] = [];
      
      timedEvents.forEach((event) => {
        const start = timeToMinutes(event.startTime);
        let placed = false;
        
        for (let i = 0; i < columns.length; i++) {
          const col = columns[i];
          const lastEvent = col[col.length - 1];
          const lastEnd = timeToMinutes(lastEvent.endTime) !== -1
            ? timeToMinutes(lastEvent.endTime)
            : timeToMinutes(lastEvent.startTime) + 60;
          
          if (start >= lastEnd) {
            col.push(event);
            placed = true;
            break;
          }
        }
        if (!placed) {
          columns.push([event]);
        }
      });

      columns.forEach((col, subColIdx) => {
        col.forEach((event) => {
          const startMin = timeToMinutes(event.startTime);
          let endMin = timeToMinutes(event.endTime);
          if (endMin === -1) {
            endMin = startMin + 60;
          } else if (endMin < startMin) {
            endMin = 24 * 60;
          }
          
          const top = startMin;
          const height = Math.max(35, endMin - startMin);
          const width = 94 / columns.length;
          const left = subColIdx * (100 / columns.length);
          
          placements.set(`${event.id}::${colType}::${colName}`, { top, height, left, width });
        });
      });
    });

    return placements;
  }, [filteredEvents]);

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

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery) count += 1;
    count += selectedLocations.length;
    count += selectedActions.length;
    count += selectedDepartments.length;
    count += selectedLeads.length;
    if (startTimeFilter) count += 1;
    if (endTimeFilter) count += 1;
    return count;
  }, [searchQuery, selectedLocations, selectedActions, selectedDepartments, selectedLeads, startTimeFilter, endTimeFilter]);

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
      <>
        <div className="legacy-search-row">
          <input
            id="portal-search-input"
            name="search"
            type="search"
            placeholder="Search description, action, dept, lead..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="legacy-search"
            aria-label="Search schedule"
          />
        </div>

        <div className="portal-dropdown-filters">
          <div className="filter-dropdown-group">
            <label htmlFor="filter-location">Location</label>
            <select
              id="filter-location"
              name="location"
              value="all"
              onChange={(e) => {
                const val = e.target.value;
                if (val !== "all" && !selectedLocations.includes(val)) {
                  setSelectedLocations([...selectedLocations, val]);
                }
              }}
            >
              <option value="all">Add Location Filter...</option>
              {locationOptions.map((loc) => (
                !selectedLocations.includes(loc) && (
                  <option key={loc} value={loc} style={getColorStyle("Location", loc)}>
                    {loc}
                  </option>
                )
              ))}
            </select>
          </div>

          <div className="filter-dropdown-group">
            <label htmlFor="filter-action">Action</label>
            <select
              id="filter-action"
              name="action"
              value="all"
              onChange={(e) => {
                const val = e.target.value;
                if (val !== "all" && !selectedActions.includes(val)) {
                  setSelectedActions([...selectedActions, val]);
                }
              }}
            >
              <option value="all">Add Action Filter...</option>
              {actionOptions.map((act) => (
                !selectedActions.includes(act) && (
                  <option key={act} value={act} style={getColorStyle("Action", act)}>
                    {act}
                  </option>
                )
              ))}
            </select>
          </div>

          <div className="filter-dropdown-group">
            <label htmlFor="filter-department">Department</label>
            <select
              id="filter-department"
              name="department"
              value="all"
              onChange={(e) => {
                const val = e.target.value;
                if (val !== "all" && !selectedDepartments.includes(val)) {
                  setSelectedDepartments([...selectedDepartments, val]);
                }
              }}
            >
              <option value="all">Add Department Filter...</option>
              {departmentOptions.map((dept) => (
                !selectedDepartments.includes(dept) && (
                  <option key={dept} value={dept} style={getColorStyle("Department", dept)}>
                    {dept}
                  </option>
                )
              ))}
            </select>
          </div>

          <div className="filter-dropdown-group">
            <label htmlFor="filter-lead">Lead Person</label>
            <select
              id="filter-lead"
              name="lead"
              value="all"
              onChange={(e) => {
                const val = e.target.value;
                if (val !== "all" && !selectedLeads.includes(val)) {
                  setSelectedLeads([...selectedLeads, val]);
                }
              }}
            >
              <option value="all">Add Lead Filter...</option>
              {leadOptions.map((lead) => (
                !selectedLeads.includes(lead) && (
                  <option key={lead} value={lead} style={getColorStyle("Personnel", lead)}>
                    {lead}
                  </option>
                )
              ))}
            </select>
          </div>
        </div>

        {/* Time Range Filters */}
        <div className="time-filter-row">
          <div className="time-input-group">
            <label htmlFor="time-start">Start Date &amp; Time</label>
            <input
              id="time-start"
              type="datetime-local"
              value={startTimeFilter}
              onChange={(e) => setStartTimeFilter(e.target.value)}
              className="time-picker-input"
            />
          </div>
          <div className="time-input-group">
            <label htmlFor="time-end">End Date &amp; Time</label>
            <input
              id="time-end"
              type="datetime-local"
              value={endTimeFilter}
              onChange={(e) => setEndTimeFilter(e.target.value)}
              className="time-picker-input"
            />
          </div>
        </div>

        {/* Active Filter Chips */}
        {(selectedLocations.length > 0 ||
          selectedActions.length > 0 ||
          selectedDepartments.length > 0 ||
          selectedLeads.length > 0 ||
          startTimeFilter ||
          endTimeFilter ||
          searchQuery) && (
          <div className="active-filters-row">
            {searchQuery && (
              <span className="filter-chip search-chip">
                🔍 &quot;{searchQuery}&quot;
                <button type="button" className="clear-chip-btn" onClick={() => setSearchQuery("")} aria-label="Clear search">×</button>
              </span>
            )}
            {selectedLocations.map((loc) => (
              <span key={`loc-${loc}`} className="filter-chip" style={getColorStyle("Location", loc)}>
                📍 {loc}
                <button type="button" className="clear-chip-btn" onClick={() => setSelectedLocations(selectedLocations.filter((l) => l !== loc))} aria-label="Clear location filter">×</button>
              </span>
            ))}
            {selectedActions.map((act) => (
              <span key={`act-${act}`} className="filter-chip" style={getColorStyle("Action", act)}>
                ⚡ {act}
                <button type="button" className="clear-chip-btn" onClick={() => setSelectedActions(selectedActions.filter((a) => a !== act))} aria-label="Clear action filter">×</button>
              </span>
            ))}
            {selectedDepartments.map((dept) => (
              <span key={`dept-${dept}`} className="filter-chip" style={getColorStyle("Department", dept)}>
                🏢 {dept}
                <button type="button" className="clear-chip-btn" onClick={() => setSelectedDepartments(selectedDepartments.filter((d) => d !== dept))} aria-label="Clear department filter">×</button>
              </span>
            ))}
            {selectedLeads.map((lead) => (
              <span key={`lead-${lead}`} className="filter-chip" style={getColorStyle("Personnel", lead)}>
                👤 {lead}
                <button type="button" className="clear-chip-btn" onClick={() => setSelectedLeads(selectedLeads.filter((l) => l !== lead))} aria-label="Clear lead filter">×</button>
              </span>
            ))}
            {startTimeFilter && (
              <span className="filter-chip time-chip">
                ⏰ Start &ge; {formatFilterDateTime(startTimeFilter)}
                <button type="button" className="clear-chip-btn" onClick={() => setStartTimeFilter("")} aria-label="Clear start time filter">×</button>
              </span>
            )}
            {endTimeFilter && (
              <span className="filter-chip time-chip">
                ⏰ End &le; {formatFilterDateTime(endTimeFilter)}
                <button type="button" className="clear-chip-btn" onClick={() => setEndTimeFilter("")} aria-label="Clear end time filter">×</button>
              </span>
            )}

            <button
              type="button"
              className="clear-filters-btn"
              onClick={() => {
                setSelectedLocations([]);
                setSelectedActions([]);
                setSelectedDepartments([]);
                setSelectedLeads([]);
                setStartTimeFilter("");
                setEndTimeFilter("");
                setSearchQuery("");
              }}
            >
              Clear All Filters
            </button>
          </div>
        )}
      </>
    );
  };

  // Helper to render the body of the running schedule
  const renderScheduleBody = () => {
    return (
      <div className="sidebar-scroll-container">
        {groupedEventsByDate.length === 0 ? (
          <div className="sidebar-empty-state">No events match filters.</div>
        ) : (
          groupedEventsByDate.map((dateGroup) => (
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
          ))
        )}
      </div>
    );
  };

  const hoursArray = Array.from({ length: 24 }, (_, i) => i);

  return (
    <main className={`legacy-app ${isDarkMode ? "dark-theme" : ""}`}>
      {/* Header Banner */}
      <header className="legacy-banner">
        <div className="legacy-banner-title">
          <h1 className="legacy-banner-heading">The Portal</h1>
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
              /* High-fidelity Schedule Grid View */
              <div className="main-schedule-container">

                {groupedEventsByDate.length === 0 ? (
                  <div className="empty-schedule-state">
                    <span className="empty-icon">🔍</span>
                    <h3>No items match your filters</h3>
                    <p>Try resetting filters or typing another search query.</p>
                  </div>
                ) : (
                  groupedEventsByDate.map((dateGroup) => (
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
                  ))
                )}
              </div>
            ) : mainTab === "calendar" ? (
              /* Spatial Calendar View */
              <div className="spatial-calendar-container">


                {/* Main Calendar Area */}
                {activeDepartments.length === 0 && activeLocations.length === 0 ? (
                  <div className="empty-calendar-state">
                    <span className="empty-icon">🔍</span>
                    <h3>No columns to display</h3>
                    <p>No locations or departments match your current filters.</p>
                  </div>
                ) : (
                  <div ref={calendarScrollContainerRef} className="spatial-calendar-grid">
                    <div className="spatial-calendar-grid-content">
                      {groupedEventsByDate.length === 0 ? (
                      <div className="empty-calendar-state">
                        <span className="empty-icon">🔍</span>
                        <h3>No items match your filters</h3>
                        <p>Try resetting filters or typing another search query.</p>
                      </div>
                    ) : (() => {
                      return groupedEventsByDate.map((dateGroup) => {
                        const activeHours = hideEmptyHours ? getActiveHoursForDay(dateGroup.events) : hoursArray;
                        
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
                            <div className="calendar-day-header font-bold">
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
                                      minWidth: `${displayDeptsForDay.length * columnWidthScale}px`
                                    }}
                                  >
                                    <span className="sticky-parent-label">🏢 Departments</span>
                                  </div>
                                )}
                                {displayLocsForDay.length > 0 && (
                                  <div 
                                    className="calendar-parent-header-cell locations" 
                                    style={{ 
                                      flex: `${displayLocsForDay.length} ${displayLocsForDay.length} 0%`, 
                                      minWidth: `${displayLocsForDay.length * columnWidthScale}px`
                                    }}
                                  >
                                    <span className="sticky-parent-label">📍 Locations</span>
                                  </div>
                                )}
                              </div>

                              {/* Specific Column Headers (Column names + TBD Shelves) */}
                              <div className="calendar-grid-header-row">
                                <div className="calendar-time-axis-header" style={{ width: "70px" }}>
                                </div>
                                
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
                                        minWidth: `${columnWidthScale}px`
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
                                                <span className="tooltip-icon">👤</span>
                                                <span className="tooltip-text">{deptInfo["Lead Point Person"]}</span>
                                              </div>
                                            )}
                                            {deptInfo["Lead Phone"] && (
                                              <div className="tooltip-item">
                                                <span className="tooltip-icon">📞</span>
                                                <span className="tooltip-text">{deptInfo["Lead Phone"]}</span>
                                              </div>
                                            )}
                                            {deptInfo["Lead Email"] && (
                                              <div className="tooltip-item">
                                                <span className="tooltip-icon">✉️</span>
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
                                                  📌 {event.title}
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
                                        minWidth: `${columnWidthScale}px`
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
                                                  📌 {event.title}
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
                                        minWidth: `${columnWidthScale}px`
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
                                          ? Math.max(35, getActiveMinuteOffset(placement.top + placement.height, activeHours) - activeTop)
                                          : placement.height;

                                        const cardStyle = {
                                          top: `${(activeTop / 60) * hourHeightScale}px`,
                                          height: `${(activeHeight / 60) * hourHeightScale}px`,
                                          left: `${placement.left}%`,
                                          width: `${placement.width}%`,
                                          ...getColorStyle("Department", dept)
                                        };

                                        return (
                                          <div
                                            key={`card-dept-${event.id}`}
                                            className={`calendar-event-card ${isHighlighted ? "highlighted" : ""} ${searchQuery.trim() !== "" && !isHighlighted ? "dimmed" : ""}`}
                                            style={cardStyle}
                                            onClick={() => setModalEvent(event)}
                                          >
                                            <div className="card-inner">
                                              <div className="event-card-time">
                                                {event.startTime} – {event.endTime}
                                              </div>
                                              <div className="event-card-title">{event.title}</div>
                                              <div className="event-card-meta">
                                                {event.locationName && <span className="meta-loc">📍 {event.locationName}</span>}
                                                {event.leadPointPerson && <span className="meta-lead">👤 {event.leadPointPerson}</span>}
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
                                        minWidth: `${columnWidthScale}px`
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
                                          ? Math.max(35, getActiveMinuteOffset(placement.top + placement.height, activeHours) - activeTop)
                                          : placement.height;

                                        const cardStyle = {
                                          top: `${(activeTop / 60) * hourHeightScale}px`,
                                          height: `${(activeHeight / 60) * hourHeightScale}px`,
                                          left: `${placement.left}%`,
                                          width: `${placement.width}%`,
                                          ...getColorStyle("Location", loc)
                                        };

                                        return (
                                          <div
                                            key={`card-loc-${event.id}`}
                                            className={`calendar-event-card ${isHighlighted ? "highlighted" : ""} ${searchQuery.trim() !== "" && !isHighlighted ? "dimmed" : ""}`}
                                            style={cardStyle}
                                            onClick={() => setModalEvent(event)}
                                          >
                                            <div className="card-inner">
                                              <div className="event-card-time">
                                                {event.startTime} – {event.endTime}
                                              </div>
                                              <div className="event-card-title">{event.title}</div>
                                              <div className="event-card-meta">
                                                {event.department && <span className="meta-dept">🏢 {event.department}</span>}
                                                {event.leadPointPerson && <span className="meta-lead">👤 {event.leadPointPerson}</span>}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Map View (Scaffolded Placeholder or Real Map) */
              <div className="main-map-container" style={{ height: "100%", width: "100%" }}>
                {visibleMappableVenues.length > 0 ? (
                  <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}>
                    <Map
                      center={mapCenterCoords}
                      zoom={MAP_DEFAULT_ZOOM}
                      mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "2f9f04bb8e9c458045b99a65"}
                      disableDefaultUI={false}
                      style={{ width: "100%", height: "100%" }}
                    >
                      {visibleMappableVenues.map((venue) => (
                        <AdvancedMarker
                          key={venue.id}
                          position={{ lat: venue.lat!, lng: venue.lng! }}
                          anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
                        >
                          <div className="custom-map-marker">
                            <span className="marker-dot"></span>
                            <span className="marker-label">{venue.name}</span>
                          </div>
                        </AdvancedMarker>
                      ))}
                    </Map>
                  </APIProvider>
                ) : (
                  /* Greyed-out Blueprint Placeholder Map View */
                  <div className="map-placeholder-container">
                    <div className="map-placeholder-grid" />
                    <div className="map-placeholder-card">
                      <div className="map-placeholder-icon">🗺️</div>
                      <h2>Interactive Map Scaffolded</h2>
                      <p>
                        The interactive map interface is pre-configured and ready. Geographical coordinates (Lat/Long) are currently pending in the Google Sheet database.
                      </p>
                      <div className="map-placeholder-badge">
                        <span className="badge-dot"></span>
                        Coordinates Pending (Scaffolded)
                      </div>
                      <div className="map-placeholder-hint">
                        Populating latitude and longitude coordinates in the <strong>Locations</strong> sheet will automatically enable mapping layout markers.
                      </div>
                    </div>
                  </div>
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

      {/* Event Details Modal */}
      {modalEvent && (
        <div className="portal-modal-overlay" onClick={() => setModalEvent(null)}>
          <div className="portal-modal-card" onClick={(e) => e.stopPropagation()}>
            <header
              className="portal-modal-header"
              style={getColorStyle(modalEvent.department ? "Department" : "Location", modalEvent.department || modalEvent.locationName)}
            >
              <button type="button" className="close-modal-btn" onClick={() => setModalEvent(null)}>×</button>
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
      )}
    </main>
  );
}
