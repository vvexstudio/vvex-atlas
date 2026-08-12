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
      return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
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

  if (!isOffline && !showWhenOnline) {
    return null;
  }

  const cleanEnv = envLabel ? envLabel.replace(/\s*\((Local|Live)\)/gi, "") : "";
  const tooltipText = [
    isOffline ? "Offline Mode (showing cached data)" : "Live Connected",
    envLabel ? `Env: ${envLabel}` : "",
    sourceLabel ? `Data: ${sourceLabel}` : "",
    syncFormatted ? `Synced at ${syncFormatted}` : "",
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
        <span className="offline-badge-label" suppressHydrationWarning>{isOffline ? "Offline" : "Live"}{cleanEnv ? ` (${cleanEnv})` : ""}</span>
        {mounted && syncFormatted ? (
          <span className="offline-badge-time" suppressHydrationWarning> • {isOffline ? "Cached" : "Synced"} {syncFormatted}</span>
        ) : null}
      </span>
    </div>
  );
}
