"use client";

import { useState, useEffect } from "react";

interface ApprovedEmail {
  email: string;
  name: string;
}

export default function ApprovedEmailsPage() {
  const [emails, setEmails] = useState<ApprovedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form states
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch approved emails
  const fetchEmails = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/approved-emails");
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Unauthorized access. Please log in.");
        }
        throw new Error("Failed to load approved emails from Google Sheet.");
      }
      const data = await res.json();
      setEmails(data.emails || []);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  // Handle adding a new email
  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/admin/approved-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          name: newName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add email address.");
      }

      setSuccess(`"${newEmail}" was successfully added to the approved list.`);
      setNewEmail("");
      setNewName("");
      setEmails(data.emails || []);
    } catch (err: any) {
      setError(err.message || "Failed to add email address.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle deleting an email
  const handleDeleteEmail = async (emailToDelete: string) => {
    if (!confirm(`Are you sure you want to remove "${emailToDelete}" from the approved list?`)) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      const res = await fetch(`/api/admin/approved-emails?email=${encodeURIComponent(emailToDelete)}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete email address.");
      }

      setSuccess(`"${emailToDelete}" was successfully removed.`);
      setEmails(data.emails || []);
    } catch (err: any) {
      setError(err.message || "Failed to delete email address.");
    }
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>Approved Emails Directory</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#6b7280", fontSize: "0.875rem" }}>
            Manage who is allowed to sign in via Google OAuth to view the Portal Map & Schedule app. Changes update Google Sheets live.
          </p>
        </div>
      </div>

      {/* Alert Banners */}
      {error && (
        <div style={{ padding: "1rem", backgroundColor: "#fef2f2", border: "1px solid #fee2e2", borderRadius: "8px", color: "#b91c1c", marginBottom: "1.5rem", fontSize: "0.9rem", fontWeight: 500 }}>
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div style={{ padding: "1rem", backgroundColor: "#ecfdf5", border: "1px solid #d1fae5", borderRadius: "8px", color: "#065f46", marginBottom: "1.5rem", fontSize: "0.9rem", fontWeight: 500 }}>
          ✅ {success}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "2rem" }}>
        {/* Add Email Form */}
        <div style={{ background: "white", padding: "1.5rem", borderRadius: "12px", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1)", height: "fit-content" }}>
          <h3 style={{ margin: "0 0 1.25rem", fontSize: "1.1rem", fontWeight: 600 }}>Approve New Email</h3>
          <form onSubmit={handleAddEmail}>
            <div style={{ marginBottom: "1rem" }}>
              <label htmlFor="email" style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.85rem", fontWeight: 500, color: "#374151" }}>
                Email Address *
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="e.g. user@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={submitting}
                style={{ width: "100%", padding: "0.6rem", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "0.9rem" }}
              />
            </div>
            <div style={{ marginBottom: "1.5rem" }}>
              <label htmlFor="name" style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.85rem", fontWeight: 500, color: "#374151" }}>
                User Name (Optional)
              </label>
              <input
                id="name"
                type="text"
                placeholder="e.g. John Doe"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={submitting}
                style={{ width: "100%", padding: "0.6rem", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "0.9rem" }}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%",
                padding: "0.65rem",
                backgroundColor: "#4f46e5",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
              }}
            >
              {submitting ? "Saving to Sheets..." : "Grant Access"}
            </button>
          </form>
        </div>

        {/* Emails Table */}
        <div style={{ background: "white", borderRadius: "12px", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1)", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#6b7280" }}>
              <div style={{ display: "inline-block", width: "1.5rem", height: "1.5rem", border: "3px solid #e5e7eb", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              <p style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>Loading Approved Directory...</p>
            </div>
          ) : emails.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#6b7280" }}>
              <p style={{ fontSize: "1.1rem", margin: 0 }}>No approved emails found.</p>
              <p style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>Create your first entry on the left to authorize access.</p>
            </div>
          ) : (
            <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "0.85rem 1.25rem", fontSize: "0.85rem", fontWeight: 600, color: "#4b5563" }}>Email Address</th>
                  <th style={{ padding: "0.85rem 1.25rem", fontSize: "0.85rem", fontWeight: 600, color: "#4b5563" }}>Name</th>
                  <th style={{ padding: "0.85rem 1.25rem", fontSize: "0.85rem", fontWeight: 600, color: "#4b5563", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((item) => (
                  <tr key={item.email} style={{ borderBottom: "1px solid #f3f4f6", transition: "background-color 0.15s" }}>
                    <td style={{ padding: "0.85rem 1.25rem", fontSize: "0.9rem", fontWeight: 500, fontFamily: "monospace", color: "#111827" }}>
                      {item.email}
                    </td>
                    <td style={{ padding: "0.85rem 1.25rem", fontSize: "0.9rem", color: "#4b5563" }}>
                      {item.name || "—"}
                    </td>
                    <td style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>
                      <button
                        onClick={() => handleDeleteEmail(item.email)}
                        style={{
                          backgroundColor: "transparent",
                          border: "none",
                          color: "#dc2626",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          padding: "0.25rem 0.5rem",
                          borderRadius: "4px",
                          transition: "background-color 0.15s"
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#fee2e2"}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                      >
                        Revoke Access
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
