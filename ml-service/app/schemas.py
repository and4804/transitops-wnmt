from typing import Optional

from pydantic import BaseModel


class MaintenanceRisk(BaseModel):
    vehicleId: int
    regNumber: str
    riskScore: float
    riskBucket: str
    kmSinceLastService: float
    daysSinceLastService: float
    lastMaintenanceAt: Optional[str]


class DriverSafetyScore(BaseModel):
    driverId: int
    name: str
    safetyScore: float
    band: str
    completionRate: float
    cancellationRate: float
    avgCargoUtilization: float
    licenseExpiryDays: float
    routeDeviationRatio: float


class FuelAnomaly(BaseModel):
    fuelLogId: int
    vehicleId: int
    regNumber: str
    date: str
    liters: float
    cost: float
    litersPerKm: Optional[float]
    costPerLiter: Optional[float]
    anomalyScore: float
    isAnomaly: bool
    reason: str


class CostRoiHistoryPoint(BaseModel):
    month: str
    cost: float
    revenue: Optional[float]
    roiPct: Optional[float]


class CostRoiForecastPoint(BaseModel):
    month: str
    predictedCost: float
    costLower: float
    costUpper: float
    predictedRoiPct: Optional[float]
    roiLower: Optional[float]
    roiUpper: Optional[float]


class CostRoiForecastResponse(BaseModel):
    scope: str
    history: list[CostRoiHistoryPoint]
    forecast: Optional[CostRoiForecastPoint]


class UtilizationHistoryPoint(BaseModel):
    date: str
    utilizationPct: float


class UtilizationForecastPoint(BaseModel):
    date: str
    predictedUtilizationPct: float
    lower: float
    upper: float


class UtilizationForecastResponse(BaseModel):
    history: list[UtilizationHistoryPoint]
    forecast: list[UtilizationForecastPoint]


class RetrainResponse(BaseModel):
    retrained: list[str]
