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
      const now = new Date();
      return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    }
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  } catch {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }
};

/**
 * Premium Offline + Last Sync Status Indicator Badge.
 * Uses useSyncExternalStore for reactive network status tracking and formats last sync timestamp.
 */
export function OfflineBadge({
  isOffline: propIsOffline,
  lastSynced,
  className = "",
  compact = false,
  showWhenOnline = true,
  envLabel,
  sourceLabel,
}: OfflineBadgeProps) {
  const isNetworkOffline = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineSnapshot,
    getServerOnlineSnapshot
  );

  const isOffline = propIsOffline !== undefined ? propIsOffline : isNetworkOffline;
  const syncFormatted = formatSyncTimestamp(lastSynced);

  if (!isOffline && !showWhenOnline) {
    return null;
  }

  const cleanEnv = envLabel ? envLabel.replace(/\s*\((Local|Live)\)/gi, "") : "";
  const tooltipText = [
    isOffline ? "Offline Mode (showing cached data)" : "Live Connected",
    envLabel ? `Env: ${envLabel}` : "",
    sourceLabel ? `Data: ${sourceLabel}` : "",
    `Synced at ${syncFormatted}`,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <div
      className={`offline-badge ${isOffline ? "is-offline" : "is-online"} ${compact ? "is-compact" : ""} ${className}`}
      title={tooltipText}
      suppressHydrationWarning
    >
      <span className="offline-badge-dot" aria-hidden="true" />
      <Icon name={isOffline ? "wifiOff" : "wifi"} size={compact ? 12 : 14} />
      <span className="offline-badge-text" suppressHydrationWarning>
        <span className="offline-badge-label">{isOffline ? "Offline" : "Live"}{cleanEnv ? ` (${cleanEnv})` : ""}</span>
        <span className="offline-badge-time" suppressHydrationWarning> • {isOffline ? "Cached" : "Synced"} {syncFormatted}</span>
      </span>
    </div>
  );
}
