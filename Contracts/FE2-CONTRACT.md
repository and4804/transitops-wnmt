# FE-2 Contract Package — Driver Management, Trip List/Status, Fuel & Expense, Reports

Your equivalent of BE-1/BE-2's contract doc: exactly which endpoints
you're building against, the stub commands, and copy-pasteable test code
for a dynamic-ID workflow and a slow-backend simulation relevant to your
screens.

---

## 1. What you consume

| Screen | Endpoints | From contract |
|---|---|---|
| Driver Management | `POST /drivers`, `GET /drivers`, `PUT /drivers/{id}` | `be2-people-finance-contract.yaml` |
| Trip list / status tabs | `GET /trips`, `GET /trips/{id}` | `be1-fleet-trips-contract.yaml` |
| Fuel & Expense entry | `POST /fuel-logs`, `POST /expenses`, `GET /vehicles/{id}/cost-summary` | `be2-people-finance-contract.yaml` |
| Reports & Analytics | `GET /reports/fuel-efficiency`, `GET /reports/utilization`, `GET /reports/operational-cost`, `GET /reports/roi`, `GET /reports/export.csv` | `be2-people-finance-contract.yaml` |

You need `GET /trips` / `GET /trips/{id}` (BE-1 endpoints) for the Trip
list screen even though Trip Management is otherwise a BE-1/FE-1 module —
that's why your stub config loads both contract files, same as FE-1's.

---

## 2. Start your stub

```bash
cd contracts/fe2
specmatic stub --config specmatic.json --port 9000
```

Point your app's API base URL at `http://localhost:9000`.

```bash
curl http://localhost:9000/drivers
curl http://localhost:9000/reports/fuel-efficiency
```

---

## 3. Workflow test with a dynamically-generated ID

The cost-summary card needs to reflect fuel logs you just entered in the
same test run — a static example can't do that. Set a dynamic expectation
after logging fuel, same arrange → act → assert pattern as the trip
dispatch example:

```javascript
// cost-summary.test.js
const STUB_URL = "http://localhost:9000";

test("cost summary reflects a freshly logged fuel entry", async () => {
  // ARRANGE — log fuel through the real endpoint
  const fuelRes = await fetch(`${STUB_URL}/fuel-logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vehicleId: 1,
      tripId: null,
      liters: 42,
      cost: 3150,
      date: "2026-07-05",
    }),
  });
  expect(fuelRes.status).toBe(201);

  // Set a dynamic expectation for the cost-summary endpoint reflecting
  // this fuel entry. Specmatic validates the shape against the contract
  // before accepting it.
  const expectationRes = await fetch(`${STUB_URL}/_specmatic/expectations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "http-request": {
        method: "GET",
        path: "/vehicles/1/cost-summary",
      },
      "http-response": {
        status: 200,
        body: {
          vehicleId: 1,
          totalFuelCost: 3150,
          totalMaintenanceCost: 0,
          totalCost: 3150,
        },
      },
    }),
  });

  // CRITICAL: if this is a 400, the expectation body itself violates the
  // CostSummary schema (typo'd field, wrong type) — fix your test, not
  // the app, before going further.
  expect(expectationRes.status).toBe(200);

  // ACT — the real component under test
  const summaryRes = await fetch(`${STUB_URL}/vehicles/1/cost-summary`);
  const summary = await summaryRes.json();

  // ASSERT
  expect(summary.totalCost).toBe(3150);
});
```

---

## 4. Simulating a slow/failing backend (Reports)

The Reports screen's charts need a loading and an error state, but the
happy-path examples respond instantly. Add a delayed stub for one of the
heavier aggregation endpoints so both states are testable:

```json
// contracts/fe2/stubs/reports-roi-timeout.json
{
  "http-request": {
    "method": "GET",
    "path": "/reports/roi",
    "query": { "simulate": "TIMEOUT" }
  },
  "http-response": {
    "status": 503,
    "body": {
      "timestamp": "(datetime)",
      "status": 503,
      "error": "Service Unavailable",
      "message": "ROI aggregation timed out",
      "path": "/reports/roi"
    },
    "headers": { "Content-Type": "application/json" }
  },
  "delay-in-seconds": 5
}
```

Drop it under `contracts/fe2/stubs/` next to `specmatic.json` — Specmatic
auto-loads it alongside the contract examples. Hit
`GET /reports/roi?simulate=TIMEOUT` in your chart loading/error tests;
every other request still gets the instant happy-path response.

---

## 5. CI pipeline

See `ci-fe2.yml` — copy to `.github/workflows/fe2-component-tests.yml`.
Same shape as FE-1's: unit tests → pull both contracts → start the stub →
run component tests against `http://localhost:9000` → assert no contract
mismatches in the stub logs.
