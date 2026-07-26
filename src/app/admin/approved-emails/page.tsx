"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icons";

export default function ApprovedEmailsPage() {
  return (
    <div className="admin-deprecated-wrap">
      <div className="admin-deprecated">
        <h1 className="admin-deprecated-title">
          <Icon name="warning" size={22} />
          Page Deprecated
        </h1>
        <p>
          The separate <strong>Approved Emails</strong> tab has been deprecated to simplify user
          management.
        </p>
        <p>
          The single source of truth for authorized email access is now the <strong>Personnel</strong>{" "}
          tab in your Google Sheet. Anyone listed in the <strong>Personnel</strong> sheet with a valid
          email address is automatically permitted to log into the application.
        </p>
        <p>
          To add, modify, or revoke access for any crew member or administrator, please edit the{" "}
          <strong>Personnel</strong> tab directly in your Google Sheet and allow the sync script to
          update the changes.
        </p>
        <div className="admin-deprecated-actions">
          <Link href="/admin" className="btn btn-primary">
            Go to Admin Pins
          </Link>
          <Link href="/admin/health" className="btn btn-secondary">
            Go to Data Health
          </Link>
        </div>
      </div>
    </div>
  );
}
