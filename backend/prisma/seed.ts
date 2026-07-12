import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("correct-horse-battery", 10);

  await prisma.user.upsert({
    where: { email: "raven.k@transitops.io" },
    update: {},
    create: {
      name: "Raven K.",
      email: "raven.k@transitops.io",
      passwordHash,
      role: "FleetManager",
    },
  });
  await prisma.user.upsert({
    where: { email: "dispatch@transitops.io" },
    update: {},
    create: {
      name: "Dee Dispatcher",
      email: "dispatch@transitops.io",
      passwordHash,
      role: "Dispatcher",
    },
  });
  await prisma.user.upsert({
    where: { email: "safety@transitops.io" },
    update: {},
    create: {
      name: "Sam Safety",
      email: "safety@transitops.io",
      passwordHash,
      role: "SafetyOfficer",
    },
  });
  await prisma.user.upsert({
    where: { email: "finance@transitops.io" },
    update: {},
    create: {
      name: "Fiona Finance",
      email: "finance@transitops.io",
      passwordHash,
      role: "FinancialAnalyst",
    },
  });

  const van05 = await prisma.vehicle.upsert({
    where: { regNumber: "VAN-05" },
    update: {},
    create: {
      regNumber: "VAN-05",
      name: "Van-05",
      model: "Tata Ace",
      type: "Van",
      maxLoadCapacityKg: 500,
      odometerKm: 12000,
      acquisitionCost: 620000,
      region: "Ahmedabad",
      status: "Available",
    },
  });

  await prisma.vehicle.upsert({
    where: { regNumber: "TRK-11" },
    update: {},
    create: {
      regNumber: "TRK-11",
      name: "Truck-11",
      model: "Ashok Leyland Dost",
      type: "Truck",
      maxLoadCapacityKg: 2000,
      odometerKm: 45000,
      acquisitionCost: 1450000,
      region: "Surat",
      status: "Available",
    },
  });

  await prisma.vehicle.upsert({
    where: { regNumber: "BUS-02" },
    update: {},
    create: {
      regNumber: "BUS-02",
      name: "Bus-02",
      model: "Tata Starbus",
      type: "Bus",
      maxLoadCapacityKg: 3000,
      odometerKm: 88000,
      acquisitionCost: 2600000,
      region: "Ahmedabad",
      status: "InShop",
    },
  });

  const alex = await prisma.driver.upsert({
    where: { licenseNumber: "DL-88213" },
    update: {},
    create: {
      name: "Alex",
      licenseNumber: "DL-88213",
      licenseCategory: "LMV",
      licenseExpiry: new Date("2028-12-01"),
      contactNumber: "9876500000",
      safetyScore: 96,
      status: "Available",
    },
  });

  await prisma.driver.upsert({
    where: { licenseNumber: "DL-44120" },
    update: {},
    create: {
      name: "John",
      licenseNumber: "DL-44120",
      licenseCategory: "HMV",
      licenseExpiry: new Date("2025-03-01"),
      contactNumber: "9822000000",
      safetyScore: 81,
      status: "Suspended",
    },
  });

  await prisma.trip.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      source: "Gandhinagar Depot",
      destination: "Ahmedabad Hub",
      vehicleId: van05.id,
      driverId: alex.id,
      cargoWeightKg: 450,
      plannedDistanceKm: 35,
      revenue: 5200,
      status: "Draft",
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
