import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";

interface FuelEfficiencyRow {
  vehicleId: number;
  regNumber: string;
  totalDistanceKm: number;
  totalFuelLiters: number;
  kmPerLiter: number | null;
}
interface UtilizationRow {
  vehicleId: number;
  regNumber: string;
  totalTrips: number;
  activeOrCompletedTrips: number;
  status: string;
}
interface OperationalCostRow {
  vehicleId: number;
  regNumber: string;
  totalFuelCost: number;
  totalMaintenanceCost: number;
  totalExpenseCost: number;
  totalOperationalCost: number;
}
interface RoiRow {
  vehicleId: number;
  regNumber: string;
  totalRevenue: number | null;
  totalCost: number;
  roiPct: number | null;
}

const TABS = ["Fuel Efficiency", "Utilization", "Operational Cost", "ROI"] as const;
type Tab = (typeof TABS)[number];

export default function Reports() {
  const [tab, setTab] = useState<Tab>("Fuel Efficiency");
  const [error, setError] = useState<string | null>(null);
  const [fuelEff, setFuelEff] = useState<FuelEfficiencyRow[] | null>(null);
  const [util, setUtil] = useState<UtilizationRow[] | null>(null);
  const [cost, setCost] = useState<OperationalCostRow[] | null>(null);
  const [roi, setRoi] = useState<RoiRow[] | null>(null);

  useEffect(() => {
    setError(null);
    const load = async () => {
      try {
        if (tab === "Fuel Efficiency" && !fuelEff) setFuelEff(await api.get("/reports/fuel-efficiency"));
        if (tab === "Utilization" && !util) setUtil(await api.get("/reports/utilization"));
        if (tab === "Operational Cost" && !cost) setCost(await api.get("/reports/operational-cost"));
        if (tab === "ROI" && !roi) setRoi(await api.get("/reports/roi"));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load report");
      }
    };
    load();
  }, [tab]);

  function downloadCsv() {
    const token = localStorage.getItem("transitops_token");
    const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
    fetch(`${base}/reports/export.csv`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "trips-export.csv";
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setError("Failed to export CSV"));
  }

  return (
    <>
      <div className="page-header">
        <h2>Reports & Analytics</h2>
        <button className="btn btn-secondary" onClick={downloadCsv}>
          Export Trips CSV
        </button>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div className="filters-row">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? "btn btn-sm" : "btn btn-secondary btn-sm"} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === "Fuel Efficiency" &&
          (fuelEff ? (
            <table>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Total Distance (km)</th>
                  <th>Total Fuel (L)</th>
                  <th>km/L</th>
                </tr>
              </thead>
              <tbody>
                {fuelEff.map((r) => (
                  <tr key={r.vehicleId}>
                    <td>{r.regNumber}</td>
                    <td>{r.totalDistanceKm}</td>
                    <td>{r.totalFuelLiters}</td>
                    <td>{r.kmPerLiter ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">Loading...</div>
          ))}

        {tab === "Utilization" &&
          (util ? (
            <table>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Total Trips</th>
                  <th>Active/Completed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {util.map((r) => (
                  <tr key={r.vehicleId}>
                    <td>{r.regNumber}</td>
                    <td>{r.totalTrips}</td>
                    <td>{r.activeOrCompletedTrips}</td>
                    <td>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">Loading...</div>
          ))}

        {tab === "Operational Cost" &&
          (cost ? (
            <table>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Fuel Cost</th>
                  <th>Maintenance Cost</th>
                  <th>Other Expenses</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {cost.map((r) => (
                  <tr key={r.vehicleId}>
                    <td>{r.regNumber}</td>
                    <td>₹{r.totalFuelCost}</td>
                    <td>₹{r.totalMaintenanceCost}</td>
                    <td>₹{r.totalExpenseCost}</td>
                    <td>₹{r.totalOperationalCost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">Loading...</div>
          ))}

        {tab === "ROI" &&
          (roi ? (
            <table>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Revenue</th>
                  <th>Total Cost</th>
                  <th>ROI %</th>
                </tr>
              </thead>
              <tbody>
                {roi.map((r) => (
                  <tr key={r.vehicleId}>
                    <td>{r.regNumber}</td>
                    <td>{r.totalRevenue != null ? `₹${r.totalRevenue}` : "—"}</td>
                    <td>₹{r.totalCost}</td>
                    <td>{r.roiPct != null ? `${r.roiPct}%` : "— (no revenue data)"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">Loading...</div>
          ))}
      </div>
    </>
  );
}
