import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireField, requireNumber } from "../lib/validate";
import { conflict, notFound } from "../lib/errors";

const router = Router();

router.use(requireAuth);

router.post(
  "/",
  requireRole("FleetManager"),
  asyncHandler(async (req, res) => {
    const vehicleId = requireNumber(req.body, "vehicleId");
    const description = requireField(req.body, "description");
    const cost = requireNumber(req.body, "cost");

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw notFound(`Vehicle with id ${vehicleId} does not exist`);

    if (vehicle.status === "InShop") {
      throw conflict(`Vehicle ${vehicleId} already has an open maintenance record`);
    }
    if (vehicle.status === "Retired") {
      throw conflict(`Vehicle ${vehicleId} is Retired and cannot be sent to maintenance`);
    }

    const [record] = await prisma.$transaction([
      prisma.maintenance.create({ data: { vehicleId, description, cost } }),
      prisma.vehicle.update({ where: { id: vehicleId }, data: { status: "InShop" } }),
    ]);
    res.status(201).json(record);
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { vehicleId } = req.query;
    const records = await prisma.maintenance.findMany({
      where: vehicleId ? { vehicleId: Number(vehicleId) } : {},
      orderBy: { id: "asc" },
    });
    res.status(200).json(records);
  })
);

router.post(
  "/:maintenanceId/close",
  requireRole("FleetManager"),
  asyncHandler(async (req, res) => {
    const maintenanceId = Number(req.params.maintenanceId);
    const record = await prisma.maintenance.findUnique({ where: { id: maintenanceId } });
    if (!record) throw notFound(`Maintenance record with id ${maintenanceId} does not exist`);
    if (record.status === "Closed") {
      throw conflict(`Maintenance record ${maintenanceId} is already Closed`);
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: record.vehicleId } });
    const nextVehicleStatus = vehicle?.status === "Retired" ? "Retired" : "Available";

    const [updated] = await prisma.$transaction([
      prisma.maintenance.update({
        where: { id: maintenanceId },
        data: { status: "Closed", closedAt: new Date() },
      }),
      prisma.vehicle.update({ where: { id: record.vehicleId }, data: { status: nextVehicleStatus } }),
    ]);
    res.status(200).json(updated);
  })
);

export default router;
