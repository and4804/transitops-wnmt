from fastapi import APIRouter, Query

from ..ml.model_cache import get_or_compute
from ..ml.utilization_forecast import compute_utilization_forecast

router = APIRouter()


@router.get("/utilization-forecast")
def utilization_forecast(historyDays: int = Query(default=120), horizonDays: int = Query(default=14)):
    cache_key = f"utilization_forecast:{historyDays}:{horizonDays}"
    return get_or_compute(cache_key, lambda: compute_utilization_forecast(historyDays, horizonDays))
