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
  borderSubtle: "#112030",
  text: "#e2e8f0",
  muted: "#4a6080",
  subtle: "#94a3b8",
  accent: "#3b82f6",
  head: "#08111f",
};

const thBase: React.CSSProperties = {
  position: "sticky",
  top: 0,
  background: C.head,
  borderBottom: `1px solid ${C.border}`,
  padding: "11px 14px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "#4a6080",
  whiteSpace: "nowrap",
  zIndex: 1,
};

const tdBase: React.CSSProperties = {
  padding: "11px 14px",
  borderBottom: `1px solid ${C.borderSubtle}`,
  verticalAlign: "middle",
};

type Props = {
  rows: Row[];
  loading: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  expandedId: string | null;
  onToggleSort: (key: SortKey) => void;
  onToggleExpand: (id: string) => void;
  onStatusChange: (id: string, status: string) => Promise<void>;
};

export default function LeadsTable({ rows, loading, sortKey, sortDir, expandedId, onToggleSort, onToggleExpand, onStatusChange }: Props) {
  function arrow(key: SortKey) {
    if (sortKey !== key) return <span style={{ color: "#1e3a5f", marginLeft: 4 }}>↕</span>;
    return <span style={{ color: C.accent, marginLeft: 4 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <div style={{
      marginTop: 14,
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      overflow: "hidden",
    }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              <th onClick={() => onToggleSort("lead_score")} style={{ ...thBase, cursor: "pointer", userSelect: "none" }}>
                Score{arrow("lead_score")}
              </th>
              {["Severity", "Status", "Type"].map(h => (
                <th key={h} style={thBase}>{h}</th>
              ))}
              <th style={{ ...thBase, minWidth: 340 }}>Title</th>
              <th style={thBase}>Publisher</th>
              <th style={thBase}>Names</th>
              <th onClick={() => onToggleSort("triaged_at")} style={{ ...thBase, cursor: "pointer", userSelect: "none" }}>
                Triaged{arrow("triaged_at")}
              </th>
              <th style={thBase}>URL</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} style={{ ...tdBase, padding: 32, textAlign: "center", color: C.muted }}>
                  <span style={{ color: C.accent }}>●</span> Loading…
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={10} style={{ ...tdBase, padding: 40, textAlign: "center", color: C.muted }}>
                  No matching leads.
                </td>
              </tr>
            )}

            {!loading && rows.map((r, idx) => {
              const isExpanded = expandedId === r.id;
              const rowBg = idx % 2 === 0 ? C.card : C.cardAlt;

              return (
                <React.Fragment key={r.id}>
                  <tr
                    style={{ background: rowBg, cursor: "pointer", transition: "background 0.1s" }}
                    onClick={() => onToggleExpand(r.id)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.hover; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = rowBg; }}
                  >
                    <td style={tdBase}>
                      <span style={{
                        ...badgeStyle(scoreKind(r.lead_score)),
                        ...(scoreKind(r.lead_score) === "bad" ? { boxShadow: "0 0 8px rgba(239,68,68,0.3)" } : {}),
                        ...(scoreKind(r.lead_score) === "warn" ? { boxShadow: "0 0 8px rgba(251,146,60,0.25)" } : {}),
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
                    <td style={{ ...tdBase, maxWidth: 500 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                        {r.url ? (
                          <a
                            href={r.url} target="_blank" rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ color: C.text, textDecoration: "none", fontWeight: 600, fontSize: 13, lineHeight: 1.4 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.accent; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.text; }}
                          >
                            {r.title ?? "(no title)"}
                          </a>
                        ) : (
                          <span style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{r.title ?? "(no title)"}</span>
                        )}
                        <span style={{ color: C.muted, fontSize: 11 }}>{isExpanded ? "▾" : "▸"}</span>
                      </div>
                      <div style={{ marginTop: 3, color: C.muted, fontSize: 11 }}>
                        {(r.triage_reasons ?? []).slice(0, 3).join(" · ")}
                        {(r.triage_reasons ?? []).length > 3 ? " · …" : ""}
                      </div>
                    </td>
                    <td style={{ ...tdBase, color: C.subtle, fontSize: 12 }}>{r.publisher_domain ?? "—"}</td>
                    <td style={{ ...tdBase, maxWidth: 200, color: C.subtle, fontSize: 12 }}>
                      {fmtPeople(r.people)}
                    </td>
                    <td style={{ ...tdBase, whiteSpace: "nowrap", color: C.subtle, fontSize: 12 }}>
                      {fmtTime(r.triaged_at)}
                    </td>
                    <td style={{ ...tdBase, maxWidth: 260 }}>
                      {r.url ? (
                        <a
                          href={r.url} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ color: C.muted, fontSize: 11, textDecoration: "none" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.accent; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.muted; }}
                        >
                          {shortUrl(r.url)}
                        </a>
                      ) : <span style={{ color: "#1e3a5f" }}>—</span>}
                    </td>
                  </tr>

                  {isExpanded && (
                    <RowDetail row={r} onStatusChange={onStatusChange} />
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
