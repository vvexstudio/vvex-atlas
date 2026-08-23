"use client";

import React, { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/icons";

export interface OfflineBadgeProps {
  isOffline?: boolean;
  lastSynced?: string | null;
  className?: string;
  compact?: boolean;
  showWhenOnline?: boolean;
  envLabel?: string;
  sourceLabel?: string;
  syncError?: string | null;
  isSyncStale?: boolean;
}

function subscribeOnlineStatus(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return !navigator.onLine;
}

function getServerOnlineSnapshot() {
  return false;
}

const formatSyncTimestamp = (ts?: string | null): string => {
  try {
    const date = ts ? new Date(ts) : new Date();
    if (isNaN(date.getTime())) {
      return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
};

/**
 * Premium Offline + Last Sync Status Indicator Badge.
 * Tracks network state, sheet sync errors, and heartbeat freshness.
 */
export function OfflineBadge({
  isOffline: propIsOffline,
  lastSynced,
  className = "",
  compact = false,
  showWhenOnline = true,
  envLabel,
  sourceLabel,
  syncError,
  isSyncStale,
}: OfflineBadgeProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isNetworkOffline = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineSnapshot,
    getServerOnlineSnapshot
  );

  const isOffline = propIsOffline !== undefined ? propIsOffline : isNetworkOffline;
  const syncFormatted = mounted ? formatSyncTimestamp(lastSynced) : "";

  if (!isOffline && !showWhenOnline && !syncError && !isSyncStale) {
    return null;
  }

  const isError = Boolean(syncError);
  const isWarning = Boolean(!isError && (isSyncStale || isOffline));
  const cleanEnv = envLabel ? envLabel.replace(/\s*\((Local|Live)\)/gi, "") : "";

  let stateClass = "is-online";
  let labelText = `Live${cleanEnv ? ` (${cleanEnv})` : ""}`;
  let iconName: "wifi" | "wifiOff" | "warning" = "wifi";

  if (isError) {
    stateClass = "is-error";
    labelText = `Sync Issue${cleanEnv ? ` (${cleanEnv})` : ""}`;
    iconName = "warning";
  } else if (isWarning) {
    stateClass = "is-offline";
    labelText = isOffline ? `Offline${cleanEnv ? ` (${cleanEnv})` : ""}` : `Sync Stale${cleanEnv ? ` (${cleanEnv})` : ""}`;
    iconName = isOffline ? "wifiOff" : "warning";
  }

  const tooltipText = [
    isError
      ? `⚠️ Sheet Sync Error: ${syncError}`
      : isSyncStale
      ? "⚠️ Sheet sync is stale (>10m ago)"
      : isOffline
      ? "Offline Mode (showing cached data)"
      : "Live Connected",
    envLabel ? `Env: ${envLabel}` : "",
    sourceLabel ? `Data: ${sourceLabel}` : "",
    syncFormatted ? `Synced at ${syncFormatted}` : "",
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <div
      className={`offline-badge ${stateClass} ${compact ? "is-compact" : ""} ${className}`}
      title={tooltipText}
      suppressHydrationWarning
    >
      <span className="offline-badge-dot" aria-hidden="true" />
      <Icon name={iconName} size={compact ? 12 : 14} />
      <span className="offline-badge-text" suppressHydrationWarning>
        <span className="offline-badge-label" suppressHydrationWarning>{labelText}</span>
        {mounted && syncFormatted ? (
          <span className="offline-badge-time" suppressHydrationWarning>
            {" "}• {isError ? "Error" : isOffline ? "Cached" : "Synced"} {syncFormatted}
          </span>
        ) : null}
      </span>
    </div>
  );
}
