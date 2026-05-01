"use client";
import React from "react";
import type { Row, SortKey, SortDir } from "@/lib/types";
import { badgeStyle, severityKind, scoreKind, statusKind, fmtTime, fmtPeople, shortUrl } from "@/lib/utils";
import RowDetail from "./RowDetail";

const C = {
  card: "#0c1526",
  cardAlt: "#0a1220",
  hover: "#0f1e38",
  border: "#1a2d4a",
  borderSubtle: "#0e1e32",
  text: "#e2e8f0",
  muted: "#4a6080",
  subtle: "#94a3b8",
  accent: "#3b82f6",
  head: "#070d1a",
};

const SCORE_BORDER: Record<string, string> = {
  bad:     "rgba(239,68,68,0.65)",
  warn:    "rgba(251,146,60,0.55)",
  good:    "rgba(74,222,128,0.4)",
  neutral: "transparent",
};

const thBase: React.CSSProperties = {
  position: "sticky",
  top: 0,
  background: C.head,
  borderBottom: `1px solid ${C.border}`,
  padding: "10px 14px",
  textAlign: "left",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: "#2e4d70",
  whiteSpace: "nowrap",
  zIndex: 1,
};

const tdBase: React.CSSProperties = {
  padding: "11px 14px",
  borderBottom: `1px solid ${C.borderSubtle}`,
  verticalAlign: "middle",
};

function ShimmerCell({ width = "70%" }: { width?: string }) {
  return (
    <div style={{
      height: 13, width, borderRadius: 5,
      background: "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%)",
      backgroundSize: "400px 100%",
      animation: "shimmer 1.4s infinite linear",
    }} />
  );
}

function SkeletonRow({ idx }: { idx: number }) {
  const widths = ["30%", "55%", "45%", "40%", "80%", "55%", "50%", "60%", "65%"];
  return (
    <tr style={{ background: idx % 2 === 0 ? C.card : C.cardAlt }}>
      <td style={{ ...tdBase, borderLeft: "3px solid transparent" }} />
      {widths.map((w, i) => (
        <td key={i} style={tdBase}><ShimmerCell width={w} /></td>
      ))}
    </tr>
  );
}

type Props = {
  rows: Row[];
  loading: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  expandedId: string | null;
  onToggleSort: (key: SortKey) => void;
  onToggleExpand: (id: string) => void;
  onStatusChange: (id: string, status: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export default function LeadsTable({ rows, loading, sortKey, sortDir, expandedId, onToggleSort, onToggleExpand, onStatusChange, onDelete }: Props) {
  function SortArrow({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span style={{ color: "#1a3050", marginLeft: 4 }}>↕</span>;
    return <span style={{ color: C.accent, marginLeft: 4 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <div style={{
      marginTop: 14,
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 16,
      boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
      overflow: "hidden",
    }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              {/* accent border column */}
              <th style={{ ...thBase, width: 3, padding: 0 }} />
              <th onClick={() => onToggleSort("lead_score")} style={{ ...thBase, cursor: "pointer", userSelect: "none" }}>
                Score<SortArrow col="lead_score" />
              </th>
              {(["Severity", "Status", "Type"] as const).map(h => <th key={h} style={thBase}>{h}</th>)}
              <th style={{ ...thBase, minWidth: 340 }}>Title</th>
              <th style={thBase}>Publisher</th>
              <th style={thBase}>Names</th>
              <th onClick={() => onToggleSort("triaged_at")} style={{ ...thBase, cursor: "pointer", userSelect: "none" }}>
                Triaged<SortArrow col="triaged_at" />
              </th>
              <th style={thBase}>URL</th>
            </tr>
          </thead>

          <tbody>
            {loading && Array.from({ length: 8 }, (_, i) => <SkeletonRow key={i} idx={i} />)}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={10} style={{ padding: "60px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>🔍</div>
                  <div style={{ color: C.subtle, fontWeight: 600, fontSize: 14 }}>No matching leads</div>
                  <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>Try adjusting your filters or lowering the min score</div>
                </td>
              </tr>
            )}

            {!loading && rows.map((r, idx) => {
              const kind = scoreKind(r.lead_score);
              const rowBg = idx % 2 === 0 ? C.card : C.cardAlt;
              const isExpanded = expandedId === r.id;
              const accentColor = SCORE_BORDER[kind];

              return (
                <React.Fragment key={r.id}>
                  <tr
                    style={{ background: rowBg, cursor: "pointer", transition: "background 0.1s" }}
                    onClick={() => onToggleExpand(r.id)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.hover; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = rowBg; }}
                  >
                    {/* Left border accent */}
                    <td style={{ padding: 0, width: 3, background: accentColor, borderBottom: `1px solid ${C.borderSubtle}` }} />

                    <td style={tdBase}>
                      <span style={{
                        fontSize: 18, fontWeight: 800, lineHeight: 1,
                        color: kind === "bad" ? "#f87171" : kind === "warn" ? "#fb923c" : kind === "good" ? "#4ade80" : C.muted,
                        ...(kind === "bad"  ? { textShadow: "0 0 12px rgba(239,68,68,0.5)" }  : {}),
                        ...(kind === "warn" ? { textShadow: "0 0 12px rgba(251,146,60,0.4)" } : {}),
                      }}>
                        {r.lead_score ?? "—"}
                      </span>
                    </td>

                    <td style={tdBase}>
                      <span style={badgeStyle(severityKind(r.severity))}>{r.severity ?? "—"}</span>
                    </td>
                    <td style={tdBase}>
                      <span style={badgeStyle(statusKind(r.status))}>{r.status ?? "—"}</span>
                    </td>
                    <td style={{ ...tdBase, color: C.subtle, fontSize: 12 }}>{r.case_type ?? "—"}</td>

                    <td style={{ ...tdBase, maxWidth: 480 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {r.url ? (
                          <a
                            href={r.url} target="_blank" rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ color: C.text, textDecoration: "none", fontWeight: 600, fontSize: 13, lineHeight: 1.4, transition: "color 0.15s" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.accent; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.text; }}
                          >
                            {r.title ?? "(no title)"}
                          </a>
                        ) : (
                          <span style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{r.title ?? "(no title)"}</span>
                        )}
                        <span style={{ color: "#1e3a5f", fontSize: 10, flexShrink: 0 }}>{isExpanded ? "▾" : "▸"}</span>
                      </div>
                      {(r.triage_reasons ?? []).length > 0 && (
                        <div style={{ marginTop: 3, color: "#2a4a68", fontSize: 11 }}>
                          {(r.triage_reasons ?? []).slice(0, 3).join(" · ")}
                          {(r.triage_reasons ?? []).length > 3 ? " ·…" : ""}
                        </div>
                      )}
                    </td>

                    <td style={{ ...tdBase, color: C.subtle, fontSize: 12 }}>{r.publisher_domain ?? "—"}</td>
                    <td style={{ ...tdBase, maxWidth: 200, color: C.subtle, fontSize: 12 }}>{fmtPeople(r.people)}</td>
                    <td style={{ ...tdBase, whiteSpace: "nowrap", color: "#2e4d70", fontSize: 12 }}>{fmtTime(r.triaged_at)}</td>
                    <td style={{ ...tdBase, maxWidth: 240 }}>
                      {r.url ? (
                        <a
                          href={r.url} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ color: "#2e4d70", fontSize: 11, textDecoration: "none", transition: "color 0.15s" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.accent; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#2e4d70"; }}
                        >
                          {shortUrl(r.url)}
                        </a>
                      ) : <span style={{ color: "#1a2d4a" }}>—</span>}
                    </td>
                  </tr>

                  {isExpanded && (
                    <RowDetail row={r} onStatusChange={onStatusChange} onDelete={onDelete} />
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
