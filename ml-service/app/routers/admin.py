from fastapi import APIRouter

from ..ml.model_cache import invalidate_all

router = APIRouter()

FEATURE_NAMES = ["maintenance_risk", "driver_safety", "fuel_anomaly", "cost_roi_forecast", "utilization_forecast"]


@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/admin/retrain")
def retrain():
    invalidate_all()
    return {"retrained": FEATURE_NAMES}
