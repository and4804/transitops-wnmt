import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { getUtilizationForecast } from "../api/ml";
import type { DashboardKpis, UtilizationForecast } from "../api/types";
import ForecastChart, { type ForecastPoint } from "../components/charts/ForecastChart";

const KPI_LABELS: { key: keyof DashboardKpis; label: string; suffix?: string }[] = [
  { key: "activeVehicles", label: "Active Vehicles" },
  { key: "availableVehicles", label: "Available" },
  { key: "inShopVehicles", label: "In Shop" },
  { key: "activeTrips", label: "Active Trips" },
  { key: "pendingTrips", label: "Pending Trips" },
  { key: "driversOnDuty", label: "Drivers On Duty" },
  { key: "fleetUtilizationPct", label: "Fleet Utilization", suffix: "%" },
];

export default function Dashboard() {
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [utilForecast, setUtilForecast] = useState<UtilizationForecast | null>(null);
  const [utilError, setUtilError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardKpis>("/dashboard/kpis")
      .then(setKpis)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load dashboard"));
    getUtilizationForecast()
      .then(setUtilForecast)
      .catch(() => setUtilError("ML insights unavailable — analytics service offline"));
  }, []);

  const utilPoints: ForecastPoint[] = utilForecast
    ? [
        ...utilForecast.history.map((h, i) => ({
          label: h.date.slice(5),
          historyValue: h.utilizationPct,
          forecastValue: i === utilForecast.history.length - 1 ? h.utilizationPct : null,
          lower: null,
          upper: null,
        })),
        ...utilForecast.forecast.map((f) => ({
          label: f.date.slice(5),
          historyValue: null,
          forecastValue: f.predictedUtilizationPct,
          lower: f.lower,
          upper: f.upper,
        })),
      ]
    : [];

  return (
    <>
      <div className="page-header">
        <h2>Dashboard</h2>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {!kpis && !error && <div className="empty-state">Loading...</div>}
      {kpis && (
        <div className="kpi-grid">
          {KPI_LABELS.map(({ key, label, suffix }) => (
            <div className="kpi-card" key={key}>
              <div className="label">{label}</div>
              <div className="value">
                {kpis[key]}
                {suffix ?? ""}
              </div>
            </div>
          ))}
        </div>
      )}
      {utilError && <div className="error-banner">{utilError}</div>}
      {utilPoints.length > 0 && (
        <ForecastChart
          title="Fleet Utilization Forecast"
          description="Daily % of the fleet on-trip, reconstructed from trip dispatch/completion history, with a 14-day projection."
          unit="%"
          color="#5b8cff"
          height={260}
          points={utilPoints}
        />
      )}
    </>
  );
}
