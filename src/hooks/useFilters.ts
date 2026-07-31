import { useState, useMemo } from "react";
import { Venue, FestivalEvent, FestivalDay } from "@/types/festival";

interface UseFiltersProps {
  events: FestivalEvent[];
  venues: Venue[];
  mapCenter: { lat: number; lng: number };
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
  
  if (startMins !== -1 && endMins < startMins) {
    date.setDate(date.getDate() + 1);
  }
  
  const hours = Math.floor(endMins / 60);
  const minutes = endMins % 60;
  date.setHours(hours, minutes, 0, 0);
  return date;
};

export const useFilters = ({ events, venues, mapCenter }: UseFiltersProps) => {
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
      if (e.department) {
        e.department.split(",").forEach((d) => {
          const trimmed = d.trim();
          if (trimmed) unique.add(trimmed);
        });
      }
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
      if (selectedDepartments.length > 0) {
        if (!event.department) return false;
        const eventDepts = event.department.split(",").map((d) => d.trim()).filter(Boolean);
        const hasMatch = eventDepts.some((d) => selectedDepartments.includes(d));
        if (!hasMatch) return false;
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
          return false;
        }
        
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

      const aMin = timeToMinutes(a.startTime);
      const bMin = timeToMinutes(b.startTime);

      if (aMin !== bMin) {
        if (aMin === -1) return 1;
        if (bMin === -1) return -1;
        return aMin - bMin;
      }

      const aEnd = timeToMinutes(a.endTime);
      const bEnd = timeToMinutes(b.endTime);

      if (aEnd !== bEnd) {
        if (aEnd === -1) return 1;
        if (bEnd === -1) return -1;
        return aEnd - bEnd;
      }

      const titleDelta = (a.title || "").localeCompare(b.title || "");
      if (titleDelta !== 0) return titleDelta;

      return (a.id || "").localeCompare(b.id || "");
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
          const parts = dateStr.split("-").map(Number);
          if (parts.length === 3 && !parts.some(Number.isNaN)) {
            const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
            label = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
          } else {
            const dateObj = new Date(`${dateStr}T00:00:00`);
            if (!Number.isNaN(dateObj.getTime())) {
              label = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
            }
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
    return mapCenter;
  }, [venues, mapCenter]);

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

  return {
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
  };
};
