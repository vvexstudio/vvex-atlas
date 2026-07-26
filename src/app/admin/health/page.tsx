"use client";

import { useEffect, useState } from "react";

interface HealthData {
  dataSource: string;
  firebase: {
    configured: boolean;
    active: boolean;
    heartbeat: {
      last_sync: string;
      rows: number;
    } | null;
    heartbeatAgeSeconds: number | null;
  };
  counts: {
    venues: number;
    events: number;
    personnel: number;
    departments: number;
  };
  unmappedLocations: string[];
  onboardingFailures: { email: string; status: string }[];
  personnelLog?: {
    name: string;
    email: string;
    role: string;
    department: string;
    active: boolean;
    inviteStatus: string;
  }[];
}

export default function AdminHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch("/api/admin/health");
        if (!res.ok) {
          if (res.status === 401) {
            throw new Error("Unauthorized access. Please login first.");
          }
          throw new Error(`Error: status ${res.status}`);
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || "Failed to load health statistics.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchHealth();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>Loading system health parameters...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "1.5rem", backgroundColor: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "8px", color: "#b91c1c", margin: "2rem 0" }}>
        <strong>System Error:</strong> {error}
      </div>
    );
  }

  if (!data) return null;

  // Sync health check (> 10 minutes is flagged red)
  const isHeartbeatStale = data.firebase.heartbeatAgeSeconds !== null && data.firebase.heartbeatAgeSeconds > 600;
  const heartbeatTimeStr = data.firebase.heartbeat
    ? new Date(data.firebase.heartbeat.last_sync).toLocaleString()
    : "Never";

  return (
    <div style={{ display: "grid", gap: "2rem", color: "#111827" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>System & Data Health Panel</h1>
        <span style={{ 
          fontSize: "0.85rem", 
          padding: "0.25rem 0.75rem", 
          borderRadius: "9999px", 
          backgroundColor: "#1e1a16", 
          color: "#f5ead2",
          fontWeight: 700 
        }}>
          Live System Stats
        </span>
      </div>

      {/* Grid Row 1: Source and Sync status */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
        
        {/* Active Data Source */}
        <div style={{ background: "white", padding: "1.5rem", borderRadius: "8px", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <h3 style={{ fontSize: "0.9rem", color: "#6b7280", fontWeight: 600, margin: 0, textTransform: "uppercase" }}>Active Data Gateway</h3>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>{data.dataSource}</div>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#6b7280" }}>
            Canonical data source from which the Next.js server is rendering the main schedules and venues.
          </p>
        </div>

        {/* Database Sync Heartbeat */}
        <div style={{ 
          background: "white", 
          padding: "1.5rem", 
          borderRadius: "8px", 
          boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1)", 
          display: "flex", 
          flexDirection: "column", 
          gap: "0.5rem",
          borderLeft: `5px solid ${isHeartbeatStale ? "#ef4444" : "#10b981"}`
        }}>
          <h3 style={{ fontSize: "0.9rem", color: "#6b7280", fontWeight: 600, margin: 0, textTransform: "uppercase" }}>Sync Heartbeat Status</h3>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: isHeartbeatStale ? "#ef4444" : "#111827" }}>
            {isHeartbeatStale ? "⚠️ Heartbeat Stale" : "✅ Heartbeat Healthy"}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#374151" }}>
            <strong>Last Sync:</strong> {heartbeatTimeStr} 
            {data.firebase.heartbeatAgeSeconds !== null && ` (${Math.floor(data.firebase.heartbeatAgeSeconds / 60)}m ago)`}
          </div>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#6b7280" }}>
            Updates every time the Google Sheets Apps Script successfully pushes data to Firebase Realtime Database.
          </p>
        </div>
      </div>

      {/* Grid Row 2: Row Counts */}
      <div style={{ background: "white", padding: "1.5rem", borderRadius: "8px", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1)" }}>
        <h3 style={{ fontSize: "0.9rem", color: "#6b7280", fontWeight: 600, marginBottom: "1rem", textTransform: "uppercase" }}>Data Row Metrics</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", textAlign: "center" }}>
          <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "6px" }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111827" }}>{data.counts.venues}</div>
            <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Locations</div>
          </div>
          <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "6px" }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111827" }}>{data.counts.events}</div>
            <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Events (ROS)</div>
          </div>
          <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "6px" }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111827" }}>{data.counts.personnel}</div>
            <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Personnel</div>
          </div>
          <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "6px" }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111827" }}>{data.counts.departments}</div>
            <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Departments</div>
          </div>
        </div>
      </div>

      {/* Grid Row 3: Warnings and Failures */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
        
        {/* Unmapped Locations warnings */}
        <div style={{ background: "white", padding: "1.5rem", borderRadius: "8px", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1)" }}>
          <h3 style={{ fontSize: "0.9rem", color: "#6b7280", fontWeight: 600, marginBottom: "1rem", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            ⚠️ Unmapped Locations ({data.unmappedLocations.length})
          </h3>
          {data.unmappedLocations.length === 0 ? (
            <p style={{ color: "#10b981", fontSize: "0.85rem", margin: 0 }}>All locations in events match a valid location on the map.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem", color: "#374151" }}>
              {data.unmappedLocations.map((loc, idx) => (
                <li key={idx} style={{ marginBottom: "0.25rem" }}>{loc}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Failed Onboarding Invites */}
        <div style={{ background: "white", padding: "1.5rem", borderRadius: "8px", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1)" }}>
          <h3 style={{ fontSize: "0.9rem", color: "#6b7280", fontWeight: 600, marginBottom: "1rem", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            ❌ Failed Onboarding Invites ({data.onboardingFailures.length})
          </h3>
          {data.onboardingFailures.length === 0 ? (
            <p style={{ color: "#10b981", fontSize: "0.85rem", margin: 0 }}>No onboarding invite failures found in Personnel.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem", maxHeight: "250px", overflowY: "auto" }}>
              {data.onboardingFailures.map((fail, idx) => (
                <div key={idx} style={{ background: "#fef2f2", padding: "0.5rem", borderLeft: "3px solid #ef4444", borderRadius: "4px", fontSize: "0.8rem" }}>
                  <strong>{fail.email}</strong>
                  <div style={{ color: "#b91c1c", marginTop: "2px" }}>{fail.status}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Access & Onboarding Audit Log */}
      {data.personnelLog && data.personnelLog.length > 0 && (
        <div style={{ background: "white", padding: "1.5rem", borderRadius: "8px", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1)" }}>
          <h3 style={{ fontSize: "0.9rem", color: "#6b7280", fontWeight: 600, marginBottom: "1rem", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            📑 Access & Onboarding Audit Log ({data.personnelLog.length} Crew)
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "0.75rem", fontWeight: 600, color: "#374151" }}>Name</th>
                  <th style={{ padding: "0.75rem", fontWeight: 600, color: "#374151" }}>Email</th>
                  <th style={{ padding: "0.75rem", fontWeight: 600, color: "#374151" }}>Role / Dept</th>
                  <th style={{ padding: "0.75rem", fontWeight: 600, color: "#374151" }}>Status</th>
                  <th style={{ padding: "0.75rem", fontWeight: 600, color: "#374151" }}>Sync Details</th>
                </tr>
              </thead>
              <tbody>
                {data.personnelLog.map((person, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "0.75rem", fontWeight: 500 }}>{person.name}</td>
                    <td style={{ padding: "0.75rem", color: "#6b7280" }}>{person.email}</td>
                    <td style={{ padding: "0.75rem" }}>
                      <span style={{ background: "#f3f4f6", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 500 }}>
                        {person.department || person.role}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem" }}>
                      <span style={{
                        padding: "0.2rem 0.55rem",
                        borderRadius: "9999px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        backgroundColor: person.active ? "#d1fae5" : "#fee2e2",
                        color: person.active ? "#065f46" : "#991b1b"
                      }}>
                        {person.active ? "Active" : "Revoked"}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem", color: "#4b5563", fontSize: "0.8rem" }}>
                      {person.inviteStatus}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
