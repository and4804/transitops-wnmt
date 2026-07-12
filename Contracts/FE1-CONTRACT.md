# FE-1 Contract Package — Auth, Vehicle Registry, Trip Creation, Maintenance, Dashboard

You don't own an API contract — you *consume* two of them. This package
is your equivalent of BE-1/BE-2's contract doc: exactly which endpoints
you're building against, the stub commands, and copy-pasteable test code
for the two tricky bits (a workflow that needs a dynamically-generated ID,
and simulating a slow/failing backend).

---

## 1. What you consume

| Screen | Endpoints | From contract |
|---|---|---|
| Login / Signup | `POST /auth/signup`, `POST /auth/login` | `be2-people-finance-contract.yaml` |
| Vehicle Registry | `POST /vehicles`, `GET /vehicles`, `PUT /vehicles/{id}` | `be1-fleet-trips-contract.yaml` |
| Trip Creation form | `GET /vehicles?status=Available`, `GET /drivers?status=Available`, `POST /trips`, `POST /trips/{id}/dispatch`, `POST /trips/{id}/cancel` | both |
| Maintenance | `POST /maintenance`, `POST /maintenance/{id}/close`, `GET /maintenance` | `be1-fleet-trips-contract.yaml` |
| Dashboard | `GET /dashboard/kpis` | `be1-fleet-trips-contract.yaml` |

You need `GET /drivers` (a BE-2 endpoint) for the Trip Creation form's
driver dropdown even though Trip Management is otherwise a BE-1/FE-1
module — that's why your stub config loads both contract files.

---

## 2. Start your stub

```bash
cd contracts/fe1
specmatic stub --config specmatic.json --port 9000
```

Point your app's API base URL at `http://localhost:9000`. Every endpoint
in the table above responds from this one process, using the named
examples in both YAML files as canned responses. No BE-1 or BE-2 code
needs to be running.

Quick sanity check once it's up:
```bash
curl http://localhost:9000/vehicles
curl -X POST http://localhost:9000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"raven.k@transitops.io","password":"correct-horse-battery"}'
```

---

## 3. Workflow test with a dynamically-generated ID

The named examples give you fixed, predictable responses — great for most
screens. But the Trip Dispatcher live board needs to create a trip, then
immediately fetch *that same trip* back with a different status (to test
the dispatch button flipping it from Draft to Dispatched). A static
example can't do that; you set a dynamic expectation on the running stub
instead. This is the arrange → act → assert pattern from the CDD demos:

```javascript
// trip-dispatch.test.js
const STUB_URL = "http://localhost:9000";

test("dispatch button flips a freshly created trip to Dispatched", async () => {
  // ARRANGE — create the trip through the real create endpoint first,
  // so we get back whatever id the stub's 201_success_van05_alex example uses
  const createRes = await fetch(`${STUB_URL}/trips`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "Gandhinagar Depot",
      destination: "Ahmedabad Hub",
      vehicleId: 1,
      driverId: 1,
      cargoWeightKg: 450,
      plannedDistanceKm: 35,
    }),
  });
  const trip = await createRes.json();

  // Now set a dynamic expectation: when the dispatch endpoint is hit for
  // THIS trip's id, respond as Dispatched. Specmatic validates this
  // expectation against the contract before accepting it.
  const expectationRes = await fetch(`${STUB_URL}/_specmatic/expectations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      http-request: {
        method: "POST",
        path: `/trips/${trip.id}/dispatch`,
      },
      http-response: {
        status: 200,
        body: { ...trip, status: "Dispatched", dispatchedAt: "2026-07-12T10:00:00Z" },
      },
    }),
  });

  // CRITICAL: assert Specmatic accepted the expectation BEFORE calling
  // the app under test. A 400 here means the expectation you just wrote
  // violates the contract — e.g. you typo'd a field name or sent the
  // wrong type — and that's a bug in YOUR test, caught before it ever
  // reaches the real dispatch button code.
  expect(expectationRes.status).toBe(200);

  // ACT — this is the actual component/UI code under test
  const dispatchRes = await fetch(`${STUB_URL}/trips/${trip.id}/dispatch`, {
    method: "POST",
  });
  const dispatched = await dispatchRes.json();

  // ASSERT
  expect(dispatched.status).toBe("Dispatched");
});
```

If `expectationRes.status` is 400, read the body — Specmatic's breadcrumbs
tell you exactly which field violated the contract (e.g.
`http-response.body.status: contract expected one of [Draft, Dispatched,
Completed, Cancelled] but found "InTransit"`), so you never waste time
debugging a mismatch that's actually in your test setup.

---

## 4. Simulating a slow/failing backend (Dashboard)

Your Dashboard needs a loading state and an error state for
`GET /dashboard/kpis`, but the happy-path example always responds
instantly. Add a second stub file with a delay so you can test both:

```json
// contracts/fe1/stubs/dashboard-timeout.json
{
  "http-request": {
    "method": "GET",
    "path": "/dashboard/kpis",
    "query": { "status": "TIMEOUT_TEST" }
  },
  "http-response": {
    "status": 503,
    "body": {
      "timestamp": "(datetime)",
      "status": 503,
      "error": "Service Unavailable",
      "message": "Dashboard aggregation timed out",
      "path": "/dashboard/kpis"
    },
    "headers": { "Content-Type": "application/json" }
  },
  "delay-in-seconds": 5
}
```

Drop this file next to `specmatic.json` under a `stubs/` folder and
Specmatic auto-loads it alongside the contract-driven examples. Hit
`GET /dashboard/kpis?status=TIMEOUT_TEST` in your loading/error-state
tests; every other query still gets the normal instant response.

---

## 5. CI pipeline

See `ci-fe1.yml` — copy to `.github/workflows/fe1-component-tests.yml`.
Steps: unit tests → pull the two contracts → start the stub → run your
component tests against `http://localhost:9000` → assert no contract
mismatches showed up in the stub's logs.
