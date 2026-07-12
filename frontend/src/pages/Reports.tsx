import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { getCostRoiForecast } from "../api/ml";
import { downloadFile } from "../api/download";
import ForecastChart, { type ForecastPoint } from "../components/charts/ForecastChart";
import CostBreakdownChart from "../components/charts/CostBreakdownChart";
import type { CostRoiForecast, Vehicle } from "../api/types";

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

const TAB_TO_REPORT_TYPE: Record<Tab, string> = {
  "Fuel Efficiency": "fuel-efficiency",
  Utilization: "utilization",
  "Operational Cost": "operational-cost",
  ROI: "roi",
};

function buildForecastSeries(
  history: { label: string; value: number | null }[],
  forecastPoint: { label: string; value: number | null; lower: number | null; upper: number | null } | null
): ForecastPoint[] {
  const points: ForecastPoint[] = history.map((h, i) => ({
    label: h.label,
    historyValue: h.value,
    forecastValue: i === history.length - 1 ? h.value : null,
    lower: null,
    upper: null,
  }));
  if (forecastPoint) {
    points.push({
      label: forecastPoint.label,
      historyValue: null,
      forecastValue: forecastPoint.value,
      lower: forecastPoint.lower,
      upper: forecastPoint.upper,
    });
  }
  return points;
}

export default function Reports() {
  const [tab, setTab] = useState<Tab>("Fuel Efficiency");
  const [error, setError] = useState<string | null>(null);
  const [fuelEff, setFuelEff] = useState<FuelEfficiencyRow[] | null>(null);
  const [util, setUtil] = useState<UtilizationRow[] | null>(null);
  const [cost, setCost] = useState<OperationalCostRow[] | null>(null);
  const [roi, setRoi] = useState<RoiRow[] | null>(null);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [forecastVehicleId, setForecastVehicleId] = useState<string>("");
  const [forecast, setForecast] = useState<CostRoiForecast | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Vehicle[]>("/vehicles").then(setVehicles).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== "Operational Cost" && tab !== "ROI") return;
    setForecastError(null);
    getCostRoiForecast(forecastVehicleId ? Number(forecastVehicleId) : undefined)
      .then(setForecast)
      .catch(() => setForecastError("ML insights unavailable — analytics service offline"));
  }, [tab, forecastVehicleId]);

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
    downloadFile("/reports/export.csv", "trips-export.csv").catch(() => setError("Failed to export CSV"));
  }

  function downloadPdf() {
    const type = TAB_TO_REPORT_TYPE[tab];
    downloadFile(`/reports/export.pdf?type=${type}`, `${type}-report.pdf`).catch(() =>
      setError("Failed to export PDF")
    );
  }

  return (
    <>
      <div className="page-header">
        <h2>Reports & Analytics</h2>
        <div className="actions-row">
          <button className="btn btn-secondary" onClick={downloadPdf}>
            Export PDF
          </button>
          <button className="btn btn-secondary" onClick={downloadCsv}>
            Export Trips CSV
          </button>
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div className="filters-row">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? "btn btn-sm" : "btn btn-secondary btn-sm"} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {(tab === "Operational Cost" || tab === "ROI") && (
        <>
          <div className="filters-row">
            <select value={forecastVehicleId} onChange={(e) => setForecastVehicleId(e.target.value)}>
              <option value="">Fleet-wide forecast</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.regNumber}
                </option>
              ))}
            </select>
          </div>
          {forecastError && <div className="error-banner">{forecastError}</div>}
          {forecast &&
            (tab === "Operational Cost" ? (
              <ForecastChart
                title="Operational Cost Forecast"
                description="Historical monthly fuel + maintenance + expense cost, with next-month projection."
                unit="₹"
                color="#f87171"
                points={buildForecastSeries(
                  forecast.history.map((h) => ({ label: h.month, value: h.cost })),
                  forecast.forecast
                    ? { label: forecast.forecast.month, value: forecast.forecast.predictedCost, lower: forecast.forecast.costLower, upper: forecast.forecast.costUpper }
                    : null
                )}
              />
            ) : (
              <ForecastChart
                title="ROI Forecast"
                description="Historical monthly ROI %, with next-month projection (only available for months with recorded revenue)."
                unit="%"
                color="#34d399"
                points={buildForecastSeries(
                  forecast.history.map((h) => ({ label: h.month, value: h.roiPct })),
                  forecast.forecast && forecast.forecast.predictedRoiPct != null
                    ? {
                        label: forecast.forecast.month,
                        value: forecast.forecast.predictedRoiPct,
                        lower: forecast.forecast.roiLower,
                        upper: forecast.forecast.roiUpper,
                      }
                    : null
                )}
              />
            ))}
        </>
      )}

      {tab === "Operational Cost" && cost && cost.length > 0 && <CostBreakdownChart data={cost} />}

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
