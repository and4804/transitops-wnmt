from typing import Optional

from fastapi import APIRouter, Query

from ..ml.driver_safety import compute_driver_safety_scores
from ..ml.model_cache import get_or_compute

router = APIRouter()


@router.get("/driver-safety-scores")
def driver_safety_scores(driverId: Optional[int] = Query(default=None)):
    results = get_or_compute("driver_safety", compute_driver_safety_scores)
    if driverId is not None:
        return [r for r in results if r["driverId"] == driverId]
    return results
