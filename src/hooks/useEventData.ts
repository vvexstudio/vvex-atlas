import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { clientDb } from "@/lib/firebase-client";
import { Venue, FestivalEvent, Department } from "@/types/festival";
import { saveOfflineSnapshot, loadOfflineSnapshot } from "@/lib/offline-cache";
import { parseSpreadsheetData } from "@/lib/event-mapper";

interface InitialData {
  venues: Venue[];
  events: FestivalEvent[];
  personnel?: unknown[];
  departments?: Department[];
  dataSourceLabel?: string;
}

export const useEventData = (role: string | null, initialData: InitialData) => {
  const [venues, setVenues] = useState<Venue[]>(initialData.venues);
  const [events, setEvents] = useState<FestivalEvent[]>(initialData.events);
  const [personnel, setPersonnel] = useState<unknown[]>(initialData.personnel || []);
  const [departments, setDepartments] = useState<Department[]>(initialData.departments || []);
  const [sourceLabel, setSourceLabel] = useState(initialData.dataSourceLabel || "Static Init");
  const [isOffline, setIsOffline] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // Monitor online/offline status and hydrate cache if offline
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOffline = () => {
      setIsOffline(true);
      const cached = loadOfflineSnapshot();
      if (cached) {
        setVenues(cached.venues);
        setEvents(cached.events);
        setPersonnel(cached.personnel);
        setDepartments(cached.departments);
        const timeStr = new Date(cached.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setSourceLabel(`Offline Cache (Synced ${timeStr})`);
        setLastSynced(cached.timestamp);
      }
    };

    const handleOnline = () => {
      setIsOffline(false);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    // Initial check
    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  useEffect(() => {
    const db = clientDb;
    
    // If offline, do not attempt to listen to RTDB (keep cached state)
    if (typeof window !== "undefined" && !navigator.onLine) {
      return;
    }

    if (!db || !role) {
      console.log("Firebase DB or user role is unavailable. Using local/static data.");
      return;
    }

    const nodePath = role === "admin" ? "admin-data" : (role === "crew" ? "crew-data" : "public-data");
    const dbRef = ref(db, nodePath);
    
    console.log(`Establishing real-time listener on path: /${nodePath}`);
    const unsubscribe = onValue(
      dbRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          console.log(`Realtime update received for path: /${nodePath}`);
          
          const locationsData = data.venues || [];
          const rosData = data.events || [];
          const personnelData = data.personnel || [];
          const departmentsData = data.departments || [];
          const adminEntriesMap = data.entries || {};

          const mapped = parseSpreadsheetData(locationsData, rosData, personnelData, departmentsData);

          const adminVenues: Venue[] = [];
          const adminEvents: FestivalEvent[] = [];
          const adminEntriesList = Object.values(adminEntriesMap);

          adminEntriesList.forEach((entryRaw: any) => {
            const entry = entryRaw;
            if (!entry || typeof entry !== "object") return;
            const hasLocation = entry.hasLocation && entry.lat !== undefined && entry.lng !== undefined;
            
            if (hasLocation) {
              adminVenues.push({
                id: entry.id,
                name: entry.name,
                label: entry.serviceType ? "Service" : (entry.projectType === "venue" ? "Venue" : "Installation"),
                mapLabel: entry.name,
                shortDescription: entry.artist ? `By ${entry.artist}` : "",
                description: entry.abridgedProjectText || "",
                x: 0,
                y: 0,
                lat: Number(entry.lat),
                lng: Number(entry.lng),
                hasLocation: true,
                thumbnailUrl: "",
                accent: entry.projectType === "services" ? "#f97316" : "#8b5cf6",
                permanence: entry.permanence || entry.projectType || "venue",
              });
            }

            if (entry.hasSchedule) {
              const matchEvent = mapped.events.find(e => e.day === entry.day);
              const scheduleDate = matchEvent ? matchEvent.scheduleDate : (entry.day === "fri" ? "2026-08-28" : (entry.day === "sat" ? "2026-08-29" : "2026-08-30"));
              
              adminEvents.push({
                id: `event-${entry.id}`,
                venueId: entry.id,
                title: entry.name,
                host: entry.artist || "",
                description: entry.abridgedProjectText || "",
                day: entry.day,
                startTime: entry.startTime,
                endTime: entry.endTime,
                type: entry.projectType,
                thumbnailUrl: "",
                hasLocation,
                lat: entry.lat,
                lng: entry.lng,
                source: "admin",
                scheduleDate,
                locationName: entry.locationInternal || "",
                department: entry.projectType === "services" ? "Services" : "Art",
                leadPointPerson: entry.artist || "",
              });
            }
          });

          const finalVenues = [...mapped.venues, ...adminVenues];
          const finalEvents = [...mapped.events, ...adminEvents];

          setVenues(finalVenues);
          setEvents(finalEvents);
          setPersonnel(mapped.personnel);
          setDepartments(mapped.departments);
          setSourceLabel(`Firebase RTD Live (${role.toUpperCase()})`);
          
          // Cache snapshot locally for offline fallback
          saveOfflineSnapshot(finalVenues, finalEvents, mapped.personnel, mapped.departments);
          setLastSynced(new Date().toISOString());
        }
      },
      (error) => {
        console.warn("RTDB read failed, falling back to cache if available:", error);
        // Fallback to cache on DB error
        const cached = loadOfflineSnapshot();
        if (cached) {
          setVenues(cached.venues);
          setEvents(cached.events);
          setPersonnel(cached.personnel);
          setDepartments(cached.departments);
          const timeStr = new Date(cached.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          setSourceLabel(`Offline Cache (Fallback, Synced ${timeStr})`);
          setLastSynced(cached.timestamp);
        }
      }
    );

    return () => {
      unsubscribe();
      console.log(`Unsubscribed from path: /${nodePath}`);
    };
  }, [role, isOffline]);

  return { venues, events, personnel, departments, sourceLabel, isOffline, lastSynced };
};
