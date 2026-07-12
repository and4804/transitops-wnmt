from typing import Optional

from fastapi import APIRouter, Query

from ..ml.maintenance_risk import compute_maintenance_risk
from ..ml.model_cache import get_or_compute

router = APIRouter()


@router.get("/maintenance-risk")
def maintenance_risk(vehicleId: Optional[int] = Query(default=None)):
    results = get_or_compute("maintenance_risk", compute_maintenance_risk)
    if vehicleId is not None:
        return [r for r in results if r["vehicleId"] == vehicleId]
    return results
