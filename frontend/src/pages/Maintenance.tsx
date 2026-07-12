import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Maintenance as MaintenanceRecord, Vehicle } from "../api/types";
import Badge from "../components/Badge";
import { useAuth } from "../auth/AuthContext";

const emptyForm = { vehicleId: "", description: "", cost: "" };

export default function Maintenance() {
  const { user } = useAuth();
  const canManage = user?.role === "FleetManager";
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    api
      .get<MaintenanceRecord[]>("/maintenance")
      .then(setRecords)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load maintenance records"));
  }

  useEffect(load, []);

  function openCreate() {
    setFormError(null);
    setForm(emptyForm);
    api
      .get<Vehicle[]>("/vehicles")
      .then((v) => {
        setVehicles(v.filter((x) => x.status !== "InShop" && x.status !== "Retired"));
        setShowForm(true);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load vehicles"));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await api.post("/maintenance", {
        vehicleId: Number(form.vehicleId),
        description: form.description,
        cost: Number(form.cost),
      });
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create maintenance record");
    }
  }

  async function close(record: MaintenanceRecord) {
    try {
      await api.post(`/maintenance/${record.id}/close`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to close maintenance record");
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>Maintenance</h2>
        {canManage && (
          <button className="btn" onClick={openCreate}>
            + Open Record
          </button>
        )}
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div className="card">
        {records.length === 0 ? (
          <div className="empty-state">No maintenance records.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Vehicle</th>
                <th>Description</th>
                <th>Cost</th>
                <th>Status</th>
                <th>Opened</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>#{r.vehicleId}</td>
                  <td>{r.description}</td>
                  <td>₹{r.cost}</td>
                  <td>
                    <Badge status={r.status} />
                  </td>
                  <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                  {canManage && (
                    <td>
                      {r.status === "Open" && (
                        <button className="btn btn-secondary btn-sm" onClick={() => close(r)}>
                          Close
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Open Maintenance Record</h3>
            {formError && <div className="error-banner">{formError}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-field">
                  <label>Vehicle</label>
                  <select required value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
                    <option value="">Select vehicle</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.regNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Description</label>
                  <input
                    required
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Cost</label>
                  <input required type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
                </div>
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
