"""Synthetic historical dataset generator for TransitOps ML features.

Populates ~9 months of Vehicles/Drivers/Trips/Maintenance/FuelLog/Expense rows
with signal deliberately injected for each ML feature to detect:
  - a handful of vehicles overdue for maintenance (Predictive Maintenance Risk)
  - drivers with distinct behavior archetypes (Driver Safety Score Engine)
  - a subset of fuel logs with abnormal liters/cost (Fuel Anomaly Detection)
  - enough monthly cost/revenue and daily trip-interval history for the
    forecast features (Cost/ROI Trend Forecast, Fleet Utilization Forecast)

Never touches the User table, so demo login credentials always stay valid.
Run: python scripts/generate_synthetic_data.py [--reset]
"""

import argparse
import random
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from faker import Faker
from sqlalchemy import text

from app.db import engine

fake = Faker("en_IN")

WINDOW_DAYS = 270
NUM_NEW_VEHICLES = 25
NUM_NEW_DRIVERS = 20
OVERDUE_VEHICLE_COUNT = 5
REGIONS = ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Pune", "Nashik"]
MAINT_DESCRIPTIONS = ["Oil Change", "Brake Service", "Tire Replacement", "General Inspection", "Engine Repair", "Battery Replacement"]

VEHICLE_TYPE_PROFILE = {
    "Van": {"capacity": (400, 900), "cost": (450000, 750000), "kmpl": (11, 15)},
    "Truck": {"capacity": (1500, 3500), "cost": (1200000, 1900000), "kmpl": (5, 8)},
    "Mini": {"capacity": (150, 450), "cost": (300000, 500000), "kmpl": (14, 19)},
    "Bus": {"capacity": (2500, 4500), "cost": (2200000, 3200000), "kmpl": (4, 6)},
    "Other": {"capacity": (500, 1500), "cost": (500000, 1000000), "kmpl": (8, 12)},
}
VEHICLE_TYPES = list(VEHICLE_TYPE_PROFILE.keys())

ARCHETYPES = {
    "Reliable": {"cancel_rate": 0.03, "deviation": 0.05, "cargo_util": (0.35, 0.65)},
    "Average": {"cancel_rate": 0.10, "deviation": 0.12, "cargo_util": (0.5, 0.85)},
    "Erratic": {"cancel_rate": 0.22, "deviation": 0.35, "cargo_util": (0.8, 0.98)},
}


def now():
    from pandas import Timestamp

    return Timestamp.utcnow().tz_localize(None).to_pydatetime()


def reset_generated_data(conn):
    conn.execute(text('TRUNCATE "FuelLog", "Maintenance", "Expense", "Trip" RESTART IDENTITY CASCADE'))
    conn.execute(text("DELETE FROM \"Driver\" WHERE \"licenseNumber\" LIKE 'GEN-DL-%'"))
    conn.execute(text("DELETE FROM \"Vehicle\" WHERE \"regNumber\" LIKE 'GEN-%'"))


def upsert_original_fixtures(conn):
    """Guarantees the demo seed's 3 vehicles / 2 drivers exist; never creates duplicates."""
    conn.execute(
        text(
            'INSERT INTO "Vehicle" ("regNumber","name","model","type","maxLoadCapacityKg","odometerKm","acquisitionCost","region","status","createdAt") '
            "VALUES ('VAN-05','Van-05','Tata Ace','Van',500,12000,620000,'Ahmedabad','Available', :createdAt) "
            'ON CONFLICT ("regNumber") DO NOTHING'
        ),
        {"createdAt": now() - timedelta(days=WINDOW_DAYS)},
    )
    conn.execute(
        text(
            'INSERT INTO "Vehicle" ("regNumber","name","model","type","maxLoadCapacityKg","odometerKm","acquisitionCost","region","status","createdAt") '
            "VALUES ('TRK-11','Truck-11','Ashok Leyland Dost','Truck',2000,45000,1450000,'Surat','Available', :createdAt) "
            'ON CONFLICT ("regNumber") DO NOTHING'
        ),
        {"createdAt": now() - timedelta(days=WINDOW_DAYS)},
    )
    conn.execute(
        text(
            'INSERT INTO "Vehicle" ("regNumber","name","model","type","maxLoadCapacityKg","odometerKm","acquisitionCost","region","status","createdAt") '
            "VALUES ('BUS-02','Bus-02','Tata Starbus','Bus',3000,88000,2600000,'Ahmedabad','InShop', :createdAt) "
            'ON CONFLICT ("regNumber") DO NOTHING'
        ),
        {"createdAt": now() - timedelta(days=WINDOW_DAYS)},
    )
    conn.execute(
        text(
            'INSERT INTO "Driver" ("name","licenseNumber","licenseCategory","licenseExpiry","contactNumber","safetyScore","status","createdAt") '
            "VALUES ('Alex','DL-88213','LMV','2028-12-01','9876500000',96,'Available', :createdAt) "
            'ON CONFLICT ("licenseNumber") DO NOTHING'
        ),
        {"createdAt": now() - timedelta(days=WINDOW_DAYS)},
    )
    conn.execute(
        text(
            'INSERT INTO "Driver" ("name","licenseNumber","licenseCategory","licenseExpiry","contactNumber","safetyScore","status","createdAt") '
            "VALUES ('John','DL-44120','HMV','2025-03-01','9822000000',81,'Suspended', :createdAt) "
            'ON CONFLICT ("licenseNumber") DO NOTHING'
        ),
        {"createdAt": now() - timedelta(days=WINDOW_DAYS)},
    )


def create_vehicles(conn, count: int, window_start) -> list[dict]:
    vehicles = []
    for i in range(count):
        vtype = random.choice(VEHICLE_TYPES)
        profile = VEHICLE_TYPE_PROFILE[vtype]
        cap_lo, cap_hi = profile["capacity"]
        cost_lo, cost_hi = profile["cost"]
        reg_number = f"GEN-{i + 1:03d}"
        created_at = window_start + timedelta(days=random.randint(0, WINDOW_DAYS - 30))
        row = {
            "regNumber": reg_number,
            "name": f"{vtype}-{i + 1:03d}",
            "model": fake.company() + " " + vtype,
            "type": vtype,
            "maxLoadCapacityKg": round(random.uniform(cap_lo, cap_hi), 1),
            "odometerKm": round(random.uniform(2000, 60000), 1),
            "acquisitionCost": round(random.uniform(cost_lo, cost_hi), 2),
            "region": random.choice(REGIONS),
            "status": "Available",
            "createdAt": created_at,
        }
        result = conn.execute(
            text(
                'INSERT INTO "Vehicle" ("regNumber","name","model","type","maxLoadCapacityKg","odometerKm","acquisitionCost","region","status","createdAt") '
                "VALUES (:regNumber,:name,:model,:type,:maxLoadCapacityKg,:odometerKm,:acquisitionCost,:region,:status,:createdAt) "
                'RETURNING "id"'
            ),
            row,
        )
        row["id"] = result.scalar()
        row["kmpl"] = round(random.uniform(*profile["kmpl"]), 2)
        vehicles.append(row)
    return vehicles


def create_drivers(conn, count: int, window_start) -> list[dict]:
    drivers = []
    archetype_names = list(ARCHETYPES.keys())
    weights = [0.5, 0.35, 0.15]  # mostly Reliable/Average, a minority Erratic
    for i in range(count):
        archetype = random.choices(archetype_names, weights=weights)[0]
        created_at = window_start + timedelta(days=random.randint(0, WINDOW_DAYS - 30))
        expiring_soon = i < 3  # exercise the license-expiry-proximity signal
        expiry = (
            now() + timedelta(days=random.randint(30, 60))
            if expiring_soon
            else now() + timedelta(days=random.randint(120, 900))
        )
        row = {
            "name": fake.name(),
            "licenseNumber": f"GEN-DL-{i + 1:05d}",
            "licenseCategory": random.choice(["LMV", "HMV"]),
            "licenseExpiry": expiry,
            "contactNumber": f"9{random.randint(100000000, 999999999)}",
            "safetyScore": 90,
            "status": "Available",
            "createdAt": created_at,
        }
        result = conn.execute(
            text(
                'INSERT INTO "Driver" ("name","licenseNumber","licenseCategory","licenseExpiry","contactNumber","safetyScore","status","createdAt") '
                "VALUES (:name,:licenseNumber,:licenseCategory,:licenseExpiry,:contactNumber,:safetyScore,:status,:createdAt) "
                'RETURNING "id"'
            ),
            row,
        )
        row["id"] = result.scalar()
        row["archetype"] = archetype
        drivers.append(row)
    return drivers


def create_maintenance_and_trips(conn, vehicles: list[dict], drivers: list[dict], window_start):
    overdue_vehicle_ids = {v["id"] for v in random.sample(vehicles, min(OVERDUE_VEHICLE_COUNT, len(vehicles)))}

    trips_by_vehicle: dict[int, list[dict]] = {v["id"]: [] for v in vehicles}
    fuel_logs = []

    for vehicle in vehicles:
        vid = vehicle["id"]
        v_created = vehicle["createdAt"]
        v_end = now()
        lifetime_days = max((v_end - v_created).days, 1)

        # --- Maintenance intervals ---
        interval_start = v_created
        is_overdue = vid in overdue_vehicle_ids
        while True:
            gap_days = random.randint(60, 130)
            next_maint_at = interval_start + timedelta(days=gap_days)
            if next_maint_at >= v_end:
                break
            if is_overdue and (v_end - next_maint_at).days < 150:
                # stop scheduling further maintenance so this vehicle's last service is old
                break
            closed_at = next_maint_at + timedelta(days=random.randint(1, 4))
            conn.execute(
                text(
                    'INSERT INTO "Maintenance" ("vehicleId","description","cost","status","createdAt","closedAt") '
                    "VALUES (:vehicleId,:description,:cost,'Closed',:createdAt,:closedAt)"
                ),
                {
                    "vehicleId": vid,
                    "description": random.choice(MAINT_DESCRIPTIONS),
                    "cost": round(random.uniform(2000, 25000), 2),
                    "createdAt": next_maint_at,
                    "closedAt": closed_at,
                },
            )
            interval_start = closed_at

        # --- Trips across the vehicle's lifetime ---
        num_trips = max(5, round(lifetime_days / random.uniform(6, 10)))
        for _ in range(num_trips):
            driver = random.choice(drivers)
            archetype = ARCHETYPES[driver["archetype"]]

            created_at = v_created + timedelta(seconds=random.randint(0, int((v_end - v_created).total_seconds())))
            roll = random.random()
            if created_at > v_end - timedelta(days=3) and roll < 0.5:
                status = "Draft"
            elif created_at > v_end - timedelta(days=7) and roll < 0.7:
                status = "Dispatched"
            elif roll < archetype["cancel_rate"]:
                status = "Cancelled"
            else:
                status = "Completed"

            planned_km = round(random.uniform(15, 320), 1)
            cargo_lo, cargo_hi = archetype["cargo_util"]
            cargo_weight = round(min(vehicle["maxLoadCapacityKg"] * random.uniform(cargo_lo, cargo_hi), vehicle["maxLoadCapacityKg"] * 0.99), 1)

            dispatched_at = None
            completed_at = None
            actual_km = None
            fuel_consumed = None
            revenue = None

            if status in ("Dispatched", "Completed", "Cancelled"):
                dispatched_at = created_at + timedelta(hours=random.uniform(1, 6))
            if status == "Completed":
                deviation = random.uniform(-archetype["deviation"], archetype["deviation"])
                actual_km = round(max(planned_km * (1 + deviation), 1.0), 1)
                travel_hours = actual_km / random.uniform(28, 45)
                completed_at = dispatched_at + timedelta(hours=travel_hours)
                fuel_consumed = round(actual_km / vehicle["kmpl"] * random.uniform(0.92, 1.1), 2)
                if random.random() > 0.15:
                    rate_per_km = {"Van": 22, "Truck": 32, "Mini": 18, "Bus": 26, "Other": 24}[vehicle["type"]]
                    revenue = round(actual_km * rate_per_km * random.uniform(0.85, 1.2), 2)

            row = {
                "source": fake.city(),
                "destination": fake.city(),
                "vehicleId": vid,
                "driverId": driver["id"],
                "cargoWeightKg": cargo_weight,
                "plannedDistanceKm": planned_km,
                "actualDistanceKm": actual_km,
                "fuelConsumedLiters": fuel_consumed,
                "revenue": revenue,
                "status": status,
                "createdAt": created_at,
                "dispatchedAt": dispatched_at,
                "completedAt": completed_at,
            }
            result = conn.execute(
                text(
                    'INSERT INTO "Trip" ("source","destination","vehicleId","driverId","cargoWeightKg","plannedDistanceKm","actualDistanceKm","fuelConsumedLiters","revenue","status","createdAt","dispatchedAt","completedAt") '
                    "VALUES (:source,:destination,:vehicleId,:driverId,:cargoWeightKg,:plannedDistanceKm,:actualDistanceKm,:fuelConsumedLiters,:revenue,:status,:createdAt,:dispatchedAt,:completedAt) "
                    'RETURNING "id"'
                ),
                row,
            )
            row["id"] = result.scalar()
            trips_by_vehicle[vid].append(row)

            if status == "Completed" and fuel_consumed:
                price_per_liter = random.uniform(95, 108)
                fuel_logs.append(
                    {
                        "vehicleId": vid,
                        "tripId": row["id"],
                        "liters": fuel_consumed,
                        "cost": round(fuel_consumed * price_per_liter, 2),
                        "date": completed_at,
                    }
                )

    return fuel_logs


def insert_fuel_logs_with_anomalies(conn, fuel_logs: list[dict]):
    anomaly_fraction = 0.07
    anomaly_indices = set(random.sample(range(len(fuel_logs)), max(1, round(len(fuel_logs) * anomaly_fraction)))) if fuel_logs else set()

    for i, log in enumerate(fuel_logs):
        if i in anomaly_indices:
            if random.random() < 0.5:
                log["liters"] = round(log["liters"] * random.uniform(1.6, 2.6), 2)  # simulated leakage/theft
            else:
                log["cost"] = round(log["cost"] * random.uniform(1.5, 2.3), 2)  # simulated billing fraud
        conn.execute(
            text('INSERT INTO "FuelLog" ("vehicleId","tripId","liters","cost","date") VALUES (:vehicleId,:tripId,:liters,:cost,:date)'),
            log,
        )


def create_expenses(conn, vehicles: list[dict]):
    expense_ranges = {"Toll": (50, 500), "Parking": (20, 300), "Fine": (500, 5000), "Insurance": (8000, 25000), "Other": (100, 2000)}
    for vehicle in vehicles:
        for _ in range(random.randint(2, 8)):
            expense_type = random.choice(list(expense_ranges.keys()))
            lo, hi = expense_ranges[expense_type]
            date = vehicle["createdAt"] + timedelta(days=random.randint(0, max((now() - vehicle["createdAt"]).days, 1)))
            conn.execute(
                text(
                    'INSERT INTO "Expense" ("vehicleId","type","amount","date","description") '
                    "VALUES (:vehicleId,:type,:amount,:date,:description)"
                ),
                {
                    "vehicleId": vehicle["id"],
                    "type": expense_type,
                    "amount": round(random.uniform(lo, hi), 2),
                    "date": date,
                    "description": None,
                },
            )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Wipe previously generated data before regenerating")
    args = parser.parse_args()

    window_start = now() - timedelta(days=WINDOW_DAYS)

    with engine.begin() as conn:
        if args.reset:
            reset_generated_data(conn)
        upsert_original_fixtures(conn)

        existing_vehicle_ids = conn.execute(text('SELECT "id","regNumber","type","maxLoadCapacityKg","createdAt" FROM "Vehicle"')).mappings().all()
        original_vehicles = [dict(v) for v in existing_vehicle_ids if not v["regNumber"].startswith("GEN-")]
        for v in original_vehicles:
            profile = VEHICLE_TYPE_PROFILE.get(v["type"], VEHICLE_TYPE_PROFILE["Other"])
            v["kmpl"] = round(random.uniform(*profile["kmpl"]), 2)

        new_vehicles = create_vehicles(conn, NUM_NEW_VEHICLES, window_start)
        all_vehicles = original_vehicles + new_vehicles

        new_drivers = create_drivers(conn, NUM_NEW_DRIVERS, window_start)
        existing_drivers = conn.execute(text('SELECT "id" FROM "Driver" WHERE "licenseNumber" NOT LIKE \'GEN-DL-%\'')).mappings().all()
        original_drivers = [{"id": d["id"], "archetype": "Average"} for d in existing_drivers]
        all_drivers = original_drivers + new_drivers

        fuel_logs = create_maintenance_and_trips(conn, all_vehicles, all_drivers, window_start)
        insert_fuel_logs_with_anomalies(conn, fuel_logs)
        create_expenses(conn, all_vehicles)

    print(f"Generated {len(new_vehicles)} vehicles, {len(new_drivers)} drivers, {len(fuel_logs)} fuel logs across {WINDOW_DAYS} days.")


if __name__ == "__main__":
    main()
