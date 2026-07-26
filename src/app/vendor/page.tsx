"use client";

import { useEffect, useState, use } from "react";
import type { FestivalEvent } from "@/types/festival";

interface VendorData {
  vendorName: string;
  timezone: string;
  eventCount: number;
  events: FestivalEvent[];
}

export default function VendorSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const resolvedParams = use(searchParams);
  const token = resolvedParams.token;

  const [data, setData] = useState<VendorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("No access token provided in URL. Please check your vendor magic link.");
      setIsLoading(false);
      return;
    }

    async function fetchVendorSchedule() {
      try {
        const res = await fetch(`/api/vendor?token=${encodeURIComponent(token!)}`);
        if (!res.ok) {
          if (res.status === 410) {
            throw new Error("This vendor access link has been revoked.");
          }
          throw new Error(`Failed to load schedule (Status ${res.status})`);
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || "Failed to load vendor schedule.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchVendorSchedule();
  }, [token]);

  if (isLoading) {
    return (
      <div style={{ padding: "3rem 1.5rem", textAlign: "center", color: "#6b7280", fontFamily: "sans-serif" }}>
        Loading vendor schedule...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem", maxWidth: "500px", margin: "3rem auto", backgroundColor: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "8px", color: "#b91c1c", fontFamily: "sans-serif" }}>
        <strong>Access Error:</strong> {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ maxWidth: "650px", margin: "0 auto", padding: "1.5rem 1rem", fontFamily: "system-ui, -apple-system, sans-serif", color: "#111827" }}>
      {/* Header Banner */}
      <header style={{ background: "#18181b", color: "#f4f4f5", padding: "1.25rem", borderRadius: "10px", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h1 style={{ fontSize: "1.25rem", margin: 0, fontWeight: 700 }}>The Portal — Vendor View</h1>
          <span style={{ fontSize: "0.75rem", background: "#3f3f46", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
            {data.timezone}
          </span>
        </div>
        <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem", color: "#a1a1aa" }}>
          Assigned Shifts for <strong>{data.vendorName}</strong> ({data.eventCount} events)
        </p>
        <div style={{ marginTop: "1rem" }}>
          <a
            href={`/api/ics?token=${encodeURIComponent(token || "")}`}
            style={{
              display: "inline-block",
              fontSize: "0.8rem",
              padding: "0.4rem 0.8rem",
              backgroundColor: "#8b5cf6",
              color: "white",
              borderRadius: "6px",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            📅 Subscribe to Calendar (.ics)
          </a>
        </div>
      </header>

      {/* Schedule List */}
      {data.events.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center", background: "#f4f4f5", borderRadius: "8px", color: "#71717a" }}>
          No scheduled shifts found for vendor token.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {data.events.map((event) => (
            <div
              key={event.id}
              style={{
                background: "white",
                padding: "1rem 1.25rem",
                borderRadius: "8px",
                border: "1px solid #e4e4e7",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4rem" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>{event.title}</h3>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#6366f1", background: "#eef2ff", padding: "0.15rem 0.4rem", borderRadius: "4px" }}>
                  {event.startTime}{event.endTime ? ` - ${event.endTime}` : ""}
                </span>
              </div>
              <div style={{ fontSize: "0.85rem", color: "#52525b", marginBottom: "0.25rem" }}>
                📍 <strong>Location:</strong> {event.locationName || "Black Rock City"}
              </div>
              {event.description && (
                <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.8rem", color: "#71717a", lineHeight: 1.4 }}>
                  {event.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
