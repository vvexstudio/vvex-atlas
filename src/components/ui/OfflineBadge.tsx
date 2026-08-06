"use client";

import React, { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/icons";

export interface OfflineBadgeProps {
  isOffline?: boolean;
  lastSynced?: string | null;
  className?: string;
  compact?: boolean;
  showWhenOnline?: boolean;
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
      return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

  return (
    <div
      className={`offline-badge ${isOffline ? "is-offline" : "is-online"} ${compact ? "is-compact" : ""} ${className}`}
      title={
        isOffline
          ? `Offline Mode — showing cached schedule data synced at ${syncFormatted}`
          : `Live Connected — last synced at ${syncFormatted}`
      }
    >
      <span className="offline-badge-dot" aria-hidden="true" />
      <Icon name={isOffline ? "wifiOff" : "wifi"} size={compact ? 12 : 14} />
      <span className="offline-badge-text">
        <span className="offline-badge-label">{isOffline ? "Offline" : "Live"}</span>
        <span className="offline-badge-time"> • {isOffline ? "Cached" : "Synced"} {syncFormatted}</span>
      </span>
    </div>
  );
}
