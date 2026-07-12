import { api } from "./client";
import type {
  CostRoiForecast,
  DriverSafetyScore,
  FuelAnomaly,
  MaintenanceRisk,
  UtilizationForecast,
} from "./types";

export const getMaintenanceRisk = () => api.get<MaintenanceRisk[]>("/ml/maintenance-risk");

export const getDriverSafetyScores = () => api.get<DriverSafetyScore[]>("/ml/driver-safety-scores");

export const getFuelAnomalies = () => api.get<FuelAnomaly[]>("/ml/fuel-anomalies");

export const getCostRoiForecast = (vehicleId?: number) =>
  api.get<CostRoiForecast>(`/ml/cost-roi-forecast${vehicleId ? `?vehicleId=${vehicleId}` : ""}`);

export const getUtilizationForecast = () => api.get<UtilizationForecast>("/ml/utilization-forecast");
