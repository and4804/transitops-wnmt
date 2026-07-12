import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireField, requireNumber, requireEnum, optionalString } from "../lib/validate";
import { conflict, notFound } from "../lib/errors";
import { parseSort, containsFilter } from "../lib/query";
import { newReportDoc, drawTable } from "../lib/pdf";

const router = Router();

const VEHICLE_SORT_FIELDS = ["id", "regNumber", "name", "type", "odometerKm", "status", "region"] as const;

const VEHICLE_TYPES = ["Van", "Truck", "Mini", "Bus", "Other"] as const;
const VEHICLE_STATUSES = ["Available", "OnTrip", "InShop", "Retired"] as const;

router.use(requireAuth);

router.post(
  "/",
  requireRole("FleetManager"),
  asyncHandler(async (req, res) => {
    const regNumber = requireField(req.body, "regNumber");
    const name = requireField(req.body, "name");
    const model = requireField(req.body, "model");
    const type = requireEnum(req.body, "type", VEHICLE_TYPES);
    const maxLoadCapacityKg = requireNumber(req.body, "maxLoadCapacityKg");
    const acquisitionCost = requireNumber(req.body, "acquisitionCost");
    const region = optionalString(req.body, "region");

    const existing = await prisma.vehicle.findUnique({ where: { regNumber } });
    if (existing) {
      throw conflict(`Vehicle with regNumber '${regNumber}' already exists`);
    }

    const vehicle = await prisma.vehicle.create({
      data: { regNumber, name, model, type, maxLoadCapacityKg, acquisitionCost, region },
    });
    res.status(201).json(vehicle);
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { type, status, region, q } = req.query;
    const vehicles = await prisma.vehicle.findMany({
      where: {
        ...(type ? { type: type as any } : {}),
        ...(status ? { status: status as any } : {}),
        ...(region ? { region: region as any } : {}),
        ...containsFilter(q, ["regNumber", "name", "model"]),
      },
      orderBy: parseSort(req.query as Record<string, unknown>, VEHICLE_SORT_FIELDS, "id"),
    });
    res.status(200).json(vehicles);
  })
);

router.get(
  "/export.pdf",
  requireRole("FleetManager"),
  asyncHandler(async (_req, res) => {
    const vehicles = await prisma.vehicle.findMany({ orderBy: { id: "asc" } });
    const doc = newReportDoc(res, "Vehicle Registry Report", "Full fleet listing with status and specifications.", "vehicle-registry-report.pdf");
    drawTable(
      doc,
      [
        { key: "regNumber", header: "REG NO.", width: 80 },
        { key: "name", header: "NAME", width: 90 },
        { key: "type", header: "TYPE", width: 60 },
        { key: "maxLoadCapacityKg", header: "CAPACITY (KG)", width: 90, align: "right" },
        { key: "odometerKm", header: "ODOMETER (KM)", width: 90, align: "right" },
        { key: "region", header: "REGION", width: 70 },
        { key: "status", header: "STATUS", width: 55 },
      ],
      vehicles.map((v) => ({
        regNumber: v.regNumber,
        name: v.name,
        type: v.type,
        maxLoadCapacityKg: v.maxLoadCapacityKg,
        odometerKm: v.odometerKm,
        region: v.region ?? "—",
        status: v.status,
      }))
    );
    doc.end();
  })
);

router.get(
  "/:vehicleId",
  asyncHandler(async (req, res) => {
    const vehicleId = Number(req.params.vehicleId);
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw notFound(`Vehicle with id ${vehicleId} does not exist`);
    res.status(200).json(vehicle);
  })
);

router.put(
  "/:vehicleId",
  requireRole("FleetManager"),
  asyncHandler(async (req, res) => {
    const vehicleId = Number(req.params.vehicleId);
    const existing = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!existing) throw notFound(`Vehicle with id ${vehicleId} does not exist`);

    const name = requireField(req.body, "name");
    const model = requireField(req.body, "model");
    const type = requireEnum(req.body, "type", VEHICLE_TYPES);
    const maxLoadCapacityKg = requireNumber(req.body, "maxLoadCapacityKg");
    const acquisitionCost = requireNumber(req.body, "acquisitionCost");
    const region = optionalString(req.body, "region");
    const status = requireEnum(req.body, "status", VEHICLE_STATUSES);

    const vehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { name, model, type, maxLoadCapacityKg, acquisitionCost, region, status },
    });
    res.status(200).json(vehicle);
  })
);

export default router;
