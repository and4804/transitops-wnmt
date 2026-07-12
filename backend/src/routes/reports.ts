import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { newReportDoc, drawTable, drawTotalsRow } from "../lib/pdf";
import { badRequest } from "../lib/errors";

const router = Router();
router.use(requireAuth);
router.use(requireRole("FleetManager", "FinancialAnalyst"));

async function buildFuelEfficiencyReport() {
  const vehicles = await prisma.vehicle.findMany({
    include: { trips: { where: { status: "Completed" } } },
  });
  return vehicles.map((v) => {
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
}

async function buildUtilizationReport() {
  const vehicles = await prisma.vehicle.findMany({ include: { trips: true } });
  return vehicles.map((v) => {
    const completedOrDispatched = v.trips.filter((t) => t.status === "Completed" || t.status === "Dispatched");
    return {
      vehicleId: v.id,
      regNumber: v.regNumber,
      totalTrips: v.trips.length,
      activeOrCompletedTrips: completedOrDispatched.length,
      status: v.status,
    };
  });
}

async function buildOperationalCostReport() {
  const vehicles = await prisma.vehicle.findMany({
    include: { fuelLogs: true, maintenanceRecords: true, expenses: true },
  });
  return vehicles.map((v) => {
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
}

async function buildRoiReport() {
  const vehicles = await prisma.vehicle.findMany({
    include: { trips: true, fuelLogs: true, maintenanceRecords: true, expenses: true },
  });
  return vehicles.map((v) => {
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
}

router.get(
  "/fuel-efficiency",
  asyncHandler(async (_req, res) => {
    res.status(200).json(await buildFuelEfficiencyReport());
  })
);

router.get(
  "/utilization",
  asyncHandler(async (_req, res) => {
    res.status(200).json(await buildUtilizationReport());
  })
);

router.get(
  "/operational-cost",
  asyncHandler(async (_req, res) => {
    res.status(200).json(await buildOperationalCostReport());
  })
);

router.get(
  "/roi",
  asyncHandler(async (_req, res) => {
    res.status(200).json(await buildRoiReport());
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

const REPORT_TYPES = ["fuel-efficiency", "utilization", "operational-cost", "roi"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

router.get(
  "/export.pdf",
  asyncHandler(async (req, res) => {
    const type = req.query.type as string;
    if (!REPORT_TYPES.includes(type as ReportType)) {
      throw badRequest(`'type' must be one of ${REPORT_TYPES.join(", ")}`);
    }

    if (type === "fuel-efficiency") {
      const rows = await buildFuelEfficiencyReport();
      const doc = newReportDoc(res, "Fuel Efficiency Report", "Total distance and fuel consumption per vehicle.", "fuel-efficiency-report.pdf");
      drawTable(
        doc,
        [
          { key: "regNumber", header: "VEHICLE", width: 110 },
          { key: "totalDistanceKm", header: "DISTANCE (KM)", width: 130, align: "right" },
          { key: "totalFuelLiters", header: "FUEL (L)", width: 110, align: "right" },
          { key: "kmPerLiter", header: "KM/L", width: 90, align: "right" },
        ],
        rows.map((r) => ({ ...r, kmPerLiter: r.kmPerLiter ?? "—" }))
      );
      doc.end();
      return;
    }

    if (type === "utilization") {
      const rows = await buildUtilizationReport();
      const doc = newReportDoc(res, "Fleet Utilization Report", "Trip counts and current status per vehicle.", "utilization-report.pdf");
      drawTable(
        doc,
        [
          { key: "regNumber", header: "VEHICLE", width: 110 },
          { key: "totalTrips", header: "TOTAL TRIPS", width: 110, align: "right" },
          { key: "activeOrCompletedTrips", header: "ACTIVE/COMPLETED", width: 140, align: "right" },
          { key: "status", header: "STATUS", width: 80 },
        ],
        rows
      );
      doc.end();
      return;
    }

    if (type === "operational-cost") {
      const rows = await buildOperationalCostReport();
      const doc = newReportDoc(res, "Operational Cost Report", "Fuel, maintenance, and other expenses per vehicle.", "operational-cost-report.pdf");
      drawTable(
        doc,
        [
          { key: "regNumber", header: "VEHICLE", width: 90 },
          { key: "totalFuelCost", header: "FUEL COST", width: 100, align: "right" },
          { key: "totalMaintenanceCost", header: "MAINTENANCE", width: 110, align: "right" },
          { key: "totalExpenseCost", header: "OTHER", width: 90, align: "right" },
          { key: "totalOperationalCost", header: "TOTAL", width: 90, align: "right" },
        ],
        rows.map((r) => ({
          ...r,
          totalFuelCost: `₹${r.totalFuelCost}`,
          totalMaintenanceCost: `₹${r.totalMaintenanceCost}`,
          totalExpenseCost: `₹${r.totalExpenseCost}`,
          totalOperationalCost: `₹${r.totalOperationalCost}`,
        }))
      );
      const grandTotal = rows.reduce((sum, r) => sum + r.totalOperationalCost, 0);
      drawTotalsRow(doc, "Fleet-wide total operational cost", `₹${grandTotal}`);
      doc.end();
      return;
    }

    const rows = await buildRoiReport();
    const doc = newReportDoc(res, "ROI Report", "Revenue vs. total cost (incl. acquisition) per vehicle.", "roi-report.pdf");
    drawTable(
      doc,
      [
        { key: "regNumber", header: "VEHICLE", width: 110 },
        { key: "totalRevenue", header: "REVENUE", width: 120, align: "right" },
        { key: "totalCost", header: "TOTAL COST", width: 120, align: "right" },
        { key: "roiPct", header: "ROI %", width: 80, align: "right" },
      ],
      rows.map((r) => ({
        ...r,
        totalRevenue: r.totalRevenue != null ? `₹${r.totalRevenue}` : "—",
        totalCost: `₹${r.totalCost}`,
        roiPct: r.roiPct != null ? `${r.roiPct}%` : "—",
      }))
    );
    doc.end();
  })
);

export default router;
