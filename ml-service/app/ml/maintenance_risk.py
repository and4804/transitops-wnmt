"""Predictive Maintenance Risk (Fleet Manager).

Logistic Regression trained on maintenance intervals reconstructed purely from
existing timestamped rows (Vehicle.createdAt, Maintenance.createdAt/closedAt,
Trip.actualDistanceKm+completedAt) — no new history table needed.
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

SAMPLE_STEP_DAYS = 15
SOON_DAYS = 30
SOON_KM = 3000.0
VEHICLE_TYPES = ["Van", "Truck", "Mini", "Bus", "Other"]


def _now():
    # Prisma's DateTime columns are stored tz-naive (UTC) — keep "now" naive to compare cleanly.
    return pd.Timestamp.utcnow().tz_localize(None)


def _km_between(trips: pd.DataFrame, vehicle_id: int, start, end) -> float:
    completed = trips[
        (trips["vehicleId"] == vehicle_id)
        & (trips["status"] == "Completed")
        & (trips["completedAt"] >= start)
        & (trips["completedAt"] < end)
    ]
    return float(completed["actualDistanceKm"].fillna(0).sum())


def _rolling_km_per_day(trips: pd.DataFrame, vehicle_id: int, t) -> float:
    window_start = t - pd.Timedelta(days=30)
    return _km_between(trips, vehicle_id, window_start, t) / 30.0


def _build_intervals(vehicles: pd.DataFrame, maintenance: pd.DataFrame) -> list[dict]:
    """One dict per vehicle per maintenance interval: {vehicleId, type, start, end (None=open), index}."""
    intervals = []
    for _, v in vehicles.iterrows():
        vid = v["id"]
        records = maintenance[maintenance["vehicleId"] == vid].sort_values("createdAt")
        start = v["createdAt"]
        for i, (_, m) in enumerate(records.iterrows()):
            intervals.append({"vehicleId": vid, "type": v["type"], "start": start, "end": m["createdAt"], "index": i})
            start = m["closedAt"] if pd.notna(m["closedAt"]) else m["createdAt"]
        intervals.append(
            {"vehicleId": vid, "type": v["type"], "start": start, "end": None, "index": len(records)}
        )
    return intervals


def _features_row(vehicle_type: str, days_since_start: float, km_since_start: float, rolling_km_per_day: float, prior_count: int) -> dict:
    row = {
        "daysSinceStart": days_since_start,
        "kmSinceStart": km_since_start,
        "rollingKmPerDay": rolling_km_per_day,
        "priorMaintenanceCount": prior_count,
    }
    for t in VEHICLE_TYPES:
        row[f"type_{t}"] = 1.0 if vehicle_type == t else 0.0
    return row


def _feature_columns() -> list[str]:
    return ["daysSinceStart", "kmSinceStart", "rollingKmPerDay", "priorMaintenanceCount"] + [
        f"type_{t}" for t in VEHICLE_TYPES
    ]


def _heuristic_risk(days_since: float, km_since: float) -> float:
    return float(min(1.0, max(days_since / 180.0, km_since / 15000.0)))


def compute_maintenance_risk() -> list[dict]:
    from ..data_access import get_maintenance_df, get_trips_df, get_vehicles_df

    vehicles = get_vehicles_df()
    trips = get_trips_df()
    maintenance = get_maintenance_df()

    if vehicles.empty:
        return []

    intervals = _build_intervals(vehicles, maintenance)
    closed = [iv for iv in intervals if iv["end"] is not None]

    train_rows, train_labels = [], []
    for iv in closed:
        start, end = iv["start"], iv["end"]
        total_km = _km_between(trips, iv["vehicleId"], start, end)
        total_days = max((end - start).total_seconds() / 86400.0, 1.0)
        t = start
        while t < end:
            days_since = (t - start).total_seconds() / 86400.0
            km_since = _km_between(trips, iv["vehicleId"], start, t)
            rolling = _rolling_km_per_day(trips, iv["vehicleId"], t)
            train_rows.append(_features_row(iv["type"], days_since, km_since, rolling, iv["index"]))
            days_remaining = (end - t).total_seconds() / 86400.0
            km_remaining = total_km - km_since
            train_labels.append(1 if (days_remaining <= SOON_DAYS or km_remaining <= SOON_KM) else 0)
            t = t + pd.Timedelta(days=SAMPLE_STEP_DAYS)
        _ = total_days  # kept for readability of intent, not otherwise used

    model = None
    if len(train_rows) >= 20 and len(set(train_labels)) == 2:
        X = pd.DataFrame(train_rows, columns=_feature_columns())
        y = np.array(train_labels)
        model = LogisticRegression(max_iter=1000)
        model.fit(X, y)

    now = _now()
    results = []
    for iv in intervals:
        if iv["end"] is not None:
            continue  # only the current open interval is used for inference
        vid = iv["vehicleId"]
        vrow = vehicles[vehicles["id"] == vid].iloc[0]
        start = iv["start"]
        days_since = (now - start).total_seconds() / 86400.0
        km_since = _km_between(trips, vid, start, now)
        rolling = _rolling_km_per_day(trips, vid, now)

        if model is not None:
            feat = pd.DataFrame([_features_row(iv["type"], days_since, km_since, rolling, iv["index"])], columns=_feature_columns())
            risk = float(model.predict_proba(feat)[0][1])
        else:
            risk = _heuristic_risk(days_since, km_since)

        bucket = "High" if risk >= 0.66 else "Medium" if risk >= 0.33 else "Low"
        last_maintenance_records = maintenance[maintenance["vehicleId"] == vid].sort_values("createdAt")
        last_at = last_maintenance_records["createdAt"].iloc[-1] if len(last_maintenance_records) else None

        results.append(
            {
                "vehicleId": int(vid),
                "regNumber": vrow["regNumber"],
                "riskScore": round(risk, 4),
                "riskBucket": bucket,
                "kmSinceLastService": round(km_since, 1),
                "daysSinceLastService": round(days_since, 1),
                "lastMaintenanceAt": last_at.isoformat() if last_at is not None and pd.notna(last_at) else None,
            }
        )

    results.sort(key=lambda r: r["riskScore"], reverse=True)
    return results
