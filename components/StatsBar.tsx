"use client";
import type { Stats } from "@/lib/db";

type Props = { stats: Stats | null; loading: boolean; };

const CARDS = [
  { key: "total",       label: "Total Leads",   sub: "all time",        color: "#3b82f6", glow: "rgba(59,130,246,0.25)",  topBorder: "rgba(59,130,246,0.6)"  },
  { key: "fatal",       label: "Fatal",          sub: "severity · fatal", color: "#f87171", glow: "rgba(248,113,113,0.2)", topBorder: "rgba(248,113,113,0.7)" },
  { key: "highPriority",label: "High Priority",  sub: "score ≥ 85",      color: "#fb923c", glow: "rgba(251,146,60,0.2)",  topBorder: "rgba(251,146,60,0.7)"  },
  { key: "newLeads",    label: "New",            sub: "awaiting review",  color: "#4ade80", glow: "rgba(74,222,128,0.15)", topBorder: "rgba(74,222,128,0.6)"  },
] as const;

function Skel() {
  return (
    <div style={{
      height: 36, width: "60%", borderRadius: 8,
      background: "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%)",
      backgroundSize: "400px 100%",
      animation: "shimmer 1.4s infinite linear",
    }} />
  );
}

export default function StatsBar({ stats, loading }: Props) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
      {CARDS.map(({ key, label, sub, color, glow, topBorder }) => {
        const val = stats?.[key];
        return (
          <div key={key} style={{
            background: "#0c1526",
            border: "1px solid #1a2d4a",
            borderTop: `2px solid ${topBorder}`,
            borderRadius: 14,
            padding: "18px 22px 16px",
            boxShadow: `0 4px 24px rgba(0,0,0,0.35), 0 0 0 0 ${glow}`,
            transition: "box-shadow 0.2s",
            animation: "fadeUp 0.4s ease both",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px rgba(0,0,0,0.4), 0 0 24px ${glow}`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 24px rgba(0,0,0,0.35)`; }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#4a6080", marginBottom: 10 }}>
              {label}
            </div>
            {loading || val == null
              ? <Skel />
              : <div style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1, letterSpacing: -1.5, marginBottom: 6 }}>
                  {val.toLocaleString()}
                </div>
            }
            <div style={{ fontSize: 11, color: "#2a4060", marginTop: 6 }}>{sub}</div>
          </div>
        );
      })}
    </div>
  );
}
