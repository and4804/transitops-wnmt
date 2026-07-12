import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("FleetManager", "FinancialAnalyst"));

router.get(
  "/fuel-efficiency",
  asyncHandler(async (_req, res) => {
    const vehicles = await prisma.vehicle.findMany({
      include: { trips: { where: { status: "Completed" } } },
    });
    const report = vehicles.map((v) => {
      const totalDistanceKm = v.trips.reduce((sum, t) => sum + (t.actualDistanceKm ?? 0), 0);
      const totalFuelLiters = v.trips.reduce((sum, t) => sum + (t.fuelConsumedLiters ?? 0), 0);
      return {
        vehicleId: v.id,
        regNumber: v.regNumber,
        totalDistanceKm,
        totalFuelLiters,
        kmPerLiter: totalFuelLiters > 0 ? Math.round((totalDistanceKm / totalFuelLiters) * 100) / 100 : null,
      };
    });
    res.status(200).json(report);
  })
);

router.get(
  "/utilization",
  asyncHandler(async (_req, res) => {
    const vehicles = await prisma.vehicle.findMany({
      include: { trips: true },
    });
    const report = vehicles.map((v) => {
      const completedOrDispatched = v.trips.filter((t) => t.status === "Completed" || t.status === "Dispatched");
      return {
        vehicleId: v.id,
        regNumber: v.regNumber,
        totalTrips: v.trips.length,
        activeOrCompletedTrips: completedOrDispatched.length,
        status: v.status,
      };
    });
    res.status(200).json(report);
  })
);

router.get(
  "/operational-cost",
  asyncHandler(async (_req, res) => {
    const vehicles = await prisma.vehicle.findMany({
      include: { fuelLogs: true, maintenanceRecords: true, expenses: true },
    });
    const report = vehicles.map((v) => {
      const totalFuelCost = v.fuelLogs.reduce((sum, l) => sum + l.cost, 0);
      const totalMaintenanceCost = v.maintenanceRecords.reduce((sum, m) => sum + m.cost, 0);
      const totalExpenseCost = v.expenses.reduce((sum, e) => sum + e.amount, 0);
      return {
        vehicleId: v.id,
        regNumber: v.regNumber,
        totalFuelCost,
        totalMaintenanceCost,
        totalExpenseCost,
        totalOperationalCost: totalFuelCost + totalMaintenanceCost + totalExpenseCost,
      };
    });
    res.status(200).json(report);
  })
);

router.get(
  "/roi",
  asyncHandler(async (_req, res) => {
    const vehicles = await prisma.vehicle.findMany({
      include: { trips: true, fuelLogs: true, maintenanceRecords: true, expenses: true },
    });
    const report = vehicles.map((v) => {
      const totalFuelCost = v.fuelLogs.reduce((sum, l) => sum + l.cost, 0);
      const totalMaintenanceCost = v.maintenanceRecords.reduce((sum, m) => sum + m.cost, 0);
      const totalExpenseCost = v.expenses.reduce((sum, e) => sum + e.amount, 0);
      const totalCost = totalFuelCost + totalMaintenanceCost + totalExpenseCost + v.acquisitionCost;

      const revenues = v.trips.map((t) => t.revenue).filter((r): r is number => r != null);
      const totalRevenue = revenues.length > 0 ? revenues.reduce((sum, r) => sum + r, 0) : null;

      return {
        vehicleId: v.id,
        regNumber: v.regNumber,
        totalRevenue,
        totalCost,
        roiPct: totalRevenue != null && totalCost > 0 ? Math.round(((totalRevenue - totalCost) / totalCost) * 1000) / 10 : null,
      };
    });
    res.status(200).json(report);
  })
);

router.get(
  "/export.csv",
  asyncHandler(async (_req, res) => {
    const trips = await prisma.trip.findMany({ orderBy: { id: "asc" } });
    const header = "id,source,destination,vehicleId,driverId,cargoWeightKg,plannedDistanceKm,actualDistanceKm,fuelConsumedLiters,revenue,status,createdAt,dispatchedAt,completedAt";
    const rows = trips.map((t) =>
      [
        t.id,
        t.source,
        t.destination,
        t.vehicleId,
        t.driverId,
        t.cargoWeightKg,
        t.plannedDistanceKm,
        t.actualDistanceKm ?? "",
        t.fuelConsumedLiters ?? "",
        t.revenue ?? "",
        t.status,
        t.createdAt.toISOString(),
        t.dispatchedAt?.toISOString() ?? "",
        t.completedAt?.toISOString() ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    res.status(200).header("Content-Type", "text/csv").send(csv);
  })
);

export default router;
