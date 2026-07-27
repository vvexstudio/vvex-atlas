import Link from "next/link";
import { Icon } from "@/components/ui/icons";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const error = params.error as string | undefined;
  const email = params.email as string | undefined;
  const callbackUrl = (params.callbackUrl as string) || "/";

  // Build OAuth redirect login URL
  const loginUrl = `/api/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  // Determine error messages
  let errorMessage = "";
  let errorTitle = "";
  if (error) {
    if (error === "unauthorized") {
      errorTitle = "Access Restricted";
      errorMessage = email
        ? `The email address "${email}" is not registered in our approved list. Please contact an administrator to request access.`
        : "Your email address is not registered in our approved list. Please contact an administrator to request access.";
    } else if (error === "config-missing") {
      errorTitle = "Configuration Error";
      errorMessage = "Google OAuth is not configured on this server. Please check the environment variables.";
    } else {
      errorTitle = "Authentication Failed";
      errorMessage = "An error occurred during sign-in. Please try again. Code: " + error;
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--bg)",
        backgroundImage: "radial-gradient(circle at 10% 20%, color-mix(in srgb, var(--accent) 15%, transparent) 0%, transparent 40%), radial-gradient(circle at 90% 80%, color-mix(in srgb, var(--accent) 15%, transparent) 0%, transparent 40%)",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "var(--ink)",
        padding: "1rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative Blur Spheres */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "5%",
          width: "250px",
          height: "250px",
          borderRadius: "50%",
          backgroundColor: "var(--accent)",
          filter: "blur(120px)",
          opacity: 0.3,
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          right: "5%",
          width: "300px",
          height: "300px",
          borderRadius: "50%",
          backgroundColor: "var(--accent)",
          filter: "blur(120px)",
          opacity: 0.25,
          zIndex: 0,
        }}
      />

      {/* Main Glassmorphic Container */}
      <div
        style={{
          background: "var(--surface-raised)",
          backdropFilter: "blur(20px)",
          border: "1px solid var(--line)",
          borderRadius: "20px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)",
          padding: "3rem 2.5rem",
          maxWidth: "440px",
          width: "100%",
          textAlign: "center",
          zIndex: 1,
          animation: "fadeIn 0.6s ease-out",
        }}
      >
        {/* Brand / Logo */}
        <div style={{ marginBottom: "2rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "var(--accent)",
              boxShadow: "0 0 20px color-mix(in srgb, var(--accent) 40%, transparent)",
              marginBottom: "1rem",
              color: "var(--accent-ink)",
            }}
          >
            <Icon name="loader" size={28} className="spin" />
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: "1.75rem",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              background: "linear-gradient(to right, var(--ink), var(--accent))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Access The Portal
          </h1>
          <p style={{ margin: "0.5rem 0 0", color: "var(--muted)", fontSize: "0.925rem" }}>
            Interactive Map & Run-of-Show Dashboard
          </p>
        </div>

        {/* Informative description */}
        <p style={{ fontSize: "0.875rem", color: "var(--muted)", lineHeight: "1.5rem", marginBottom: "2rem" }}>
          This dashboard contains internal scheduling and location details. Access requires email verification from our approved directory.
        </p>

        {/* Error Alert Display */}
        {error && (
          <div
            style={{
              backgroundColor: "var(--danger-soft)",
              border: "1px solid var(--danger)",
              borderRadius: "10px",
              padding: "1rem",
              marginBottom: "1.5rem",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", marginBottom: "0.35rem" }}>
              <span style={{ marginRight: "0.5rem", display: "inline-flex", color: "var(--danger)" }}><Icon name="warning" size={14} /></span>
              <strong style={{ color: "var(--danger)", fontSize: "0.875rem" }}>{errorTitle}</strong>
            </div>
            <p style={{ margin: "0 0 0.75rem 0", color: "var(--danger)", fontSize: "0.825rem", lineHeight: "1.25rem" }}>
              {errorMessage}
            </p>
            {error === "unauthorized" && (
              <Link
                href="/?role=public"
                style={{
                  display: "inline-block",
                  fontSize: "0.825rem",
                  fontWeight: 600,
                  color: "var(--ink)",
                  textDecoration: "underline",
                }}
              >
                Explore Public Schedule as Guest →
              </Link>
            )}
          </div>
        )}

        {/* Sign In Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <style dangerouslySetInnerHTML={{ __html: `
            .google-signin-btn {
              transition: transform 0.2s, box-shadow 0.2s;
            }
            .google-signin-btn:hover {
              transform: translateY(-1px);
              box-shadow: 0 6px 12px rgba(255, 255, 255, 0.15) !important;
            }
            .public-signin-btn:hover {
              background-color: var(--surface) !important;
              border-color: var(--accent) !important;
            }
            .admin-gate-link {
              transition: color 0.2s;
            }
            .admin-gate-link:hover {
              color: var(--accent) !important;
            }
          ` }} />
          <a
            href={loginUrl}
            className="google-signin-btn"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              backgroundColor: "var(--surface-raised)",
              color: "var(--ink)",
              border: "none",
              borderRadius: "10px",
              padding: "0.875rem",
              fontSize: "0.95rem",
              fontWeight: 600,
              textDecoration: "none",
              cursor: "pointer",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7v2.24h2.9c1.7-1.57 2.69-3.87 2.69-6.57z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.8 5.96-2.2l-2.9-2.24c-.8.54-1.84.87-3.06.87-2.35 0-4.34-1.58-5.05-3.72H.9v2.32C2.39 15.98 5.46 18 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.95 10.71a5.41 5.41 0 0 1 0-3.42V4.97H.9a8.99 8.99 0 0 0 0 8.06l3.05-2.32z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15 2.05C13.47.63 11.43 0 9 0 5.46 0 2.39 2.02.9 4.97l3.05 2.32C4.66 5.16 6.65 3.58 9 3.58z"
              />
            </svg>
            Sign in with Google (Crew Access)
          </a>

          <Link
            href="/?role=public"
            className="public-signin-btn"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              backgroundColor: "transparent",
              color: "var(--ink)",
              border: "1px solid var(--line)",
              borderRadius: "10px",
              padding: "0.875rem",
              fontSize: "0.9rem",
              fontWeight: 500,
              textDecoration: "none",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <Icon name="externalLink" size={16} />
            Continue to Public Map & Schedule (No Login) →
          </Link>
          
          <div style={{ marginTop: "1rem", borderTop: "1px solid var(--line)", paddingTop: "0.875rem" }}>
            <Link
              href="/admin"
              className="admin-gate-link"
              style={{
                fontSize: "0.825rem",
                color: "var(--muted)",
                textDecoration: "none",
              }}
            >
              <Icon name="lock" size={12} /> Administrative Login Gate
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
