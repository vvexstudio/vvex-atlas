"use client";

import { useEffect, useState, use } from "react";
import type { FestivalEvent, Venue, Department } from "@/types/festival";
import { EventApp } from "@/components/event/EventApp";
import { Icon } from "@/components/ui/icons";

interface VendorData {
  vendorName: string;
  timezone: string;
  eventCount: number;
  events: FestivalEvent[];
  venues: Venue[];
  departments: Department[];
  personnel: unknown[];
  colors: Record<string, Record<string, { bg: string; fg: string }>>;
  dataSourceLabel: string;
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
          throw new Error(`Failed to load vendor schedule (Status ${res.status})`);
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "70vh",
          gap: "16px",
          color: "var(--muted)",
          fontFamily: "var(--font-sans)",
        }}
      >
        <div className="banner-brand-mark" style={{ animation: "pulse 1.5s infinite" }}>
          <img src="/icon.png?v=solaris" alt="" width={26} height={26} className="banner-brand-mark" suppressHydrationWarning />
        </div>
        <div style={{ fontSize: "1rem", fontWeight: 600 }}>Loading Vendor Schedule...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "2rem",
          maxWidth: "520px",
          margin: "4rem auto",
          backgroundColor: "var(--surface)",
          border: "1px solid var(--danger, #ef4444)",
          borderRadius: "var(--radius-lg, 12px)",
          color: "var(--ink)",
          textAlign: "center",
          boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ color: "var(--danger, #ef4444)", marginBottom: "8px" }}>
          <Icon name="xCircle" size={32} />
        </div>
        <h2 style={{ margin: "0 0 8px 0", fontSize: "1.2rem", fontWeight: 700 }}>Access Restricted</h2>
        <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)" }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <EventApp
      venues={data.venues}
      events={data.events}
      personnel={data.personnel}
      departments={data.departments}
      colors={data.colors}
      dataSourceLabel={data.dataSourceLabel}
      appEnvironment="PROD"
      vendorScope={{
        vendorName: data.vendorName,
        token: token || "",
      }}
    />
  );
}
