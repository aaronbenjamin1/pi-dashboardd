"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Row = {
  id: string;
  url: string | null;
  title: string | null;
  publisher_domain: string | null;
  people: string[] | null;
  severity: string | null;
  case_type: string | null;
  lead_score: number | null;
  triage_reasons: string[] | null;
  triaged_at: string | null;
  ingested_at: string | null;
  status: string | null;
};

const SEVERITIES = ["all", "fatal", "serious_injury", "injury", "unknown"] as const;
const CASE_TYPES = ["all", "truck", "pedestrian", "auto", "motorcycle", "unknown"] as const;

const PAGE_SIZE = 50;

function fmtTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString();
}

function fmtPeople(p: string[] | null) {
  if (!p || p.length === 0) return "";
  const max = 4;
  const shown = p.slice(0, max);
  const extra = p.length > max ? ` +${p.length - max}` : "";
  return shown.join(", ") + extra;
}

function shortUrl(u: string | null) {
  if (!u) return "";
  try {
    const url = new URL(u);
    const s = `${url.hostname}${url.pathname}`;
    return s.length > 60 ? s.slice(0, 60) + "…" : s;
  } catch {
    return u.length > 60 ? u.slice(0, 60) + "…" : u;
  }
}

async function fetchPagedFromViewOrArticles(params: {
  minScore: number;
  severity: string;
  caseType: string;
  page: number; // 1-based
}) {
  const { minScore, severity, caseType, page } = params;

  const selectCols =
    "id,url,title,publisher_domain,people,severity,case_type,lead_score,triage_reasons,triaged_at,ingested_at,status";

  const fromIdx = (page - 1) * PAGE_SIZE;
  const toIdx = fromIdx + PAGE_SIZE - 1;

  // 1) Try view
  let q1 = supabase
    .from("v_triage_live")
    .select(selectCols, { count: "exact" })
    .order("triaged_at", { ascending: false })
    .range(fromIdx, toIdx);

  if (minScore > 0) q1 = q1.gte("lead_score", minScore);
  if (severity !== "all") q1 = q1.eq("severity", severity);
  if (caseType !== "all") q1 = q1.eq("case_type", caseType);

  const r1 = await q1;
  if (!r1.error) {
    return {
      data: (r1.data as Row[]) ?? [],
      count: r1.count ?? 0,
      source: "v_triage_live" as const,
    };
  }

  // 2) Fallback: articles directly
  let q2 = supabase
    .from("articles")
    .select(selectCols, { count: "exact" })
    .not("triaged_at", "is", null)
    .order("triaged_at", { ascending: false })
    .range(fromIdx, toIdx);

  if (minScore > 0) q2 = q2.gte("lead_score", minScore);
  if (severity !== "all") q2 = q2.eq("severity", severity);
  if (caseType !== "all") q2 = q2.eq("case_type", caseType);

  const r2 = await q2;
  if (r2.error) {
    throw new Error(`View error: ${r1.error.message} | Articles error: ${r2.error.message}`);
  }

  return {
    data: (r2.data as Row[]) ?? [],
    count: r2.count ?? 0,
    source: "articles" as const,
  };
}

export default function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [source, setSource] = useState<"v_triage_live" | "articles" | null>(null);

  // Filters
  const [minScore, setMinScore] = useState<number>(70);
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("all");
  const [caseType, setCaseType] = useState<(typeof CASE_TYPES)[number]>("all");
  const [search, setSearch] = useState<string>("");

  // Pagination
  const [page, setPage] = useState<number>(1);

  // Refresh
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetchPagedFromViewOrArticles({ minScore, severity, caseType, page });
      setRows(res.data);
      setTotalCount(res.count);
      setSource(res.source);

      // If filters changed and current page is now out of range, snap back
      const newTotalPages = Math.max(1, Math.ceil((res.count ?? 0) / PAGE_SIZE));
      if (page > newTotalPages) setPage(1);
    } catch (e: any) {
      setRows([]);
      setTotalCount(0);
      setErr(e?.message ?? "Unknown error");
      setSource(null);
    } finally {
      setLoading(false);
    }
  }

  // When filters change, reset to page 1
  useEffect(() => {
    setPage(1);
  }, [minScore, severity, caseType]);

  // Load when filters or page change
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minScore, severity, caseType, page]);

  // Auto-refresh current page
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, minScore, severity, caseType, page]);

  // Client-side search (within the 50 rows on the page)
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const hay = `${r.title ?? ""} ${r.publisher_domain ?? ""} ${(r.triage_reasons ?? []).join(" ")} ${(r.people ?? []).join(
        " "
      )}`.toLowerCase();
      return hay.includes(s);
    });
  }, [rows, search]);

  const fromShown = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toShown = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ margin: 0 }}>PI Lead Monitor</h1>
      <p style={{ marginTop: 6, color: "#666" }}>
        Source: <code>{source ?? "…"}</code> • Page size: {PAGE_SIZE} • Auto-refresh: {autoRefresh ? "ON" : "OFF"}
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14, alignItems: "center" }}>
        <label>
          Min score{" "}
          <input
            type="number"
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            style={{ width: 90 }}
          />
        </label>

        <label>
          Severity{" "}
          <select value={severity} onChange={(e) => setSeverity(e.target.value as any)}>
            {SEVERITIES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label>
          Case type{" "}
          <select value={caseType} onChange={(e) => setCaseType(e.target.value as any)}>
            {CASE_TYPES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label style={{ flex: "1 1 260px" }}>
          Search (this page){" "}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="title, publisher, reasons, names..."
            style={{ width: "100%", maxWidth: 420 }}
          />
        </label>

        <button onClick={load} style={{ padding: "6px 10px" }}>
          Refresh now
        </button>

        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
          Auto-refresh
        </label>
      </div>

      {/* Pagination controls */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || loading}
          style={{ padding: "6px 10px" }}
        >
          ← Prev
        </button>

        <div style={{ color: "#666" }}>
          Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          {" • "}
          Showing <strong>{fromShown}</strong>–<strong>{toShown}</strong> of <strong>{totalCount}</strong>
        </div>

        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages || loading}
          style={{ padding: "6px 10px" }}
        >
          Next →
        </button>

        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          Jump to page{" "}
          <input
            type="number"
            min={1}
            max={totalPages}
            value={page}
            onChange={(e) => setPage(Math.max(1, Math.min(totalPages, Number(e.target.value) || 1)))}
            style={{ width: 90 }}
          />
        </label>
      </div>

      {err && (
        <div style={{ marginTop: 14, color: "crimson" }}>
          <strong>Error:</strong> {err}
        </div>
      )}

      <div style={{ marginTop: 14, color: "#666" }}>
        {loading ? "Loading..." : `Fetched ${rows.length} rows for this page. Displaying ${filtered.length} after search filter.`}
      </div>

      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <table cellPadding={10} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th>Score</th>
              <th>Severity</th>
              <th>Type</th>
              <th>Title</th>
              <th>Publisher</th>
              <th>Names</th>
              <th>Triaged</th>
              <th>URL</th>
              <th>Reasons</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                <td style={{ fontWeight: 700 }}>{r.lead_score ?? ""}</td>
                <td>{r.severity ?? ""}</td>
                <td>{r.case_type ?? ""}</td>

                <td style={{ maxWidth: 520 }}>
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer">
                      {r.title ?? "(no title)"}
                    </a>
                  ) : (
                    r.title ?? "(no title)"
                  )}
                </td>

                <td>{r.publisher_domain ?? ""}</td>

                <td style={{ maxWidth: 260, color: "#444" }}>{fmtPeople(r.people)}</td>

                <td>{fmtTime(r.triaged_at)}</td>

                <td style={{ maxWidth: 260 }}>
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer" style={{ color: "#888" }}>
                      {shortUrl(r.url)}
                    </a>
                  ) : (
                    ""
                  )}
                </td>

                <td style={{ maxWidth: 420, color: "#555" }}>{(r.triage_reasons ?? []).join(", ")}</td>
              </tr>
            ))}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ color: "#666" }}>
                  No matching rows.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, color: "#666", fontSize: 12 }}>
        Note: “Search” filters only the current page. If you want search across all records, we’ll move search to the Supabase query.
      </div>
    </div>
  );
}
