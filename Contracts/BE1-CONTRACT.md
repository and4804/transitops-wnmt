# BE-1 Contract Package — Fleet & Trip Operations

You implement `be1-fleet-trips-contract.yaml`. This is everything you need
to go from "here's a YAML file" to "my app passes contract tests in CI"
without reading anything else.

---

## 1. What you own

| Endpoint | Business rule you must enforce | Wrong HTTP code = contract violation |
|---|---|---|
| `POST /vehicles` | `regNumber` unique | Duplicate → **409**, not 500 |
| `POST /trips` | vehicle/driver must be `Available`; cargo ≤ capacity; driver not expired/suspended | Bad state → **409**; bad business data → **422** |
| `POST /trips/{id}/dispatch` | only legal from `Draft` | Wrong lifecycle stage → **409** |
| `POST /trips/{id}/complete` | only legal from `Dispatched`; `actualDistanceKm`/`fuelConsumedLiters` mandatory | Null odometer → **422**; wrong stage → **409** |
| `POST /trips/{id}/cancel` | only legal from `Dispatched` | Wrong stage → **409** |
| `POST /maintenance` | vehicle must not already be `InShop`/`Retired`; auto-flips vehicle to `InShop` | Already in shop → **409** |
| `POST /maintenance/{id}/close` | restores vehicle to `Available` **unless** `Retired` | Already closed → **409** |
| `GET /dashboard/kpis` | `fleetUtilizationPct = OnTrip / non-Retired * 100` | — |

The full request/response shape for every one of these, including the
exact `StandardError` body expected, is in the YAML's `examples` blocks —
that's the actual test oracle, this table is just the summary.

---

## 2. Must-pass checklist before contract tests will go green

Work through this in order — it mirrors the sequence in the Trip
Management module doc (register → dispatch → complete → maintenance):

- [ ] `POST /vehicles` rejects a duplicate `regNumber` with 409, not a DB
      constraint exception bubbling up as 500
- [ ] `POST /vehicles` rejects a null `type` with 422
- [ ] `POST /trips` filters vehicle/driver dropdowns server-side — don't
      rely on the frontend to hide unavailable ones; the API itself must
      409 if a not-`Available` vehicle/driver is submitted
- [ ] `POST /trips` returns 422 (not 500) when `cargoWeightKg >
      vehicle.maxLoadCapacityKg`
- [ ] `POST /trips` returns 422 when the driver's `licenseExpiry < today`
      or `status == Suspended`
- [ ] `POST /trips/{id}/dispatch` flips **both** `vehicle.status` and
      `driver.status` to `OnTrip` atomically — a partial flip on error is
      a data-integrity bug the contract can't catch, watch it in code
      review instead
- [ ] `POST /trips/{id}/complete` writes a `FuelLog` row (BE-2's table)
      from `fuelConsumedLiters` — cross-contract side effect, not visible
      in this YAML's response shape, easy to forget
- [ ] `POST /maintenance` immediately excludes the vehicle from
      `POST /trips`'s implicit availability filter (cross-check against
      Module 4 rule 1)
- [ ] `POST /maintenance/{id}/close` does **not** un-retire a vehicle
- [ ] Every 4xx/5xx response body matches `StandardError` exactly — no
      endpoint-specific error shapes

---

## 3. Generative (resiliency) testing

`be1/specmatic.json` has `resiliencyTests.enable: "all"` turned on. On top
of the ~14 named examples in the YAML, Specmatic will auto-generate
mutations and expect these outcomes:

| Mutated | Expected response |
|---|---|
| Null every mandatory field, one at a time (`regNumber`, `name`, `type`, `cargoWeightKg`, `vehicleId`, `driverId`, `description`, `cost`...) | 422 |
| Wrong data type per typed field (string where number expected, etc.) | 400 |
| Invalid enum value (`status: "Flying"`, `type: "Spaceship"`) | 400 |
| Boundary values on numeric fields (`cargoWeightKg: 0`, `-1`) | 400 or 422 depending on your minimum constraint |
| Path param ID that doesn't exist, for every `{id}` route | 404 |

Expect roughly **8 endpoints × ~6 mutation categories ≈ 45–60 additional
tests** on top of the baseline ~14 named-example tests. Run locally first:

```bash
cd contracts/be1
specmatic test --config specmatic.json
```

The first run against a fresh implementation should fail loudly — that's
expected, it's the same red-then-green loop from the tracer-bullet demo.
Fix signature/validation issues before writing any deeper business logic.

---

## 4. CI pipeline

See `ci-be1.yml` in this folder — copy it to
`.github/workflows/be1-contract-tests.yml` in your repo. It:
1. Runs your unit tests
2. Starts your app
3. Runs `specmatic test` **before** any component/integration tests —
   if the signature is broken there's no point testing logic behind it
4. Fails the build and uploads the Specmatic HTML report as an artifact
   if any test fails

---

## 5. Local dev loop

```bash
# Terminal 1 — your app
npm run dev   # or your stack's start command, listening on :8081

# Terminal 2 — contract tests, re-run on every change
cd contracts/be1
specmatic test --config specmatic.json
```
