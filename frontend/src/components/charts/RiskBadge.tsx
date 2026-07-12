const COLORS: Record<string, { bg: string; fg: string }> = {
  Low: { bg: "rgba(52,211,153,0.15)", fg: "var(--accent-2)" },
  Medium: { bg: "rgba(251,191,36,0.15)", fg: "var(--warn)" },
  High: { bg: "rgba(248,113,113,0.15)", fg: "var(--danger)" },
  Excellent: { bg: "rgba(52,211,153,0.15)", fg: "var(--accent-2)" },
  Good: { bg: "rgba(91,140,255,0.15)", fg: "var(--accent)" },
  Fair: { bg: "rgba(251,191,36,0.15)", fg: "var(--warn)" },
  "At Risk": { bg: "rgba(248,113,113,0.15)", fg: "var(--danger)" },
};

export default function RiskBadge({ label }: { label: string }) {
  const c = COLORS[label] ?? { bg: "rgba(148,163,184,0.15)", fg: "var(--text-dim)" };
  return (
    <span className="badge" style={{ background: c.bg, color: c.fg }}>
      {label}
    </span>
  );
}
