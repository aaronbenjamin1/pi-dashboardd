"use client";

import React, { useEffect, useMemo, useState } from "react";
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
const STATUSES = ["all", "new", "reviewing", "contacted", "done", "closed", "ignore"] as const;

const PAGE_SIZE = 50;

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

function fmtPeople(p: string[] | null) {
  if (!p || p.length === 0) return "—";
  const max = 5;
  const shown = p.slice(0, max);
  const extra = p.length > max ? ` +${p.length - max}` : "";
  return shown.join(", ") + extra;
}

function shortUrl(u: string | null) {
  if (!u) return "—";
  try {
    const url = new URL(u);
    const s = `${url.hostname}${url.pathname}`;
    return s.length > 70 ? s.slice(0, 70) + "…" : s;
  } catch {
    return u.length > 70 ? u.slice(0, 70) + "…" : u;
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
    fontWeight: 700,
    border: "1px solid",
    userSelect: "none",
    whiteSpace: "nowrap",
    lineHeight: 1.2,
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

function statusKind(status: string | null): "neutral" | "good" | "warn" | "bad" {
  if (!status) return "neutral";
  const s = status.toLowerCase();
  if (s === "ignore" || s === "closed") return "neutral";
  if (s === "contacted" || s === "done") return "good";
  if (s === "reviewing") return "warn";
  if (s === "new") return "bad";
  return "neutral";
}

async function fetchPagedFromViewOrArticles(params: {
  minScore: number;
  severity: string;
  caseType: string;
  status: string;
  page: number; // 1-based
}) {
  const supabase = getSupabase();

  // During build/SSR, supabase may be null; return empty to avoid failure
  if (!supabase) {
    return { data: [] as Row[], count: 0, source: "v_triage_live" as const };
  }

  const { minScore, severity, caseType, status, page } = params;

  const selectCols =
    "id,url,title,publisher_domain,people,severity,case_type,lead_score,triage_reasons,triaged_at,ingested_at,status";

  const fromIdx = (page - 1) * PAGE_SIZE;
  const toIdx = fromIdx + PAGE_SIZE - 1;

  // 1) Try view first
  let q1 = supabase
    .from("v_triage_live")
    .select(selectCols, { count: "exact" })
    .order("triaged_at", { ascending: false })
    .range(fromIdx, toIdx);

  if (minScore > 0) q1 = q1.gte("lead_score", minScore);
  if (severity !== "all") q1 = q1.eq("severity", severity);
  if (caseType !== "all") q1 = q1.eq("case_type", caseType);
  if (status !== "all") q1 = q1.eq("status", status);

  const r1 = await q1;
  if (!r1.error) {
    return {
      data: (r1.data as Row[]) ?? [],
      count: r1.count ?? 0,
      source: "v_triage_live" as const,
    };
  }

  // 2) Fallback: articles
  let q2 = supabase
    .from("articles")
    .select(selectCols, { count: "exact" })
    .not("triaged_at", "is", null)
    .order("triaged_at", { ascending: false })
    .range(fromIdx, toIdx);

  if (minScore > 0) q2 = q2.gte("lead_score", minScore);
  if (severity !== "all") q2 = q2.eq("severity", severity);
  if (caseType !== "all") q2 = q2.eq("case_type", caseType);
  if (status !== "all") q2 = q2.eq("status", status);

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
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");

  // Debounced search
  const [searchInput, setSearchInput] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  // Pagination
  const [page, setPage] = useState<number>(1);

  // Refresh
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Sorting (client-side within current page)
  const [sortKey, setSortKey] = useState<SortKey>("triaged_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Expand row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetchPagedFromViewOrArticles({ minScore, severity, caseType, status, page });
      setRows(res.data);
      setTotalCount(res.count);
      setSource(res.source);

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

  // reset page on filter changes
  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [minScore, severity, caseType, status]);

  // load on dependency changes
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minScore, severity, caseType, status, page]);

  // auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, minScore, severity, caseType, status, page]);

  function toggleScoreSort() {
    if (sortKey !== "lead_score") {
      setSortKey("lead_score");
      setSortDir("desc");
      return;
    }
    setSortDir((d) => (d === "desc" ? "asc" : "desc"));
  }

  function toggleTriageSort() {
    if (sortKey !== "triaged_at") {
      setSortKey("triaged_at");
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
          )} ${(r.people ?? []).join(" ")} ${(r.status ?? "")}`.toLowerCase();
          return hay.includes(s);
        });

    return [...searched].sort((a, b) => {
      if (sortKey === "lead_score") {
        const av = a.lead_score ?? -Infinity;
        const bv = b.lead_score ?? -Infinity;
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const at = a.triaged_at ? new Date(a.triaged_at).getTime() : -Infinity;
      const bt = b.triaged_at ? new Date(b.triaged_at).getTime() : -Infinity;
      return sortDir === "asc" ? at - bt : bt - at;
    });
  }, [rows, search, sortKey, sortDir]);

  const fromShown = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toShown = Math.min(page * PAGE_SIZE, totalCount);

  const scoreArrow = sortKey === "lead_score" ? (sortDir === "asc" ? "▲" : "▼") : "";
  const triageArrow = sortKey === "triaged_at" ? (sortDir === "asc" ? "▲" : "▼") : "";

  const container: React.CSSProperties = {
    minHeight: "100vh",
    background: "radial-gradient(1200px 600px at 10% 0%, rgba(99, 102, 241, .12) 0%, rgba(255,255,255,0) 55%), linear-gradient(180deg, #f7f8fb 0%, #ffffff 55%)",
    padding: "28px 16px",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    color: "#111827",
  };

  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    boxShadow: "0 10px 30px rgba(17, 24, 39, 0.08)",
  };

  const subtle: React.CSSProperties = { color: "#6b7280" };

  const inputStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    outline: "none",
    background: "#fff",
  };

  const buttonStyle: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    background: "#fff",
    padding: "10px 12px",
    borderRadius: 12,
    fontWeight: 750,
    cursor: "pointer",
  };

  function copyToClipboard(text: string) {
    try {
      navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  return (
    <div style={container}>
      <div style={{ maxWidth: 1320, margin: "0 auto" }}>
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 28, letterSpacing: -0.4 }}>PI Lead Monitor</h1>

              <span style={badgeStyle("neutral")}>
                Source:{" "}
                <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                  {source ?? "…"}
                </code>
              </span>

              <span style={badgeStyle(autoRefresh ? "good" : "neutral")}>
                {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
              </span>

              <span style={badgeStyle("neutral")}>Page size: {PAGE_SIZE}</span>
            </div>

            <div style={{ marginTop: 6, ...subtle, fontSize: 13 }}>
              {loading
                ? "Loading…"
                : `Showing ${fromShown}–${toShown} of ${totalCount} total (this page: ${filtered.length})`}
              {sortKey === "lead_score" ? ` • Sorted by score ${sortDir}` : ` • Sorted by triaged_at ${sortDir}`}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={load} style={buttonStyle}>
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
              <div style={{ ...subtle, fontSize: 12, fontWeight: 750 }}>Min score</div>
              <input
                type="number"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                style={{ ...inputStyle, width: 120 }}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ ...subtle, fontSize: 12, fontWeight: 750 }}>Severity</div>
              <select value={severity} onChange={(e) => setSeverity(e.target.value as any)} style={{ ...inputStyle, minWidth: 190 }}>
                {SEVERITIES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ ...subtle, fontSize: 12, fontWeight: 750 }}>Case type</div>
              <select value={caseType} onChange={(e) => setCaseType(e.target.value as any)} style={{ ...inputStyle, minWidth: 190 }}>
                {CASE_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ ...subtle, fontSize: 12, fontWeight: 750 }}>Status</div>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} style={{ ...inputStyle, minWidth: 190 }}>
                {STATUSES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: "1 1 320px", display: "grid", gap: 6 }}>
              <div style={{ ...subtle, fontSize: 12, fontWeight: 750 }}>Search (this page)</div>
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="title, publisher, reasons, names, status…"
                style={{ ...inputStyle, width: "100%" }}
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
                fontWeight: 750,
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
              ...buttonStyle,
              background: page <= 1 || loading ? "#f3f4f6" : "#fff",
              cursor: page <= 1 || loading ? "not-allowed" : "pointer",
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
              ...buttonStyle,
              background: page >= totalPages || loading ? "#f3f4f6" : "#fff",
              cursor: page >= totalPages || loading ? "not-allowed" : "pointer",
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
              style={{ ...inputStyle, width: 96 }}
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

                  {["Severity", "Status", "Type", "Title", "Publisher", "Names"].map((h) => (
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
                  ))}

                  <th
                    onClick={toggleTriageSort}
                    title="Click to sort by triaged time"
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
                    Triaged {triageArrow}
                  </th>

                  {["URL", "Reasons"].map((h) => (
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
                  ))}
                </tr>
              </thead>

              <tbody>
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ padding: 18, color: "#6b7280" }}>
                      No matching rows.
                    </td>
                  </tr>
                )}

                {filtered.map((r, idx) => {
                  const zebra = idx % 2 === 0 ? "#ffffff" : "#fafafa";
                  const isExpanded = expandedId === r.id;

                  return (
                    <React.Fragment key={r.id}>
                      <tr
                        style={{
                          background: zebra,
                          cursor: "pointer",
                        }}
                        onClick={() => setExpandedId((cur) => (cur === r.id ? null : r.id))}
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

                        <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7" }}>
                          <span style={badgeStyle(statusKind(r.status))}>{r.status ?? "—"}</span>
                        </td>

                        <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7", color: "#374151" }}>
                          {r.case_type ?? "—"}
                        </td>

                        <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7", maxWidth: 640 }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                            {r.url ? (
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  color: "#111827",
                                  textDecoration: "none",
                                  fontWeight: 800,
                                  letterSpacing: -0.1,
                                }}
                              >
                                {r.title ?? "(no title)"}
                              </a>
                            ) : (
                              <span style={{ fontWeight: 800 }}>{r.title ?? "(no title)"}</span>
                            )}

                            <span style={{ ...subtle, fontSize: 12 }}>{isExpanded ? "▾" : "▸"}</span>
                          </div>

                          <div style={{ marginTop: 4, color: "#6b7280", fontSize: 12 }}>
                            {(r.triage_reasons ?? []).slice(0, 2).join(" • ")}
                            {(r.triage_reasons ?? []).length > 2 ? " • …" : ""}
                          </div>
                        </td>

                        <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7", color: "#374151" }}>
                          {r.publisher_domain ?? "—"}
                        </td>

                        <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7", maxWidth: 320 }}>
                          <div style={{ color: "#374151" }}>{fmtPeople(r.people)}</div>
                        </td>

                        <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7", whiteSpace: "nowrap" }}>
                          <div style={{ color: "#111827", fontWeight: 800, fontSize: 13 }}>{fmtTime(r.triaged_at)}</div>
                        </td>

                        <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7", maxWidth: 340 }}>
                          {r.url ? (
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: "#6b7280", fontSize: 12, textDecoration: "none" }}
                            >
                              {shortUrl(r.url)}
                            </a>
                          ) : (
                            <span style={{ color: "#9ca3af" }}>—</span>
                          )}
                        </td>

                        <td style={{ padding: "12px 14px", borderBottom: "1px solid #eef2f7", maxWidth: 560 }}>
                          <div style={{ color: "#374151" }}>{(r.triage_reasons ?? []).join(", ") || "—"}</div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={11} style={{ padding: 0, borderBottom: "1px solid #eef2f7" }}>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1.2fr 1fr",
                                gap: 12,
                                padding: 14,
                                background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 70%)",
                              }}
                            >
                              <div style={{ ...card, boxShadow: "none", borderRadius: 14, padding: 14 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                                  <div style={{ fontWeight: 850, letterSpacing: -0.2 }}>Details</div>
                                  {r.url && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        copyToClipboard(r.url!);
                                      }}
                                      style={{
                                        ...buttonStyle,
                                        padding: "8px 10px",
                                        borderRadius: 10,
                                        fontWeight: 800,
                                      }}
                                    >
                                      Copy URL
                                    </button>
                                  )}
                                </div>

                                <div style={{ marginTop: 10, display: "grid", gap: 8, fontSize: 13 }}>
                                  <div>
                                    <span style={{ ...subtle, fontWeight: 750 }}>People: </span>
                                    <span style={{ color: "#111827", fontWeight: 650 }}>{fmtPeople(r.people)}</span>
                                  </div>

                                  <div>
                                    <span style={{ ...subtle, fontWeight: 750 }}>Publisher: </span>
                                    <span style={{ color: "#111827", fontWeight: 650 }}>{r.publisher_domain ?? "—"}</span>
                                  </div>

                                  <div>
                                    <span style={{ ...subtle, fontWeight: 750 }}>Ingested: </span>
                                    <span style={{ color: "#111827", fontWeight: 650 }}>{fmtTime(r.ingested_at)}</span>
                                  </div>

                                  <div>
                                    <span style={{ ...subtle, fontWeight: 750 }}>Triaged: </span>
                                    <span style={{ color: "#111827", fontWeight: 650 }}>{fmtTime(r.triaged_at)}</span>
                                  </div>

                                  <div>
                                    <span style={{ ...subtle, fontWeight: 750 }}>URL: </span>
                                    {r.url ? (
                                      <a
                                        href={r.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ color: "#111827", fontWeight: 650, textDecoration: "underline" }}
                                      >
                                        {r.url}
                                      </a>
                                    ) : (
                                      <span style={{ color: "#111827", fontWeight: 650 }}>—</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div style={{ ...card, boxShadow: "none", borderRadius: 14, padding: 14 }}>
                                <div style={{ fontWeight: 850, letterSpacing: -0.2 }}>Reasons</div>
                                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                                  {(r.triage_reasons ?? []).length ? (
                                    (r.triage_reasons ?? []).map((reason, i) => (
                                      <span key={`${r.id}-reason-${i}`} style={badgeStyle("neutral")}>
                                        {reason}
                                      </span>
                                    ))
                                  ) : (
                                    <span style={{ ...subtle, fontSize: 13 }}>—</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 12, color: "#6b7280", fontSize: 12 }}>
          Note: Search + sort are client-side for the current page only. If you want global search/sort, we’ll push it into the Supabase query.
        </div>
      </div>
    </div>
  );
}
