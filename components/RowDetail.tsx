"use client";
import type { Row } from "@/lib/types";
import { STATUS_OPTIONS } from "@/lib/types";
import { fmtTime, fmtPeople, badgeStyle, statusKind } from "@/lib/utils";

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 16,
};
const subtle: React.CSSProperties = { color: "#6b7280" };

type Props = {
  row: Row;
  onStatusChange: (id: string, status: string) => Promise<void>;
};

export default function RowDetail({ row, onStatusChange }: Props) {
  function copyUrl() {
    if (row.url) navigator.clipboard.writeText(row.url).catch(() => {});
  }

  return (
    <tr>
      <td colSpan={10} style={{ padding: 0, borderBottom: "1px solid #eef2f7" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr 0.8fr",
          gap: 12,
          padding: 16,
          background: "linear-gradient(180deg,#f8fafc 0%,#ffffff 70%)",
        }}>
          {/* Details */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, letterSpacing: -0.2 }}>Details</div>
              {row.url && (
                <button
                  onClick={copyUrl}
                  style={{ border: "1px solid #e5e7eb", background: "#fff", padding: "6px 10px", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 12 }}
                >
                  Copy URL
                </button>
              )}
            </div>
            <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
              {[
                ["People", fmtPeople(row.people)],
                ["Publisher", row.publisher_domain ?? "—"],
                ["Ingested", fmtTime(row.ingested_at)],
                ["Triaged", fmtTime(row.triaged_at)],
              ].map(([label, val]) => (
                <div key={label}>
                  <span style={{ ...subtle, fontWeight: 700 }}>{label}: </span>
                  <span style={{ color: "#111827", fontWeight: 600 }}>{val}</span>
                </div>
              ))}
              <div>
                <span style={{ ...subtle, fontWeight: 700 }}>URL: </span>
                {row.url ? (
                  <a href={row.url} target="_blank" rel="noreferrer" style={{ color: "#111827", fontWeight: 600, textDecoration: "underline", wordBreak: "break-all" }}>
                    {row.url}
                  </a>
                ) : <span style={{ color: "#111827" }}>—</span>}
              </div>
            </div>
          </div>

          {/* Reasons */}
          <div style={card}>
            <div style={{ fontWeight: 800, letterSpacing: -0.2, marginBottom: 12 }}>Triage Reasons</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(row.triage_reasons ?? []).length
                ? (row.triage_reasons ?? []).map((r, i) => (
                    <span key={i} style={badgeStyle("neutral")}>{r}</span>
                  ))
                : <span style={{ ...subtle, fontSize: 13 }}>—</span>}
            </div>
          </div>

          {/* Status changer */}
          <div style={card}>
            <div style={{ fontWeight: 800, letterSpacing: -0.2, marginBottom: 12 }}>Update Status</div>
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
                      opacity: isCurrent ? 1 : 0.6,
                      border: isCurrent ? "2px solid currentColor" : "1px solid",
                      fontWeight: isCurrent ? 800 : 600,
                      transition: "opacity 0.15s",
                      width: "100%",
                    }}
                    onMouseEnter={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                    onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.opacity = "0.6"; }}
                    disabled={isCurrent}
                  >
                    {s}
                    {isCurrent && <span style={{ marginLeft: 6 }}>✓</span>}
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
