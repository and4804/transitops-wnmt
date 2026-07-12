# TransitOps

Smart Transport Operations Platform — vehicle registry, trip dispatch,
maintenance, driver management, fuel/expense tracking, dashboard and
reports, built against the contract in `Contracts/`.

## Stack

- **Backend** (`backend/`): Node.js + Express + TypeScript + Prisma, single
  service on port `8080`, one Postgres database.
- **Frontend** (`frontend/`): React + TypeScript + Vite, single app on port
  `5173`, talks directly to the backend.
- **Database**: Postgres via Docker (`docker-compose.yml` at repo root).

## Run it

```bash
# 1. Start Postgres
docker compose up -d

# 2. Backend
cd backend
npm install
npx prisma migrate dev   # first time only
npm run seed             # demo data: 4 users, 3 vehicles, 2 drivers, 1 trip
npm run dev              # listens on :8080

# 3. Frontend (separate terminal)
cd frontend
npm install
npm run dev               # listens on :5173
```

Open http://localhost:5173.

## Demo login

| Email | Password | Role |
|---|---|---|
| raven.k@transitops.io | correct-horse-battery | FleetManager |
| dispatch@transitops.io | correct-horse-battery | Dispatcher |
| safety@transitops.io | correct-horse-battery | SafetyOfficer |
| finance@transitops.io | correct-horse-battery | FinancialAnalyst |

## RBAC summary

- **FleetManager**: full access — vehicles, maintenance, reports, and can
  also manage drivers/trips.
- **Dispatcher**: create/dispatch/complete/cancel trips, log fuel entries.
- **SafetyOfficer**: manage drivers (including suspending/reinstating).
- **FinancialAnalyst**: log fuel/expenses, view reports.

All authenticated roles can read every list/detail endpoint; write actions
are gated per the table above, enforced server-side (never trust the UI to
hide a button).

## Business rules implemented

- Duplicate `regNumber` / `licenseNumber` → 409.
- Null mandatory fields → 422, never 500.
- Trip creation blocked (409/422) if vehicle/driver not `Available`, cargo
  exceeds capacity, or driver license expired/suspended.
- Trip dispatch/complete/cancel only legal from the correct lifecycle
  stage (409 otherwise); dispatch/complete atomically flips vehicle +
  driver status.
- Maintenance open flips vehicle to `InShop`; close restores `Available`
  unless the vehicle was separately `Retired`.
- Login lockout after 5 consecutive failed attempts → 423, checked before
  the password.
- Every error response follows the shared `StandardError` shape
  (`timestamp`, `status`, `error`, `message`, `path`).
