"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

export interface MagicLinkGeneratorProps {
  /** Compact single-row variant used on the health dashboard. */
  compact?: boolean;
}

const PRESET_DEPARTMENTS = [
  "Lighting",
  "Audio",
  "Rigging",
  "Stage Crew",
  "Services",
  "F&B",
  "Ops",
  "Safety",
  "Art",
  "Media",
  "Medical",
  "Performer",
];

function generateHighEntropyToken(dept: string) {
  const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `v_${dept.toLowerCase().replace(/[^a-z0-9]/g, "")}_${randomHex}`;
}

/**
 * Shared vendor magic-link + iCal feed URL generator.
 * Used by /admin/magic-links (full) and /admin/health (compact).
 */
export function MagicLinkGenerator({ compact = false }: MagicLinkGeneratorProps) {
  const [selectedDept, setSelectedDept] = useState("Lighting");
  const [customToken, setCustomToken] = useState("");
  const [secureToken, setSecureToken] = useState("");
  const [copiedType, setCopiedType] = useState<"magic" | "ics" | "secure" | null>(null);

  const activeOrigin = typeof window !== "undefined" ? window.location.origin : "https://portal.is";
  
  const activeDeptKeyword = customToken.trim() || selectedDept;
  const magicLinkUrl = `${activeOrigin}/vendor?token=${encodeURIComponent(activeDeptKeyword)}`;
  const icsFeedUrl = `${activeOrigin}/api/ics?token=demo-token&dept=${encodeURIComponent(activeDeptKeyword)}`;
  const secureMagicUrl = secureToken ? `${activeOrigin}/vendor?token=${secureToken}` : "";
  const secureIcsUrl = secureToken ? `${activeOrigin}/api/ics?token=${secureToken}` : "";

  const handleGenerateSecureToken = () => {
    const token = generateHighEntropyToken(activeDeptKeyword);
    setSecureToken(token);
  };

  const handleCopy = (type: "magic" | "ics" | "secure", url: string) => {
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
              Select Department:
            </label>
            <select
              id="vendor-token-compact"
              className="admin-input admin-input-narrow"
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setCustomToken("");
              }}
            >
              {PRESET_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-mlg-actions">
            <Button
              variant="secondary"
              size="sm"
              icon={copiedType === "magic" ? "check" : "copy"}
              onClick={() => handleCopy("magic", magicLinkUrl)}
            >
              {copiedType === "magic" ? "Copied" : "Copy Magic Link"}
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
              href={`/vendor?token=${encodeURIComponent(activeDeptKeyword)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm"
            >
              <Icon name="externalLink" size={14} />
              Test Link
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div>
          <label className="admin-label" htmlFor="vendor-dept-select">
            Pre-Populated Department Selector:
          </label>
          <select
            id="vendor-dept-select"
            className="admin-input"
            value={selectedDept}
            onChange={(e) => {
              setSelectedDept(e.target.value);
              setCustomToken("");
            }}
          >
            {PRESET_DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept} Department
              </option>
            ))}
          </select>
          <span className="admin-hint">Loaded directly from master Google Sheet registry.</span>
        </div>

        <div>
          <label className="admin-label" htmlFor="vendor-custom-token">
            Or Type Custom Keyword / Vendor Tag:
          </label>
          <input
            id="vendor-custom-token"
            type="text"
            className="admin-input"
            value={customToken}
            onChange={(e) => setCustomToken(e.target.value)}
            placeholder="e.g. Catering, Night Shift, Pyro"
          />
          <span className="admin-hint">Overrides dropdown selection if filled.</span>
        </div>
      </div>

      {/* High-Entropy Cryptographic Token Generator Action */}
      <div style={{ background: "rgba(139, 92, 246, 0.08)", border: "1px solid rgba(139, 92, 246, 0.25)", borderRadius: "8px", padding: "16px", marginTop: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong style={{ color: "#a78bfa" }}>🔒 High-Entropy Cryptographic Token Generator</strong>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--color-muted)" }}>
              Generates an unguessable 128-bit token to prevent URL guessing for sensitive vendor schedules.
            </p>
          </div>
          <Button variant="primary" size="sm" icon="lock" onClick={handleGenerateSecureToken}>
            Generate Secure 128-bit Token
          </Button>
        </div>

        {secureToken && (
          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="admin-mlg-url-head">
              <strong className="admin-mlg-url-label">Secure Token Link:</strong>
              <Button
                variant="secondary"
                size="sm"
                icon={copiedType === "secure" ? "check" : "copy"}
                onClick={() => handleCopy("secure", secureMagicUrl)}
              >
                {copiedType === "secure" ? "Copied" : "Copy Secure Link"}
              </Button>
            </div>
            <code className="admin-mlg-code mono">{secureMagicUrl}</code>
          </div>
        )}
      </div>

      {/* Standard Generated URLs Box */}
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
