"""Cost/ROI Trend Forecast (Financial Analyst).

Layers a simple Linear Regression over the same monthly cost/revenue sums that
backend/src/routes/reports.ts already computes for the Operational Cost and ROI
report tabs — just bucketed by month with a next-month projection added.
"""

from typing import Optional

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

TRAILING_MONTHS = 12


def _month_key(ts) -> str:
    return pd.Timestamp(ts).strftime("%Y-%m")


def _monthly_history(vehicle_id: Optional[int]) -> pd.DataFrame:
    from ..data_access import get_expenses_df, get_fuel_logs_df, get_maintenance_df, get_trips_df

    fuel_logs = get_fuel_logs_df()
    maintenance = get_maintenance_df()
    expenses = get_expenses_df()
    trips = get_trips_df()

    if vehicle_id is not None:
        fuel_logs = fuel_logs[fuel_logs["vehicleId"] == vehicle_id]
        maintenance = maintenance[maintenance["vehicleId"] == vehicle_id]
        expenses = expenses[expenses["vehicleId"] == vehicle_id]
        trips = trips[trips["vehicleId"] == vehicle_id]

    cost_by_month: dict[str, float] = {}
    for df, date_col, val_col in (
        (fuel_logs, "date", "cost"),
        (maintenance, "createdAt", "cost"),
        (expenses, "date", "amount"),
    ):
        for _, r in df.iterrows():
            if pd.isna(r[date_col]):
                continue
            key = _month_key(r[date_col])
            cost_by_month[key] = cost_by_month.get(key, 0.0) + float(r[val_col])

    revenue_by_month: dict[str, float] = {}
    completed = trips[(trips["status"] == "Completed") & trips["revenue"].notna() & trips["completedAt"].notna()]
    for _, r in completed.iterrows():
        key = _month_key(r["completedAt"])
        revenue_by_month[key] = revenue_by_month.get(key, 0.0) + float(r["revenue"])

    months = sorted(set(cost_by_month) | set(revenue_by_month))
    rows = []
    for m in months:
        cost = cost_by_month.get(m, 0.0)
        revenue = revenue_by_month.get(m)
        roi_pct = ((revenue - cost) / cost * 100) if (revenue is not None and cost > 0) else None
        rows.append({"month": m, "cost": cost, "revenue": revenue, "roiPct": roi_pct})

    return pd.DataFrame(rows)


def _next_month(month_key: str) -> str:
    ts = pd.Timestamp(month_key + "-01") + pd.DateOffset(months=1)
    return ts.strftime("%Y-%m")


def _fit_and_forecast(y: np.ndarray) -> Optional[tuple[float, float, float]]:
    if len(y) < 2:
        return None
    X = np.arange(len(y)).reshape(-1, 1)
    model = LinearRegression()
    model.fit(X, y)
    residual_std = float(np.std(y - model.predict(X))) if len(y) > 1 else 0.0
    pred = float(model.predict([[len(y)]])[0])
    return pred, pred - 1.96 * residual_std, pred + 1.96 * residual_std


def compute_cost_roi_forecast(vehicle_id: Optional[int]) -> dict:
    history = _monthly_history(vehicle_id).tail(TRAILING_MONTHS)

    forecast = None
    if len(history) >= 2:
        cost_fit = _fit_and_forecast(history["cost"].to_numpy())
        roi_rows = history.dropna(subset=["roiPct"])
        roi_fit = _fit_and_forecast(roi_rows["roiPct"].to_numpy()) if len(roi_rows) >= 2 else None

        if cost_fit is not None:
            pred_cost, cost_lo, cost_hi = cost_fit
            next_month = _next_month(history["month"].iloc[-1])
            forecast = {
                "month": next_month,
                "predictedCost": round(pred_cost, 2),
                "costLower": round(max(cost_lo, 0), 2),
                "costUpper": round(cost_hi, 2),
                "predictedRoiPct": round(roi_fit[0], 2) if roi_fit else None,
                "roiLower": round(roi_fit[1], 2) if roi_fit else None,
                "roiUpper": round(roi_fit[2], 2) if roi_fit else None,
            }

    return {
        "scope": f"vehicle:{vehicle_id}" if vehicle_id is not None else "fleet",
        "history": history.to_dict("records"),
        "forecast": forecast,
    }
