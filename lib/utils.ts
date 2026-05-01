import type React from "react";

export type BadgeKind = "neutral" | "good" | "warn" | "bad";

export function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function fmtPeople(p: string[] | null) {
  if (!p || p.length === 0) return "—";
  const shown = p.slice(0, 5);
  const extra = p.length > 5 ? ` +${p.length - 5}` : "";
  return shown.join(", ") + extra;
}

export function shortUrl(u: string | null) {
  if (!u) return "—";
  try {
    const url = new URL(u);
    const s = `${url.hostname}${url.pathname}`;
    return s.length > 70 ? s.slice(0, 70) + "…" : s;
  } catch {
    return u.length > 70 ? u.slice(0, 70) + "…" : u;
  }
}

export function badgeStyle(kind: BadgeKind): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    border: "1px solid",
    userSelect: "none",
    whiteSpace: "nowrap",
    lineHeight: 1.5,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  };
  if (kind === "bad")  return { ...base, background: "rgba(239,68,68,0.15)",   borderColor: "rgba(239,68,68,0.4)",   color: "#f87171" };
  if (kind === "warn") return { ...base, background: "rgba(251,146,60,0.15)",  borderColor: "rgba(251,146,60,0.4)",  color: "#fb923c" };
  if (kind === "good") return { ...base, background: "rgba(74,222,128,0.12)",  borderColor: "rgba(74,222,128,0.35)", color: "#4ade80" };
  return                      { ...base, background: "rgba(148,163,184,0.08)", borderColor: "rgba(148,163,184,0.2)", color: "#94a3b8" };
}

export function severityKind(sev: string | null): BadgeKind {
  if (!sev) return "neutral";
  if (sev === "fatal") return "bad";
  if (sev === "serious_injury") return "warn";
  if (sev === "injury") return "good";
  return "neutral";
}

export function scoreKind(score: number | null): BadgeKind {
  if (score == null) return "neutral";
  if (score >= 85) return "bad";
  if (score >= 70) return "warn";
  if (score >= 50) return "good";
  return "neutral";
}

export function statusKind(status: string | null): BadgeKind {
  if (!status) return "neutral";
  const s = status.toLowerCase();
  if (s === "ignore" || s === "closed") return "neutral";
  if (s === "contacted" || s === "done") return "good";
  if (s === "reviewing") return "warn";
  if (s === "new") return "bad";
  return "neutral";
}
