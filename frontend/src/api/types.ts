export type Role = "FleetManager" | "Dispatcher" | "SafetyOfficer" | "FinancialAnalyst";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type VehicleType = "Van" | "Truck" | "Mini" | "Bus" | "Other";
export type VehicleStatus = "Available" | "OnTrip" | "InShop" | "Retired";

export interface Vehicle {
  id: number;
  regNumber: string;
  name: string;
  model: string;
  type: VehicleType;
  maxLoadCapacityKg: number;
  odometerKm: number;
  acquisitionCost: number;
  region: string | null;
  status: VehicleStatus;
}

export type DriverStatus = "Available" | "OnTrip" | "Suspended";

export interface Driver {
  id: number;
  name: string;
  licenseNumber: string;
  licenseCategory: string;
  licenseExpiry: string;
  contactNumber: string;
  safetyScore: number;
  status: DriverStatus;
  userId: number | null;
}

export type TripStatus = "Draft" | "Dispatched" | "Completed" | "Cancelled";

export interface Trip {
  id: number;
  source: string;
  destination: string;
  vehicleId: number;
  driverId: number;
  cargoWeightKg: number;
  plannedDistanceKm: number;
  actualDistanceKm: number | null;
  fuelConsumedLiters: number | null;
  revenue: number | null;
  status: TripStatus;
  createdAt: string;
  dispatchedAt: string | null;
  completedAt: string | null;
}

export type MaintenanceStatus = "Open" | "Closed";

export interface Maintenance {
  id: number;
  vehicleId: number;
  description: string;
  cost: number;
  status: MaintenanceStatus;
  createdAt: string;
  closedAt: string | null;
}

export interface DashboardKpis {
  activeVehicles: number;
  availableVehicles: number;
  inShopVehicles: number;
  activeTrips: number;
  pendingTrips: number;
  driversOnDuty: number;
  fleetUtilizationPct: number;
}

export interface FuelLog {
  id: number;
  vehicleId: number;
  tripId: number | null;
  liters: number;
  cost: number;
  date: string;
}

export type ExpenseType = "Toll" | "Parking" | "Fine" | "Insurance" | "Other";

export interface Expense {
  id: number;
  vehicleId: number;
  type: ExpenseType;
  amount: number;
  date: string;
  description: string | null;
}

export interface CostSummary {
  vehicleId: number;
  totalFuelCost: number;
  totalMaintenanceCost: number;
  totalExpenseCost: number;
  totalCost: number;
}
