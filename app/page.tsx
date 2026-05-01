"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchLeads, fetchStats, updateStatus, deleteArticle } from "@/lib/db";
import type { Stats } from "@/lib/db";
import type { SortKey, SortDir, Row } from "@/lib/types";
import { PAGE_SIZE } from "@/lib/types";
import FilterPanel from "@/components/FilterPanel";
import LeadsTable from "@/components/LeadsTable";
import Pagination from "@/components/Pagination";
import StatsBar from "@/components/StatsBar";

function playNewLeadsChime() {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    [[660, 0], [880, 0.12], [1100, 0.24]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      osc.connect(gain);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.35);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.35);
    });
  } catch {}
}

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
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [minScore, setMinScore] = useState(70);
  const [severity, setSeverity] = useState("all");
  const [caseType, setCaseType] = useState("all");
  const [status, setStatus] = useState<string[]>([]);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("triaged_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const fromShown = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toShown = Math.min(page * PAGE_SIZE, totalCount);

  useEffect(() => {
    fetchStats().then(s => { setStats(s); setStatsLoading(false); });
  }, []);

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
      setTotalCount(prev => {
        if (prev > 0 && res.count > prev) playNewLeadsChime();
        return res.count;
      });
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
      // refresh stats after delete
      fetchStats().then(setStats);
    } catch (e: any) {
      alert(`Failed to delete: ${e.message}`);
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      await updateStatus(id, newStatus);
      setRows(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
      fetchStats().then(setStats);
    } catch (e: any) {
      alert(`Failed to update status: ${e.message}`);
    }
  }

  const activeFilters = [
    minScore !== 70 && `score ≥ ${minScore}`,
    severity !== "all" && severity,
    caseType !== "all" && caseType,
    ...status,
    search && `"${search}"`,
  ].filter(Boolean);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "28px 20px 60px", color: C.text }}>
      {/* Top glow */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 500, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 1000px 350px at 50% -80px, rgba(59,130,246,0.1) 0%, transparent 65%)",
      }} />

      <div style={{ maxWidth: 1440, margin: "0 auto", position: "relative", zIndex: 1 }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: "linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, boxShadow: "0 0 24px rgba(59,130,246,0.35)",
              }}>⚖️</div>
              <div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: C.text, lineHeight: 1.1 }}>
                  PI Lead Monitor
                </h1>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {loading
                    ? <span style={{ color: "#2a5a9a" }}>loading…</span>
                    : <>
                        {totalCount.toLocaleString()} leads
                        {activeFilters.length > 0 && <span style={{ color: "#2a4a68" }}> · filtered by {activeFilters.join(", ")}</span>}
                      </>}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {source && (
              <div style={{
                padding: "6px 11px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)",
                color: "#3b82f6",
              }}>
                <code style={{ fontFamily: "ui-monospace,monospace" }}>{source}</code>
              </div>
            )}
            <button
              onClick={() => { load(); fetchStats().then(setStats); }}
              style={{
                border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)",
                color: C.subtle, padding: "8px 16px", borderRadius: 10,
                fontWeight: 600, cursor: "pointer", fontSize: 13,
                transition: "all 0.15s",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(255,255,255,0.08)";
                el.style.color = C.text;
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(255,255,255,0.04)";
                el.style.color = C.subtle;
              }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        <StatsBar stats={stats} loading={statsLoading} />

        {/* ── Filters ── */}
        <FilterPanel
          minScore={minScore} severity={severity} caseType={caseType}
          status={status} searchInput={searchInput} error={error}
          onMinScore={setMinScore} onSeverity={setSeverity} onCaseType={setCaseType}
          onStatus={setStatus} onSearch={setSearchInput}
        />

        {/* ── Pagination ── */}
        <Pagination
          page={page} totalPages={totalPages} totalCount={totalCount}
          fromShown={fromShown} toShown={toShown} loading={loading}
          onPrev={() => setPage(p => Math.max(1, p - 1))}
          onNext={() => setPage(p => Math.min(totalPages, p + 1))}
          onJump={setPage}
        />

        {/* ── Table ── */}
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
