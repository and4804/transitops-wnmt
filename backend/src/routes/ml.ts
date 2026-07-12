import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { serviceUnavailable } from "../lib/errors";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

async function callMl<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${ML_SERVICE_URL}${path}`);
  } catch {
    throw serviceUnavailable("ML service is unreachable — is ml-service running?");
  }
  if (!res.ok) {
    throw serviceUnavailable(`ML service returned ${res.status}`);
  }
  return (await res.json()) as T;
}

function forwardQuery(req: { query: Record<string, unknown> }): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

const router = Router();
router.use(requireAuth);

router.get(
  "/maintenance-risk",
  requireRole("FleetManager"),
  asyncHandler(async (req, res) => {
    res.status(200).json(await callMl(`/maintenance-risk${forwardQuery(req)}`));
  })
);

router.get(
  "/driver-safety-scores",
  requireRole("FleetManager", "SafetyOfficer"),
  asyncHandler(async (req, res) => {
    res.status(200).json(await callMl(`/driver-safety-scores${forwardQuery(req)}`));
  })
);

router.get(
  "/fuel-anomalies",
  requireRole("FleetManager", "FinancialAnalyst"),
  asyncHandler(async (req, res) => {
    res.status(200).json(await callMl(`/fuel-anomalies${forwardQuery(req)}`));
  })
);

router.get(
  "/cost-roi-forecast",
  requireRole("FleetManager", "FinancialAnalyst"),
  asyncHandler(async (req, res) => {
    res.status(200).json(await callMl(`/cost-roi-forecast${forwardQuery(req)}`));
  })
);

router.get(
  "/utilization-forecast",
  asyncHandler(async (req, res) => {
    res.status(200).json(await callMl(`/utilization-forecast${forwardQuery(req)}`));
  })
);

export default router;
