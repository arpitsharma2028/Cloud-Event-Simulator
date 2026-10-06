# C++ Engine & Backend Test Suites

The Cloud Event Simulator includes comprehensive test suites across both the native C++ simulation engine and the Node.js orchestration backend to ensure mathematical correctness, stability, and reproducibility.

---

## 1. Directory Structure

```
tests/
  ├── test_engine.cpp          # 17 C++ unit tests covering all engine components
  └── test_engine.exe          # Compiled native test runner binary
backend/tests/
  └── api.test.js              # 7 Node.js integration tests for REST API, schemas, and experiments
```

---

## 2. C++ Engine Test Suite (`tests/test_engine.cpp`)

The C++ test suite verifies core discrete-event mechanics, scheduling algorithms, elasticity rules, failure handling, and mathematical metrics calculations.

| # | Test Name | Tested Component | Assertion / Verification |
| :--- | :--- | :--- | :--- |
| **1** | `testEventQueueOrdering` | `EventQueue` | Verifies events are popped in chronological order and higher priority tiers (P1 vs P3) take precedence. |
| **2** | `testSimultaneousEvents` | `EventComparator` | Verifies causality tie-breaking at identical timestamps: failures and completions process before arrivals. |
| **3** | `testEmptyEventQueue` | `EventQueue` | Verifies safe handling of empty queues without segfaults (`empty() == true`, `nextEventTime() == -1.0`). |
| **4** | `testNodeAllocationAndRelease` | `Node` | Verifies vCPU and RAM allocation, utilization calculation, and complete resource restoration on deallocation. |
| **5** | `testNodeOverloadAndQueueSaturation` | `Node` | Verifies that when active capacity is full, tasks queue up to `node_queue_limit`; subsequent tasks are rejected. |
| **6** | `testRoundRobinScheduler` | `RoundRobinScheduler` | Verifies uniform cycling across all operational cluster nodes. |
| **7** | `testLeastLoadedScheduler` | `LeastLoadedScheduler` | Verifies routing to the node with the lowest composite utilization $(0.6 \cdot \text{CPU} + 0.4 \cdot \text{RAM})$. |
| **8** | `testPriorityScheduler` | `PriorityScheduler` | Verifies immediate allocation to P1 Mission-Critical tasks over P3 Batch workloads. |
| **9** | `testFirstFitScheduler` | `FirstFitScheduler` | Verifies sequential node scanning and allocation to the first node with sufficient spare capacity. |
| **10** | `testNoAvailableNodes` | Schedulers | Verifies graceful rejection and explainable decision logs when all nodes are offline or failed. |
| **11** | `testLoadBalancers` | `LoadBalancer` | Verifies least connections routing and weighted distribution proportional to node capacity. |
| **12** | `testAutoScalingThresholdsAndCooldown` | `AutoScaler` | Verifies scale-up trigger on crossing threshold and cooldown timer blocking rapid oscillation. |
| **13** | `testAutoScalingBoundaries` | `AutoScaler` | Verifies that cluster sizing strictly respects `min_nodes` and `max_nodes` limits. |
| **14** | `testFailureAndRecovery` | `FailureManager` | Verifies that node crash evicts active tasks with status `FAILED` and recovery restores healthy capacity. |
| **15** | `testMetricsCalculation` | `MetricsCollector` | Verifies mathematical consistency of queue wait ($W_q$), response time ($R = W_q + D$), throughput, SLA rate, and cost. |
| **16** | `testDeterministicSimulation` | `SimulationEngine` | Verifies 100% byte-for-byte identical JSON export across independent runs with identical seeds. |
| **17** | `testZeroWorkloadEdgeCase` | `SimulationEngine` | Verifies simulator handles empty/near-zero workloads gracefully without division by zero. |

### Compile & Run C++ Tests
```bash
# Using g++
g++ -std=c++14 -O3 tests/test_engine.cpp -o tests/test_engine.exe
./tests/test_engine.exe
```

---

## 3. Backend API Test Suite (`backend/tests/api.test.js`)

Verifies the Express server endpoints, Zod schema validation, C++ binary orchestration, and the comparison experiment runner.

| # | Test Scenario | Endpoint Tested | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **1** | Health Check | `GET /health` | Returns HTTP 200 with `{ status: "HEALTHY" }`. |
| **2** | Presets Catalog | `GET /api/presets` | Returns HTTP 200 with at least 5 configured presets. |
| **3** | Schema Bounds Validation | `POST /api/simulations` | Rejects malformed or out-of-bounds input with HTTP 400. |
| **4** | C++ Engine Invocation | `POST /api/simulations` | Spawns engine, completes simulation, and returns summary KPIs. |
| **5** | Secondary Policy Execution | `POST /api/simulations` | Executes second run with Least Loaded scheduler. |
| **6** | Saved Runs Comparison | `POST /api/compare` | Compares two runs, generating comparative matrix and viva insights. |
| **7** | Policy Experiment Benchmark | `POST /api/compare/experiment` | Runs multi-policy showdown on identical seed, generating ranked metrics. |

### Run Backend Integration Tests
```bash
cd backend
npm test
```
