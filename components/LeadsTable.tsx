"use client";
import React from "react";
import type { Row, SortKey, SortDir } from "@/lib/types";
import { badgeStyle, severityKind, scoreKind, statusKind, fmtTime, fmtPeople, shortUrl } from "@/lib/utils";
import RowDetail from "./RowDetail";

const subtle: React.CSSProperties = { color: "#6b7280" };
const thBase: React.CSSProperties = {
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
};
const tdBase: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid #eef2f7",
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
    return sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";
  }

  return (
    <div style={{ marginTop: 14, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, boxShadow: "0 10px 30px rgba(17,24,39,0.08)", overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              <th onClick={() => onToggleSort("lead_score")} style={{ ...thBase, cursor: "pointer", userSelect: "none" }}>
                Score{arrow("lead_score")}
              </th>
              {["Severity", "Status", "Type", "Title", "Publisher", "Names"].map(h => (
                <th key={h} style={thBase}>{h}</th>
              ))}
              <th onClick={() => onToggleSort("triaged_at")} style={{ ...thBase, cursor: "pointer", userSelect: "none" }}>
                Triaged{arrow("triaged_at")}
              </th>
              <th style={thBase}>URL</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} style={{ padding: 24, color: "#6b7280", textAlign: "center" }}>
                  Loading…
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={10} style={{ padding: 24, color: "#6b7280" }}>
                  No matching rows.
                </td>
              </tr>
            )}

            {!loading && rows.map((r, idx) => {
              const zebra = idx % 2 === 0 ? "#ffffff" : "#fafafa";
              const isExpanded = expandedId === r.id;

              return (
                <React.Fragment key={r.id}>
                  <tr
                    style={{ background: zebra, cursor: "pointer" }}
                    onClick={() => onToggleExpand(r.id)}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f5f7ff"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = zebra; }}
                  >
                    <td style={tdBase}>
                      <span style={badgeStyle(scoreKind(r.lead_score))}>{r.lead_score ?? "—"}</span>
                    </td>
                    <td style={tdBase}>
                      <span style={badgeStyle(severityKind(r.severity))}>{r.severity ?? "—"}</span>
                    </td>
                    <td style={tdBase}>
                      <span style={badgeStyle(statusKind(r.status))}>{r.status ?? "—"}</span>
                    </td>
                    <td style={{ ...tdBase, color: "#374151" }}>{r.case_type ?? "—"}</td>
                    <td style={{ ...tdBase, maxWidth: 600 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: "#111827", textDecoration: "none", fontWeight: 800 }}>
                            {r.title ?? "(no title)"}
                          </a>
                        ) : (
                          <span style={{ fontWeight: 800 }}>{r.title ?? "(no title)"}</span>
                        )}
                        <span style={{ ...subtle, fontSize: 12 }}>{isExpanded ? "▾" : "▸"}</span>
                      </div>
                      <div style={{ marginTop: 3, color: "#6b7280", fontSize: 12 }}>
                        {(r.triage_reasons ?? []).slice(0, 2).join(" · ")}
                        {(r.triage_reasons ?? []).length > 2 ? " · …" : ""}
                      </div>
                    </td>
                    <td style={{ ...tdBase, color: "#374151" }}>{r.publisher_domain ?? "—"}</td>
                    <td style={{ ...tdBase, maxWidth: 280 }}>
                      <div style={{ color: "#374151" }}>{fmtPeople(r.people)}</div>
                    </td>
                    <td style={{ ...tdBase, whiteSpace: "nowrap" }}>
                      <div style={{ color: "#111827", fontWeight: 800, fontSize: 13 }}>{fmtTime(r.triaged_at)}</div>
                    </td>
                    <td style={{ ...tdBase, maxWidth: 300 }}>
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: "#6b7280", fontSize: 12, textDecoration: "none" }}>
                          {shortUrl(r.url)}
                        </a>
                      ) : <span style={{ color: "#9ca3af" }}>—</span>}
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
