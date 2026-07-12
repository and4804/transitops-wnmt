# TransitOps — Contract Guide (FE-1 / FE-2 / BE-1 / BE-2)

Two contracts, split along the same ownership lines as the build plan, so
each backend owner has exactly one file to implement against and each
frontend owner has exactly the two files they need to stub.

| Contract file | Owner (implements) | Modules covered |
|---|---|---|
| `be1-fleet-trips-contract.yaml` | **BE-1** | Vehicle Registry (2), Trip Management (4), Maintenance (5), Dashboard (7) |
| `be2-people-finance-contract.yaml` | **BE-2** | Auth & RBAC (1), Driver Management (3), Fuel & Expense (6), Reports (8) |

| Consumer | Stubs (specmatic.json `stub`) | Why |
|---|---|---|
| **FE-1** | both files | Auth screens (BE-2) + Vehicle Registry / Trip creation / Maintenance / Dashboard (BE-1) |
| **FE-2** | both files | Driver / Fuel & Expense / Reports screens (BE-2) + Trip list/status view (BE-1) |

Both contracts share one `StandardError` schema shape (`timestamp`, `status`,
`error`, `message`, `path`) so error handling looks identical everywhere in
the app regardless of which backend answered.

---

## Assumptions made while writing the contracts (confirm these first)

These are called out inline in the YAML too (search for the word "NOTE" /
long description blocks), collected here so the team can resolve them in
one pass before build starts:

1. **Role name mismatch.** The build plan's data model lists roles as
   `FleetManager | Driver | SafetyOfficer | FinancialAnalyst`, but every
   mockup (login screen, Settings → RBAC table) shows **Dispatcher**, not
   Driver. The contract follows the mockups (`Role` enum in
   `be2-people-finance-contract.yaml`). If `Driver` was actually intended,
   update that one enum and the RBAC matrix in the Settings screen.
2. **Account lockout (423).** The login mockup shows an explicit "Account
   locked after 5 failed attempts" error state. This isn't in the written
   spec's error policy, so it's been added to `/auth/login` as a `423
   Locked` response. Confirm BE-2 actually wants to build lockout tracking
   in an 8-hour hackathon, or drop this response and the mockup's error
   copy together.
3. **`region` field on Vehicle.** Not in the original data model, but the
   Dashboard/Vehicle Registry mockups have a Region filter. Added as an
   optional, nullable string on `Vehicle`. Drop it (and the `region` query
   params) if region tracking is out of scope for the 8 hours.
4. **`revenue` field on Trip, for ROI.** The data model has no revenue
   field anywhere, but `GET /reports/roi` needs one. Added as an optional,
   nullable `revenue` field on `Trip` in the BE-1 contract, consumed by
   BE-2's ROI report. If it's never populated, ROI legitimately returns
   0%/null — that's expected per the module doc's own guidance to mark ROI
   as a mocked/stretch metric in the demo, not a bug to chase.
5. **Cross-contract read in `GET /vehicles/{id}/cost-summary`.** This lives
   in BE-2's contract but sums BE-1-owned Maintenance costs. BE-1 and BE-2
   run as separate services, each with its own dockerized Postgres
   instance (see `docker-compose.yml`), so this needs an internal call
   from BE-2 to BE-1's Maintenance data rather than a shared DB read —
   flagged so it isn't discovered at Hour 6 integration.
6. **Database engine.** Both services use Postgres, run via Docker for
   local dev (`docker-compose.yml` in this folder — `postgres-be1` on
   `:5433`, `postgres-be2` on `:5434`). See each role's `CONTRACT.md`
   "Database" section for connection strings.

---

## Named example convention

Every example in both YAML files follows `[HTTP_STATUS]_[scenario_name]`,
e.g. `201_success_van05_alex`, `422_cargo_exceeds_capacity`. The same name
is reused between the request example and the response example it
produces — that name match is what lets Specmatic stitch "this request" to
"this exact response" into one test case. When you add new examples,
keep that pairing or the generated test will fall back to a random
response.

---

## Error contract (applies to both files)

| HTTP Status | Meaning | Who's at fault | Provider must return |
|---|---|---|---|
| 400 | Malformed request (bad JSON, wrong param type) | Consumer | `StandardError` |
| 401 | Missing/invalid JWT | Consumer | `StandardError` |
| 403 | Valid JWT, wrong role for this action | Consumer | `StandardError` |
| 404 | Resource ID does not exist | Consumer | `StandardError` |
| 409 | Valid request, but conflicts with current state (duplicate reg number, vehicle not Available, trip not in the right lifecycle stage) | Consumer (timing) | `StandardError` |
| 422 | Mandatory field null/missing, business rule violated (cargo > capacity, suspended driver, expired driver) | Consumer | `StandardError` |
| 423 | Account locked (Auth only) | Consumer | `StandardError` |
| 500 | Unhandled provider exception | **Provider** | `StandardError`, never a stack trace |
| 503 | Downstream dependency unavailable/timed out | **Provider** | `StandardError` |

**Hard rules, non-negotiable:**
- A null mandatory field must return 422, never 500 (this is exactly the
  bug the CDD transcripts show being caught for free — don't reintroduce
  it here).
- A missing resource returns 404, never a 200 with a null/empty body.
- HTTP 200 is never returned when the operation didn't actually happen
  (e.g. dispatching a trip that's already Dispatched must be 409, not a
  silent 200).

---

## Backward compatibility, in one sentence

Before merging any change to either YAML file, run Specmatic's
contract-vs-contract check — it starts the *new* version as a stub and
runs the *old* version's tests against it; if all old tests pass, the
change is backward compatible, no code required to find out:

```bash
specmatic compare fleet-trips/be1-fleet-trips-contract.yaml@main fleet-trips/be1-fleet-trips-contract.yaml@HEAD
```

Quick reference, since you'll hit these during the hackathon:
- Adding a new **optional** field (request or response) → compatible.
- Adding a new **mandatory** field to a request → **breaking** (old
  consumers won't send it).
- Removing any field, or narrowing an enum → **breaking**.
- Widening an enum, or adding a new endpoint → compatible.

---

## Quick start — run this per role

### BE-1 (Vehicle Registry, Trips, Maintenance, Dashboard)
```bash
cd contracts/be1
# 1. Prove the contract fails against nothing yet (expected first run)
specmatic test --config specmatic.json

# 2. Start your app on the port the contract expects (8081), then re-run:
specmatic test --config specmatic.json
# Fix signature errors before writing business logic — that's the point.
```

### BE-2 (Auth, Drivers, Fuel & Expense, Reports)
```bash
cd contracts/be2
specmatic test --config specmatic.json
# App must be listening on 8082 (see servers: block in be2-people-finance-contract.yaml)
```

### FE-1 (Auth UI, Vehicle Registry, Trip creation, Maintenance, Dashboard)
```bash
cd contracts/fe1
specmatic stub --config specmatic.json --port 9000
# Point your app's API base URL at http://localhost:9000 instead of the real backends.
# Both contracts are loaded on this one stub, so /auth/*, /vehicles*, /trips*,
# /maintenance*, /dashboard/* all respond from the same server.
```

### FE-2 (Driver Management, Trip list/status, Fuel & Expense, Reports)
```bash
cd contracts/fe2
specmatic stub --config specmatic.json --port 9000
# Same idea — /drivers*, /fuel-logs, /expenses, /reports/*, /trips (GET) all respond here.
```

### Everyone, before raising a PR
```bash
# Lint (adjust to whatever ruleset the team agrees on)
npx @stoplight/spectral-cli lint contracts/*/*.yaml

# Backward-compat check against main before pushing a contract change
specmatic compare <path-to-old-spec> <path-to-new-spec>
```

---

## Files in this package

```
contracts/
├── be1-fleet-trips-contract.yaml       # BE-1's contract (source of truth)
├── be2-people-finance-contract.yaml    # BE-2's contract (source of truth)
├── CONTRACT_GUIDE.md                   # this file — shared reference
├── docker-compose.yml                  # dockerized Postgres for BE-1/BE-2 (:5433/:5434)
├── be1/
│   ├── specmatic.json                  # provider config (test mode)
│   ├── CONTRACT.md                     # must-pass checklist, generative test estimate
│   └── ci-be1.yml                      # copy to .github/workflows/
├── be2/
│   ├── specmatic.json
│   ├── CONTRACT.md
│   └── ci-be2.yml
├── fe1/
│   ├── specmatic.json                  # consumer config (stub mode, both files)
│   ├── CONTRACT.md                     # endpoint map, dynamic-expectation test, fault injection
│   └── ci-fe1.yml
└── fe2/
    ├── specmatic.json
    ├── CONTRACT.md
    └── ci-fe2.yml
```

Read `CONTRACT_GUIDE.md` (this file) first for the shared conventions,
then go to your own `CONTRACT.md` for the role-specific detail —
checklists and CI for BE-1/BE-2, endpoint maps and stub test code for
FE-1/FE-2.

The `repository`/`branch` values in each `specmatic.json` are placeholders
pointing at a `central-contract-repo` — swap in your actual git remote (or
point `sources` at a local path) before the hackathon starts; everything
else works as-is once that's wired up.
