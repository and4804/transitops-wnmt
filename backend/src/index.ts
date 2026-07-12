import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import vehiclesRouter from "./routes/vehicles";
import driversRouter from "./routes/drivers";
import tripsRouter from "./routes/trips";
import maintenanceRouter from "./routes/maintenance";
import dashboardRouter from "./routes/dashboard";
import reportsRouter from "./routes/reports";
import mlRouter from "./routes/ml";
import { fuelLogsRouter, expensesRouter, costSummaryRouter } from "./routes/fuelExpense";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRouter);
app.use("/vehicles", costSummaryRouter); // /vehicles/:id/cost-summary
app.use("/vehicles", vehiclesRouter);
app.use("/drivers", driversRouter);
app.use("/trips", tripsRouter);
app.use("/maintenance", maintenanceRouter);
app.use("/dashboard", dashboardRouter);
app.use("/reports", reportsRouter);
app.use("/ml", mlRouter);
app.use("/fuel-logs", fuelLogsRouter);
app.use("/expenses", expensesRouter);

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 8080;
app.listen(PORT, () => {
  console.log(`TransitOps backend listening on :${PORT}`);
});
