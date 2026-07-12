from typing import Optional

from fastapi import APIRouter, Query

from ..ml.fuel_anomaly import compute_fuel_anomalies
from ..ml.model_cache import get_or_compute

router = APIRouter()


@router.get("/fuel-anomalies")
def fuel_anomalies(vehicleId: Optional[int] = Query(default=None), sinceDays: Optional[int] = Query(default=None)):
    results = get_or_compute("fuel_anomaly", compute_fuel_anomalies)
    if vehicleId is not None:
        results = [r for r in results if r["vehicleId"] == vehicleId]
    if sinceDays is not None:
        import pandas as pd

        cutoff = pd.Timestamp.utcnow().tz_localize(None) - pd.Timedelta(days=sinceDays)
        results = [r for r in results if pd.Timestamp(r["date"]).tz_localize(None) >= cutoff]
    return results
