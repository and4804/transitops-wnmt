import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { DashboardKpis } from "../api/types";

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

  useEffect(() => {
    api
      .get<DashboardKpis>("/dashboard/kpis")
      .then(setKpis)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load dashboard"));
  }, []);

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
    </>
  );
}
