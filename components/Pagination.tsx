"use client";

const C = { border: "#1a2d4a", text: "#e2e8f0", muted: "#4a6080", subtle: "#94a3b8", accent: "#3b82f6", input: "#0a1628" };

const btn = (disabled: boolean): React.CSSProperties => ({
  border: `1px solid ${C.border}`,
  background: disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)",
  color: disabled ? C.muted : C.text,
  padding: "8px 14px",
  borderRadius: 10,
  fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
  fontSize: 13,
  transition: "background 0.15s",
});

type Props = {
  page: number;
  totalPages: number;
  totalCount: number;
  fromShown: number;
  toShown: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  onJump: (p: number) => void;
};

export default function Pagination({ page, totalPages, totalCount, fromShown, toShown, loading, onPrev, onNext, onJump }: Props) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
      <button onClick={onPrev} disabled={page <= 1 || loading} style={btn(page <= 1 || loading)}>
        ← Prev
      </button>

      <div style={{ color: C.subtle, fontSize: 13 }}>
        Page <strong style={{ color: C.text }}>{page}</strong> of{" "}
        <strong style={{ color: C.text }}>{totalPages}</strong>
        <span style={{ color: C.muted }}> · </span>
        <strong style={{ color: C.text }}>{fromShown}</strong>–<strong style={{ color: C.text }}>{toShown}</strong>
        <span style={{ color: C.muted }}> of </span>
        <strong style={{ color: C.accent }}>{totalCount.toLocaleString()}</strong>
      </div>

      <button onClick={onNext} disabled={page >= totalPages || loading} style={btn(page >= totalPages || loading)}>
        Next →
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: C.muted, fontSize: 13 }}>Jump:</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={page}
          onChange={e => onJump(Math.max(1, Math.min(totalPages, Number(e.target.value) || 1)))}
          style={{
            padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.border}`,
            outline: "none", background: C.input, color: C.text, width: 80, fontSize: 13,
          }}
        />
      </div>
    </div>
  );
}
