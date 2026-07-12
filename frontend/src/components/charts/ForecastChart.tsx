import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface ForecastPoint {
  label: string;
  historyValue: number | null;
  forecastValue: number | null;
  lower: number | null;
  upper: number | null;
}

interface ForecastChartProps {
  title: string;
  description: string;
  points: ForecastPoint[];
  unit?: string;
  color?: string;
  height?: number;
}

export default function ForecastChart({ title, description, points, unit = "", color = "#5b8cff", height = 220 }: ForecastChartProps) {
  if (points.length === 0) return null;

  const bandData = points.map((p) => ({ ...p, band: p.lower != null && p.upper != null ? [p.lower, p.upper] : null }));

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 4 }}>{title}</h3>
      <p style={{ marginTop: 0, marginBottom: 12, fontSize: 12, color: "var(--text-dim)" }}>{description}</p>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={bandData} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
          <CartesianGrid stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fill: "var(--text-dim)", fontSize: 12 }} />
          <YAxis tick={{ fill: "var(--text-dim)", fontSize: 12 }} unit={unit} />
          <Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }} />
          <Area dataKey="band" stroke="none" fill={color} fillOpacity={0.12} isAnimationActive={false} />
          <Line type="monotone" dataKey="historyValue" name="Actual" stroke={color} strokeWidth={2} dot={false} connectNulls={false} />
          <Line
            type="monotone"
            dataKey="forecastValue"
            name="Forecast"
            stroke={color}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
