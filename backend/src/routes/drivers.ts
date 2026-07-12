import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireField, requireNumber, requireEnum } from "../lib/validate";
import { conflict, notFound } from "../lib/errors";

const router = Router();

const DRIVER_STATUSES = ["Available", "OnTrip", "Suspended"] as const;

router.use(requireAuth);

router.post(
  "/",
  requireRole("FleetManager", "SafetyOfficer"),
  asyncHandler(async (req, res) => {
    const name = requireField(req.body, "name");
    const licenseNumber = requireField(req.body, "licenseNumber");
    const licenseCategory = requireField(req.body, "licenseCategory");
    const licenseExpiry = requireField(req.body, "licenseExpiry");
    const contactNumber = requireField(req.body, "contactNumber");

    const existing = await prisma.driver.findUnique({ where: { licenseNumber } });
    if (existing) {
      throw conflict(`Driver with licenseNumber '${licenseNumber}' already exists`);
    }

    const driver = await prisma.driver.create({
      data: {
        name,
        licenseNumber,
        licenseCategory,
        licenseExpiry: new Date(licenseExpiry),
        contactNumber,
      },
    });
    res.status(201).json(driver);
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    const drivers = await prisma.driver.findMany({
      where: status ? { status: status as any } : {},
      orderBy: { id: "asc" },
    });
    res.status(200).json(drivers);
  })
);

router.get(
  "/:driverId",
  asyncHandler(async (req, res) => {
    const driverId = Number(req.params.driverId);
    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw notFound(`Driver with id ${driverId} does not exist`);
    res.status(200).json(driver);
  })
);

router.put(
  "/:driverId",
  requireRole("FleetManager", "SafetyOfficer"),
  asyncHandler(async (req, res) => {
    const driverId = Number(req.params.driverId);
    const existing = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!existing) throw notFound(`Driver with id ${driverId} does not exist`);

    const name = requireField(req.body, "name");
    const licenseNumber = requireField(req.body, "licenseNumber");
    const licenseCategory = requireField(req.body, "licenseCategory");
    const licenseExpiry = requireField(req.body, "licenseExpiry");
    const contactNumber = requireField(req.body, "contactNumber");
    const safetyScore = requireNumber(req.body, "safetyScore");
    const status = requireEnum(req.body, "status", DRIVER_STATUSES);

    const driver = await prisma.driver.update({
      where: { id: driverId },
      data: {
        name,
        licenseNumber,
        licenseCategory,
        licenseExpiry: new Date(licenseExpiry),
        contactNumber,
        safetyScore,
        status,
      },
    });
    res.status(200).json(driver);
  })
);

export default router;
