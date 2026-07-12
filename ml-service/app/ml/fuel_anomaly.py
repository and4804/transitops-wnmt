"""Fuel Anomaly Detection (Financial Analyst).

Flags suspicious FuelLog rows (fraud/leakage/inefficiency) using IsolationForest
per vehicle-type group on [litersPerKm, costPerLiter], falling back to a z-score
on costPerLiter when a group is too small to fit a model or a log has no linked
trip (so litersPerKm can't be computed).
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

MIN_GROUP_SIZE_FOR_FOREST = 20
Z_SCORE_THRESHOLD = 2.5


def _zscore(series: pd.Series) -> pd.Series:
    std = series.std()
    if not std or np.isnan(std) or std == 0:
        return pd.Series(np.zeros(len(series)), index=series.index)
    return (series - series.mean()) / std


def compute_fuel_anomalies() -> list[dict]:
    from ..data_access import get_fuel_logs_df, get_trips_df, get_vehicles_df

    fuel_logs = get_fuel_logs_df()
    trips = get_trips_df()
    vehicles = get_vehicles_df()

    if fuel_logs.empty:
        return []

    df = fuel_logs.merge(vehicles[["id", "regNumber", "type"]], left_on="vehicleId", right_on="id", suffixes=("", "_v"))
    df = df.merge(trips[["id", "actualDistanceKm"]], left_on="tripId", right_on="id", how="left", suffixes=("", "_t"))

    df["litersPerKm"] = np.where(
        df["actualDistanceKm"].notna() & (df["actualDistanceKm"] > 0), df["liters"] / df["actualDistanceKm"], np.nan
    )
    df["costPerLiter"] = np.where(df["liters"] > 0, df["cost"] / df["liters"], np.nan)

    df["isAnomaly"] = False
    df["anomalyScore"] = 0.0
    df["reason"] = ""

    for vtype, group in df.groupby("type"):
        idx = group.index
        with_km = group.dropna(subset=["litersPerKm", "costPerLiter"])

        if len(with_km) >= MIN_GROUP_SIZE_FOR_FOREST:
            X = with_km[["litersPerKm", "costPerLiter"]].to_numpy()
            forest = IsolationForest(contamination=0.08, random_state=42)
            forest.fit(X)
            raw_scores = -forest.score_samples(X)
            lo, hi = raw_scores.min(), raw_scores.max()
            norm_scores = (raw_scores - lo) / (hi - lo) if hi > lo else np.zeros_like(raw_scores)
            preds = forest.predict(X)
            df.loc[with_km.index, "anomalyScore"] = norm_scores
            df.loc[with_km.index, "isAnomaly"] = preds == -1
            km_z = _zscore(with_km["litersPerKm"])
            cost_z = _zscore(with_km["costPerLiter"])
            for i, ridx in enumerate(with_km.index):
                if preds[i] == -1:
                    reason = "liters/km outlier" if abs(km_z.loc[ridx]) >= abs(cost_z.loc[ridx]) else "cost/liter outlier"
                    df.loc[ridx, "reason"] = f"{reason} vs {vtype} fleet"
        else:
            km_z = _zscore(with_km["litersPerKm"]) if len(with_km) else pd.Series(dtype=float)
            cost_z = _zscore(with_km["costPerLiter"]) if len(with_km) else pd.Series(dtype=float)
            for ridx in with_km.index:
                z_km, z_cost = km_z.loc[ridx], cost_z.loc[ridx]
                score = max(abs(z_km), abs(z_cost)) / 4.0
                df.loc[ridx, "anomalyScore"] = min(1.0, score)
                if abs(z_km) >= Z_SCORE_THRESHOLD or abs(z_cost) >= Z_SCORE_THRESHOLD:
                    df.loc[ridx, "isAnomaly"] = True
                    reason = "liters/km z-score" if abs(z_km) >= abs(z_cost) else "cost/liter z-score"
                    df.loc[ridx, "reason"] = f"{reason} outlier vs {vtype} fleet (small sample)"

        # rows with no linked trip: z-score on costPerLiter only, within the same vehicle-type group
        no_km = group[group["litersPerKm"].isna() & group["costPerLiter"].notna()]
        if len(no_km) > 1:
            cost_z = _zscore(group["costPerLiter"])
            for ridx in no_km.index:
                z = cost_z.loc[ridx]
                df.loc[ridx, "anomalyScore"] = min(1.0, abs(z) / 4.0)
                if abs(z) >= Z_SCORE_THRESHOLD:
                    df.loc[ridx, "isAnomaly"] = True
                    df.loc[ridx, "reason"] = f"cost/liter z-score outlier vs {vtype} fleet (no trip distance)"
        _ = idx  # unused beyond documenting group scope

    results = []
    for _, r in df.sort_values("anomalyScore", ascending=False).iterrows():
        results.append(
            {
                "fuelLogId": int(r["id"]),
                "vehicleId": int(r["vehicleId"]),
                "regNumber": r["regNumber"],
                "date": pd.Timestamp(r["date"]).isoformat(),
                "liters": float(r["liters"]),
                "cost": float(r["cost"]),
                "litersPerKm": None if pd.isna(r["litersPerKm"]) else round(float(r["litersPerKm"]), 4),
                "costPerLiter": None if pd.isna(r["costPerLiter"]) else round(float(r["costPerLiter"]), 2),
                "anomalyScore": round(float(r["anomalyScore"]), 4),
                "isAnomaly": bool(r["isAnomaly"]),
                "reason": r["reason"] or ("normal" if not r["isAnomaly"] else "flagged"),
            }
        )
    return results
