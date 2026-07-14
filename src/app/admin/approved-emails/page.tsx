"use client";

import Link from "next/link";

export default function ApprovedEmailsPage() {
  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" }}>
      <div style={{
        padding: "24px",
        borderRadius: "8px",
        backgroundColor: "#fef3c7",
        border: "1px solid #f59e0b",
        color: "#92400e",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
      }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 12px 0" }}>
          ⚠️ Page Deprecated
        </h1>
        <p style={{ margin: "0 0 16px 0", lineHeight: "1.5" }}>
          The separate <strong>Approved Emails</strong> tab has been deprecated to simplify user management.
        </p>
        <p style={{ margin: "0 0 16px 0", lineHeight: "1.5" }}>
          The single source of truth for authorized email access is now the <strong>Personnel</strong> tab in your Google Sheet. Anyone listed in the <strong>Personnel</strong> sheet with a valid email address is automatically permitted to log into the application.
        </p>
        <p style={{ margin: "0 0 24px 0", lineHeight: "1.5" }}>
          To add, modify, or revoke access for any crew member or administrator, please edit the <strong>Personnel</strong> tab directly in your Google Sheet and allow the sync script to update the changes.
        </p>
        <div style={{ display: "flex", gap: "12px" }}>
          <Link
            href="/admin"
            style={{
              padding: "8px 16px",
              backgroundColor: "#b45309",
              color: "white",
              textDecoration: "none",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "0.9rem"
            }}
          >
            Go to Admin Pins
          </Link>
          <Link
            href="/admin/health"
            style={{
              padding: "8px 16px",
              backgroundColor: "transparent",
              color: "#b45309",
              border: "1px solid #b45309",
              textDecoration: "none",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "0.9rem"
            }}
          >
            Go to Data Health
          </Link>
        </div>
      </div>
    </div>
  );
}
