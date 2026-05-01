"use client";

const subtle: React.CSSProperties = { color: "#6b7280" };
const btn = (disabled: boolean): React.CSSProperties => ({
  border: "1px solid #e5e7eb",
  background: disabled ? "#f3f4f6" : "#fff",
  padding: "10px 14px",
  borderRadius: 12,
  fontWeight: 700,
  cursor: disabled ? "not-allowed" : "pointer",
  fontSize: 13,
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

      <div style={{ ...subtle, fontSize: 13 }}>
        Page <strong style={{ color: "#111827" }}>{page}</strong> of{" "}
        <strong style={{ color: "#111827" }}>{totalPages}</strong>
        {" · "}
        <strong style={{ color: "#111827" }}>{fromShown}</strong>–<strong style={{ color: "#111827" }}>{toShown}</strong>{" "}
        of <strong style={{ color: "#111827" }}>{totalCount}</strong>
      </div>

      <button onClick={onNext} disabled={page >= totalPages || loading} style={btn(page >= totalPages || loading)}>
        Next →
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ ...subtle, fontSize: 13 }}>Jump:</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={page}
          onChange={e => onJump(Math.max(1, Math.min(totalPages, Number(e.target.value) || 1)))}
          style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", outline: "none", background: "#fff", width: 90, fontSize: 14 }}
        />
      </div>
    </div>
  );
}
