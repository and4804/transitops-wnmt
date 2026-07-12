import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const STATUS_COLOR: Record<string, string> = {
  Available: "#34d399",
  OnTrip: "#5b8cff",
  InShop: "#fbbf24",
  Retired: "#93a0bd",
};

export default function StatusPieChart({ data, title }: { data: { name: string; value: number }[]; title: string }) {
  const nonZero = data.filter((d) => d.value > 0);
  if (nonZero.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={nonZero} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {nonZero.map((entry) => (
              <Cell key={entry.name} fill={STATUS_COLOR[entry.name] ?? "#5b8cff"} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
