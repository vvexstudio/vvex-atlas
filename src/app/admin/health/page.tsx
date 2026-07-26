"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/icons";
import { MagicLinkGenerator } from "@/components/admin/MagicLinkGenerator";

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
    return <div className="admin-loading">Loading system health parameters...</div>;
  }

  if (error) {
    return (
      <div className="admin-error">
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
    <div className="admin-page-stack">
      <div className="admin-page-header">
        <h1 className="admin-page-title">System & Data Health Panel</h1>
        <span className="admin-live-badge">Live System Stats</span>
      </div>

      {/* Grid Row 1: Source and Sync status */}
      <div className="admin-grid-cols">
        {/* Active Data Source */}
        <Card className="admin-card admin-stat-card">
          <h3 className="eyebrow admin-section-title">Active Data Gateway</h3>
          <div className="admin-stat-value">{data.dataSource}</div>
          <p className="admin-stat-note">
            Canonical data source from which the Next.js server is rendering the main schedules and venues.
          </p>
        </Card>

        {/* Database Sync Heartbeat */}
        <Card
          className={`admin-card admin-stat-card ${
            isHeartbeatStale ? "admin-heartbeat-stale" : "admin-heartbeat-ok"
          }`}
        >
          <h3 className="eyebrow admin-section-title">Sync Heartbeat Status</h3>
          <div className="admin-stat-value">
            <Icon name={isHeartbeatStale ? "warning" : "checkCircle"} size={18} />
            {isHeartbeatStale ? "Heartbeat Stale" : "Heartbeat Healthy"}
          </div>
          <div>
            <strong>Last Sync:</strong> {heartbeatTimeStr}
            {data.firebase.heartbeatAgeSeconds !== null &&
              ` (${Math.floor(data.firebase.heartbeatAgeSeconds / 60)}m ago)`}
          </div>
          <p className="admin-stat-note">
            Updates every time the Google Sheets Apps Script successfully pushes data to Firebase Realtime Database.
          </p>
        </Card>
      </div>

      {/* Grid Row 2: Row Counts */}
      <Card className="admin-card">
        <h3 className="eyebrow admin-section-title">Data Row Metrics</h3>
        <div className="admin-metric-grid">
          <div className="admin-metric">
            <div className="admin-metric-value">{data.counts.venues}</div>
            <div className="admin-metric-label">Locations</div>
          </div>
          <div className="admin-metric">
            <div className="admin-metric-value">{data.counts.events}</div>
            <div className="admin-metric-label">Events (ROS)</div>
          </div>
          <div className="admin-metric">
            <div className="admin-metric-value">{data.counts.personnel}</div>
            <div className="admin-metric-label">Personnel</div>
          </div>
          <div className="admin-metric">
            <div className="admin-metric-value">{data.counts.departments}</div>
            <div className="admin-metric-label">Departments</div>
          </div>
        </div>
      </Card>

      {/* Grid Row 3: Schema Linter Report */}
      {data.linterReport && (
        <Card className="admin-card">
          <div className="admin-section-head">
            <h3 className="eyebrow admin-section-title">
              <Icon name="search" size={14} />
              Schema Validation & Quality Report
            </h3>
            <div className="admin-chip-row">
              <Chip tone="danger">{data.linterReport.issueCounts.errors} Errors</Chip>
              <Chip tone="warn">{data.linterReport.issueCounts.warnings} Warnings</Chip>
              <Chip tone="info">{data.linterReport.issueCounts.info} Info</Chip>
            </div>
          </div>
          {data.linterReport.issues.length === 0 ? (
            <p className="admin-ok-text">
              <Icon name="checkCircle" size={14} />
              0 schema lint issues detected. Data quality is clean.
            </p>
          ) : (
            <div className="admin-issue-list">
              {data.linterReport.issues.map((issue) => (
                <div key={issue.id} className={`admin-issue-row admin-issue-${issue.severity}`}>
                  <strong>[{issue.category.toUpperCase()}]</strong> {issue.message}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Grid Row 4: Warnings and Failures */}
      <div className="admin-grid-cols">
        {/* Unmapped Locations warnings */}
        <Card className="admin-card">
          <h3 className="eyebrow admin-section-title">
            <Icon name="warning" size={14} />
            Unmapped Locations ({data.unmappedLocations.length})
          </h3>
          {data.unmappedLocations.length === 0 ? (
            <p className="admin-ok-text">All locations in events match a valid location on the map.</p>
          ) : (
            <ul className="admin-plain-list">
              {data.unmappedLocations.map((loc, idx) => (
                <li key={idx}>{loc}</li>
              ))}
            </ul>
          )}
        </Card>

        {/* Failed Onboarding Invites */}
        <Card className="admin-card">
          <h3 className="eyebrow admin-section-title">
            <Icon name="xCircle" size={14} />
            Failed Onboarding Invites ({data.onboardingFailures.length})
          </h3>
          {data.onboardingFailures.length === 0 ? (
            <p className="admin-ok-text">No onboarding invite failures found in Personnel.</p>
          ) : (
            <div className="admin-fail-list">
              {data.onboardingFailures.map((fail, idx) => (
                <div key={idx} className="admin-fail-row">
                  <strong className="mono">{fail.email}</strong>
                  <div className="admin-fail-status">{fail.status}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Grid Row 4: Vendor Magic Links & iCal Feed Link Generator */}
      <Card className="admin-card">
        <h3 className="eyebrow admin-section-title">
          <Icon name="key" size={14} />
          Vendor Magic Links & iCal Subscriptions Link Generator
        </h3>
        <p className="admin-section-desc">
          Issue single-vendor schedule magic links for external crew (no password required) or copy
          tokenized `.ics` calendar subscription feeds.
        </p>
        <MagicLinkGenerator compact />
      </Card>

      {/* Access & Onboarding Audit Log */}
      {data.personnelLog && data.personnelLog.length > 0 && (
        <Card className="admin-card">
          <h3 className="eyebrow admin-section-title">
            <Icon name="file" size={14} />
            Access & Onboarding Audit Log ({data.personnelLog.length} Crew)
          </h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role / Dept</th>
                  <th>Status</th>
                  <th>Sync Details</th>
                </tr>
              </thead>
              <tbody>
                {data.personnelLog.map((person, idx) => (
                  <tr key={idx}>
                    <td>{person.name}</td>
                    <td className="admin-cell-muted mono">{person.email}</td>
                    <td>
                      <Chip tone="neutral">{person.department || person.role}</Chip>
                    </td>
                    <td>
                      <Chip tone={person.active ? "success" : "danger"}>
                        {person.active ? "Active" : "Revoked"}
                      </Chip>
                    </td>
                    <td className="admin-cell-muted">{person.inviteStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
