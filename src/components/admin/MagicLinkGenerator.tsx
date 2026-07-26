"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

export interface MagicLinkGeneratorProps {
  /** Compact single-row variant used on the health dashboard. */
  compact?: boolean;
}

/**
 * Shared vendor magic-link + iCal feed URL generator.
 * Used by /admin/magic-links (full) and /admin/health (compact).
 */
export function MagicLinkGenerator({ compact = false }: MagicLinkGeneratorProps) {
  const [vendorTokenInput, setVendorTokenInput] = useState("Lighting");
  const [copiedType, setCopiedType] = useState<"magic" | "ics" | null>(null);

  const activeOrigin = typeof window !== "undefined" ? window.location.origin : "https://portal.is";
  const magicLinkUrl = `${activeOrigin}/vendor?token=${encodeURIComponent(vendorTokenInput.trim())}`;
  const icsFeedUrl = `${activeOrigin}/api/ics?token=demo-token&dept=${encodeURIComponent(vendorTokenInput.trim())}`;

  const handleCopy = (type: "magic" | "ics", url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  if (compact) {
    return (
      <>
        <div className="admin-form-row admin-mlg-compact-row">
          <div>
            <label className="admin-label" htmlFor="vendor-token-compact">
              Vendor / Department Token:
            </label>
            <input
              id="vendor-token-compact"
              type="text"
              className="admin-input admin-input-narrow"
              value={vendorTokenInput}
              onChange={(e) => setVendorTokenInput(e.target.value)}
              placeholder="e.g. Lighting, Audio, Food"
            />
          </div>

          <div className="admin-mlg-actions">
            <Button
              variant="secondary"
              size="sm"
              icon={copiedType === "magic" ? "check" : "copy"}
              onClick={() => handleCopy("magic", magicLinkUrl)}
            >
              {copiedType === "magic" ? "Copied" : "Copy Vendor Magic Link"}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              icon={copiedType === "ics" ? "check" : "copy"}
              onClick={() => handleCopy("ics", icsFeedUrl)}
            >
              {copiedType === "ics" ? "Copied" : "Copy iCal Feed URL"}
            </Button>

            <a
              href={`/vendor?token=${encodeURIComponent(vendorTokenInput.trim())}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm"
            >
              <Icon name="externalLink" size={14} />
              Test Link View
            </a>
          </div>
        </div>

        <div className="admin-mlg-preview">
          <strong>Generated Magic Link Preview:</strong>{" "}
          <code className="mono">{magicLinkUrl}</code>
        </div>
      </>
    );
  }

  return (
    <div className="admin-mlg">
      <div>
        <label className="admin-label" htmlFor="vendor-token">
          Vendor / Department Name or Token:
        </label>
        <input
          id="vendor-token"
          type="text"
          className="admin-input"
          value={vendorTokenInput}
          onChange={(e) => setVendorTokenInput(e.target.value)}
          placeholder="e.g. Lighting, Audio, Stage Crew, Food"
        />
        <span className="admin-hint">
          Filter shifts matching department, lead point person, or title containing this keyword.
        </span>
      </div>

      {/* Generated URLs Box */}
      <div className="admin-mlg-urls">
        {/* Vendor Magic Link */}
        <div>
          <div className="admin-mlg-url-head">
            <strong className="admin-mlg-url-label">
              <Icon name="link" size={14} />
              Vendor Schedule Magic Link:
            </strong>
            <Button
              variant="secondary"
              size="sm"
              icon={copiedType === "magic" ? "check" : "copy"}
              onClick={() => handleCopy("magic", magicLinkUrl)}
            >
              {copiedType === "magic" ? "Copied" : "Copy Link"}
            </Button>
          </div>
          <code className="admin-mlg-code mono">{magicLinkUrl}</code>
        </div>

        {/* iCal Subscription Feed */}
        <div>
          <div className="admin-mlg-url-head">
            <strong className="admin-mlg-url-label">
              <Icon name="calendar" size={14} />
              iCal Subscription Feed URL (.ics):
            </strong>
            <Button
              variant="secondary"
              size="sm"
              icon={copiedType === "ics" ? "check" : "copy"}
              onClick={() => handleCopy("ics", icsFeedUrl)}
            >
              {copiedType === "ics" ? "Copied" : "Copy Feed URL"}
            </Button>
          </div>
          <code className="admin-mlg-code mono">{icsFeedUrl}</code>
        </div>
      </div>

      {/* Test Link Action */}
      <div className="admin-mlg-actions">
        <a href={magicLinkUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
          <Icon name="externalLink" size={16} />
          Open Vendor Mobile View
        </a>
      </div>
    </div>
  );
}
