import { getFestivalData } from "@/lib/festival-data";

export type PredefinedLocation = {
  name: string;
  category: string;
  lat: number;
  lng: number;
};

export async function readPredefinedLocations(): Promise<PredefinedLocation[]> {
  const { venues } = await getFestivalData();
  return venues
    .filter((venue) => venue.hasLocation && typeof venue.lat === "number" && typeof venue.lng === "number")
    .map((venue) => ({
      name: venue.name,
      category: venue.label || "Venue",
      lat: venue.lat as number,
      lng: venue.lng as number,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
