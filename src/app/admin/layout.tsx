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
