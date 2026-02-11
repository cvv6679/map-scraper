"use client";

import { useEffect, useMemo, useState } from "react";

export default function Home() {
  const [keywords, setKeywords] = useState("plumber\ndentist");
  const [locations, setLocations] = useState("New York, NY\nLos Angeles, CA");
  const [limit, setLimit] = useState(40);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  async function refreshJobs() {
    const res = await fetch("/api/jobs");
    const data = await res.json();
    setJobs(data.jobs || []);
  }

  useEffect(() => {
    refreshJobs();
    const t = setInterval(refreshJobs, 3000);
    return () => clearInterval(t);
  }, []);

  const stats = useMemo(() => {
    const total = jobs.length;
    const by = { pending: 0, running: 0, completed: 0, failed: 0 };
    for (const j of jobs) by[j.status] = (by[j.status] || 0) + 1;
    return { total, ...by };
  }, [jobs]);

  async function createJobs() {
    setLoading(true);
    try {
      const res = await fetch("/api/jobs/create-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords,
          locations,
          limit: Number(limit)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await refreshJobs();
      alert(`Created ${data.created} jobs`);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 5 }}>Google Maps Scraper (Background)</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Bulk keyword + location jobs. Worker runs in background and saves results in Postgres.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <h3>Keywords (1 per line)</h3>
          <textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            rows={10}
            style={{ width: "100%", padding: 10 }}
          />
        </div>

        <div>
          <h3>Locations (1 per line)</h3>
          <textarea
            value={locations}
            onChange={(e) => setLocations(e.target.value)}
            rows={10}
            style={{ width: "100%", padding: 10 }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14 }}>
        <label>
          Results per search:
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            style={{ marginLeft: 8, width: 90, padding: 6 }}
            min={5}
            max={200}
          />
        </label>

        <button
          onClick={createJobs}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #333",
            cursor: "pointer"
          }}
        >
          {loading ? "Creating..." : "Create Jobs + Start Scraping"}
        </button>

        <button
          onClick={refreshJobs}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #333",
            cursor: "pointer"
          }}
        >
          Refresh
        </button>
      </div>

      <hr style={{ margin: "18px 0" }} />

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Stat label="Total" value={stats.total} />
        <Stat label="Pending" value={stats.pending} />
        <Stat label="Running" value={stats.running} />
        <Stat label="Completed" value={stats.completed} />
        <Stat label="Failed" value={stats.failed} />
      </div>

      <h2 style={{ marginTop: 18 }}>Jobs</h2>

      <div style={{ overflowX: "auto" }}>
        <table cellPadding="10" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th>Keyword</th>
              <th>Location</th>
              <th>Status</th>
              <th>Found</th>
              <th>Created</th>
              <th>Download</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{j.keyword}</td>
                <td>{j.location}</td>
                <td>{j.status}</td>
                <td>{j.total_found ?? "-"}</td>
                <td>{new Date(j.created_at).toLocaleString()}</td>
                <td>
                  {j.status === "completed" ? (
                    <a href={`/api/jobs/${j.id}/download`} target="_blank">
                      CSV
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        padding: 12,
        borderRadius: 14,
        minWidth: 120
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
