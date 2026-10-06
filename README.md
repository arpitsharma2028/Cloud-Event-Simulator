# Cloud Event Simulator

A deterministic cloud infrastructure behavior and discrete-event simulation platform built for academic and software engineering evaluation.

The simulator models cloud infrastructure mechanics without provisioning physical cloud hardware, producing deterministic, mathematically explainable results suitable for technical interview defense, academic evaluation, and algorithm benchmarking.

---

## Table of Contents
1. [The Problem: Why This Project Exists](#1-the-problem-why-this-project-exists)
2. [System Architecture](#2-system-architecture)
3. [End-to-End Request & Simulation Lifecycle](#3-end-to-end-request--simulation-lifecycle)
4. [C++ Discrete-Event Simulation Engine](#4-c-discrete-event-simulation-engine)
5. [Scheduling & Load-Balancing Policies](#5-scheduling--load-balancing-policies)
6. [Autoscaling Elasticity & Chaos Failure Semantics](#6-autoscaling-elasticity--chaos-failure-semantics)
7. [Mathematical Metric Definitions & Consistency](#7-mathematical-metric-definitions--consistency)
8. [Policy Experimentation & Benchmarking Studio](#8-policy-experimentation--benchmarking-studio)
9. [Technical Interview Preparation & Defense Guide](#9-technical-interview-preparation--defense-guide)
10. [Local Quickstart & Execution Guide](#10-local-quickstart--execution-guide)
11. [Submodule Documentation](#11-submodule-documentation)

---

## 1. The Problem: Why This Project Exists

Evaluating distributed cloud architectures, scheduling algorithms, and elasticity policies in real cloud environments (AWS, GCP, Azure) presents major engineering challenges:
- **Prohibitive Cloud Infrastructure Bills**: Running experimental multi-node clusters under heavy traffic surges generates significant cloud costs.
- **Nondeterminism & Network Noise**: Variable virtualization noise, noisy neighbors, and public network jitter make it impossible to reproduce benchmark runs byte-for-byte.
- **Slow Feedback Loops**: Cloud instance spin-up takes 1 to 5 minutes per VM, preventing rapid iterative algorithm design.
- **The Toy Dashboard Anti-Pattern**: Many academic projects use simple frontend animations with hardcoded random numbers. These dashboards lack a real simulation core and crumble under technical scrutiny.

### The Solution
The Cloud Event Simulator decouples cloud behavior modeling from physical infrastructure:
- **True Discrete-Event Simulation (DES)**: Implemented in native C++14 using a virtual clock and min-priority event queues.
- **Physical Resource Accounting**: Explicitly tracks vCPU cores and RAM (GB) with strict capacity bounds and queue backpressure.
- **Explainable Decision Traces**: Every routing decision, queue delay, scaling action, and task failure is logged with its exact causal rationale.
- **100% Deterministic Reproducibility**: Uses a Mersenne Twister PRNG (`std::mt19937`). Identical configurations and seeds produce identical traces every time.

---

## 2. System Architecture

The platform follows a strict three-tier layered architecture:

```
+--------------------------------------------------------------------------+
|                     REACT FRONTEND DASHBOARD                             |
|  - Dashboard: System KPI cards & academic scenario quick launchers       |
|  - Workload Studio: Cluster sizing, policy selector, chaos parameters    |
|  - Simulation Console: Interactive time-scrubber, node pool, traces      |
|  - Results & Analytics: Latency percentiles, cost metering, SLA audit    |
|  - Comparison Studio: Multi-policy experiment runner & metric matrix     |
+------------------------------------+-------------------------------------+
                                     | REST API + Server-Sent Events (SSE)
+------------------------------------v-------------------------------------+
|                  NODE.JS / EXPRESS ORCHESTRATION API                     |
|  - Request validation (Zod schema bounds enforcement)                    |
|  - Process controller: Spawns C++ binary with 45s safety timeout         |
|  - Security middleware: Helmet, CORS, Rate Limiting (express-rate-limit) |
|  - Real-time Server-Sent Events (SSE) broadcaster                        |
|  - Multi-policy experiment orchestrator and viva insights generator      |
+------------------------------------+-------------------------------------+
                                     | Stdin/Stdout Pipes (JSON Protocol)
+------------------------------------v-------------------------------------+
|                   C++ DISCRETE EVENT SIMULATION ENGINE                   |
|  - Discrete Event Simulation (DES) core with virtual clock               |
|  - Priority Queue with multi-criteria causality comparator               |
|  - Pluggable Schedulers: Round Robin, Least Loaded, Priority, First Fit  |
|  - Pluggable Load Balancers: Round Robin, Least Connections, Weighted    |
|  - Virtual Resource Pool: Dynamic vCPU and RAM allocation/deallocation  |
|  - Elastic Auto-Scaler: Threshold-based scaling with cooldown hysteresis |
|  - Chaos & Failure Manager: Outage injection, task eviction, recovery    |
|  - Metrics & Cost Engine: Hourly vCPU/RAM rates, idle waste, SLA tracker |
|  - Deterministic Mersenne Twister PRNG (std::mt19937)                    |
+--------------------------------------------------------------------------+
```

---

## 3. End-to-End Request & Simulation Lifecycle

Every request follows a complete, traceable journey through the system:

```
[Browser Client]
       |
       | 1. Configures workload parameters, policy, seed, and chaos events
       v
[Express API: POST /api/simulations]
       |
       | 2. Zod validates parameter bounds (duration <= 600s, nodes <= 32)
       | 3. Writes configuration to isolated file: temp/sim_config_<id>.json
       v
[Process Controller (simulationService.js)]
       |
       | 4. Spawns C++ binary: cloud_sim_engine.exe --config <in> --output <out> --stream
       | 5. Starts 45s wall clock watchdog timer
       v
[C++ Simulation Engine (main.cpp)]
       |
       | 6. Parses JSON config via json_helper.h; initializes std::mt19937 PRNG with seed
       | 7. Populates initial nodes in ResourcePool; generates arrival events in EventQueue
       |
       +---> [Master Discrete-Event Simulation Loop]
       |        |
       |        |-- a. Pops next chronological event from priority_queue
       |        |-- b. Advances virtual clock current_time_ to event.timestamp
       |        |-- c. Event Dispatch:
       |        |      - REQUEST_ARRIVAL: LoadBalancer routes to node; Scheduler checks capacity
       |        |        * If resources available: Allocates vCPU/RAM, schedules TASK_COMPLETE
       |        |        * If capacity full but queue < limit: Enqueues task in node waiting buffer
       |        |        * If queue saturated: Rejects task with status REJECTED (backpressure)
       |        |      - TASK_COMPLETE: Releases vCPU/RAM; pops next queued task; schedules TASK_START
       |        |      - AUTOSCALE_EVAL: Checks composite utilization vs thresholds and cooldown
       |        |        * SCALE_UP: Adds new node(s) up to max_nodes
       |        |        * SCALE_DOWN: Drains and removes idle node(s) down to min_nodes
       |        |      - NODE_FAILURE: Marks node FAILED; evicts active tasks as FAILED
       |        |      - NODE_RECOVERY: Restores node to HEALTHY; re-enters scheduling pool
       |        |      - METRIC_SAMPLE: Records telemetry snapshot and cost rate
       |        |
       |        +-- d. Writes step progress to stdout as NDJSON
       v
[Express SSE Broadcaster: /api/simulations/:id/stream]
       |
       | 8. Reads stdout stream; broadcasts SSE events to connected browser
       v
[React Simulation Console]
       |
       | 9. Updates node utilization bars, event table, and decision trace in real time
       v
[C++ Engine Termination]
       |
       | 10. Computes final latency percentiles, throughput, SLA rate, and cost
       | 11. Writes structured output to temp/sim_output_<id>.json and exits with code 0
       v
[Express API Resolution]
       |
       | 12. Reads output JSON, cleans temp files, stores in registry, returns HTTP 201
       v
[React Results & Analytics / Comparison Studio]
       |
       | 13. Renders KPI cards, queue wait breakdown, telemetry graphs, and comparison matrix
```

---

## 4. C++ Discrete-Event Simulation Engine

The core simulation engine operates on a virtual timeline where time only advances when an event occurs:

### Event Causality & Precedence
When events share the exact same timestamp, the comparator in `EventQueue.h` enforces a strict causality rank:
1. `NODE_FAILURE` (Rank 0): Hardware outages execute first.
2. `NODE_RECOVERY` (Rank 1): Rebooted node capacity is restored.
3. `TASK_COMPLETE` (Rank 2): Completing tasks release resources before new arrivals are evaluated.
4. `AUTOSCALE_EVAL` (Rank 3): Scaling evaluations observe the latest resource state.
5. `WORKLOAD_SPIKE` (Rank 4): Traffic surges trigger.
6. `TASK_START` (Rank 5): Tasks waiting in node queues start.
7. `REQUEST_ARRIVAL` (Rank 6): Newly arrived work is admitted.
8. `METRIC_SAMPLE` (Rank 7): Telemetry snapshots are recorded.

---

## 5. Scheduling & Load-Balancing Policies

### Schedulers (`Scheduler.h`)
- **Round Robin (`ROUND_ROBIN`)**: Cycles sequentially across all healthy nodes. Best for homogeneous workloads; can lead to queue imbalances under heterogeneous task sizes.
- **Least Loaded (`LEAST_LOADED`)**: Evaluates composite utilization $0.60 \cdot U_{\text{cpu}} + 0.40 \cdot U_{\text{mem}}$ and dispatches to the node with the lowest load. Minimizes queuing hotspots.
- **Priority-Based (`PRIORITY_BASED`)**: Inspects task priority tiers:
  - P1 (Critical): High-priority service traffic. Granted immediate capacity slots.
  - P2 (Standard): General interactive user requests.
  - P3 (Batch): Background batch compute. Deferred or queued during heavy utilization.
- **First Fit (`FIRST_FIT`)**: Scans nodes sequentially and allocates to the first node with sufficient unreserved vCPU and RAM. Promotes bin-packing efficiency.

### Load Balancers (`LoadBalancer.h`)
- **Round Robin**: Alternating connection dispatch.
- **Least Connections**: Dispatches to the node executing the fewest active tasks.
- **Weighted**: Routes traffic proportionally based on node compute capacity weights.

---

## 6. Autoscaling Elasticity & Chaos Failure Semantics

### Elastic Autoscaling (`AutoScaler.h`)
- **Composite Load Evaluation**: Calculates cluster-wide composite utilization:
  $$U_{\text{comp}} = (0.60 \cdot \bar{U}_{\text{cpu}}) + (0.40 \cdot \bar{U}_{\text{mem}})$$
- **Scale-Up Trigger**: If $U_{\text{comp}} > \text{scale\_up\_threshold}$ and elapsed time since last scaling $\ge \text{cooldown\_period}$, provisions $\min(\text{step}, \text{max\_nodes} - N)$ new nodes.
- **Scale-Down Trigger**: If $U_{\text{comp}} < \text{scale\_down\_threshold}$ and node count $> \text{min\_nodes}$, finds the lowest-loaded node, drains active work, and removes it.
- **Cooldown Hysteresis**: Prevents rapid oscillatory thrashing.

### Chaos Engineering & Outages (`FailureManager.h`)
- **Outage Injection**: Node status immediately transitions to `FAILED`.
- **Task Eviction**: Active workloads on the failed node are terminated and marked `FAILED`. Queued workloads are evicted.
- **Traffic Bypass**: Schedulers immediately bypass offline nodes.
- **Automated Recovery**: On recovery timestamp, the node reboots with clean zero load and re-enters the active cluster pool.

---

## 7. Mathematical Metric Definitions & Consistency

All metrics are mathematically derived from discrete event timestamps:

| Metric | Mathematical Formula | Meaning & Explanation |
| :--- | :--- | :--- |
| **Response Time (Latency)** | $R = T_{\text{completion}} - T_{\text{arrival}}$ | Total end-to-end elapsed time for a request. |
| **Queue Waiting Time** | $W_q = T_{\text{start}} - T_{\text{arrival}}$ | Delay spent in a node waiting buffer prior to execution. |
| **Execution Duration** | $D = T_{\text{completion}} - T_{\text{start}}$ | Time spent actively running on assigned vCPUs. |
| **Latency Identity** | $R = W_q + D$ | Response time is the exact sum of queue wait and execution time. |
| **Throughput** | $\Theta = \frac{N_{\text{completed}}}{T_{\text{simulation}}}$ | Rate of completed requests per simulation wall second. |
| **Little's Law Relation** | $L = \lambda W$ | Average concurrency in system equals arrival rate times residence time. |
| **Node CPU Utilization** | $U_{\text{cpu}} = \frac{\sum_{\tau} \text{cpu\_req}(\tau)}{C_{\text{cpu}}} \times 100\%$ | Ratio of active vCPUs to total node core capacity. |
| **Node Memory Utilization** | $U_{\text{mem}} = \frac{\sum_{\tau} \text{mem\_req}(\tau)}{C_{\text{mem}}} \times 100\%$ | Ratio of active RAM to total node memory capacity. |
| **Composite Utilization** | $U_{\text{comp}} = 0.60 U_{\text{cpu}} + 0.40 U_{\text{mem}}$ | Weighted utilization balancing CPU and memory pressure. |
| **SLA Violation** | $R > \text{SLA Target Latency}$ | Triggered when total response time breaches target (e.g. 250ms). |
| **SLA Compliance Rate** | $\frac{N_{\text{compliant}}}{N_{\text{completed}}} \times 100\%$ | Percentage of completed requests meeting SLA target. |
| **Simulated Cost** | $\sum (\text{vCPU} \times \text{hours} \times \$0.048) + (\text{RAM} \times \text{hours} \times \$0.006)$ | Provider-style per-second virtual instance compute billing. |
| **Idle Waste Cost** | Billing accrued during periods where provisioned capacity sat idle | Economic measure of over-provisioning overhead. |

---

## 8. Policy Experimentation & Benchmarking Studio

The Comparison Studio (`ComparisonStudio.jsx`) transforms the simulator into a scientific experimentation workbench:
1. **Identical Input Conditions**: The user selects a base workload and an explicit PRNG seed.
2. **Automated Multi-Policy Showdown**:
   - Compares **Round Robin vs Least Loaded vs Priority vs First Fit** under the exact same arrival sequence.
   - Compares **Load Balancing Strategies** under identical connection volumes.
   - Compares **Autoscaling Elasticity** (Fixed Capacity vs Reactive vs Aggressive).
3. **Side-by-Side Metric Table**:
   - Rows: Avg Response Time, Avg Queue Wait, Throughput, CPU Util, Memory Util, Peak Queue Length, Completed, Failed, SLA Violations, Scaling Events, Failures, Simulated Cost, Cost per 1,000 requests.
   - Best value in each row is highlighted with a green indicator.
4. **Multi-Objective Policy Ranking**: Scores policies out of 100 using a weighted composite formula:
   $$\text{Score} = (0.35 \cdot \text{SLA}) + (0.25 \cdot \text{Latency Score}) + (0.20 \cdot \text{Throughput Score}) + (0.20 \cdot \text{Cost Score})$$
5. **Academic Viva Defense Notes**: Summarizes the trade-offs observed between concurrency, queue wait times, and cost efficiency.

---

## 9. Technical Interview Preparation & Defense Guide

Use this section to defend the project in engineering interviews and academic viva examinations:

### Q1: "Why did you choose C++ for the discrete-event simulation engine?"
> "In discrete-event simulation, performance and memory layout are critical. A simulation with 50,000 events must manage a priority queue with tight cache locality, zero garbage-collection pauses, and minimal memory overhead. C++ provides direct memory management, standard template library priority queues (`std::priority_queue`), and high execution throughput. The simulation completes in tens of milliseconds, enabling instantaneous multi-policy experimentation."

### Q2: "How does the scheduler decide which node receives a request?"
> "Depending on the active policy:
> - Under **Least Loaded**, the scheduler calculates composite utilization $0.60 U_{\text{cpu}} + 0.40 U_{\text{mem}}$ for all operational nodes, selecting the node with the lowest load that has capacity or queue space.
> - Under **Priority-Based**, the scheduler grants immediate capacity to P1 Mission-Critical workloads while queuing or deferring P3 Batch workloads.
> Every decision logs candidate node IDs, loads, and explicit rationales in `e.decision_log` for full explainability."

### Q3: "Why did a request get queued or rejected?"
> "Each virtual node has two tiers of capacity:
> 1. Active Capacity: Hardware limits for vCPU and RAM.
> 2. Bounded Waiting Buffer: Defined by `node_queue_limit`.
> If active capacity is full, the task enters the waiting buffer (queue wait increases). If the waiting buffer is also saturated, the node applies backpressure and rejects the task (`REJECTED`) to protect system stability."

### Q4: "Why did latency spike during the traffic surge?"
> "By Little's Law, when arrival rate $\lambda$ exceeds cluster service capacity $\mu$, queue depth $L_q$ grows rapidly. Because Response Time $R = W_q + D$, the accumulated queue wait time $W_q$ directly inflates tail latencies (P95, P99), triggering SLA violations until autoscaling adds capacity."

### Q5: "How does the autoscaler prevent rapid scaling oscillation (flapping)?"
> "The engine uses two mechanisms:
> 1. Threshold Deadband: Scale-up triggers above 65-75%, while scale-down only triggers below 25-30%.
> 2. Cooldown Hysteresis: After any scaling action, a cooldown timer (e.g. 10s) blocks subsequent scaling actions until the cluster stabilizes."

### Q6: "How do Node.js and C++ communicate safely?"
> "Node spawns the compiled binary directly via `child_process.spawn` without shell execution, eliminating shell injection vulnerabilities. Configuration is passed via isolated temporary JSON files, real-time progress is streamed via stdout NDJSON pipes for Server-Sent Events, and final results are read from a structured output file. A 45-second wall clock safety timeout terminates runaway processes."

### Q7: "How would you scale this system to handle 10,000 concurrent simulations?"
> "The stateless design of the C++ engine makes horizontal scaling straightforward:
> 1. Containerize the C++ engine as a lightweight worker image.
> 2. Place an asynchronous message queue (e.g. AWS SQS or RabbitMQ) between the API layer and worker pool.
> 3. Worker pods pull simulation jobs, execute the C++ binary in an isolated container sandbox, and upload results to object storage (e.g. S3).
> 4. Express servers stream progress to clients via Redis pub/sub and WebSocket channels."

---

## 10. Local Quickstart & Execution Guide

### Prerequisites
- Node.js (v18+)
- C++ Compiler with C++14 support (MinGW g++, GCC, or Clang)

### Option A: One-Click Startup (Recommended)
From the root directory:
- **Windows Command Prompt / Double-Click:**
  ```cmd
  start.bat
  ```
- **PowerShell:**
  ```powershell
  .\start.ps1
  ```
The launcher verifies tools, compiles the C++ engine binary, installs dependencies, builds the frontend production bundle, launches the server on `http://localhost:5050`, and opens your default browser.

### Option B: Development Mode with Live Reloading
```powershell
.\start.ps1 -Dev
```
- Backend runs with file watching on port `5050`.
- Frontend runs on Vite dev server on port `5173` with automatic API proxying.

### Option C: Manual Setup
```bash
# 1. Compile C++ Engine
g++ -std=c++14 -O3 simulation-engine/src/main.cpp -o simulation-engine/bin/cloud_sim_engine.exe

# 2. Run C++ Engine Tests (17 tests)
g++ -std=c++14 -O3 tests/test_engine.cpp -o tests/test_engine.exe
./tests/test_engine.exe

# 3. Install & Start Backend
cd backend
npm install
node src/index.js

# 4. Run Backend Integration Tests (7 tests)
cd backend
npm test

# 5. Build Frontend
cd frontend
npm install
npm run build
```

---

## 11. Submodule Documentation

For in-depth details on each project layer, see the dedicated module guides:
- [C++ Discrete-Event Simulation Engine Guide](simulation-engine/README.md)
- [Node.js / Express Backend API Guide](backend/README.md)
- [React Engineering Dashboard Guide](frontend/README.md)
- [Test Suites & Quality Verification Guide](tests/README.md)
