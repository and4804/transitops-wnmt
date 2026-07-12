import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireField, requireNumber, requireEnum } from "../lib/validate";
import { notFound } from "../lib/errors";
import { parseSort } from "../lib/query";

const EXPENSE_TYPES = ["Toll", "Parking", "Fine", "Insurance", "Other"] as const;
const FUEL_LOG_SORT_FIELDS = ["id", "date", "liters", "cost"] as const;
const EXPENSE_SORT_FIELDS = ["id", "date", "amount", "type"] as const;

export const fuelLogsRouter = Router();
fuelLogsRouter.use(requireAuth);

fuelLogsRouter.post(
  "/",
  requireRole("FleetManager", "FinancialAnalyst", "Dispatcher"),
  asyncHandler(async (req, res) => {
    const vehicleId = requireNumber(req.body, "vehicleId");
    const liters = requireNumber(req.body, "liters");
    const cost = requireNumber(req.body, "cost");
    const date = requireField(req.body, "date");
    const tripId = req.body?.tripId ?? null;

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw notFound(`Vehicle with id ${vehicleId} does not exist`);

    const log = await prisma.fuelLog.create({
      data: { vehicleId, tripId, liters, cost, date: new Date(date) },
    });
    res.status(201).json(log);
  })
);

fuelLogsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { vehicleId } = req.query;
    const logs = await prisma.fuelLog.findMany({
      where: vehicleId ? { vehicleId: Number(vehicleId) } : {},
      orderBy: parseSort(req.query as Record<string, unknown>, FUEL_LOG_SORT_FIELDS, "id"),
    });
    res.status(200).json(logs);
  })
);

export const expensesRouter = Router();
expensesRouter.use(requireAuth);

expensesRouter.post(
  "/",
  requireRole("FleetManager", "FinancialAnalyst"),
  asyncHandler(async (req, res) => {
    const vehicleId = requireNumber(req.body, "vehicleId");
    const type = requireEnum(req.body, "type", EXPENSE_TYPES);
    const amount = requireNumber(req.body, "amount");
    const date = requireField(req.body, "date");
    const description = req.body?.description ?? null;

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw notFound(`Vehicle with id ${vehicleId} does not exist`);

    const expense = await prisma.expense.create({
      data: { vehicleId, type, amount, date: new Date(date), description },
    });
    res.status(201).json(expense);
  })
);

expensesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { vehicleId } = req.query;
    const expenses = await prisma.expense.findMany({
      where: vehicleId ? { vehicleId: Number(vehicleId) } : {},
      orderBy: parseSort(req.query as Record<string, unknown>, EXPENSE_SORT_FIELDS, "id"),
    });
    res.status(200).json(expenses);
  })
);

export const costSummaryRouter = Router();
costSummaryRouter.use(requireAuth);

costSummaryRouter.get(
  "/:vehicleId/cost-summary",
  asyncHandler(async (req, res) => {
    const vehicleId = Number(req.params.vehicleId);
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw notFound(`Vehicle with id ${vehicleId} does not exist`);

    const [fuelLogs, maintenanceRecords, expenses] = await Promise.all([
      prisma.fuelLog.findMany({ where: { vehicleId } }),
      prisma.maintenance.findMany({ where: { vehicleId } }),
      prisma.expense.findMany({ where: { vehicleId } }),
    ]);

    const totalFuelCost = fuelLogs.reduce((sum, l) => sum + l.cost, 0);
    const totalMaintenanceCost = maintenanceRecords.reduce((sum, m) => sum + m.cost, 0);
    const totalExpenseCost = expenses.reduce((sum, e) => sum + e.amount, 0);

    res.status(200).json({
      vehicleId,
      totalFuelCost,
      totalMaintenanceCost,
      totalExpenseCost,
      totalCost: totalFuelCost + totalMaintenanceCost + totalExpenseCost,
    });
  })
);

export default fuelLogsRouter;
