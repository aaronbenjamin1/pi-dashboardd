"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

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

function badgeStyle(kind: "neutral" | "good" | "warn" | "bad") {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 650,
    border: "1px solid",
    userSelect: "none",
    whiteSpace: "nowrap",
  };

  if (kind === "good")
    return { ...base, background: "#eefbf1", borderColor: "#c8eed2", color: "#156b2d" };
  if (kind === "warn")
    return { ...base, background: "#fff7ed", borderColor: "#fed7aa", color: "#7c3e0a" };
  if (kind === "bad")
    return { ...base, background: "#fff1f2", borderColor: "#fecdd3", color: "#9f1239" };
  return { ...base, background: "#f6f7f9", borderColor: "#e5e7eb", color: "#374151" };
}

function severityKind(sev: string | null): "neutral" | "good" | "warn" | "bad" {
  if (!sev) return "neutral";
  if (sev === "fatal") return "bad";
  if (sev === "serious_injury") return "warn";
  if (sev === "injury") return "good";
  return "neutral";
}

function scoreKind(score: number | null): "neutral" | "good" | "warn" | "bad" {
  if (score == null) return "neutral";
  if (score >= 85) return "bad";
  if (score >= 70) return "warn";
  if (score >= 50) return "good";
  return "neutral";
}

async function fetchPagedFromViewOrArticles(params: {
  minScore: number;
  severity: string;
  caseType: string;
  page: number; // 1-based
}) {
  const supabase = getSupabase();

  // During Vercel build / SSR, supabase is null — return empty (prevents prerender failure)
  if (!supabase) {
    return { data: [] as Row[], count: 0, source: "v_triage_live" as const };
  }

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

type SortKey = "triaged_at" | "lead_score";
type SortDir = "asc" | "desc";

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

  // Sorting (client-side within the current page)
  const [sortKey, setSortKey] = useState<SortKey>("triaged_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  function toggleScoreSort() {
    if (sortKey !== "lead_score") {
      setSortKey("lead_score");
      setSortDir("desc");
      return;
    }
    setSortDir((d) => (d === "desc" ? "asc" : "desc"));
  }

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();

    const searched = !s
      ? rows
      : rows.filter((r) => {
          const hay = `${r.title ?? ""} ${r.publisher_domain ?? ""} ${(r.triage_reasons ?? []).join(
            " "
          )} ${(r.people ?? []).join(" ")}`.toLowerCase();
          return hay.includes(s);
        });

    const sorted = [...searched].sort((a, b) => {
      if (sortKey === "lead_score") {
        const av = a.lead_score ?? -Infinity;
        const bv = b.lead_score ?? -Infinity;
        return sortDir === "asc" ? av - bv : bv - av;
      }

      const at = a.triaged_at ? new Date(a.triaged_at).getTime() : -Infinity;
      const bt = b.triaged_at ? new Date(b.triaged_at).getTime() : -Infinity;
      return sortDir === "asc" ? at - bt : bt - at;
    });

    return sorted;
  }, [rows, search, sortKey, sortDir]);

  const fromShown = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toShown = Math.min(page * PAGE_SIZE, totalCount);

  const scoreArrow = sortKey === "lead_score" ? (sortDir === "asc" ? "▲" : "▼") : "";
  const triageArrow = sortKey === "triaged_at" ? (sortDir === "asc" ? "▲" : "▼") : "";

  const container: React.CSSProperties = {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #f7f8fb 0%, #ffffff 55%)",
    padding: "28px 16px",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    color: "#111827",
  };

  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    boxShadow: "0 6px 24px rgba(17, 24, 39, 0.06)",
  };

  const subtle: React.CSSProperties = { color: "#6b7280" };

  return (
    <div style={container}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 28, letterSpacing: -0.3 }}>PI Lead Monitor</h1>
              <span style={badgeStyle("neutral")}>
                Source: <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{source ?? "…"}</code>
              </span>
              <span style={badgeStyle(autoRefresh ? "good" : "neutral")}>
                {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
              </span>
              <span style={badgeStyle("neutral")}>Page size: {PAGE_SIZE}</span>
            </div>
            <div style={{ marginTop: 6, ...subtle, fontSize: 13 }}>
              {loading ? "Loading…" : `Showing ${fromShown}–${toShown} of ${totalCount} total (this page: ${filtered.length})`}
              {sortKey === "lead_score" ? ` • Sorted by score ${sortDir}` : ` • Sorted by triaged_at ${sortDir}`}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={load}
              style={{
                border: "1px solid #e5e7eb",
                background: "#fff",
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 650,
                cursor: "pointer",
              }}
            >
              Refresh
            </button>

            <label style={{ display: "flex", gap: 8, alignItems: "center", ...subtle, fontSize: 13 }}>
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              Auto-refresh
            </label>
          </div>
        </div>

        {/* Filters */}
        <div style={{ marginTop: 16, padding: 14, ...card }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ ...subtle, fontSize: 12, fontWeight: 650 }}>Min score</div>
              <input
                type="number"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                style={{
                  width: 120,
                  padding: "10px 10px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ ...subtle, fontSize: 12, fontWeight: 650 }}>Severity</div>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                style={{
                  minWidth: 190,
                  padding: "10px 10px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                }}
              >
                {SEVERITIES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ ...subtle, fontSize: 12, fontWeight: 650 }}>Case type</div>
              <select
                value={caseType}
                onChange={(e) => setCaseType(e.target.value as any)}
                style={{
                  minWidth: 190,
                  padding: "10px 10px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                }}
              >
                {CASE_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: "1 1 320px", display: "grid", gap: 6 }}>
              <div style={{ ...subtle, fontSize: 12, fontWeight: 650 }}>Search (this page)</div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="title, publisher, reasons, names…"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {err && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                border: "1px solid #fecdd3",
                background: "#fff1f2",
                color: "#9f1239",
                fontWeight: 650,
              }}
            >
              Error: <span style={{ fontWeight: 500 }}>{err}</span>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            style={{
              border: "1px solid #e5e7eb",
              background: page <= 1 || loading ? "#f3f4f6" : "#fff",
              padding: "10px 12px",
              borderRadius: 12,
              cursor: page <= 1 || loading ? "not-allowed" : "pointer",
              fontWeight: 650,
            }}
          >
            ← Prev
          </button>

          <div style={{ ...subtle, fontSize: 13 }}>
            Page <strong style={{ color: "#111827" }}>{page}</strong> of{" "}
            <strong style={{ color: "#111827" }}>{totalPages}</strong> • Showing{" "}
            <strong style={{ color: "#111827" }}>{fromShown}</strong>–<strong style={{ color: "#111827" }}>{toShown}</strong>{" "}
            of <strong style={{ color: "#111827" }}>{totalCount}</strong>
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            style={{
              border: "1px solid #e5e7eb",
              background: page >= totalPages || loading ? "#f3f4f6" : "#fff",
              padding: "10px 12px",
              borderRadius: 12,
              cursor: page >= totalPages || loading ? "not-allowed" : "pointer",
              fontWeight: 650,
            }}
          >
            Next →
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ ...subtle, fontSize: 13 }}>Jump:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={page}
              onChange={(e) => setPage(Math.max(1, Math.min(totalPages, Number(e.target.value) || 1)))}
              style={{
                width: 96,
                padding: "10px 10px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "#fff",
              }}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ marginTop: 14, ...card, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th
                    onClick={toggleScoreSort}
                    title="Click to sort by score"
                    style={{
                      position: "sticky",
                      top: 0,
                      background: "#ffffff",
                      borderBottom: "1px solid #e5e7eb",
                      padding: "12px 14px",
                      textAlign: "left",
                      cursor: "pointer",
                      userSelect: "none",
                      fontSize: 12,
                      letterSpacing: 0.2,
                      color: "#374151",
                      whiteSpace: "nowrap",
                      zIndex: 1,
                    }}
                  >
                    Score {scoreArrow}
                  </th>

                  {["Severity", "Type", "Title", "Publisher", "Names", `Triaged ${triageArrow}`, "URL", "Reasons"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          position: "sticky",
                          top: 0,
                          background: "#ffffff",
                          borderBottom: "1px solid #e5e7eb",
                          padding: "12px 14px",
                          textAlign: "left",
                          fontSize: 12,
                          letterSpacing: 0.2,
                          color: "#374151",
                          whiteSpace: "nowrap",
                          zIndex: 1,
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: 18, color: "#6b7280" }}>
                      No matching rows.
                    </td>
                  </tr>
                )}

                {filtered.map((r, idx) => {
                  const zebra = idx % 2 === 0 ? "#ffffff" : "#fafafa";
                  return (
                    <tr
                      key={r.id}
                      style={{
                        background: zebra,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = "#f5f7ff";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = zebra;
                      }}
                    >
                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7" }}>
                        <span style={badgeStyle(scoreKind(r.lead_score))}>{r.lead_score ?? "—"}</span>
                      </td>

                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7" }}>
                        <span style={badgeStyle(severityKind(r.severity))}>{r.severity ?? "—"}</span>
                      </td>

                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7", color: "#374151" }}>
                        {r.case_type ?? "—"}
                      </td>

                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7", maxWidth: 560 }}>
                        {r.url ? (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "#111827", textDecoration: "none", fontWeight: 650 }}
                          >
                            {r.title ?? "(no title)"}
                          </a>
                        ) : (
                          <span style={{ fontWeight: 650 }}>{r.title ?? "(no title)"}</span>
                        )}
                        {r.title && (
                          <div style={{ marginTop: 4, color: "#6b7280", fontSize: 12 }}>
                            {(r.triage_reasons ?? []).slice(0, 2).join(" • ")}
                            {(r.triage_reasons ?? []).length > 2 ? " • …" : ""}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7", color: "#374151" }}>
                        {r.publisher_domain ?? "—"}
                      </td>

                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7", maxWidth: 280 }}>
                        <div style={{ color: "#374151" }}>{fmtPeople(r.people) || "—"}</div>
                      </td>

                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7", whiteSpace: "nowrap" }}>
                        <div style={{ color: "#111827", fontWeight: 650, fontSize: 13 }}>{fmtTime(r.triaged_at) || "—"}</div>
                      </td>

                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7", maxWidth: 280 }}>
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noreferrer" style={{ color: "#6b7280", fontSize: 12 }}>
                            {shortUrl(r.url)}
                          </a>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7", maxWidth: 520 }}>
                        <div style={{ color: "#374151" }}>{(r.triage_reasons ?? []).join(", ") || "—"}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 12, color: "#6b7280", fontSize: 12 }}>
          Note: Search + sort are client-side for the current page only. Move them into the Supabase query for global sort/search.
        </div>
      </div>
    </div>
  );
}
