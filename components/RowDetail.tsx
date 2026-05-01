"use client";
import type { Row } from "@/lib/types";
import { STATUS_OPTIONS } from "@/lib/types";
import { fmtTime, fmtPeople, badgeStyle, statusKind } from "@/lib/utils";

const C = {
  card: "#091422",
  cardInner: "#0c1a2e",
  border: "#1a2d4a",
  text: "#e2e8f0",
  muted: "#4a6080",
  subtle: "#94a3b8",
  accent: "#3b82f6",
};

const card: React.CSSProperties = {
  background: C.cardInner,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: 16,
};

type Props = {
  row: Row;
  onStatusChange: (id: string, status: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export default function RowDetail({ row, onStatusChange, onDelete }: Props) {
  function copyUrl() {
    if (row.url) navigator.clipboard.writeText(row.url).catch(() => {});
  }

  function handleDelete() {
    if (confirm(`Delete "${row.title ?? row.id}"? This cannot be undone.`)) {
      onDelete(row.id);
    }
  }

  return (
    <tr>
      <td colSpan={10} style={{ padding: 0, borderBottom: `1px solid ${C.border}` }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr 0.8fr",
          gap: 12,
          padding: 16,
          background: C.card,
        }}>
          {/* Details */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.subtle, letterSpacing: 0.6, textTransform: "uppercase" }}>Details</div>
              <div style={{ display: "flex", gap: 8 }}>
                {row.url && (
                  <button
                    onClick={copyUrl}
                    style={{
                      border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)",
                      color: C.subtle, padding: "5px 10px", borderRadius: 8,
                      fontWeight: 600, cursor: "pointer", fontSize: 11,
                    }}
                  >
                    Copy URL
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  style={{
                    border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)",
                    color: "#f87171", padding: "5px 10px", borderRadius: 8,
                    fontWeight: 600, cursor: "pointer", fontSize: 11,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.18)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)"; }}
                >
                  Delete
                </button>
              </div>
            </div>
            <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
              {[
                ["People", fmtPeople(row.people)],
                ["Publisher", row.publisher_domain ?? "—"],
                ["Ingested", fmtTime(row.ingested_at)],
                ["Triaged", fmtTime(row.triaged_at)],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", gap: 8 }}>
                  <span style={{ color: C.muted, fontWeight: 700, minWidth: 70, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", paddingTop: 1 }}>{label}</span>
                  <span style={{ color: C.text, fontWeight: 500 }}>{val}</span>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: C.muted, fontWeight: 700, minWidth: 70, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", paddingTop: 1 }}>URL</span>
                {row.url ? (
                  <a href={row.url} target="_blank" rel="noreferrer"
                    style={{ color: C.accent, fontWeight: 500, textDecoration: "none", wordBreak: "break-all", fontSize: 12 }}>
                    {row.url}
                  </a>
                ) : <span style={{ color: C.muted }}>—</span>}
              </div>
            </div>
          </div>

          {/* Reasons */}
          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.subtle, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 14 }}>Triage Reasons</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(row.triage_reasons ?? []).length
                ? (row.triage_reasons ?? []).map((r, i) => (
                    <span key={i} style={badgeStyle("neutral")}>{r}</span>
                  ))
                : <span style={{ color: C.muted, fontSize: 13 }}>—</span>}
            </div>
          </div>

          {/* Status */}
          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.subtle, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 14 }}>Update Status</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {STATUS_OPTIONS.map(s => {
                const isCurrent = row.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => onStatusChange(row.id, s)}
                    style={{
                      ...badgeStyle(statusKind(s)),
                      cursor: isCurrent ? "default" : "pointer",
                      justifyContent: "space-between",
                      opacity: isCurrent ? 1 : 0.45,
                      border: isCurrent ? "1.5px solid currentColor" : "1px solid",
                      fontWeight: isCurrent ? 800 : 600,
                      transition: "opacity 0.15s",
                      width: "100%",
                      padding: "7px 12px",
                    }}
                    onMouseEnter={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
                    onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.opacity = "0.45"; }}
                    disabled={isCurrent}
                  >
                    {s}
                    {isCurrent && <span>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
