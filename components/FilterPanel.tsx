"use client";
import { SEVERITIES, CASE_TYPES, STATUS_OPTIONS } from "@/lib/types";
import { badgeStyle, statusKind } from "@/lib/utils";

const C = {
  card: "#0c1526",
  border: "#1a2d4a",
  text: "#e2e8f0",
  muted: "#4a6080",
  subtle: "#94a3b8",
  input: "#0a1628",
};

const label: React.CSSProperties = { color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" };

const inputStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  outline: "none",
  background: C.input,
  color: C.text,
  fontSize: 13,
  transition: "border-color 0.15s",
};

type Props = {
  minScore: number;
  severity: string;
  caseType: string;
  status: string[];
  searchInput: string;
  error: string | null;
  onMinScore: (v: number) => void;
  onSeverity: (v: string) => void;
  onCaseType: (v: string) => void;
  onStatus: (v: string[]) => void;
  onSearch: (v: string) => void;
};

export default function FilterPanel({
  minScore, severity, caseType, status, searchInput, error,
  onMinScore, onSeverity, onCaseType, onStatus, onSearch,
}: Props) {
  return (
    <div style={{
      marginTop: 16, padding: "16px 20px",
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 14, boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
    }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "end" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={label}>Min Score</div>
          <input
            type="number"
            value={minScore}
            onChange={e => onMinScore(Number(e.target.value))}
            style={{ ...inputStyle, width: 100 }}
          />
        </div>

        {([
          { lbl: "Severity", value: severity, opts: SEVERITIES, onChange: onSeverity },
          { lbl: "Case Type", value: caseType, opts: CASE_TYPES, onChange: onCaseType },
        ] as const).map(({ lbl, value, opts, onChange }) => (
          <div key={lbl} style={{ display: "grid", gap: 6 }}>
            <div style={label}>{lbl}</div>
            <select
              value={value}
              onChange={e => onChange(e.target.value as any)}
              style={{ ...inputStyle, minWidth: 160 }}
            >
              {opts.map(v => <option key={v} value={v} style={{ background: "#0c1526" }}>{v}</option>)}
            </select>
          </div>
        ))}

        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={label}>Status</span>
            {status.length > 0 && (
              <button
                onClick={() => onStatus([])}
                style={{ background: "none", border: "none", color: "#4a6080", fontSize: 11, cursor: "pointer", padding: 0, textDecoration: "underline" }}
              >
                clear
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {STATUS_OPTIONS.map(s => {
              const active = status.includes(s);
              const base = badgeStyle(statusKind(s));
              return (
                <button
                  key={s}
                  onClick={() => onStatus(active ? status.filter(x => x !== s) : [...status, s])}
                  style={{
                    ...base,
                    cursor: "pointer",
                    opacity: active ? 1 : 0.35,
                    border: active ? "1.5px solid currentColor" : base.border,
                    transition: "opacity 0.15s",
                    background: "none",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.8"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = active ? "1" : "0.35"; }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ flex: "1 1 260px", display: "grid", gap: 6 }}>
          <div style={label}>Search</div>
          <input
            value={searchInput}
            onChange={e => onSearch(e.target.value)}
            placeholder="title, publisher…"
            style={{ ...inputStyle, width: "100%" }}
          />
        </div>
      </div>

      {error && (
        <div style={{
          marginTop: 12, padding: "10px 14px", borderRadius: 10,
          border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)",
          color: "#f87171", fontWeight: 600, fontSize: 13,
        }}>
          Error: {error}
        </div>
      )}
    </div>
  );
}
