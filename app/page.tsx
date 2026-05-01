"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchLeads, updateStatus, deleteArticle } from "@/lib/db";
import type { SortKey, SortDir, Row } from "@/lib/types";
import { PAGE_SIZE } from "@/lib/types";
import FilterPanel from "@/components/FilterPanel";
import LeadsTable from "@/components/LeadsTable";
import Pagination from "@/components/Pagination";

const C = {
  bg: "#080e1a",
  card: "#0c1526",
  border: "#1a2d4a",
  text: "#e2e8f0",
  muted: "#4a6080",
  subtle: "#94a3b8",
  accent: "#3b82f6",
};

export default function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"v_triage_live" | "articles" | null>(null);

  const [minScore, setMinScore] = useState(70);
  const [severity, setSeverity] = useState("all");
  const [caseType, setCaseType] = useState("all");
  const [status, setStatus] = useState("all");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("triaged_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const fromShown = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toShown = Math.min(page * PAGE_SIZE, totalCount);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(1); setExpandedId(null); }, [minScore, severity, caseType, status, search, sortKey, sortDir]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchLeads({ minScore, severity, caseType, status, search, sortKey, sortDir, page });
      setRows(res.data);
      setTotalCount(res.count);
      setSource(res.source);
      const newMax = Math.max(1, Math.ceil(res.count / PAGE_SIZE));
      if (page > newMax) setPage(1);
    } catch (e: any) {
      setRows([]);
      setTotalCount(0);
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [minScore, severity, caseType, status, search, sortKey, sortDir, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  function toggleSort(key: SortKey) {
    if (sortKey !== key) { setSortKey(key); setSortDir("desc"); }
    else setSortDir(d => d === "desc" ? "asc" : "desc");
  }

  async function handleDelete(id: string) {
    try {
      await deleteArticle(id);
      setRows(prev => prev.filter(r => r.id !== id));
      setTotalCount(prev => prev - 1);
      setExpandedId(null);
    } catch (e: any) {
      alert(`Failed to delete: ${e.message}`);
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      await updateStatus(id, newStatus);
      setRows(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    } catch (e: any) {
      alert(`Failed to update status: ${e.message}`);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 20px", color: C.text }}>
      {/* Subtle radial glow at top */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 400, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 900px 300px at 50% -60px, rgba(59,130,246,0.12) 0%, transparent 70%)",
      }} />

      <div style={{ maxWidth: 1420, margin: "0 auto", position: "relative", zIndex: 1 }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, boxShadow: "0 0 20px rgba(59,130,246,0.4)",
                }}>⚖️</div>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: -0.6, color: C.text }}>
                  PI Lead Monitor
                </h1>
              </div>

              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 10px", borderRadius: 8,
                background: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.15)",
                fontSize: 12, color: C.subtle,
              }}>
                <span style={{ opacity: 0.6 }}>src</span>
                <code style={{ fontFamily: "ui-monospace,monospace", color: C.accent }}>{source ?? "…"}</code>
              </div>

              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 10px", borderRadius: 8,
                background: autoRefresh ? "rgba(74,222,128,0.08)" : "rgba(148,163,184,0.06)",
                border: `1px solid ${autoRefresh ? "rgba(74,222,128,0.25)" : "rgba(148,163,184,0.15)"}`,
                fontSize: 12, color: autoRefresh ? "#4ade80" : C.subtle,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: autoRefresh ? "#4ade80" : C.muted,
                  boxShadow: autoRefresh ? "0 0 6px #4ade80" : "none",
                  display: "inline-block",
                }} />
                {autoRefresh ? "Live" : "Paused"}
              </div>
            </div>

            <div style={{ marginTop: 6, color: C.muted, fontSize: 13 }}>
              {loading
                ? <span style={{ color: C.accent }}>Fetching…</span>
                : `${totalCount.toLocaleString()} leads · showing ${fromShown}–${toShown} · sorted by ${sortKey} ${sortDir}`}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={load}
              style={{
                border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)",
                color: C.text, padding: "9px 16px", borderRadius: 10,
                fontWeight: 600, cursor: "pointer", fontSize: 13,
                transition: "background 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
            >
              ↻ Refresh
            </button>
            <label style={{ display: "flex", gap: 8, alignItems: "center", color: C.subtle, fontSize: 13, cursor: "pointer", userSelect: "none" }}>
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
              Auto (15s)
            </label>
          </div>
        </div>

        <FilterPanel
          minScore={minScore} severity={severity} caseType={caseType}
          status={status} searchInput={searchInput} error={error}
          onMinScore={setMinScore} onSeverity={setSeverity} onCaseType={setCaseType}
          onStatus={setStatus} onSearch={setSearchInput}
        />

        <Pagination
          page={page} totalPages={totalPages} totalCount={totalCount}
          fromShown={fromShown} toShown={toShown} loading={loading}
          onPrev={() => setPage(p => Math.max(1, p - 1))}
          onNext={() => setPage(p => Math.min(totalPages, p + 1))}
          onJump={setPage}
        />

        <LeadsTable
          rows={rows} loading={loading} sortKey={sortKey} sortDir={sortDir}
          expandedId={expandedId}
          onToggleSort={toggleSort}
          onToggleExpand={id => setExpandedId(cur => cur === id ? null : id)}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />

      </div>
    </div>
  );
}
