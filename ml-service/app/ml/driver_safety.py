"""Driver Safety Score Engine (Safety Officer).

The Driver.safetyScore column exists in the schema but no code ever updates it
(dead field, stuck at its default). This replaces it with a score computed from
real trip-history signals via a Ridge regression fit on a documented heuristic
weak-label (there is no ground-truth safety label anywhere in the data) —
disclosed as weak supervision, not a discovered target.
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge

FEATURE_COLUMNS = [
    "completionRate",
    "cancellationRate",
    "avgCargoUtilization",
    "licenseExpiryProximityDays",
    "routeDeviationRatio",
]


def _now():
    return pd.Timestamp.utcnow().tz_localize(None)


def _driver_features(driver_id: int, trips: pd.DataFrame, vehicles: pd.DataFrame, license_expiry) -> dict:
    dtrips = trips[trips["driverId"] == driver_id]
    completed = dtrips[dtrips["status"] == "Completed"]
    cancelled = dtrips[dtrips["status"] == "Cancelled"]
    resolved = len(completed) + len(cancelled)

    completion_rate = len(completed) / resolved if resolved > 0 else 1.0
    cancellation_rate = len(cancelled) / resolved if resolved > 0 else 0.0

    if len(completed) > 0:
        merged = completed.merge(vehicles[["id", "maxLoadCapacityKg"]], left_on="vehicleId", right_on="id", how="left")
        cargo_util = (merged["cargoWeightKg"] / merged["maxLoadCapacityKg"]).clip(upper=1.5)
        avg_cargo_utilization = float(cargo_util.mean())

        with_actual = completed.dropna(subset=["actualDistanceKm"])
        with_actual = with_actual[with_actual["plannedDistanceKm"] > 0]
        if len(with_actual) > 0:
            deviation = (
                (with_actual["actualDistanceKm"] - with_actual["plannedDistanceKm"]).abs()
                / with_actual["plannedDistanceKm"]
            )
            route_deviation_ratio = float(deviation.clip(upper=1.0).mean())
        else:
            route_deviation_ratio = 0.0
    else:
        avg_cargo_utilization = 0.5
        route_deviation_ratio = 0.0

    expiry_days = (pd.Timestamp(license_expiry) - _now()).total_seconds() / 86400.0
    expiry_proximity = float(np.clip(expiry_days, -365, 365))

    return {
        "completionRate": completion_rate,
        "cancellationRate": cancellation_rate,
        "avgCargoUtilization": avg_cargo_utilization,
        "licenseExpiryProximityDays": expiry_proximity,
        "routeDeviationRatio": route_deviation_ratio,
    }


def _heuristic_weak_label(features: dict) -> float:
    over_capacity_penalty = max(0.0, features["avgCargoUtilization"] - 1.0) * 2.0
    expiry_penalty = 1.0 if features["licenseExpiryProximityDays"] < 30 else 0.0
    score = (
        100
        - 40 * features["cancellationRate"]
        - 25 * features["routeDeviationRatio"]
        - 20 * over_capacity_penalty
        - 15 * expiry_penalty
    )
    return float(np.clip(score, 0, 100))


def compute_driver_safety_scores() -> list[dict]:
    from ..data_access import get_drivers_df, get_trips_df, get_vehicles_df

    drivers = get_drivers_df()
    trips = get_trips_df()
    vehicles = get_vehicles_df()

    if drivers.empty:
        return []

    feature_rows, weak_labels, driver_meta = [], [], []
    for _, d in drivers.iterrows():
        feats = _driver_features(d["id"], trips, vehicles, d["licenseExpiry"])
        feature_rows.append(feats)
        weak_labels.append(_heuristic_weak_label(feats))
        driver_meta.append(d)

    X = pd.DataFrame(feature_rows, columns=FEATURE_COLUMNS)
    y = np.array(weak_labels)

    model = None
    if len(X) >= 5 and X[FEATURE_COLUMNS].nunique().gt(1).any():
        model = Ridge(alpha=1.0)
        model.fit(X, y)

    results = []
    for feats, weak_label, d in zip(feature_rows, weak_labels, driver_meta):
        if model is not None:
            row = pd.DataFrame([feats], columns=FEATURE_COLUMNS)
            score = float(np.clip(model.predict(row)[0], 0, 100))
        else:
            score = weak_label

        band = "Excellent" if score >= 85 else "Good" if score >= 70 else "Fair" if score >= 50 else "At Risk"

        results.append(
            {
                "driverId": int(d["id"]),
                "name": d["name"],
                "safetyScore": round(score, 1),
                "band": band,
                "completionRate": round(feats["completionRate"], 3),
                "cancellationRate": round(feats["cancellationRate"], 3),
                "avgCargoUtilization": round(feats["avgCargoUtilization"], 3),
                "licenseExpiryDays": round(feats["licenseExpiryProximityDays"], 1),
                "routeDeviationRatio": round(feats["routeDeviationRatio"], 3),
            }
        )

    results.sort(key=lambda r: r["safetyScore"])
    return results
