import { EventType, FestivalDay } from "@/types/festival";

export const dayLabels: Record<FestivalDay, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

export const eventTypeLabels: Record<EventType, string> = {
  music: "Music",
  performance: "Performance",
  installation: "Installation",
  exhibition: "Exhibition",
  lecture: "Lecture / Talk",
  community: "General",
  social: "Social",
  object: "Object",
  experience: "Experience",
  film: "Film",
  dj: "DJ",
  venue: "Venue Operations",
  food: "Food / Beverage",
  services: "Logistics",
};
