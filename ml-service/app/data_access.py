"""Read-only access to the Postgres tables Prisma owns. This module never writes."""

import pandas as pd

from .db import engine


def get_vehicles_df() -> pd.DataFrame:
    return pd.read_sql(
        'SELECT "id", "regNumber", "name", "model", "type", "maxLoadCapacityKg", '
        '"odometerKm", "acquisitionCost", "region", "status", "createdAt" FROM "Vehicle"',
        engine,
    )


def get_drivers_df() -> pd.DataFrame:
    return pd.read_sql(
        'SELECT "id", "name", "licenseNumber", "licenseCategory", "licenseExpiry", '
        '"contactNumber", "safetyScore", "status", "userId", "createdAt" FROM "Driver"',
        engine,
    )


def get_trips_df() -> pd.DataFrame:
    return pd.read_sql(
        'SELECT "id", "source", "destination", "vehicleId", "driverId", "cargoWeightKg", '
        '"plannedDistanceKm", "actualDistanceKm", "fuelConsumedLiters", "revenue", "status", '
        '"createdAt", "dispatchedAt", "completedAt" FROM "Trip"',
        engine,
    )


def get_maintenance_df() -> pd.DataFrame:
    return pd.read_sql(
        'SELECT "id", "vehicleId", "description", "cost", "status", "createdAt", "closedAt" '
        'FROM "Maintenance"',
        engine,
    )


def get_fuel_logs_df() -> pd.DataFrame:
    return pd.read_sql(
        'SELECT "id", "vehicleId", "tripId", "liters", "cost", "date" FROM "FuelLog"',
        engine,
    )


def get_expenses_df() -> pd.DataFrame:
    return pd.read_sql(
        'SELECT "id", "vehicleId", "type", "amount", "date", "description" FROM "Expense"',
        engine,
    )


def get_data_fingerprint() -> str:
    """Cheap signature of table sizes/max-ids, used to decide whether cached models are stale."""
    with engine.connect() as conn:
        row = conn.exec_driver_sql(
            'SELECT '
            '(SELECT count(*) FROM "Vehicle") AS vehicles, '
            '(SELECT count(*) FROM "Driver") AS drivers, '
            '(SELECT count(*) FROM "Trip") AS trips, '
            '(SELECT coalesce(max("id"), 0) FROM "Trip") AS max_trip_id, '
            '(SELECT count(*) FROM "Maintenance") AS maintenance, '
            '(SELECT count(*) FROM "FuelLog") AS fuel_logs, '
            '(SELECT count(*) FROM "Expense") AS expenses'
        ).fetchone()
    return "-".join(str(v) for v in row)
