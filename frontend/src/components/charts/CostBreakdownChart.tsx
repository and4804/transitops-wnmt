import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface OperationalCostRow {
  vehicleId: number;
  regNumber: string;
  totalFuelCost: number;
  totalMaintenanceCost: number;
  totalExpenseCost: number;
  totalOperationalCost: number;
}

export default function CostBreakdownChart({ data }: { data: OperationalCostRow[] }) {
  if (data.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 4 }}>Cost Breakdown by Vehicle</h3>
      <p style={{ marginTop: 0, marginBottom: 12, fontSize: 12, color: "var(--text-dim)" }}>
        Fuel, maintenance, and other expenses stacked per vehicle.
      </p>
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 30)}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis type="number" tick={{ fill: "var(--text-dim)", fontSize: 12 }} />
          <YAxis type="category" dataKey="regNumber" width={80} tick={{ fill: "var(--text-dim)", fontSize: 12 }} />
          <Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="totalFuelCost" name="Fuel" stackId="cost" fill="#5b8cff" />
          <Bar dataKey="totalMaintenanceCost" name="Maintenance" stackId="cost" fill="#f87171" />
          <Bar dataKey="totalExpenseCost" name="Other" stackId="cost" fill="#fbbf24" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
