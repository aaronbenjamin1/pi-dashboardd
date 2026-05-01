"use client";
import { SEVERITIES, CASE_TYPES, STATUSES } from "@/lib/types";

const subtle: React.CSSProperties = { color: "#6b7280" };
const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  outline: "none",
  background: "#fff",
  fontSize: 14,
};
const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  boxShadow: "0 10px 30px rgba(17,24,39,0.08)",
};

type Props = {
  minScore: number;
  severity: string;
  caseType: string;
  status: string;
  searchInput: string;
  error: string | null;
  onMinScore: (v: number) => void;
  onSeverity: (v: string) => void;
  onCaseType: (v: string) => void;
  onStatus: (v: string) => void;
  onSearch: (v: string) => void;
};

export default function FilterPanel({
  minScore, severity, caseType, status, searchInput, error,
  onMinScore, onSeverity, onCaseType, onStatus, onSearch,
}: Props) {
  return (
    <div style={{ marginTop: 16, padding: 16, ...card }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ ...subtle, fontSize: 12, fontWeight: 700 }}>Min score</div>
          <input
            type="number"
            value={minScore}
            onChange={e => onMinScore(Number(e.target.value))}
            style={{ ...inputStyle, width: 110 }}
          />
        </div>

        {([
          { label: "Severity", value: severity, opts: SEVERITIES, onChange: onSeverity },
          { label: "Case type", value: caseType, opts: CASE_TYPES, onChange: onCaseType },
          { label: "Status", value: status, opts: STATUSES, onChange: onStatus },
        ] as const).map(({ label, value, opts, onChange }) => (
          <div key={label} style={{ display: "grid", gap: 6 }}>
            <div style={{ ...subtle, fontSize: 12, fontWeight: 700 }}>{label}</div>
            <select
              value={value}
              onChange={e => onChange(e.target.value as any)}
              style={{ ...inputStyle, minWidth: 180 }}
            >
              {opts.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        ))}

        <div style={{ flex: "1 1 300px", display: "grid", gap: 6 }}>
          <div style={{ ...subtle, fontSize: 12, fontWeight: 700 }}>Search (all pages)</div>
          <input
            value={searchInput}
            onChange={e => onSearch(e.target.value)}
            placeholder="title, publisher…"
            style={{ ...inputStyle, width: "100%" }}
          />
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #fecdd3", background: "#fff1f2", color: "#9f1239", fontWeight: 700 }}>
          Error: <span style={{ fontWeight: 500 }}>{error}</span>
        </div>
      )}
    </div>
  );
}
