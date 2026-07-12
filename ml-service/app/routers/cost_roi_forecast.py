from typing import Optional

from fastapi import APIRouter, Query

from ..ml.cost_roi_forecast import compute_cost_roi_forecast
from ..ml.model_cache import get_or_compute

router = APIRouter()


@router.get("/cost-roi-forecast")
def cost_roi_forecast(vehicleId: Optional[int] = Query(default=None)):
    cache_key = f"cost_roi_forecast:{vehicleId if vehicleId is not None else 'fleet'}"
    return get_or_compute(cache_key, lambda: compute_cost_roi_forecast(vehicleId))
