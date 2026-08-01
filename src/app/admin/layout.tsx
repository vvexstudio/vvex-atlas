"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icons";
import "./admin.css";

const NAV_TABS: { href: string; icon: IconName; label: string; exact?: boolean }[] = [
  { href: "/admin", icon: "mapPin", label: "Locations", exact: true },
  { href: "/admin/magic-links", icon: "key", label: "Magic Links & Feeds" },
  { href: "/admin/health", icon: "stethoscope", label: "Data Health" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-left">
          <div className="admin-brand">
            <img src="/icon.png" alt="" width={26} height={26} className="admin-brand-logo" />
            <h2 className="admin-brand-title">The Portal — Admin</h2>
            {(() => {
              const isLive = typeof window !== "undefined" && !window.location.hostname.includes("localhost") && !window.location.hostname.includes("127.0.0.1");
              const isProd = typeof window !== "undefined" && (window.location.hostname.includes("portal-map-app") || window.location.hostname.includes("portal-production"));
              const badgeText = isProd ? (isLive ? "PROD (Live)" : "PROD (Local)") : (isLive ? "DEV (Live)" : "DEV (Local)");

              return isProd ? (
                <span
                  className="chip"
                  title="Production Environment (portal-production / portal-map-app)"
                  style={{
                    backgroundColor: "rgba(16, 185, 129, 0.15)",
                    color: "#10b981",
                    border: "1px solid rgba(16, 185, 129, 0.35)",
                    fontWeight: 700,
                    fontSize: "0.68rem",
                    letterSpacing: "0.06em",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "2px 8px",
                    borderRadius: "12px",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: "#10b981",
                      boxShadow: "0 0 6px #10b981",
                    }}
                  />
                  {badgeText}
                </span>
              ) : (
                <span
                  className="chip"
                  title="Development Environment (portal-dev)"
                  style={{
                    backgroundColor: "rgba(245, 158, 11, 0.15)",
                    color: "#f59e0b",
                    border: "1px solid rgba(245, 158, 11, 0.35)",
                    fontWeight: 700,
                    fontSize: "0.68rem",
                    letterSpacing: "0.06em",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "2px 8px",
                    borderRadius: "12px",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: "#f59e0b",
                      boxShadow: "0 0 6px #f59e0b",
                    }}
                  />
                  {badgeText}
                </span>
              );
            })()}
          </div>
          <nav className="admin-nav">
            {NAV_TABS.map((tab) => {
              const isActive = tab.exact
                ? pathname === tab.href
                : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`admin-nav-tab${isActive ? " admin-nav-tab-active" : ""}`}
                >
                  <Icon name={tab.icon} size={14} />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <Link href="/" className="btn btn-ghost btn-sm">
          <Icon name="chevronLeft" size={14} />
          Back to App
        </Link>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
