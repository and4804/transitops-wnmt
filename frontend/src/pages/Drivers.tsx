import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { getDriverSafetyScores } from "../api/ml";
import type { Driver, DriverSafetyScore, DriverStatus } from "../api/types";
import Badge from "../components/Badge";
import RiskBadge from "../components/charts/RiskBadge";
import SafetyScoreChart from "../components/charts/SafetyScoreChart";
import { useAuth } from "../auth/AuthContext";

const STATUSES: DriverStatus[] = ["Available", "OnTrip", "Suspended"];

const emptyForm = {
  name: "",
  licenseNumber: "",
  licenseCategory: "LMV",
  licenseExpiry: "",
  contactNumber: "",
  safetyScore: "96",
  status: "Available" as DriverStatus,
};

function isExpiringSoon(expiry: string): boolean {
  const days = (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return days < 30;
}

export default function Drivers() {
  const { user } = useAuth();
  const canManage = user?.role === "FleetManager" || user?.role === "SafetyOfficer";
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [safetyScores, setSafetyScores] = useState<DriverSafetyScore[]>([]);
  const [safetyError, setSafetyError] = useState<string | null>(null);

  useEffect(() => {
    if (!canManage) return;
    getDriverSafetyScores()
      .then(setSafetyScores)
      .catch(() => setSafetyError("ML insights unavailable — analytics service offline"));
  }, [canManage]);

  function safetyFor(driverId: number) {
    return safetyScores.find((s) => s.driverId === driverId);
  }

  function load() {
    const params = statusFilter ? `?status=${statusFilter}` : "";
    api
      .get<Driver[]>(`/drivers${params}`)
      .then(setDrivers)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load drivers"));
  }

  useEffect(load, [statusFilter]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(d: Driver) {
    setEditing(d);
    setForm({
      name: d.name,
      licenseNumber: d.licenseNumber,
      licenseCategory: d.licenseCategory,
      licenseExpiry: d.licenseExpiry.slice(0, 10),
      contactNumber: d.contactNumber,
      safetyScore: String(d.safetyScore),
      status: d.status,
    });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      if (editing) {
        await api.put(`/drivers/${editing.id}`, {
          name: form.name,
          licenseNumber: form.licenseNumber,
          licenseCategory: form.licenseCategory,
          licenseExpiry: form.licenseExpiry,
          contactNumber: form.contactNumber,
          safetyScore: Number(form.safetyScore),
          status: form.status,
        });
      } else {
        await api.post("/drivers", {
          name: form.name,
          licenseNumber: form.licenseNumber,
          licenseCategory: form.licenseCategory,
          licenseExpiry: form.licenseExpiry,
          contactNumber: form.contactNumber,
        });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save driver");
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>Drivers</h2>
        {canManage && (
          <button className="btn" onClick={openCreate}>
            + Add Driver
          </button>
        )}
      </div>
      {error && <div className="error-banner">{error}</div>}
      {canManage && safetyError && <div className="error-banner">{safetyError}</div>}
      {canManage && safetyScores.length > 0 && <SafetyScoreChart data={safetyScores} />}
      <div className="filters-row">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="card">
        {drivers.length === 0 ? (
          <div className="empty-state">No drivers found.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>License No.</th>
                <th>Category</th>
                <th>Expiry</th>
                <th>Contact</th>
                <th>Safety Score</th>
                <th>Status</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => {
                const computed = safetyFor(d.id);
                return (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>{d.licenseNumber}</td>
                  <td>{d.licenseCategory}</td>
                  <td style={{ color: isExpiringSoon(d.licenseExpiry) ? "var(--danger)" : undefined }}>
                    {d.licenseExpiry.slice(0, 10)}
                    {isExpiringSoon(d.licenseExpiry) ? " ⚠" : ""}
                  </td>
                  <td>{d.contactNumber}</td>
                  <td>
                    {computed ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {computed.safetyScore}
                        <RiskBadge label={computed.band} />
                      </span>
                    ) : (
                      d.safetyScore
                    )}
                  </td>
                  <td>
                    <Badge status={d.status} />
                  </td>
                  {canManage && (
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(d)}>
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? `Edit ${editing.name}` : "Add Driver"}</h3>
            {formError && <div className="error-banner">{formError}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-field">
                  <label>Name</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>License Number</label>
                  <input
                    required
                    value={form.licenseNumber}
                    onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>License Category</label>
                  <input
                    required
                    value={form.licenseCategory}
                    onChange={(e) => setForm({ ...form, licenseCategory: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>License Expiry</label>
                  <input
                    required
                    type="date"
                    value={form.licenseExpiry}
                    onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Contact Number</label>
                  <input
                    required
                    value={form.contactNumber}
                    onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
                  />
                </div>
                {editing && (
                  <>
                    <div className="form-field">
                      <label>Safety Score</label>
                      <input
                        type="number"
                        value={form.safetyScore}
                        onChange={(e) => setForm({ ...form, safetyScore: e.target.value })}
                      />
                    </div>
                    <div className="form-field">
                      <label>Status</label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value as DriverStatus })}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
              <div className="actions-row">
                <button className="btn" type="submit">
                  Save
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
