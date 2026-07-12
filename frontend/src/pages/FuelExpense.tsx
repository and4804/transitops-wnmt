import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../api/client";
import { getFuelAnomalies } from "../api/ml";
import type { CostSummary, ExpenseType, FuelAnomaly, Vehicle } from "../api/types";
import FuelAnomalyChart from "../components/charts/FuelAnomalyChart";
import { useAuth } from "../auth/AuthContext";

const EXPENSE_TYPES: ExpenseType[] = ["Toll", "Parking", "Fine", "Insurance", "Other"];

export default function FuelExpense() {
  const { user } = useAuth();
  const canSeeAnomalies = user?.role === "FleetManager" || user?.role === "FinancialAnalyst";
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [anomalies, setAnomalies] = useState<FuelAnomaly[]>([]);
  const [anomalyError, setAnomalyError] = useState<string | null>(null);

  useEffect(() => {
    if (!canSeeAnomalies) return;
    getFuelAnomalies()
      .then(setAnomalies)
      .catch(() => setAnomalyError("ML insights unavailable — analytics service offline"));
  }, [canSeeAnomalies]);

  const [fuelForm, setFuelForm] = useState({ vehicleId: "", liters: "", cost: "", date: "" });
  const [expenseForm, setExpenseForm] = useState({
    vehicleId: "",
    type: "Toll" as ExpenseType,
    amount: "",
    date: "",
    description: "",
  });

  const [summaryVehicleId, setSummaryVehicleId] = useState("");
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Vehicle[]>("/vehicles").then(setVehicles).catch(() => {});
  }, []);

  async function submitFuel(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await api.post("/fuel-logs", {
        vehicleId: Number(fuelForm.vehicleId),
        liters: Number(fuelForm.liters),
        cost: Number(fuelForm.cost),
        date: fuelForm.date,
      });
      setSuccess("Fuel log recorded.");
      setFuelForm({ vehicleId: "", liters: "", cost: "", date: "" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to log fuel entry");
    }
  }

  async function submitExpense(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await api.post("/expenses", {
        vehicleId: Number(expenseForm.vehicleId),
        type: expenseForm.type,
        amount: Number(expenseForm.amount),
        date: expenseForm.date,
        description: expenseForm.description || null,
      });
      setSuccess("Expense recorded.");
      setExpenseForm({ vehicleId: "", type: "Toll", amount: "", date: "", description: "" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to log expense");
    }
  }

  async function lookupSummary(e: FormEvent) {
    e.preventDefault();
    setSummaryError(null);
    setSummary(null);
    try {
      const s = await api.get<CostSummary>(`/vehicles/${summaryVehicleId}/cost-summary`);
      setSummary(s);
    } catch (err) {
      setSummaryError(err instanceof ApiError ? err.message : "Failed to load cost summary");
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>Fuel & Expense</h2>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {success && <div className="card" style={{ marginBottom: 16, color: "var(--accent-2)" }}>{success}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Log Fuel Entry</h3>
          <form onSubmit={submitFuel}>
            <div className="form-field" style={{ marginBottom: 10 }}>
              <label>Vehicle</label>
              <select required value={fuelForm.vehicleId} onChange={(e) => setFuelForm({ ...fuelForm, vehicleId: e.target.value })}>
                <option value="">Select vehicle</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.regNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ marginBottom: 10 }}>
              <label>Liters</label>
              <input required type="number" value={fuelForm.liters} onChange={(e) => setFuelForm({ ...fuelForm, liters: e.target.value })} />
            </div>
            <div className="form-field" style={{ marginBottom: 10 }}>
              <label>Cost</label>
              <input required type="number" value={fuelForm.cost} onChange={(e) => setFuelForm({ ...fuelForm, cost: e.target.value })} />
            </div>
            <div className="form-field" style={{ marginBottom: 12 }}>
              <label>Date</label>
              <input required type="date" value={fuelForm.date} onChange={(e) => setFuelForm({ ...fuelForm, date: e.target.value })} />
            </div>
            <button className="btn" type="submit">
              Log Fuel
            </button>
          </form>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Log Expense</h3>
          <form onSubmit={submitExpense}>
            <div className="form-field" style={{ marginBottom: 10 }}>
              <label>Vehicle</label>
              <select
                required
                value={expenseForm.vehicleId}
                onChange={(e) => setExpenseForm({ ...expenseForm, vehicleId: e.target.value })}
              >
                <option value="">Select vehicle</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.regNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ marginBottom: 10 }}>
              <label>Type</label>
              <select value={expenseForm.type} onChange={(e) => setExpenseForm({ ...expenseForm, type: e.target.value as ExpenseType })}>
                {EXPENSE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ marginBottom: 10 }}>
              <label>Amount</label>
              <input
                required
                type="number"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              />
            </div>
            <div className="form-field" style={{ marginBottom: 10 }}>
              <label>Date</label>
              <input
                required
                type="date"
                value={expenseForm.date}
                onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
              />
            </div>
            <div className="form-field" style={{ marginBottom: 12 }}>
              <label>Description (optional)</label>
              <input
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              />
            </div>
            <button className="btn" type="submit">
              Log Expense
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Vehicle Cost Summary</h3>
        {summaryError && <div className="error-banner">{summaryError}</div>}
        <form onSubmit={lookupSummary} className="filters-row">
          <select required value={summaryVehicleId} onChange={(e) => setSummaryVehicleId(e.target.value)}>
            <option value="">Select vehicle</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.regNumber}
              </option>
            ))}
          </select>
          <button className="btn btn-secondary" type="submit">
            Look up
          </button>
        </form>
        {summary && (
          <div className="kpi-grid" style={{ marginTop: 14, marginBottom: 0 }}>
            <div className="kpi-card">
              <div className="label">Fuel Cost</div>
              <div className="value">₹{summary.totalFuelCost}</div>
            </div>
            <div className="kpi-card">
              <div className="label">Maintenance Cost</div>
              <div className="value">₹{summary.totalMaintenanceCost}</div>
            </div>
            <div className="kpi-card">
              <div className="label">Other Expenses</div>
              <div className="value">₹{summary.totalExpenseCost}</div>
            </div>
            <div className="kpi-card">
              <div className="label">Total Cost</div>
              <div className="value">₹{summary.totalCost}</div>
            </div>
          </div>
        )}
      </div>

      {canSeeAnomalies && (
        <>
          {anomalyError && <div className="error-banner">{anomalyError}</div>}
          <FuelAnomalyChart data={anomalies} />
        </>
      )}
    </>
  );
}
