import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireField, requireNumber } from "../lib/validate";
import { conflict, notFound, unprocessable } from "../lib/errors";

const router = Router();

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
    const { status, vehicleId, driverId } = req.query;
    const trips = await prisma.trip.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(vehicleId ? { vehicleId: Number(vehicleId) } : {}),
        ...(driverId ? { driverId: Number(driverId) } : {}),
      },
      orderBy: { id: "asc" },
    });
    res.status(200).json(trips);
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
