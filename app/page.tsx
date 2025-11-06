"use client";

import { useMemo, useState } from "react";

type Account = {
  handle: string;
  name: string | null;
  followers: number | null;
  averageViews: number | null;
  category: string | null;
  engagementRate: number | null; // 0..1
  location: string | null;
  error?: string | null;
};

function formatNumber(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "?";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function toCsv(rows: Account[]): string {
  const headers = [
    "Name",
    "Handle",
    "Followers",
    "Average Views",
    "Category",
    "Engagement Rate",
    "Location",
    "Error",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const vals = [
      r.name ?? "",
      r.handle,
      r.followers ?? "",
      r.averageViews ?? "",
      r.category ?? "",
      r.engagementRate != null ? (r.engagementRate * 100).toFixed(2) + "%" : "",
      r.location ?? "",
      r.error ?? "",
    ]
      .map((v) => String(v).replaceAll('"', '""'))
      .map((v) => `"${v}` + `"`);
    lines.push(vals.join(","));
  }
  return lines.join("\n");
}

export default function Page() {
  const [handlesInput, setHandlesInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Account[]>([]);
  const [sortBy, setSortBy] = useState<keyof Account>("followers");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = (a[sortBy] as any) ?? -Infinity;
      const bv = (b[sortBy] as any) ?? -Infinity;
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortBy, sortDir]);

  async function analyze() {
    const raw = handlesInput
      .split(/[\n,\s]+/)
      .map((h) => h.trim().replace(/^@/, ""))
      .filter(Boolean);
    if (raw.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handles: raw }),
      });
      const json = (await res.json()) as { accounts: Account[] };
      setRows(json.accounts);
    } catch (e) {
      console.error(e);
      alert("Failed to analyze. Please try again later.");
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv() {
    const csv = toCsv(sortedRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "instagram-analysis.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onHeaderClick(key: keyof Account) {
    if (sortBy === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  }

  return (
    <div className="page">
      <section className="card">
        <label htmlFor="handles">Instagram handles</label>
        <textarea
          id="handles"
          rows={3}
          placeholder="e.g. @instagram, nasa, natgeo (comma or newline separated)"
          value={handlesInput}
          onChange={(e) => setHandlesInput(e.target.value)}
        />
        <div className="actions">
          <button onClick={analyze} disabled={loading}>
            {loading ? "Analyzing..." : "Analyze"}
          </button>
          <button onClick={downloadCsv} disabled={rows.length === 0} className="secondary">
            Export CSV
          </button>
        </div>
      </section>

      <section className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th onClick={() => onHeaderClick("name")}>Name</th>
              <th onClick={() => onHeaderClick("handle")}>Handle</th>
              <th onClick={() => onHeaderClick("followers")}>Followers</th>
              <th onClick={() => onHeaderClick("averageViews")}>Avg Views</th>
              <th onClick={() => onHeaderClick("category")}>Category</th>
              <th onClick={() => onHeaderClick("engagementRate")}>Engagement</th>
              <th onClick={() => onHeaderClick("location")}>Location</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr key={r.handle}>
                <td>{r.name ?? "?"}</td>
                <td>@{r.handle}</td>
                <td>{formatNumber(r.followers)}</td>
                <td>{formatNumber(r.averageViews)}</td>
                <td>{r.category ?? "?"}</td>
                <td>
                  {r.engagementRate != null
                    ? (r.engagementRate * 100).toFixed(2) + "%"
                    : "?"}
                </td>
                <td>{r.location ?? "?"}</td>
                <td className="error">{r.error ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
