"use client";

import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { MagicLinkGenerator } from "@/components/admin/MagicLinkGenerator";

export default function AdminMagicLinksPage() {
  return (
    <div className="admin-page-stack">
      {/* Header Title */}
      <div>
        <h1 className="admin-page-title">Vendor Magic Links & iCal Feeds</h1>
        <p className="admin-page-subtitle">
          Issue frictionless, password-free schedule links for external contractors or share
          tokenized `.ics` calendar subscription feeds.
        </p>
      </div>

      {/* Main Generator Card */}
      <Card className="admin-card">
        <h3 className="eyebrow admin-section-title">
          <Icon name="key" size={14} />
          Generate Magic Link & Feed URL
        </h3>
        <MagicLinkGenerator />
      </Card>
    </div>
  );
}
