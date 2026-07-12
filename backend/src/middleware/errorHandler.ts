import { ErrorRequestHandler } from "express";
import { ApiError } from "../lib/errors";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      timestamp: new Date().toISOString(),
      status: err.status,
      error: err.errorName,
      message: err.message,
      path: req.originalUrl.split("?")[0],
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    timestamp: new Date().toISOString(),
    status: 500,
    error: "Internal Server Error",
    message: "An unexpected error occurred",
    path: req.originalUrl.split("?")[0],
  });
};

export const asyncHandler =
  (fn: (req: any, res: any, next: any) => Promise<any>) =>
  (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next);
