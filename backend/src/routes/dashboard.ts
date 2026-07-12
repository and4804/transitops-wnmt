import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get(
  "/kpis",
  asyncHandler(async (req, res) => {
    const { type, status, region } = req.query;
    const vehicleWhere = {
      ...(type ? { type: type as any } : {}),
      ...(status ? { status: status as any } : {}),
      ...(region ? { region: region as any } : {}),
    };

    const vehicles = await prisma.vehicle.findMany({ where: vehicleWhere });
    const nonRetired = vehicles.filter((v) => v.status !== "Retired");
    const onTrip = vehicles.filter((v) => v.status === "OnTrip");
    const available = vehicles.filter((v) => v.status === "Available");
    const inShop = vehicles.filter((v) => v.status === "InShop");

    const activeTrips = await prisma.trip.count({ where: { status: "Dispatched" } });
    const pendingTrips = await prisma.trip.count({ where: { status: "Draft" } });
    const driversOnDuty = await prisma.driver.count({ where: { status: "OnTrip" } });

    const fleetUtilizationPct = nonRetired.length > 0 ? (onTrip.length / nonRetired.length) * 100 : 0;

    res.status(200).json({
      activeVehicles: nonRetired.length,
      availableVehicles: available.length,
      inShopVehicles: inShop.length,
      activeTrips,
      pendingTrips,
      driversOnDuty,
      fleetUtilizationPct: Math.round(fleetUtilizationPct * 10) / 10,
    });
  })
);

export default router;
