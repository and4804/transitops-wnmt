import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import { getMaintenanceRisk } from "../api/ml";
import { downloadFile } from "../api/download";
import type { MaintenanceRisk, Vehicle, VehicleStatus, VehicleType } from "../api/types";
import Badge from "../components/Badge";
import MaintenanceRiskChart from "../components/charts/MaintenanceRiskChart";
import RiskBadge from "../components/charts/RiskBadge";
import SortableHeader, { type SortState } from "../components/SortableHeader";
import VehicleDocumentsModal from "../components/VehicleDocumentsModal";
import { useAuth } from "../auth/AuthContext";

const TYPES: VehicleType[] = ["Van", "Truck", "Mini", "Bus", "Other"];
const STATUSES: VehicleStatus[] = ["Available", "OnTrip", "InShop", "Retired"];

const emptyForm = {
  regNumber: "",
  name: "",
  model: "",
  type: "Van" as VehicleType,
  maxLoadCapacityKg: "",
  acquisitionCost: "",
  region: "",
};

export default function Vehicles() {
  const { user } = useAuth();
  const canManage = user?.role === "FleetManager";
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState<SortState>({ sortBy: "id", sortDir: "asc" });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [risk, setRisk] = useState<MaintenanceRisk[]>([]);
  const [riskError, setRiskError] = useState<string | null>(null);
  const [docsVehicle, setDocsVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!canManage) return;
    getMaintenanceRisk()
      .then(setRisk)
      .catch(() => setRiskError("ML insights unavailable — analytics service offline"));
  }, [canManage]);

  function riskFor(vehicleId: number) {
    return risk.find((r) => r.vehicleId === vehicleId);
  }

  function load() {
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("q", search);
    params.set("sortBy", sort.sortBy);
    params.set("sortDir", sort.sortDir);
    api
      .get<Vehicle[]>(`/vehicles?${params.toString()}`)
      .then(setVehicles)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load vehicles"));
  }

  useEffect(load, [typeFilter, statusFilter, search, sort]);

  function downloadPdf() {
    downloadFile("/vehicles/export.pdf", "vehicle-registry-report.pdf").catch(() =>
      setError("Failed to export PDF")
    );
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(v: Vehicle) {
    setEditing(v);
    setForm({
      regNumber: v.regNumber,
      name: v.name,
      model: v.model,
      type: v.type,
      maxLoadCapacityKg: String(v.maxLoadCapacityKg),
      acquisitionCost: String(v.acquisitionCost),
      region: v.region ?? "",
    });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      if (editing) {
        await api.put(`/vehicles/${editing.id}`, {
          name: form.name,
          model: form.model,
          type: form.type,
          maxLoadCapacityKg: Number(form.maxLoadCapacityKg),
          acquisitionCost: Number(form.acquisitionCost),
          region: form.region || null,
          status: editing.status,
        });
      } else {
        await api.post("/vehicles", {
          regNumber: form.regNumber,
          name: form.name,
          model: form.model,
          type: form.type,
          maxLoadCapacityKg: Number(form.maxLoadCapacityKg),
          acquisitionCost: Number(form.acquisitionCost),
          region: form.region || null,
        });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save vehicle");
    }
  }

  async function retire(v: Vehicle) {
    if (!confirm(`Retire vehicle ${v.regNumber}?`)) return;
    try {
      await api.put(`/vehicles/${v.id}`, {
        name: v.name,
        model: v.model,
        type: v.type,
        maxLoadCapacityKg: v.maxLoadCapacityKg,
        acquisitionCost: v.acquisitionCost,
        region: v.region,
        status: "Retired",
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to retire vehicle");
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>Vehicle Registry</h2>
        <div className="actions-row">
          <button className="btn btn-secondary" onClick={downloadPdf}>
            Export PDF
          </button>
          {canManage && (
            <button className="btn" onClick={openCreate}>
              + Register Vehicle
            </button>
          )}
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {canManage && riskError && <div className="error-banner">{riskError}</div>}
      {canManage && risk.length > 0 && <MaintenanceRiskChart data={risk} />}
      <div className="filters-row">
        <input
          placeholder="Search reg no., name, model…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
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
        {vehicles.length === 0 ? (
          <div className="empty-state">No vehicles found.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <SortableHeader field="regNumber" label="Reg No." sort={sort} onChange={setSort} />
                <SortableHeader field="name" label="Name" sort={sort} onChange={setSort} />
                <SortableHeader field="type" label="Type" sort={sort} onChange={setSort} />
                <th>Capacity (kg)</th>
                <SortableHeader field="odometerKm" label="Odometer (km)" sort={sort} onChange={setSort} />
                <SortableHeader field="region" label="Region" sort={sort} onChange={setSort} />
                <SortableHeader field="status" label="Status" sort={sort} onChange={setSort} />
                {canManage && <th>Maintenance Risk</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td>{v.regNumber}</td>
                  <td>{v.name}</td>
                  <td>{v.type}</td>
                  <td>{v.maxLoadCapacityKg}</td>
                  <td>{v.odometerKm}</td>
                  <td>{v.region ?? "—"}</td>
                  <td>
                    <Badge status={v.status} />
                  </td>
                  {canManage && <td>{riskFor(v.id) ? <RiskBadge label={riskFor(v.id)!.riskBucket} /> : "—"}</td>}
                  <td>
                    <div className="actions-row">
                      <button className="btn btn-secondary btn-sm" onClick={() => setDocsVehicle(v)}>
                        Documents
                      </button>
                      {canManage && (
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(v)}>
                          Edit
                        </button>
                      )}
                      {canManage && v.status !== "Retired" && (
                        <button className="btn btn-danger btn-sm" onClick={() => retire(v)}>
                          Retire
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {docsVehicle && (
        <VehicleDocumentsModal vehicle={docsVehicle} canManage={canManage} onClose={() => setDocsVehicle(null)} />
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? `Edit ${editing.regNumber}` : "Register Vehicle"}</h3>
            {formError && <div className="error-banner">{formError}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                {!editing && (
                  <div className="form-field">
                    <label>Reg Number</label>
                    <input
                      required
                      value={form.regNumber}
                      onChange={(e) => setForm({ ...form, regNumber: e.target.value })}
                    />
                  </div>
                )}
                <div className="form-field">
                  <label>Name</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>Model</label>
                  <input required value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as VehicleType })}>
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Max Load (kg)</label>
                  <input
                    required
                    type="number"
                    value={form.maxLoadCapacityKg}
                    onChange={(e) => setForm({ ...form, maxLoadCapacityKg: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Acquisition Cost</label>
                  <input
                    required
                    type="number"
                    value={form.acquisitionCost}
                    onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Region</label>
                  <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
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
