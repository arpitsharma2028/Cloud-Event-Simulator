# Test Suites & Quality Verification

The test directory contains automated test suites that mathematically and logically verify the **Cloud Event Simulator**. Testing spans both native C++ discrete-event simulation mechanics and the Node.js orchestration layer.

---

## Navigation
- [System Architecture Specification](../docs/ARCHITECTURE.md)
- [Mathematical Simulation Model](../docs/SIMULATION_MODEL.md)
- [Viva & Technical Interview Guide](../docs/VIVA_AND_INTERVIEW.md)

---

## 1. Directory Structure

```
tests/
  ├── test_engine.cpp          # 17 Native C++ unit tests covering all engine modules
  └── test_engine.exe          # Compiled native test runner binary
backend/tests/
  └── api.test.js              # 7 Node.js integration tests for REST API and experiments
```

---

## 2. Testing Philosophy

In distributed systems and cloud simulation, testing must not be limited to frontend UI clicks. The core mathematical engine must be rigorously defensible.

Our test suites protect against:
1. **Causality Violations**: Processing arrivals before task completions at the same timestamp.
2. **Resource Leaks**: Failing to restore vCPU cores or RAM after task completion.
3. **Ghost Allocations**: Allocating resources to failed or nonexistent nodes.
4. **Flapping Thrashing**: Allowing autoscaling to oscillate without cooldown enforcement.
5. **Nondeterminism**: Producing differing output across repeated runs with identical seeds.
6. **Division by Zero**: Crashing when workload contains zero requests or duration is short.

---

## 3. C++ Simulation Engine Test Suite (`tests/test_engine.cpp`)

The C++ unit test runner executes 17 comprehensive unit tests directly against engine header classes:

| # | Test Function | Target Component | What It Tests & Protects Against |
| :--- | :--- | :--- | :--- |
| **1** | `testEventQueueOrdering` | `EventQueue` | Verifies priority queue pops earliest timestamps first and prioritizes High priority ($P_1$) over Low ($P_3$). |
| **2** | `testSimultaneousEvents` | `EventComparator` | Verifies tie-breaking causality rank: `NODE_FAILURE` and `TASK_COMPLETE` pop before `REQUEST_ARRIVAL` at identical timestamps. |
| **3** | `testEmptyEventQueue` | `EventQueue` | Verifies safe behavior on empty queue: `empty() == true`, `size() == 0`, and `nextEventTime() == -1.0` without segfaults. |
| **4** | `testNodeAllocationAndRelease` | `Node` | Verifies vCPU and RAM allocation, utilization calculations, and exact resource restoration on deallocation. |
| **5** | `testNodeOverloadAndQueueSaturation`| `Node` | Verifies bounded queue buffer: tasks queue up to `node_queue_limit`; subsequent tasks trigger backpressure rejection (`TaskStatus::REJECTED`). |
| **6** | `testRoundRobinScheduler` | `RoundRobinScheduler` | Verifies uniform cycling across operational nodes: requests route sequentially ($0 \to 1 \to 0 \to 1$). |
| **7** | `testLeastLoadedScheduler` | `LeastLoadedScheduler`| Verifies routing to the node with the lowest composite utilization ($0.60 \cdot U_{\text{cpu}} + 0.40 \cdot U_{\text{mem}}$). |
| **8** | `testPriorityScheduler` | `PriorityScheduler` | Verifies that P1 Mission-Critical tasks receive immediate allocation slots while P3 Batch tasks are deferred during high load. |
| **9** | `testFirstFitScheduler` | `FirstFitScheduler` | Verifies sequential capacity scanning: allocates to the very first node with sufficient unreserved vCPU and RAM. |
| **10** | `testNoAvailableNodes` | Schedulers | Verifies graceful rejection and explainable decision logs when all cluster nodes are offline or failed. |
| **11** | `testLoadBalancers` | `LoadBalancer` | Verifies least connections routing and weighted distribution proportional to node compute weights. |
| **12** | `testAutoScalingThresholdsAndCooldown`| `AutoScaler` | Verifies scale-up trigger on crossing threshold and cooldown timer blocking subsequent scaling during the deadband window. |
| **13** | `testAutoScalingBoundaries` | `AutoScaler` | Verifies that cluster sizing strictly respects `min_nodes` and `max_nodes` limits regardless of load. |
| **14** | `testFailureAndRecovery` | `FailureManager` | Verifies that node outage transitions node to `FAILED`, evicts active tasks as `FAILED`, and recovery restores healthy capacity. |
| **15** | `testMetricsCalculation` | `MetricsCollector` | Mathematically verifies $R = W_q + D$ (Response Time = Queue Wait + Duration), throughput, SLA compliance %, and cost integration. |
| **16** | `testDeterministicSimulation` | `SimulationEngine` | Verifies that two independent engines running with seed 98765 produce 100% byte-for-byte identical output JSON. |
| **17** | `testZeroWorkloadEdgeCase` | `SimulationEngine` | Verifies that running with virtually zero request rate completes safely without division by zero errors. |

---

## 4. Backend API Integration Test Suite (`backend/tests/api.test.js`)

Verifies the Express server, Zod schema validation, IPC child process execution, and benchmark comparison endpoints:

| # | Test Scenario | Target Route | What It Verifies |
| :--- | :--- | :--- | :--- |
| **1** | Health Check | `GET /health` | Verifies server is online, returning HTTP 200 with `{ status: "HEALTHY" }`. |
| **2** | Presets Catalog | `GET /api/presets` | Verifies catalog returns at least 5 valid pre-configured scenarios. |
| **3** | Schema Bounds Validation | `POST /api/simulations` | Submits negative duration and invalid node counts; asserts rejection with HTTP 400. |
| **4** | C++ Engine Orchestration | `POST /api/simulations` | Spawns native binary, monitors execution, and verifies returned summary metrics. |
| **5** | Secondary Policy Execution | `POST /api/simulations` | Executes a second run with Least Loaded scheduler and verifies completion. |
| **6** | Saved Runs Comparison | `POST /api/compare` | Compares two simulation runs; verifies matrix generation and viva defense insights. |
| **7** | Policy Experiment Benchmark | `POST /api/compare/experiment`| Runs automated benchmark across 3 policies with identical seed; verifies rankings and metric table. |

---

## 5. How to Run the Tests

### Running the C++ Test Suite
```bash
# Compile and run with MinGW / GCC
g++ -std=c++14 -O3 tests/test_engine.cpp -o tests/test_engine.exe
./tests/test_engine.exe
```

Expected Output:
```text
==========================================================
 CLOUD EVENT SIMULATOR - EXPANDED C++ UNIT TEST SUITE (17)
==========================================================
[TEST 1] EventQueue Ordering Test... -> PASSED
...
[TEST 17] Zero Workload Edge Case Test... -> PASSED
==========================================================
 ALL 17/17 C++ SIMULATION ENGINE TESTS PASSED!
==========================================================
```

### Running the Backend Integration Test Suite
```bash
cd backend
npm test
```

Expected Output:
```text
=========================================
 BACKEND API INTEGRATION TEST SUITE
=========================================
[TEST 1] Testing /health endpoint... -> PASSED
...
[TEST 7] Testing /api/compare/experiment endpoint... -> PASSED
=========================================
 ALL BACKEND API TESTS PASSED (7/7)!
=========================================
```

---

## 6. What Failures Mean & How to Debug

- **If Test 2 (Simultaneous Events) fails**:
  - *Cause*: Event type causality rank in `EventQueue.h` was altered.
  - *Fix*: Ensure `NODE_FAILURE` (0) and `TASK_COMPLETE` (2) have lower rank integers than `REQUEST_ARRIVAL` (6).
- **If Test 12 (Autoscaling Cooldown) fails**:
  - *Cause*: `AutoScaler::evaluate()` is not checking `(current_time - last_scaling_time_ < cooldown_period)`.
- **If Test 15 (Metrics Calculation) fails**:
  - *Cause*: Response time formula diverged from $R = W_q + D$. Check `MetricsCollector::recordCompletion()`.
- **If Test 16 (Determinism) fails**:
  - *Cause*: Unseeded random generator call or uninitialized variable in C++ state. Ensure all randomness uses `rng_`.
