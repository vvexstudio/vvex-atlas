"use client";

import { useState } from "react";

export default function AdminMagicLinksPage() {
  const [vendorTokenInput, setVendorTokenInput] = useState("Lighting");
  const [copiedType, setCopiedType] = useState<"magic" | "ics" | null>(null);

  const activeOrigin = typeof window !== "undefined" ? window.location.origin : "https://portal.is";
  const magicLinkUrl = `${activeOrigin}/vendor?token=${encodeURIComponent(vendorTokenInput.trim())}`;
  const icsFeedUrl = `${activeOrigin}/api/ics?token=demo-token&dept=${encodeURIComponent(vendorTokenInput.trim())}`;

  return (
    <div style={{ display: "grid", gap: "2rem", color: "#111827" }}>
      {/* Header Title */}
      <div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>Vendor Magic Links & iCal Feeds</h1>
        <p style={{ color: "#6b7280", fontSize: "0.9rem", marginTop: "0.5rem" }}>
          Issue frictionless, password-free schedule links for external contractors or share tokenized `.ics` calendar subscription feeds.
        </p>
      </div>

      {/* Main Generator Card */}
      <div style={{ background: "white", padding: "1.5rem", borderRadius: "10px", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1)" }}>
        <h3 style={{ fontSize: "1rem", color: "#374151", fontWeight: 600, marginBottom: "1rem" }}>
          🔑 Generate Magic Link & Feed URL
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: "650px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#374151", marginBottom: "0.4rem" }}>
              Vendor / Department Name or Token:
            </label>
            <input
              type="text"
              value={vendorTokenInput}
              onChange={(e) => setVendorTokenInput(e.target.value)}
              placeholder="e.g. Lighting, Audio, Stage Crew, Food"
              style={{
                width: "100%",
                padding: "0.6rem 0.85rem",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                fontSize: "0.9rem",
              }}
            />
            <span style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.3rem", display: "block" }}>
              Filter shifts matching department, lead point person, or title containing this keyword.
            </span>
          </div>

          {/* Generated URLs Box */}
          <div style={{ display: "grid", gap: "1rem", backgroundColor: "#f9fafb", padding: "1.25rem", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
            {/* Vendor Magic Link */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <strong style={{ fontSize: "0.85rem", color: "#4f46e5" }}>🔗 Vendor Schedule Magic Link:</strong>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(magicLinkUrl);
                    setCopiedType("magic");
                    setTimeout(() => setCopiedType(null), 2500);
                  }}
                  style={{
                    backgroundColor: "#6366f1",
                    color: "white",
                    border: "none",
                    padding: "0.35rem 0.75rem",
                    borderRadius: "6px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {copiedType === "magic" ? "✅ Copied!" : "📋 Copy Link"}
                </button>
              </div>
              <code style={{ display: "block", background: "white", padding: "0.5rem", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "0.8rem", wordBreak: "break-all", color: "#111827" }}>
                {magicLinkUrl}
              </code>
            </div>

            {/* iCal Subscription Feed */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <strong style={{ fontSize: "0.85rem", color: "#7c3aed" }}>📅 iCal Subscription Feed URL (.ics):</strong>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(icsFeedUrl);
                    setCopiedType("ics");
                    setTimeout(() => setCopiedType(null), 2500);
                  }}
                  style={{
                    backgroundColor: "#8b5cf6",
                    color: "white",
                    border: "none",
                    padding: "0.35rem 0.75rem",
                    borderRadius: "6px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {copiedType === "ics" ? "✅ Copied!" : "📋 Copy Feed URL"}
                </button>
              </div>
              <code style={{ display: "block", background: "white", padding: "0.5rem", borderRadius: "4px", border: "1px solid #d1d5db", fontSize: "0.8rem", wordBreak: "break-all", color: "#111827" }}>
                {icsFeedUrl}
              </code>
            </div>
          </div>

          {/* Test Link Action */}
          <div style={{ display: "flex", gap: "1rem" }}>
            <a
              href={magicLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.6rem 1.2rem",
                backgroundColor: "#18181b",
                color: "white",
                borderRadius: "6px",
                textDecoration: "none",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              ↗ Open Vendor Mobile View
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
