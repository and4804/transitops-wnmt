# transitops-wnmt

# TransitOps

Smart Transport Operations Platform — vehicle registry, trip dispatch,
maintenance, driver management, fuel/expense tracking, dashboard and
reports, built against the contract in `Contracts/`.

- **Live deployment**: <https://transitops.nrg.it.com/>
- **Demo video**: [Google Drive folder](https://drive.google.com/drive/folders/12m6cdYCjx3Vrg4IAUmKRSkHzOwY59WRQ)

## Stack

- **Backend** (`backend/`): Node.js + Express + TypeScript + Prisma, single
  service on port `8080`, one Postgres database.
- **Frontend** (`frontend/`): React + TypeScript + Vite, single app on port
  `5173`, talks directly to the backend.
- **ML service** (`ml-service/`): Python + FastAPI + scikit-learn, port
  `8000`. Reads the same Postgres database read-only and serves 5 ML-powered
  insights (predictive maintenance risk, driver safety scoring, fuel anomaly
  detection, cost/ROI forecasting, fleet utilization forecasting) that the
  backend proxies at `/ml/*` and the frontend renders as charts on the
  Vehicles, Drivers, Fuel & Expense, Reports, and Dashboard pages.
- **Database**: Postgres via Docker (`docker-compose.yml` at repo root).

## Run it

```
# 1. Start Postgres (+ ml-service, if using Docker for it)
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

# 4. ML service (separate terminal, if not run via docker compose)
cd ml-service
pip install -r requirements.txt
cp .env.example .env      # point DATABASE_URL at localhost if running outside Docker
uvicorn app.main:app --reload --port 8000

# 5. Generate synthetic historical data once, so the ML features have signal
#    (the demo seed's 3 vehicles/2 drivers/1 trip are too thin for any of them)
python ml-service/scripts/generate_synthetic_data.py
```

Open <http://localhost:5173>. The backend needs `ML_SERVICE_URL` (defaults to `http://localhost:8000`) — see `backend/.env.example`. If `ml-service` is
down, `/ml/*` routes return `503` and the frontend pages fall back to a
small inline notice instead of breaking.

## Demo login

| Email                    | Password              | Role             |
| ------------------------ | ---------------------- | ---------------- |
| raven.k@transitops.io    | correct-horse-battery  | FleetManager     |
| dispatch@transitops.io   | correct-horse-battery  | Dispatcher       |
| safety@transitops.io     | correct-horse-battery  | SafetyOfficer    |
| finance@transitops.io    | correct-horse-battery  | FinancialAnalyst |

## RBAC summary

- **FleetManager**: full access — vehicles, maintenance, reports, and can
  also manage drivers/trips.
- **Dispatcher**: create/dispatch/complete/cancel trips, log fuel entries.
- **SafetyOfficer**: manage drivers (including suspending/reinstating).
- **FinancialAnalyst**: log fuel/expenses, view reports.

All authenticated roles can read core fleet data (vehicles, drivers, trips,
maintenance, fuel/expenses). Reports and ML insights are further restricted
per the "Persona / page" column in the ML features table below, and
`reports.ts` limits all report routes to FleetManager and FinancialAnalyst.
Write actions are gated per the table above, enforced server-side (never
trust the UI to hide a button).

## Business rules implemented

- Duplicate `regNumber` / `licenseNumber` → 409.
- Null mandatory fields → 422, never 500.
- Trip creation blocked (409/422) if vehicle/driver not `Available`, cargo
  exceeds capacity, or driver license expired/suspended.
- Trip dispatch/complete/cancel only legal from the correct lifecycle
  stage (409 otherwise); dispatch/complete atomically flips vehicle +
  driver status.
- Maintenance open flips vehicle to `InShop`; close restores `Available` unless the vehicle was separately `Retired`.
- Login lockout after 5 consecutive failed attempts → 423, checked before
  the password.
- Every error response follows the shared `StandardError` shape
  (`timestamp`, `status`, `error`, `message`, `path`).

## ML features

Each of the 5 endpoints in `ml-service/` derives its features purely from the
existing Vehicle/Driver/Trip/Maintenance/FuelLog/Expense tables — no new
tables were added. Models retrain automatically whenever the underlying data
changes (fingerprinted via row counts), and eagerly warm up on service
startup. See `ml-service/app/ml/*.py` for the concrete algorithm per feature,
and `ml-service/scripts/generate_synthetic_data.py` for how the historical
dataset (and its injected anomalies/archetypes/overdue vehicles) is built.

| Feature                     | Algorithm                            | Endpoint                       | Persona / page                     |
| ---------------------------- | ------------------------------------ | ------------------------------- | ------------------------------------ |
| Predictive Maintenance Risk | Logistic Regression                  | `GET /ml/maintenance-risk`     | Fleet Manager — Vehicles           |
| Driver Safety Score         | Ridge Regression (weak-labeled)      | `GET /ml/driver-safety-scores` | Safety Officer — Drivers           |
| Fuel Anomaly Detection      | IsolationForest (+ z-score fallback) | `GET /ml/fuel-anomalies`       | Financial Analyst — Fuel & Expense |
| Cost/ROI Trend Forecast     | Linear Regression                    | `GET /ml/cost-roi-forecast`    | Financial Analyst — Reports        |
| Fleet Utilization Forecast  | Linear Regression                    | `GET /ml/utilization-forecast` | Fleet Manager — Dashboard          |

`POST http://localhost:8000/admin/retrain` force-retrains all 5 models
(useful right after re-running the generator).
