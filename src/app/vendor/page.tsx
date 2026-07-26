"use client";

import { useEffect, useState, use } from "react";
import type { FestivalEvent } from "@/types/festival";
import { Icon } from "@/components/ui/icons";

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
      <div style={{ padding: "3rem 1.5rem", textAlign: "center", color: "var(--muted)" }}>
        Loading vendor schedule...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "2rem",
          maxWidth: "500px",
          margin: "3rem auto",
          backgroundColor: "var(--danger-soft)",
          border: "1px solid var(--danger)",
          borderRadius: "var(--radius-md)",
          color: "var(--danger)",
        }}
      >
        <strong>Access Error:</strong> {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ maxWidth: "650px", margin: "0 auto", padding: "1.5rem 1rem", color: "var(--ink)" }}>
      {/* Header Banner */}
      <header
        style={{
          background: "var(--ink)",
          color: "var(--bg)",
          padding: "1.25rem",
          borderRadius: "var(--radius-lg)",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h1 style={{ fontSize: "var(--text-xl)", margin: 0, fontWeight: 700, fontFamily: "var(--font-display)" }}>
            The Portal — Vendor View
          </h1>
          <span className="chip chip-neutral">{data.timezone}</span>
        </div>
        <p style={{ margin: "0.5rem 0 0 0", fontSize: "var(--text-sm)", color: "var(--bg)", opacity: 0.75 }}>
          Assigned Shifts for <strong>{data.vendorName}</strong> ({data.eventCount} events)
        </p>
        <div style={{ marginTop: "1rem" }}>
          <a className="btn btn-primary btn-sm" href={`/api/ics?token=${encodeURIComponent(token || "")}`}>
            <Icon name="calendar" size={14} /> Subscribe to Calendar (.ics)
          </a>
        </div>
      </header>

      {/* Schedule List */}
      {data.events.length === 0 ? (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            background: "var(--surface)",
            borderRadius: "var(--radius-md)",
            color: "var(--muted)",
          }}
        >
          No scheduled shifts found for vendor token.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {data.events.map((event) => (
            <div key={event.id} className="card" style={{ padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4rem" }}>
                <h3 style={{ margin: 0, fontSize: "var(--text-md)", fontWeight: 600 }}>{event.title}</h3>
                <span className="chip chip-accent mono">
                  {event.startTime}{event.endTime ? ` - ${event.endTime}` : ""}
                </span>
              </div>
              <div
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--muted)",
                  marginBottom: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                <Icon name="mapPin" size={12} /> <strong>Location:</strong> {event.locationName || "Black Rock City"}
              </div>
              {event.description && (
                <p style={{ margin: "0.5rem 0 0 0", fontSize: "var(--text-sm)", color: "var(--muted)", lineHeight: 1.4 }}>
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
