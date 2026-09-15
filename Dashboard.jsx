import React, { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");

      if (!token) {
        setError("Please login first.");
        return;
      }

      const response = await fetch(`${API_URL}/api/dashboard`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load dashboard");
      }

      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const copyApiKey = async () => {
    if (!data?.user?.api_key) return;

    await navigator.clipboard.writeText(data.user.api_key);
    setCopied(true);

    setTimeout(() => setCopied(false), 1800);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div style={styles.center}>
        <div style={styles.loader}></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.center}>
        <div style={styles.errorCard}>
          <h2>Dashboard Error</h2>
          <p>{error}</p>

          <button style={styles.button} onClick={loadDashboard}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const usage = data?.usage || {
    current: 0,
    limit: 100,
    percentage: 0,
  };

  const stats = data?.stats || {
    valid: 0,
    invalid: 0,
    total: 0,
  };

  const percentage = Math.min(
    Number(usage.percentage || 0),
    100
  );

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>
            EmailVerify API
          </h1>

          <p style={styles.subtitle}>
            Email verification dashboard
          </p>
        </div>

        <button
          style={styles.logoutButton}
          onClick={logout}
        >
          Logout
        </button>
      </header>

      <main style={styles.container}>

        {/* Welcome */}
        <section style={styles.welcomeCard}>
          <div>
            <p style={styles.mutedWhite}>
              Welcome back
            </p>

            <h2 style={styles.welcome}>
              {data?.user?.name || "User"} 👋
            </h2>

            <p style={styles.email}>
              {data?.user?.email}
            </p>
          </div>

          <div style={styles.tierBadge}>
            {String(
              data?.user?.tier || "free"
            ).toUpperCase()}
          </div>
        </section>

        {/* Stats */}
        <section style={styles.grid}>

          <StatCard
            title="Total Verifications"
            value={stats.total}
            icon="📊"
          />

          <StatCard
            title="Valid Emails"
            value={stats.valid}
            icon="✅"
          />

          <StatCard
            title="Invalid Emails"
            value={stats.invalid}
            icon="❌"
          />

          <StatCard
            title="Monthly Usage"
            value={`${usage.current} / ${usage.limit}`}
            icon="⚡"
          />

        </section>

        {/* Usage */}
        <section style={styles.card}>

          <div style={styles.cardHeader}>

            <div>
              <h3 style={styles.cardTitle}>
                API Usage
              </h3>

              <p style={styles.muted}>
                Your current monthly verification usage
              </p>
            </div>

            <strong>
              {percentage.toFixed(1)}%
            </strong>

          </div>

          <div style={styles.progressBackground}>
            <div
              style={{
                ...styles.progress,
                width: `${percentage}%`,
              }}
            />
          </div>

          <div style={styles.usageFooter}>
            <span>
              {usage.current} used
            </span>

            <span>
              {usage.limit} monthly limit
            </span>
          </div>

        </section>

        {/* API Key */}
        <section style={styles.card}>

          <div style={styles.cardHeader}>

            <div>
              <h3 style={styles.cardTitle}>
                Your API Key
              </h3>

              <p style={styles.muted}>
                Use this key in the X-API-Key request header.
              </p>
            </div>

          </div>

          <div style={styles.apiKeyRow}>

            <code style={styles.apiKey}>
              {data?.user?.api_key || "No API key"}
            </code>

            <button
              style={styles.button}
              onClick={copyApiKey}
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>

          </div>

        </section>

        {/* API Example */}
        <section style={styles.card}>

          <h3 style={styles.cardTitle}>
            Quick API Example
          </h3>

          <pre style={styles.code}>
{`fetch("${API_URL}/api/verify-email", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "YOUR_API_KEY"
  },
  body: JSON.stringify({
    email: "user@example.com"
  })
});`}
          </pre>

        </section>

        {/* Recent Verifications */}
        <section style={styles.card}>

          <div style={styles.cardHeader}>

            <div>
              <h3 style={styles.cardTitle}>
                Recent Verifications
              </h3>

              <p style={styles.muted}>
                Latest verification activity
              </p>
            </div>

          </div>

          {data?.chart?.length ? (

            <div style={styles.logs}>

              {data.chart
                .slice(-10)
                .reverse()
                .map((item, index) => (

                  <div
                    style={styles.logRow}
                    key={`${item.date}-${index}`}
                  >

                    <span>
                      {item.date}
                    </span>

                    <span
                      style={{
                        ...styles.status,
                        ...(item.result === "valid"
                          ? styles.valid
                          : styles.invalid),
                      }}
                    >
                      {item.result}
                    </span>

                  </div>

                ))}

            </div>

          ) : (

            <p style={styles.muted}>
              No verification history yet.
            </p>

          )}

        </section>

      </main>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}) {
  return (
    <div style={styles.statCard}>

      <div style={styles.statIcon}>
        {icon}
      </div>

      <p style={styles.muted}>
        {title}
      </p>

      <h2 style={styles.statValue}>
        {value}
      </h2>

    </div>
  );
}

const styles = {

  page: {
    minHeight: "100vh",
    background: "#f6f7f9",
    color: "#111827",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },

  header: {
    background: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    padding: "18px 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },

  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
  },

  subtitle: {
    margin: "4px 0 0",
    color: "#6b7280",
    fontSize: 13,
  },

  container: {
    maxWidth: 1150,
    margin: "0 auto",
    padding: 28,
  },

  welcomeCard: {
    background: "#111827",
    color: "#ffffff",
    borderRadius: 16,
    padding: 26,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    boxShadow:
      "0 10px 30px rgba(17,24,39,.10)",
  },

  welcome: {
    margin: "4px 0",
    fontSize: 28,
  },

  email: {
    margin: 0,
    color: "#cbd5e1",
  },

  muted: {
    color: "#6b7280",
    margin: "0 0 8px",
    fontSize: 13,
  },

  mutedWhite: {
    color: "#cbd5e1",
    margin: "0 0 8px",
    fontSize: 13,
  },

  tierBadge: {
    background: "#0ea5e9",
    color: "#ffffff",
    padding: "9px 14px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 16,
    marginBottom: 20,
  },

  statCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 20,
    boxShadow:
      "0 5px 18px rgba(17,24,39,.05)",
  },

  statIcon: {
    fontSize: 22,
    marginBottom: 14,
  },

  statValue: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
  },

  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 22,
    marginBottom: 18,
    boxShadow:
      "0 5px 18px rgba(17,24,39,.04)",
  },

  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 15,
    marginBottom: 16,
  },

  cardTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 750,
  },

  progressBackground: {
    width: "100%",
    height: 10,
    background: "#e5e7eb",
    borderRadius: 999,
    overflow: "hidden",
  },

  progress: {
    height: "100%",
    background: "#0ea5e9",
    borderRadius: 999,
    transition: "width .4s ease",
  },

  usageFooter: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 9,
    fontSize: 12,
    color: "#6b7280",
  },

  apiKeyRow: {
    display: "flex",
    gap: 10,
    alignItems: "stretch",
  },

  apiKey: {
    flex: 1,
    background: "#f3f4f6",
    border: "1px solid #e5e7eb",
    borderRadius: 9,
    padding: "12px 14px",
    overflowX: "auto",
    whiteSpace: "nowrap",
  },

  button: {
    border: 0,
    borderRadius: 9,
    background: "#0ea5e9",
    color: "#ffffff",
    padding: "0 18px",
    fontWeight: 700,
    cursor: "pointer",
  },

  logoutButton: {
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#374151",
    borderRadius: 9,
    padding: "9px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },

  code: {
    background: "#111827",
    color: "#e5e7eb",
    borderRadius: 10,
    padding: 18,
    overflowX: "auto",
    fontSize: 13,
    lineHeight: 1.6,
  },

  logs: {
    display: "flex",
    flexDirection: "column",
  },

  logRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #f0f0f0",
    fontSize: 14,
  },

  status: {
    padding: "5px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
  },

  valid: {
    background: "#dcfce7",
    color: "#166534",
  },

  invalid: {
    background: "#fee2e2",
    color: "#991b1b",
  },

  center: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#f6f7f9",
    fontFamily: "Inter, system-ui, sans-serif",
  },

  errorCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 28,
    maxWidth: 420,
    width: "90%",
    textAlign: "center",
  },

  loader: {
    width: 36,
    height: 36,
    border: "4px solid #e5e7eb",
    borderTop: "4px solid #0ea5e9",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
};
