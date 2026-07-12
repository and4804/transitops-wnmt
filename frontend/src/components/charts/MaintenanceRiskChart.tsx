import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MaintenanceRisk } from "../../api/types";

const BUCKET_COLOR: Record<string, string> = { Low: "#34d399", Medium: "#fbbf24", High: "#f87171" };

export default function MaintenanceRiskChart({ data }: { data: MaintenanceRisk[] }) {
  const top = [...data].sort((a, b) => b.riskScore - a.riskScore).slice(0, 8);
  if (top.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 4 }}>Top At-Risk Vehicles</h3>
      <p style={{ marginTop: 0, marginBottom: 12, fontSize: 12, color: "var(--text-dim)" }}>
        Predicted risk of needing maintenance soon, from usage since last service.
      </p>
      <ResponsiveContainer width="100%" height={Math.max(160, top.length * 34)}>
        <BarChart data={top} layout="vertical" margin={{ left: 8, right: 16 }}>
          <XAxis type="number" domain={[0, 1]} tick={{ fill: "var(--text-dim)", fontSize: 12 }} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
          <YAxis type="category" dataKey="regNumber" width={80} tick={{ fill: "var(--text-dim)", fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}
            formatter={(value: unknown) => [`${Math.round(Number(value) * 100)}%`, "Risk score"]}
          />
          <Bar dataKey="riskScore" radius={[0, 4, 4, 0]}>
            {top.map((entry) => (
              <Cell key={entry.vehicleId} fill={BUCKET_COLOR[entry.riskBucket] ?? "#5b8cff"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
