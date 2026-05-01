"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchLeads, updateStatus } from "@/lib/db";
import { badgeStyle } from "@/lib/utils";
import type { SortKey, SortDir, Row } from "@/lib/types";
import { PAGE_SIZE } from "@/lib/types";
import FilterPanel from "@/components/FilterPanel";
import LeadsTable from "@/components/LeadsTable";
import Pagination from "@/components/Pagination";

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

  // Debounce search — triggers server query after 300ms pause
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to page 1 when filters/sort change
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

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      await updateStatus(id, newStatus);
      setRows(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    } catch (e: any) {
      alert(`Failed to update status: ${e.message}`);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(1200px 600px at 10% 0%, rgba(99,102,241,.1) 0%, rgba(255,255,255,0) 55%), linear-gradient(180deg,#f7f8fb 0%,#ffffff 55%)",
      padding: "28px 16px",
      fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Arial",
      color: "#111827",
    }}>
      <div style={{ maxWidth: 1380, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 28, letterSpacing: -0.4 }}>PI Lead Monitor</h1>
              <span style={badgeStyle("neutral")}>
                Source: <code style={{ fontFamily: "ui-monospace,monospace" }}>{source ?? "…"}</code>
              </span>
              <span style={badgeStyle(autoRefresh ? "good" : "neutral")}>
                {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
              </span>
            </div>
            <div style={{ marginTop: 6, color: "#6b7280", fontSize: 13 }}>
              {loading ? "Loading…" : `Showing ${fromShown}–${toShown} of ${totalCount} · Sorted by ${sortKey} ${sortDir}`}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={load} style={{ border: "1px solid #e5e7eb", background: "#fff", padding: "10px 16px", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>
              ↻ Refresh
            </button>
            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#6b7280", fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
              Auto-refresh (15s)
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
        />

      </div>
    </div>
  );
}
