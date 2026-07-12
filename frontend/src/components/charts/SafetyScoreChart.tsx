import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DriverSafetyScore } from "../../api/types";

const BAND_COLOR: Record<string, string> = {
  Excellent: "#34d399",
  Good: "#5b8cff",
  Fair: "#fbbf24",
  "At Risk": "#f87171",
};

export default function SafetyScoreChart({ data }: { data: DriverSafetyScore[] }) {
  const sorted = [...data].sort((a, b) => a.safetyScore - b.safetyScore).slice(0, 10);
  if (sorted.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 4 }}>Driver Safety Score Ranking</h3>
      <p style={{ marginTop: 0, marginBottom: 12, fontSize: 12, color: "var(--text-dim)" }}>
        Computed from completion/cancellation rate, cargo utilization, route deviation, and license-expiry proximity.
      </p>
      <ResponsiveContainer width="100%" height={Math.max(180, sorted.length * 32)}>
        <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 16 }}>
          <XAxis type="number" domain={[0, 100]} tick={{ fill: "var(--text-dim)", fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={110} tick={{ fill: "var(--text-dim)", fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}
            formatter={(value: unknown, _name: unknown, entry: any) => [`${value} (${entry.payload.band})`, "Safety score"]}
          />
          <Bar dataKey="safetyScore" radius={[0, 4, 4, 0]}>
            {sorted.map((entry) => (
              <Cell key={entry.driverId} fill={BAND_COLOR[entry.band] ?? "#5b8cff"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
