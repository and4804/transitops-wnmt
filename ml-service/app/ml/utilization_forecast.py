"""Fleet Utilization Forecast (Fleet Manager).

History is reconstructed from Trip.dispatchedAt/completedAt intervals (how many
vehicles were on-trip each past day) rather than a new snapshot table. Two
simplifications are deliberate and documented: Trip has no cancelledAt, so
Cancelled trips contribute 0 on-trip days; fleet size per day is approximated
from Vehicle.createdAt only (no retirement date is tracked either).
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression


def _now():
    return pd.Timestamp.utcnow().tz_localize(None)


def _daily_utilization(history_days: int) -> pd.DataFrame:
    from ..data_access import get_trips_df, get_vehicles_df

    trips = get_trips_df()
    vehicles = get_vehicles_df()

    now = _now()
    days = pd.date_range(end=now.normalize(), periods=history_days, freq="D")

    active = trips[trips["status"].isin(["Dispatched", "Completed"]) & trips["dispatchedAt"].notna()].copy()
    active["endAt"] = active["completedAt"].fillna(now)

    rows = []
    for day in days:
        day_end = day + pd.Timedelta(days=1)
        on_trip_vehicles = active[(active["dispatchedAt"] < day_end) & (active["endAt"] >= day)]["vehicleId"].nunique()
        fleet_size = int((vehicles["createdAt"] < day_end).sum())
        pct = (on_trip_vehicles / fleet_size * 100) if fleet_size > 0 else 0.0
        rows.append({"date": day.strftime("%Y-%m-%d"), "utilizationPct": round(pct, 2)})

    return pd.DataFrame(rows)


def compute_utilization_forecast(history_days: int = 120, horizon_days: int = 14) -> dict:
    history = _daily_utilization(history_days)

    forecast = []
    if len(history) >= 2:
        y = history["utilizationPct"].to_numpy()
        X = np.arange(len(y)).reshape(-1, 1)
        model = LinearRegression()
        model.fit(X, y)
        residual_std = float(np.std(y - model.predict(X)))

        last_day = pd.Timestamp(history["date"].iloc[-1])
        for h in range(1, horizon_days + 1):
            pred = float(model.predict([[len(y) + h - 1]])[0])
            pred_clamped = float(np.clip(pred, 0, 100))
            forecast.append(
                {
                    "date": (last_day + pd.Timedelta(days=h)).strftime("%Y-%m-%d"),
                    "predictedUtilizationPct": round(pred_clamped, 2),
                    "lower": round(max(0.0, pred_clamped - 1.96 * residual_std), 2),
                    "upper": round(min(100.0, pred_clamped + 1.96 * residual_std), 2),
                }
            )

    return {"history": history.to_dict("records"), "forecast": forecast}
