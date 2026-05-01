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
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: "1px solid",
    userSelect: "none",
    whiteSpace: "nowrap",
    lineHeight: 1.2,
  };
  if (kind === "good") return { ...base, background: "#eefbf1", borderColor: "#c8eed2", color: "#156b2d" };
  if (kind === "warn") return { ...base, background: "#fff7ed", borderColor: "#fed7aa", color: "#7c3e0a" };
  if (kind === "bad") return { ...base, background: "#fff1f2", borderColor: "#fecdd3", color: "#9f1239" };
  return { ...base, background: "#f6f7f9", borderColor: "#e5e7eb", color: "#374151" };
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
