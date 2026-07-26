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
  linterReport?: {
    timestamp: string;
    issueCounts: { errors: number; warnings: number; info: number };
    issues: { id: string; severity: "error" | "warning" | "info"; category: string; message: string }[];
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
  const [vendorTokenInput, setVendorTokenInput] = useState("Lighting");
  const [copiedType, setCopiedType] = useState<"magic" | "ics" | null>(null);

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

      {/* Grid Row 3: Schema Linter Report */}
      {data.linterReport && (
        <div style={{ background: "white", padding: "1.5rem", borderRadius: "8px", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "0.9rem", color: "#6b7280", fontWeight: 600, margin: 0, textTransform: "uppercase" }}>
              🔍 Schema Validation & Quality Report
            </h3>
            <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.75rem", fontWeight: 700 }}>
              <span style={{ background: "#fee2e2", color: "#991b1b", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
                {data.linterReport.issueCounts.errors} Errors
              </span>
              <span style={{ background: "#fef3c7", color: "#92400e", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
                {data.linterReport.issueCounts.warnings} Warnings
              </span>
              <span style={{ background: "#e0f2fe", color: "#075985", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
                {data.linterReport.issueCounts.info} Info
              </span>
            </div>
          </div>
          {data.linterReport.issues.length === 0 ? (
            <p style={{ color: "#10b981", fontSize: "0.85rem", margin: 0 }}>✅ 0 schema lint issues detected. Data quality is clean.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.5rem", maxHeight: "200px", overflowY: "auto" }}>
              {data.linterReport.issues.map((issue) => (
                <div
                  key={issue.id}
                  style={{
                    fontSize: "0.8rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "4px",
                    borderLeft: `4px solid ${
                      issue.severity === "error" ? "#ef4444" : (issue.severity === "warning" ? "#f59e0b" : "#3b82f6")
                    }`,
                    background: issue.severity === "error" ? "#fef2f2" : (issue.severity === "warning" ? "#fffbebe" : "#f0f9ff"),
                    color: "#1f2937"
                  }}
                >
                  <strong>[{issue.category.toUpperCase()}]</strong> {issue.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grid Row 4: Warnings and Failures */}
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

      {/* Grid Row 4: Vendor Magic Links & iCal Feed Link Generator */}
      <div style={{ background: "white", padding: "1.5rem", borderRadius: "8px", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1)" }}>
        <h3 style={{ fontSize: "0.9rem", color: "#6b7280", fontWeight: 600, marginBottom: "0.75rem", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          🔑 Vendor Magic Links & iCal Subscriptions Link Generator
        </h3>
        <p style={{ fontSize: "0.85rem", color: "#4b5563", marginTop: 0, marginBottom: "1rem" }}>
          Issue single-vendor schedule magic links for external crew (no password required) or copy tokenized `.ics` calendar subscription feeds.
        </p>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>Vendor / Department Token:</label>
            <input
              type="text"
              value={vendorTokenInput}
              onChange={(e) => setVendorTokenInput(e.target.value)}
              placeholder="e.g. Lighting, Audio, Food"
              style={{
                padding: "0.45rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                fontSize: "0.85rem",
                minWidth: "220px"
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
            <button
              onClick={() => {
                const url = `${window.location.origin}/vendor?token=${encodeURIComponent(vendorTokenInput.trim())}`;
                navigator.clipboard.writeText(url);
                setCopiedType("magic");
                setTimeout(() => setCopiedType(null), 2500);
              }}
              style={{
                backgroundColor: "#6366f1",
                color: "white",
                border: "none",
                padding: "0.5rem 0.9rem",
                borderRadius: "6px",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem"
              }}
            >
              📋 {copiedType === "magic" ? "Copied Magic Link!" : "Copy Vendor Magic Link"}
            </button>

            <button
              onClick={() => {
                const url = `${window.location.origin}/api/ics?token=demo-token&dept=${encodeURIComponent(vendorTokenInput.trim())}`;
                navigator.clipboard.writeText(url);
                setCopiedType("ics");
                setTimeout(() => setCopiedType(null), 2500);
              }}
              style={{
                backgroundColor: "#8b5cf6",
                color: "white",
                border: "none",
                padding: "0.5rem 0.9rem",
                borderRadius: "6px",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem"
              }}
            >
              📅 {copiedType === "ics" ? "Copied iCal Feed URL!" : "Copy iCal Feed URL"}
            </button>

            <a
              href={`/vendor?token=${encodeURIComponent(vendorTokenInput.trim())}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                backgroundColor: "#f3f4f6",
                color: "#374151",
                border: "1px solid #d1d5db",
                padding: "0.5rem 0.9rem",
                borderRadius: "6px",
                fontSize: "0.8rem",
                fontWeight: 600,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: "0.3rem"
              }}
            >
              ↗ Test Link View
            </a>
          </div>
        </div>

        <div style={{ backgroundColor: "#f9fafb", padding: "0.75rem 1rem", borderRadius: "6px", fontSize: "0.8rem", color: "#6b7280" }}>
          <strong>Generated Magic Link Preview:</strong>{" "}
          <code style={{ color: "#4f46e5" }}>
            {typeof window !== "undefined" ? window.location.origin : "https://portal.is"}/vendor?token={encodeURIComponent(vendorTokenInput.trim())}
          </code>
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
