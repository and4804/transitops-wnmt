import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Driver, Trip, TripStatus, Vehicle } from "../api/types";
import Badge from "../components/Badge";
import { useAuth } from "../auth/AuthContext";

const STATUSES: TripStatus[] = ["Draft", "Dispatched", "Completed", "Cancelled"];

const emptyForm = {
  source: "",
  destination: "",
  vehicleId: "",
  driverId: "",
  cargoWeightKg: "",
  plannedDistanceKm: "",
};

export default function Trips() {
  const { user } = useAuth();
  const canManage = user?.role === "FleetManager" || user?.role === "Dispatcher";
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [completingTrip, setCompletingTrip] = useState<Trip | null>(null);
  const [completeForm, setCompleteForm] = useState({ actualDistanceKm: "", fuelConsumedLiters: "" });
  const [completeError, setCompleteError] = useState<string | null>(null);

  function load() {
    const params = statusFilter ? `?status=${statusFilter}` : "";
    api
      .get<Trip[]>(`/trips${params}`)
      .then(setTrips)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load trips"));
  }

  useEffect(load, [statusFilter]);

  function openCreate() {
    setFormError(null);
    setForm(emptyForm);
    Promise.all([api.get<Vehicle[]>("/vehicles?status=Available"), api.get<Driver[]>("/drivers?status=Available")])
      .then(([v, d]) => {
        setVehicles(v);
        setDrivers(d);
        setShowForm(true);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load form data"));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await api.post("/trips", {
        source: form.source,
        destination: form.destination,
        vehicleId: Number(form.vehicleId),
        driverId: Number(form.driverId),
        cargoWeightKg: Number(form.cargoWeightKg),
        plannedDistanceKm: Number(form.plannedDistanceKm),
      });
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create trip");
    }
  }

  async function dispatch(trip: Trip) {
    try {
      await api.post(`/trips/${trip.id}/dispatch`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to dispatch trip");
    }
  }

  async function cancelTrip(trip: Trip) {
    if (!confirm(`Cancel trip #${trip.id}?`)) return;
    try {
      await api.post(`/trips/${trip.id}/cancel`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to cancel trip");
    }
  }

  function openComplete(trip: Trip) {
    setCompletingTrip(trip);
    setCompleteForm({ actualDistanceKm: String(trip.plannedDistanceKm), fuelConsumedLiters: "" });
    setCompleteError(null);
  }

  async function handleComplete(e: FormEvent) {
    e.preventDefault();
    if (!completingTrip) return;
    setCompleteError(null);
    try {
      await api.post(`/trips/${completingTrip.id}/complete`, {
        actualDistanceKm: Number(completeForm.actualDistanceKm),
        fuelConsumedLiters: Number(completeForm.fuelConsumedLiters),
      });
      setCompletingTrip(null);
      load();
    } catch (err) {
      setCompleteError(err instanceof ApiError ? err.message : "Failed to complete trip");
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>Trips</h2>
        {canManage && (
          <button className="btn" onClick={openCreate}>
            + Create Trip
          </button>
        )}
      </div>
      {error && <div className="error-banner">{error}</div>}
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
        {trips.length === 0 ? (
          <div className="empty-state">No trips found.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Route</th>
                <th>Vehicle</th>
                <th>Driver</th>
                <th>Cargo (kg)</th>
                <th>Distance (km)</th>
                <th>Status</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>
                    {t.source} → {t.destination}
                  </td>
                  <td>#{t.vehicleId}</td>
                  <td>#{t.driverId}</td>
                  <td>{t.cargoWeightKg}</td>
                  <td>{t.actualDistanceKm ?? t.plannedDistanceKm}</td>
                  <td>
                    <Badge status={t.status} />
                  </td>
                  {canManage && (
                    <td>
                      <div className="actions-row">
                        {t.status === "Draft" && (
                          <button className="btn btn-secondary btn-sm" onClick={() => dispatch(t)}>
                            Dispatch
                          </button>
                        )}
                        {t.status === "Dispatched" && (
                          <>
                            <button className="btn btn-secondary btn-sm" onClick={() => openComplete(t)}>
                              Complete
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => cancelTrip(t)}>
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
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
            <h3>Create Trip</h3>
            {formError && <div className="error-banner">{formError}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-field">
                  <label>Source</label>
                  <input required value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
                </div>
                <div className="form-field">
                  <label>Destination</label>
                  <input
                    required
                    value={form.destination}
                    onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Vehicle</label>
                  <select required value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
                    <option value="">Select vehicle</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.regNumber} ({v.maxLoadCapacityKg}kg)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Driver</label>
                  <select required value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })}>
                    <option value="">Select driver</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Cargo Weight (kg)</label>
                  <input
                    required
                    type="number"
                    value={form.cargoWeightKg}
                    onChange={(e) => setForm({ ...form, cargoWeightKg: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Planned Distance (km)</label>
                  <input
                    required
                    type="number"
                    value={form.plannedDistanceKm}
                    onChange={(e) => setForm({ ...form, plannedDistanceKm: e.target.value })}
                  />
                </div>
              </div>
              <div className="actions-row">
                <button className="btn" type="submit">
                  Create
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {completingTrip && (
        <div className="modal-backdrop" onClick={() => setCompletingTrip(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Complete Trip #{completingTrip.id}</h3>
            {completeError && <div className="error-banner">{completeError}</div>}
            <form onSubmit={handleComplete}>
              <div className="form-grid">
                <div className="form-field">
                  <label>Actual Distance (km)</label>
                  <input
                    required
                    type="number"
                    value={completeForm.actualDistanceKm}
                    onChange={(e) => setCompleteForm({ ...completeForm, actualDistanceKm: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Fuel Consumed (L)</label>
                  <input
                    required
                    type="number"
                    value={completeForm.fuelConsumedLiters}
                    onChange={(e) => setCompleteForm({ ...completeForm, fuelConsumedLiters: e.target.value })}
                  />
                </div>
              </div>
              <div className="actions-row">
                <button className="btn" type="submit">
                  Complete Trip
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => setCompletingTrip(null)}>
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
