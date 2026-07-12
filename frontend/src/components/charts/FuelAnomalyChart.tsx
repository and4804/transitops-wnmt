import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import type { FuelAnomaly } from "../../api/types";

export default function FuelAnomalyChart({ data }: { data: FuelAnomaly[] }) {
  const withKm = data.filter((d) => d.litersPerKm != null && d.costPerLiter != null);
  const normal = withKm.filter((d) => !d.isAnomaly);
  const flagged = data.filter((d) => d.isAnomaly);

  if (data.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 4 }}>Fuel Anomaly Detection</h3>
      <p style={{ marginTop: 0, marginBottom: 12, fontSize: 12, color: "var(--text-dim)" }}>
        Liters/km vs cost/liter per fuel log, grouped by vehicle type. Red points fall outside the normal cluster.
      </p>
      {withKm.length > 0 && (
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="var(--border)" />
            <XAxis
              type="number"
              dataKey="litersPerKm"
              name="Liters/km"
              tick={{ fill: "var(--text-dim)", fontSize: 12 }}
              label={{ value: "Liters/km", position: "insideBottom", offset: -4, fill: "var(--text-dim)", fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="costPerLiter"
              name="Cost/liter"
              tick={{ fill: "var(--text-dim)", fontSize: 12 }}
              label={{ value: "Cost/liter (₹)", angle: -90, position: "insideLeft", fill: "var(--text-dim)", fontSize: 12 }}
            />
            <ZAxis range={[40, 40]} />
            <Tooltip
              contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}
              formatter={(value: unknown, name: unknown) => [typeof value === "number" ? value.toFixed(2) : String(value), String(name)]}
            />
            <Scatter name="Normal" data={normal} fill="#5b8cff" />
            <Scatter name="Flagged" data={data.filter((d) => d.isAnomaly && d.litersPerKm != null)} fill="#f87171" />
          </ScatterChart>
        </ResponsiveContainer>
      )}

      {flagged.length > 0 && (
        <>
          <h4 style={{ margin: "16px 0 8px" }}>Flagged Entries ({flagged.length})</h4>
          <table>
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Date</th>
                <th>Liters</th>
                <th>Cost</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {flagged.slice(0, 15).map((f) => (
                <tr key={f.fuelLogId}>
                  <td>{f.regNumber}</td>
                  <td>{f.date.slice(0, 10)}</td>
                  <td>{f.liters}</td>
                  <td>₹{f.cost}</td>
                  <td style={{ color: "var(--danger)" }}>{f.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
