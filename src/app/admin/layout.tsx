import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ backgroundColor: "white", padding: "1rem 2rem", boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>The Portal — Admin</h2>
          <nav style={{ display: "flex", gap: "1.5rem" }}>
            <Link 
              href="/admin" 
              style={{ color: "#4b5563", textDecoration: "none", fontWeight: 600, fontSize: "0.95rem" }}
            >
              📍 Local Pins
            </Link>
            <Link 
              href="/admin/approved-emails" 
              style={{ color: "#4b5563", textDecoration: "none", fontWeight: 600, fontSize: "0.95rem" }}
            >
              ✉️ Approved Emails
            </Link>
          </nav>
        </div>
        <Link href="/" style={{ color: "#6b7280", textDecoration: "none" }}>Back to Map</Link>
      </header>
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>
        {children}
      </main>
    </div>
  );
}

