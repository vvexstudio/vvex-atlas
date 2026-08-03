"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

export interface MagicLinkGeneratorProps {
  /** Compact single-row variant used on the health dashboard. */
  compact?: boolean;
}

function generateHighEntropyToken(dept: string) {
  const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const sanitized = dept.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "dept";
  return `v_${sanitized}_${randomHex}`;
}

/**
 * Shared vendor magic-link + iCal feed URL generator.
 * Used by /admin/magic-links (full) and /admin/health (compact).
 */
export function MagicLinkGenerator({ compact = false }: MagicLinkGeneratorProps) {
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [customToken, setCustomToken] = useState("");
  const [secureToken, setSecureToken] = useState("");
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [copiedType, setCopiedType] = useState<"magic" | "ics" | "secure" | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeOrigin = typeof window !== "undefined" ? window.location.origin : "https://portal.is";

  useEffect(() => {
    async function loadDepartments() {
      try {
        const res = await fetch("/api/departments");
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.departments) && json.departments.length > 0) {
            setDepartments(json.departments);
            setSelectedDepts([json.departments[0]]);
          }
        }
      } catch (err) {
        console.error("Failed to load departments:", err);
      }
    }
    loadDepartments();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDepartment = (dept: string) => {
    if (selectedDepts.includes(dept)) {
      setSelectedDepts(selectedDepts.filter((d) => d !== dept));
    } else {
      setSelectedDepts([...selectedDepts, dept]);
    }
  };

  const handleSelectAll = () => setSelectedDepts([...departments]);
  const handleClearAll = () => setSelectedDepts([]);

  const activeDeptKeyword = customToken.trim() || selectedDepts.join(",");
  const magicLinkUrl = `${activeOrigin}/vendor?token=${encodeURIComponent(activeDeptKeyword)}`;
  const icsFeedUrl = `${activeOrigin}/api/ics?token=demo-token&dept=${encodeURIComponent(activeDeptKeyword)}`;
  const secureMagicUrl = secureToken ? `${activeOrigin}/vendor?token=${secureToken}` : "";

  const handleGenerateSecureToken = async () => {
    setIsSavingToken(true);
    const token = generateHighEntropyToken(activeDeptKeyword);
    setSecureToken(token);

    try {
      await fetch("/api/admin/vendor-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          vendorName: activeDeptKeyword,
          departments: selectedDepts,
        }),
      });
    } catch (e) {
      console.warn("Failed to persist secure vendor token to RTDB:", e);
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleCopy = (type: "magic" | "ics" | "secure", url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const renderMultiSelect = () => {
    const summaryText =
      selectedDepts.length === 0
        ? "Select Departments..."
        : selectedDepts.length === departments.length
        ? "All Departments Selected"
        : `${selectedDepts.length} Department${selectedDepts.length > 1 ? "s" : ""} Selected`;

    return (
      <div className="admin-multiselect-container" ref={dropdownRef}>
        <button
          type="button"
          className="admin-multiselect-trigger"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <span>{summaryText}</span>
          <Icon name={isDropdownOpen ? "chevronUp" : "chevronDown"} size={14} />
        </button>

        {isDropdownOpen && (
          <div className="admin-multiselect-menu">
            <div className="admin-multiselect-actions">
              <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClearAll}>
                Clear
              </Button>
            </div>

            <div className="admin-multiselect-list">
              {departments.length === 0 ? (
                <div style={{ padding: "8px 12px", fontSize: "0.85rem", color: "var(--muted)" }}>
                  Loading departments from sheet...
                </div>
              ) : (
                departments.map((dept) => {
                  const isChecked = selectedDepts.includes(dept);
                  return (
                    <label key={dept} className="admin-multiselect-item">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleDepartment(dept)}
                      />
                      <span>{dept}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Selected Chips */}
        {selectedDepts.length > 0 && !customToken.trim() && (
          <div className="admin-chips-row">
            {selectedDepts.map((d) => (
              <span key={d} className="chip chip-accent" style={{ fontSize: "0.75rem", padding: "2px 6px" }}>
                {d}
                <button
                  type="button"
                  onClick={() => toggleDepartment(d)}
                  style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", marginLeft: "4px" }}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (compact) {
    return (
      <>
        <div className="admin-form-row admin-mlg-compact-row">
          <div style={{ minWidth: "240px" }}>
            <label className="admin-label">
              Select Department(s):
            </label>
            {renderMultiSelect()}
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
          <label className="admin-label">
            Multi-Department Selector (from Google Sheet):
          </label>
          {renderMultiSelect()}
          <span className="admin-hint">Loaded directly from master Google Sheet registry. Toggle checkboxes for multi-department scope.</span>
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
              Generates an unguessable 128-bit token to prevent URL guessing for sensitive multi-department vendor schedules.
            </p>
          </div>
          <Button variant="primary" size="sm" icon="lock" onClick={handleGenerateSecureToken} disabled={isSavingToken}>
            {isSavingToken ? "Saving Token..." : "Generate Secure 128-bit Token"}
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
