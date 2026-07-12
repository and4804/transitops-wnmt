from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .ml.cost_roi_forecast import compute_cost_roi_forecast
from .ml.driver_safety import compute_driver_safety_scores
from .ml.fuel_anomaly import compute_fuel_anomalies
from .ml.maintenance_risk import compute_maintenance_risk
from .ml.model_cache import get_or_compute
from .ml.utilization_forecast import compute_utilization_forecast
from .routers import admin, cost_roi_forecast, driver_safety, fuel_anomaly, maintenance_risk, utilization_forecast

app = FastAPI(title="TransitOps ML Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(maintenance_risk.router)
app.include_router(driver_safety.router)
app.include_router(fuel_anomaly.router)
app.include_router(cost_roi_forecast.router)
app.include_router(utilization_forecast.router)


@app.on_event("startup")
def warm_up_models() -> None:
    """Eagerly train+cache all 5 models on boot — cheap on a few thousand rows,
    so the first request after startup doesn't pay the training cost."""
    try:
        get_or_compute("maintenance_risk", compute_maintenance_risk)
        get_or_compute("driver_safety", compute_driver_safety_scores)
        get_or_compute("fuel_anomaly", compute_fuel_anomalies)
        get_or_compute("cost_roi_forecast:fleet", lambda: compute_cost_roi_forecast(None))
        get_or_compute("utilization_forecast:120:14", lambda: compute_utilization_forecast(120, 14))
    except Exception as exc:  # pragma: no cover - warm-up is best-effort
        print(f"[ml-service] warm-up skipped: {exc}")
