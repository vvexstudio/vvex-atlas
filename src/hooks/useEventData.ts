import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { clientDb } from "@/lib/firebase-client";
import { Venue, FestivalEvent, Department } from "@/types/festival";

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

  useEffect(() => {
    const db = clientDb;
    if (!db || !role) {
      console.log("Firebase DB or user role is unavailable. Using local/static data.");
      return;
    }

    const nodePath = role === "admin" ? "admin-data" : (role === "crew" ? "crew-data" : "public-data");
    const dbRef = ref(db, nodePath);
    
    console.log(`Establishing real-time listener on path: /${nodePath}`);
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log(`Realtime update received for path: /${nodePath}`);
        if (data.venues) setVenues(data.venues);
        if (data.events) setEvents(data.events);
        if (data.personnel) setPersonnel(data.personnel);
        if (data.departments) setDepartments(data.departments);
        setSourceLabel(`Firebase RTD Live (${role.toUpperCase()})`);
      }
    });

    return () => {
      unsubscribe();
      console.log(`Unsubscribed from path: /${nodePath}`);
    };
  }, [role]);

  return { venues, events, personnel, departments, sourceLabel };
};
