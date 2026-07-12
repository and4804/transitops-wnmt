# BE-2 Contract Package — People & Finance

You implement `be2-people-finance-contract.yaml`. This is everything you
need to go from "here's a YAML file" to "my app passes contract tests in
CI" without reading anything else.

---

## 1. What you own

| Endpoint | Business rule you must enforce | Wrong HTTP code = contract violation |
|---|---|---|
| `POST /auth/signup` | `email` unique; `role` must be one of the 4 enum values | Duplicate → **409**; bad role → **422** |
| `POST /auth/login` | wrong password → 401; **5 consecutive failures → 423**, checked before this attempt's password | 401 vs 423, see below |
| `POST /drivers` | `licenseNumber` unique; expired license is **flagged, not blocked** here | Duplicate → **409** |
| `PUT /drivers/{id}` | this is the only place `Suspended` gets set/cleared manually | — |
| `POST /fuel-logs` / `POST /expenses` | `vehicleId` must exist (owned by BE-1's table) | Missing vehicle → **404** |
| `GET /vehicles/{id}/cost-summary` | `totalCost` computed **server-side**, never trust frontend math | — |
| `GET /reports/roi` | stretch metric — see note in the YAML, `revenue` may legitimately be null | — |

**On 401 vs 423:** check the lockout counter first. If the account is
already locked, return 423 *regardless of whether this attempt's password
happens to be correct* — the mockup's copy ("Invalid credentials. Account
locked after 5 failed attempts.") implies the message is shown together,
but the status code must be 423 so the frontend can distinguish "try
again" from "wait/reset" states.

---

## 2. Must-pass checklist

- [ ] `POST /auth/signup` returns 409 on duplicate email, not a raw DB
      constraint error
- [ ] `POST /auth/signup` validates `role` against the 4-value enum and
      returns 422 for anything else (including case mismatches)
- [ ] `POST /auth/login` tracks failed attempts per account and returns
      423 on the 5th
- [ ] `POST /drivers` allows an expired `licenseExpiry` to be saved
      successfully (201) — do **not** reject it here, that's Module 4's
      job at trip assignment, not this endpoint's
- [ ] `PUT /drivers/{id}` is the only write path that can set
      `status: Suspended`
- [ ] `POST /fuel-logs` / `POST /expenses` return 404 (not 500) when
      `vehicleId` doesn't exist in BE-1's vehicle table — this is a
      cross-service/cross-table lookup, confirm the join path with BE-1
      before assuming a local FK constraint will catch it
- [ ] `GET /vehicles/{id}/cost-summary` sums `fuel_logs.cost +
      maintenance.cost` — the maintenance side reads BE-1-owned data,
      same cross-service note as above
- [ ] Every 4xx/5xx response body matches `StandardError` exactly

---

## 3. Generative (resiliency) testing

`be2/specmatic.json` has `resiliencyTests.enable: "all"` turned on.
Expect mutation categories across all 9 endpoints:

| Mutated | Expected response |
|---|---|
| Null every mandatory field (`name`, `email`, `password`, `role`, `licenseNumber`...) | 422 |
| Wrong type (`amount: "fifty"` instead of a number) | 400 |
| Invalid enum (`role`, `type` on Expense, `status` on Driver) | 400 |
| Malformed email format on signup/login | 400 |
| Non-existent `vehicleId`/`driverId` path or body reference | 404 |

Baseline named examples: ~13. Expect **roughly 40–55 additional
generative tests**. Run locally:

```bash
cd contracts/be2
specmatic test --config specmatic.json
```

---

## 4. CI pipeline

See `ci-be2.yml` — copy to `.github/workflows/be2-contract-tests.yml`.
Same shape as BE-1's: unit tests → start app → contract tests before
component tests → fail + upload report on any mismatch.

---

## 5. Database

Postgres, dockerized — no local Postgres install required. Connection
details:

```bash
# from contracts/ (one level up from this file)
docker compose up -d postgres-be2
```

| Setting | Value |
|---|---|
| Host | `localhost` |
| Port | `5434` |
| Database | `people_finance` |
| User / Password | `be2` / `be2` |
| Connection string | `postgresql://be2:be2@localhost:5434/people_finance` |

Point your app's DB config at this connection string. `docker-compose.yml`
persists data in the `be2_pgdata` volume, so `docker compose down` alone
won't wipe it — add `-v` if you need a clean slate.

---

## 6. Local dev loop

```bash
# Terminal 1 — Postgres
cd contracts
docker compose up -d postgres-be2

# Terminal 2 — your app
npm run dev   # your app, listening on :8082

# Terminal 3 — contract tests, re-run on every change
cd contracts/be2
specmatic test --config specmatic.json
```
