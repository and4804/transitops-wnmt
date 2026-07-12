import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireField, requireNumber } from "../lib/validate";
import { conflict, notFound, unprocessable } from "../lib/errors";
import { parseSort, containsFilter } from "../lib/query";
import { newReportDoc, drawTable } from "../lib/pdf";

const router = Router();

const TRIP_SORT_FIELDS = ["id", "source", "destination", "status", "createdAt", "actualDistanceKm"] as const;

router.use(requireAuth);

router.post(
  "/",
  requireRole("FleetManager", "Dispatcher"),
  asyncHandler(async (req, res) => {
    const source = requireField(req.body, "source");
    const destination = requireField(req.body, "destination");
    const vehicleId = requireNumber(req.body, "vehicleId");
    const driverId = requireNumber(req.body, "driverId");
    const cargoWeightKg = requireNumber(req.body, "cargoWeightKg");
    const plannedDistanceKm = requireNumber(req.body, "plannedDistanceKm");

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw notFound(`Vehicle with id ${vehicleId} does not exist`);

    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw notFound(`Driver with id ${driverId} does not exist`);

    if (vehicle.status !== "Available") {
      throw conflict(`Vehicle ${vehicleId} is not Available (current status: ${vehicle.status})`);
    }
    if (driver.status !== "Available") {
      if (driver.status === "Suspended") {
        throw unprocessable(`Driver ${driverId} is Suspended and cannot be assigned to a trip`);
      }
      throw conflict(`Driver ${driverId} is not Available (current status: ${driver.status})`);
    }

    if (cargoWeightKg > vehicle.maxLoadCapacityKg) {
      throw unprocessable(
        `Cargo weight ${cargoWeightKg}kg exceeds vehicle max load capacity ${vehicle.maxLoadCapacityKg}kg`
      );
    }

    if (driver.licenseExpiry < new Date()) {
      throw unprocessable(`Driver ${driverId}'s license expired on ${driver.licenseExpiry.toISOString().slice(0, 10)}`);
    }

    const trip = await prisma.trip.create({
      data: { source, destination, vehicleId, driverId, cargoWeightKg, plannedDistanceKm },
    });
    res.status(201).json(trip);
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status, vehicleId, driverId, q } = req.query;
    const trips = await prisma.trip.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(vehicleId ? { vehicleId: Number(vehicleId) } : {}),
        ...(driverId ? { driverId: Number(driverId) } : {}),
        ...containsFilter(q, ["source", "destination"]),
      },
      orderBy: parseSort(req.query as Record<string, unknown>, TRIP_SORT_FIELDS, "id"),
    });
    res.status(200).json(trips);
  })
);

router.get(
  "/export.pdf",
  requireRole("FleetManager", "Dispatcher"),
  asyncHandler(async (_req, res) => {
    const trips = await prisma.trip.findMany({ orderBy: { id: "asc" } });
    const doc = newReportDoc(res, "Trip Log Report", "All trips with route, cargo, and status.", "trip-log-report.pdf");
    drawTable(
      doc,
      [
        { key: "id", header: "#", width: 30, align: "right" },
        { key: "route", header: "ROUTE", width: 150 },
        { key: "vehicleId", header: "VEH", width: 40, align: "right" },
        { key: "driverId", header: "DRV", width: 40, align: "right" },
        { key: "cargoWeightKg", header: "CARGO (KG)", width: 70, align: "right" },
        { key: "distanceKm", header: "DIST (KM)", width: 70, align: "right" },
        { key: "status", header: "STATUS", width: 65 },
      ],
      trips.map((t) => ({
        id: t.id,
        route: `${t.source} -> ${t.destination}`,
        vehicleId: t.vehicleId,
        driverId: t.driverId,
        cargoWeightKg: t.cargoWeightKg,
        distanceKm: t.actualDistanceKm ?? t.plannedDistanceKm,
        status: t.status,
      }))
    );
    doc.end();
  })
);

router.get(
  "/:tripId",
  asyncHandler(async (req, res) => {
    const tripId = Number(req.params.tripId);
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw notFound(`Trip with id ${tripId} does not exist`);
    res.status(200).json(trip);
  })
);

router.post(
  "/:tripId/dispatch",
  requireRole("FleetManager", "Dispatcher"),
  asyncHandler(async (req, res) => {
    const tripId = Number(req.params.tripId);
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw notFound(`Trip with id ${tripId} does not exist`);
    if (trip.status !== "Draft") {
      throw conflict(`Trip ${tripId} cannot be dispatched from status ${trip.status}`);
    }

    const [, , updated] = await prisma.$transaction([
      prisma.vehicle.update({ where: { id: trip.vehicleId }, data: { status: "OnTrip" } }),
      prisma.driver.update({ where: { id: trip.driverId }, data: { status: "OnTrip" } }),
      prisma.trip.update({
        where: { id: tripId },
        data: { status: "Dispatched", dispatchedAt: new Date() },
      }),
    ]);
    res.status(200).json(updated);
  })
);

router.post(
  "/:tripId/complete",
  requireRole("FleetManager", "Dispatcher"),
  asyncHandler(async (req, res) => {
    const tripId = Number(req.params.tripId);
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw notFound(`Trip with id ${tripId} does not exist`);
    if (trip.status !== "Dispatched") {
      throw conflict(`Trip ${tripId} cannot be completed from status ${trip.status}`);
    }

    const actualDistanceKm = requireNumber(req.body, "actualDistanceKm");
    const fuelConsumedLiters = requireNumber(req.body, "fuelConsumedLiters");

    const [, , updated] = await prisma.$transaction([
      prisma.vehicle.update({
        where: { id: trip.vehicleId },
        data: { status: "Available", odometerKm: { increment: actualDistanceKm } },
      }),
      prisma.driver.update({ where: { id: trip.driverId }, data: { status: "Available" } }),
      prisma.trip.update({
        where: { id: tripId },
        data: { status: "Completed", completedAt: new Date(), actualDistanceKm, fuelConsumedLiters },
      }),
    ]);

    await prisma.fuelLog.create({
      data: {
        vehicleId: trip.vehicleId,
        tripId: trip.id,
        liters: fuelConsumedLiters,
        cost: 0,
        date: new Date(),
      },
    });

    res.status(200).json(updated);
  })
);

router.post(
  "/:tripId/cancel",
  requireRole("FleetManager", "Dispatcher"),
  asyncHandler(async (req, res) => {
    const tripId = Number(req.params.tripId);
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw notFound(`Trip with id ${tripId} does not exist`);
    if (trip.status !== "Dispatched") {
      throw conflict(`Trip ${tripId} cannot be cancelled from status ${trip.status}`);
    }

    const [, , updated] = await prisma.$transaction([
      prisma.vehicle.update({ where: { id: trip.vehicleId }, data: { status: "Available" } }),
      prisma.driver.update({ where: { id: trip.driverId }, data: { status: "Available" } }),
      prisma.trip.update({ where: { id: tripId }, data: { status: "Cancelled" } }),
    ]);
    res.status(200).json(updated);
  })
);

export default router;
