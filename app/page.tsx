"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

/* ============================
   Types
============================ */

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
const STATUSES = ["all", "new", "reviewing", "contacted", "closed", "ignore"] as const;

const PAGE_SIZE = 50;

/* ============================
   Helpers
============================ */

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function fmtPeople(p: string[] | null) {
  if (!p?.length) return "—";
  const shown = p.slice(0, 4);
  return shown.join(", ") + (p.length > 4 ? ` +${p.length - 4}` : "");
}

function shortUrl(u: string | null) {
  if (!u) return "—";
  try {
    const url = new URL(u);
    const s = `${url.hostname}${url.pathname}`;
    return s.length > 60 ? s.slice(0, 60) + "…" : s;
  } catch {
    return u;
  }
}

function badgeStyle(kind: "neutral" | "good" | "warn" | "bad") {
  const base: React.CSSProperties = {
    display: "inline-flex",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 650,
    border: "1px solid",
    whiteSpace: "nowrap",
  };
  if (kind === "bad") return { ...base, background: "#fff1f2", borderColor: "#fecdd3", color: "#9f1239" };
  if (kind === "warn") return { ...base, background: "#fff7ed", borderColor: "#fed7aa", color: "#7c3e0a" };
  if (kind === "good") return { ...base, background: "#eefbf1", borderColor: "#c8eed2", color: "#166534" };
  return { ...base, background: "#f6f7f9", borderColor: "#e5e7eb", color: "#374151" };
}

function scoreKind(score: number | null) {
  if (score == null) return "neutral";
  if (score >= 85) return "bad";
  if (score >= 70) return "warn";
  if (score >= 50) return "good";
  return "neutral";
}

function severityKind(sev: string | null) {
  if (sev === "fatal") return "bad";
  if (sev === "serious_injury") return "warn";
  if (sev === "injury") return "good";
  return "neutral";
}

/* ============================
   Data Fetch
============================ */

async function fetchPaged(params: {
  minScore: number;
  severity: string;
  caseType: string;
  status: string;
  page: number;
}) {
  const supabase = getSupabase();
  if (!supabase) return { data: [], count: 0 };

  const from = (params.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let q = supabase
    .from("v_triage_live")
    .select("*", { count: "exact" })
    .order("triaged_at", { ascending: false })
    .range(from, to);

  if (params.minScore > 0) q = q.gte("lead_score", params.minScore);
  if (params.severity !== "all") q = q.eq("severity", params.severity);
  if (params.caseType !== "all") q = q.eq("case_type", params.caseType);
  if (params.status !== "all") q = q.eq("status", params.status);

  const res = await q;
  return { data: (res.data as Row[]) ?? [], count: res.count ?? 0 };
}

/* ============================
   Page
============================ */

export default function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [minScore, setMinScore] = useState(70);
  const [severity, setSeverity] = useState("all");
  const [caseType, setCaseType] = useState("all");
  const [status, setStatus] = useState("all");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [sortKey, setSortKey] = useState<"triaged_at" | "lead_score">("triaged_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  /* Debounce search */
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    fetchPaged({ minScore, severity, caseType, status, page }).then((r) => {
      setRows(r.data);
      setTotal(r.count);
    });
  }, [minScore, severity, caseType, status, page]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    const searched = !s
      ? rows
      : rows.filter((r) =>
          `${r.title} ${r.publisher_domain} ${(r.people ?? []).join(" ")} ${(r.triage_reasons ?? []).join(" ")}`.toLowerCase().includes(s)
        );

    return [...searched].sort((a, b) => {
      const av = sortKey === "lead_score" ? a.lead_score ?? -1 : new Date(a.triaged_at ?? 0).getTime();
      const bv = sortKey === "lead_score" ? b.lead_score ?? -1 : new Date(b.triaged_at ?? 0).getTime();
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, search, sortKey, sortDir]);

  return (
    <div style={{ padding: 24 }}>
      <h1>PI Lead Monitor</h1>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <input type="number" value={minScore} onChange={(e) => setMinScore(+e.target.value)} placeholder="Min score" />
        <select value={severity} onChange={(e) => setSeverity(e.target.value)}>{SEVERITIES.map(v => <option key={v}>{v}</option>)}</select>
        <select value={caseType} onChange={(e) => setCaseType(e.target.value)}>{CASE_TYPES.map(v => <option key={v}>{v}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map(v => <option key={v}>{v}</option>)}</select>
        <input placeholder="Search…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
      </div>

      {/* Table */}
      <table width="100%">
        <thead>
          <tr>
            <th onClick={() => setSortKey("lead_score")}>Score</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Title</th>
            <th onClick={() => setSortKey("triaged_at")}>Triaged</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <>
              <tr key={r.id} onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                <td><span style={badgeStyle(scoreKind(r.lead_score))}>{r.lead_score}</span></td>
                <td><span style={badgeStyle(severityKind(r.severity))}>{r.severity}</span></td>
                <td>{r.status}</td>
                <td>{r.title}</td>
                <td>{fmtTime(r.triaged_at)}</td>
              </tr>

              {expanded === r.id && (
                <tr>
                  <td colSpan={5} style={{ background: "#f9fafb", padding: 12 }}>
                    <div><strong>People:</strong> {fmtPeople(r.people)}</div>
                    <div><strong>Reasons:</strong> {(r.triage_reasons ?? []).join(", ")}</div>
                    <div><strong>URL:</strong> <a href={r.url ?? "#"} target="_blank">{shortUrl(r.url)}</a></div>
                    <div><strong>Ingested:</strong> {fmtTime(r.ingested_at)}</div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
