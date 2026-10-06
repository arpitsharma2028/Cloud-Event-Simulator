# Cloud Event Simulator

A deterministic cloud infrastructure behavior and discrete-event simulation platform built for academic evaluation, algorithm benchmarking, and software engineering interview defense.

---

## Navigation & Deep-Dive Guides
- [System Architecture Specification](docs/ARCHITECTURE.md)
- [Cloud Computing Concepts Guide](docs/CLOUD_CONCEPTS.md)
- [Mathematical Simulation Model](docs/SIMULATION_MODEL.md)
- [Viva & Technical Interview Study Guide](docs/VIVA_AND_INTERVIEW.md)
- [15-Minute Viva Revision Cheat Sheet](docs/VIVA_CHEAT_SHEET.md)
- Submodule Documentation: [C++ Simulation Engine](simulation-engine/README.md) | [Node.js Backend](backend/README.md) | [React Frontend](frontend/README.md) | [Test Suites](tests/README.md)

---

## 1. What is this project?

The **Cloud Event Simulator** is an interactive experimentation platform that models how cloud computing infrastructure behaves under diverse workloads, scheduling policies, elasticity configurations, and chaos hardware failures.

### The Real-World Analogy
Think of a large international airport:
- **Airplanes arriving**: User requests arriving at the cloud gateway.
- **Runways & Gates**: Virtual compute nodes with fixed physical capacity (vCPUs and RAM).
- **Air Traffic Controllers**: Cloud Schedulers and Load Balancers deciding which runway each plane lands on.
- **Airport Overflow Parking**: Bounded node waiting queues holding planes when all runways are busy.
- **Opening a Temporary Emergency Runway**: Elastic Autoscaling spinning up new virtual servers when traffic surges.
- **Runway Closure for Emergency Repairs**: Hardware node failures that evict running flights and reroute incoming traffic.

Building a real airport just to test what happens when 500 flights arrive at once is dangerous and prohibitively expensive. Similarly, provisioning 50 real AWS EC2 servers to test an experimental scheduling algorithm is slow, expensive, and noisy. This simulator creates a virtual, mathematically rigorous version of that environment.

### What is Actually Simulated
- **Discrete Workload Requests**: Individual tasks with specific arrival times, vCPU demands, memory demands, execution durations, and priority tiers (P1 High, P2 Medium, P3 Low).
- **Virtual Compute Nodes**: Instances tracking physical vCPU cores, RAM capacity (GB), active allocations, and finite waiting queues.
- **Pluggable Scheduling**: Algorithmic decision logic: Round Robin, Least Loaded, Priority-Based, and First Fit.
- **Pluggable Load Balancing**: Connection distribution logic: Round Robin, Least Connections, and Weighted.
- **Autonomous Horizontal Elasticity**: Dynamic provisioning and deprovisioning of virtual instances based on composite utilization and cooldown hysteresis.
- **Hardware Failures & Recovery**: Unscheduled node crashes, task evictions, traffic bypass, and subsequent node recovery.
- **Financial Metering & SLA Auditing**: Hourly vCPU/RAM billing, idle resource waste, tail latencies (P50, P90, P95, P99), and SLA violations.

### What is NOT Simulated
- This project does **NOT** deploy real AWS, Azure, or GCP infrastructure.
- It does **NOT** provision physical kernel virtual machines, Docker containers, or hypervisors.
- It does **NOT** simulate real physical network cards, optical cables, TCP retransmissions, or packet drops.
- It models cloud **behavioral logic and queuing dynamics** using discrete-event mathematics.

---

## 2. The Problem This Project Solves

Without this simulator, studying and experimenting with cloud architecture presents major barriers:
1. **Financial Cost**: Setting up multi-node clusters in AWS or GCP generates substantial cloud bills.
2. **Nondeterminism & Network Noise**: Variable cloud virtualization noise and public internet latency make it impossible to reproduce benchmarks byte-for-byte.
3. **Slow Provisioning Loops**: Waiting 1 to 5 minutes for real VMs to boot prevents rapid iterative algorithm experimentation.
4. **Dangerous Failure Testing**: Intentionally crashing production servers to evaluate resilience risks cascading outages and data loss.
5. **The "Toy Dashboard" Anti-Pattern**: Many academic projects use simple frontend animations with hardcoded math disconnected from actual system state.

### The Solution
The simulator provides a controlled, deterministic workbench where the exact same sequence of requests can be executed against competing scheduling, load balancing, or elasticity policies to observe the true mathematical trade-offs.

---

## 3. One Request: Complete End-to-End Journey

Here is the exact step-by-step trace of how a request moves through the system from user click to final analytics:

1. **User Configures Simulation in React**:
   - *What*: The user selects node count, scheduling policy, request rate, and seed in `WorkloadStudio.jsx` and clicks "Run Simulation".
   - *Component*: `frontend/src/pages/WorkloadStudio.jsx`
   - *Why*: Provides an intuitive infrastructure control console.
2. **React Dispatches REST Payload**:
   - *What*: React formats a configuration object and sends an HTTP POST to `/api/simulations`.
   - *Component*: `frontend/src/services/api.js`
   - *Why*: Initiates execution on the backend server.
3. **Node.js Express Server Receives Request**:
   - *What*: Express router captures the payload and passes it to the simulation controller.
   - *Component*: `backend/src/routes/simulations.js`
   - *Why*: Manages API endpoints and routes.
4. **Backend Validates Configuration Bounds**:
   - *What*: Zod schema validates all numerical boundaries (e.g. duration between 1.0s and 600.0s).
   - *Component*: `backend/src/schemas/simulationSchema.js`
   - *Why*: Protects against out-of-bounds parameters or malformed input before spawning native processes.
5. **Node Controller Writes Temporary Config File**:
   - *What*: Node serializes the validated configuration into `backend/temp/sim_config_<id>.json`.
   - *Component*: `backend/src/services/simulationService.js`
   - *Why*: Decouples memory between Node and C++, avoiding operating system command-line argument length limits.
6. **Node Spawns C++ Engine Binary**:
   - *What*: Node executes `cloud_sim_engine.exe --config <in> --output <out> --stream` via `child_process.spawn`.
   - *Component*: `backend/src/services/simulationService.js`
   - *Why*: Executes simulation in native C++ without shell interpretation (`shell: false`).
7. **C++ Parses Configuration & Initializes PRNG**:
   - *What*: `SimulationEngine` reads input JSON and initializes `std::mt19937` with the configured seed.
   - *Component*: `simulation-engine/include/SimulationEngine.h`
   - *Why*: Ensures 100% deterministic, reproducible pseudo-random numbers.
8. **Events are Generated and Pushed to EventQueue**:
   - *What*: Poisson request arrivals, scheduled spikes, and chaos failure events are placed in `EventQueue`.
   - *Component*: `simulation-engine/include/EventQueue.h`
   - *Why*: Prepares the chronological timeline for discrete-event execution.
9. **Simulation Clock Advances to Next Earliest Event**:
   - *What*: The engine pops the root event from `priority_queue` and jumps `current_time_` to `event.timestamp`.
   - *Component*: `simulation-engine/include/SimulationEngine.h`
   - *Why*: Advances virtual time without waiting for real wall-clock seconds.
10. **Load Balancer Routes Request to Node**:
    - *What*: If load balancing is configured, `LoadBalancer` picks an ingress node (e.g. Least Connections).
    - *Component*: `simulation-engine/include/LoadBalancer.h`
    - *Why*: Distributes network ingress evenly across nodes.
11. **Scheduler Evaluates Node Capacity**:
    - *What*: The scheduler (e.g. `LeastLoadedScheduler`) evaluates candidate operational nodes.
    - *Component*: `simulation-engine/include/Scheduler.h`
    - *Why*: Determines which node is best suited to host the workload.
12. **Virtual Node Manages Resource Allocation**:
    - *What*: `Node::canAllocate()` checks if spare vCPU and RAM exist.
      - If capacity is free: `Node::allocate()` increments `cpu_used` and `mem_used`.
      - If capacity is full: Task enters `waiting_queue`.
      - If waiting queue is full: Task is rejected with backpressure (`TaskStatus::REJECTED`).
    - *Component*: `simulation-engine/include/Node.h`
    - *Why*: Models physical hardware resource limits and buffer constraints.
13. **Workload Executes**:
    - *What*: If admitted, task status becomes `TaskStatus::RUNNING`. A future `TASK_COMPLETE` event is scheduled at `current_time + duration`.
    - *Component*: `simulation-engine/include/SimulationEngine.h`
    - *Why*: Simulates compute execution over virtual time.
14. **Task Completes & Resources are Released**:
    - *What*: When `TASK_COMPLETE` fires, `Node::deallocate()` restores the exact vCPU and RAM. The node then pops the next waiting task from `waiting_queue` and starts it.
    - *Component*: `simulation-engine/include/Node.h`
    - *Why*: Reclaims capacity and drains pending queues.
15. **Metrics are Updated**:
    - *What*: `MetricsCollector` records completion timestamp, response time ($R = W_q + D$), and checks SLA.
    - *Component*: `simulation-engine/include/MetricsCollector.h`
    - *Why*: Collects auditable telemetry.
16. **Autoscaling Evaluates Cluster Load**:
    - *What*: Periodic `AUTOSCALE_EVAL` checks composite utilization against thresholds and cooldown.
    - *Component*: `simulation-engine/include/AutoScaler.h`
    - *Why*: Dynamically adapts cluster size to load spikes.
17. **Failure Manager Injects Scheduled Outages**:
    - *What*: If `NODE_FAILURE` timestamp arrives, the node transitions to `FAILED` and evicts active workloads.
    - *Component*: `simulation-engine/include/FailureManager.h`
    - *Why*: Tests cluster resilience under chaos conditions.
18. **Node Recovers**:
    - *What*: When `NODE_RECOVERY` fires, the node resets load to 0.0 and re-enters the active pool.
    - *Component*: `simulation-engine/include/FailureManager.h`
    - *Why*: Restores degraded capacity.
19. **Engine Writes Structured JSON Results**:
    - *What*: At simulation end, full summary KPIs, timeseries snapshots, and decision traces are written to disk.
    - *Component*: `simulation-engine/include/SimulationEngine.h`
    - *Why*: Persists complete simulation output.
20. **Node Controller Reads Results & Emits to Frontend**:
    - *What*: Node parses the JSON output file, unlinks temp files, and returns HTTP 201.
    - *Component*: `backend/src/services/simulationService.js`
    - *Why*: Delivers clean data to the web client.
21. **React Renders Analytics**:
    - *What*: `ResultsAnalytics.jsx` renders KPI cards, queue decomposition, and timeseries charts.
    - *Component*: `frontend/src/pages/ResultsAnalytics.jsx`
    - *Why*: Allows the engineer to inspect what happened.
22. **Results Benchmarked in Comparison Studio**:
    - *What*: The user opens `ComparisonStudio.jsx` to benchmark this run against competing policies.
    - *Component*: `frontend/src/pages/ComparisonStudio.jsx`
    - *Why*: Scientifically proves which algorithm performed best.

---

## 4. Architecture

### System Architecture Diagram

```
React Frontend (Port 5050 / 5173)
  |
  | HTTP REST (POST /api/simulations, /api/compare)
  | Server-Sent Events (GET /api/simulations/:id/stream)
  v
Node.js / Express Backend (Port 5050)
  |
  | Controlled Process IPC: child_process.spawn
  | Temporary Files: temp/sim_config_<id>.json, temp/sim_output_<id>.json
  | Standard Output: Streaming NDJSON
  v
C++ Simulation Engine (cloud_sim_engine.exe)
  |
  +-- Event Generator & std::mt19937 PRNG
  +-- EventQueue (std::priority_queue + Causality Comparator)
  +-- Schedulers (Round Robin, Least Loaded, Priority, First Fit)
  +-- Load Balancers (Round Robin, Least Connections, Weighted)
  +-- ResourcePool & Virtual Compute Nodes (vCPU, RAM, Queues)
  +-- AutoScaler (Thresholds & Cooldown Hysteresis)
  +-- FailureManager (Chaos Outages, Eviction, Recovery)
  +-- MetricsCollector (Latencies, Throughput, Cost, SLA)
```

### Architectural Decisions

- **Why is simulation logic in C++?**
  A 50,000-event simulation requires inserting and popping elements from a priority queue thousands of times per second. C++ `std::priority_queue` provides continuous memory layout, optimal CPU cache locality, and zero garbage collection pauses.
- **Why is Node.js not implementing the simulation?**
  JavaScript in V8 is single-threaded and relies on non-preemptive garbage collection sweeps. These GC sweeps introduce unpredictable pauses that skew micro-benchmarking.
- **Why does React not implement simulation logic?**
  Running heavy simulation loops on the browser main thread freezes the DOM and degrades user interaction. Decoupling the frontend allows headless batch benchmarking.
- **Why is the C++ engine a separate process?**
  Process isolation prevents memory leaks or engine crashes from bringing down the web server. If a simulation exceeds its 45-second safety timeout, Node terminates the child process with `SIGKILL` without affecting other users.
- **Why use JSON for communication?**
  JSON is platform-agnostic, human-readable for debugging, and supported by zero-dependency parsers in C++ and native parsers in JavaScript.
- **Why use Server-Sent Events (SSE)?**
  During a simulation run, communication is strictly unidirectional: the server streams progress events to the browser. SSE runs over standard HTTP, avoids WebSocket connection upgrade overhead, and natively supports automatic reconnection.

---

## 5. Folder Structure & Submodule Guides

```
Cloud Event Simulator/
  ├── simulation-engine/       # C++14 Discrete-Event Simulation Core
  ├── backend/                 # Node.js / Express API Service & Process Controller
  ├── frontend/                # React 18 + Vite Engineering Control Console
  ├── tests/                   # 17 Native C++ Unit Tests & 7 Backend API Tests
  ├── docs/                    # Deep-dive study guides and architecture documentation
  ├── start.bat                # Windows 1-click batch launcher
  ├── start.ps1                # PowerShell automated startup script
  └── README.md                # Root project manual
```

### Submodule Guides
- [`simulation-engine/README.md`](simulation-engine/README.md): Detailed C++ class relationships, ownership models, and memory layouts.
- [`backend/README.md`](backend/README.md): Express routes, Zod schemas, process controller, and security middleware.
- [`frontend/README.md`](frontend/README.md): React component hierarchy, state management, and SSE stream listeners.
- [`tests/README.md`](tests/README.md): Test verification matrices for all 17 C++ and 7 backend tests.

---

## 6. Cloud Computing Concepts Used

For detailed definitions, university exam questions, and real-world examples, see [`docs/CLOUD_CONCEPTS.md`](docs/CLOUD_CONCEPTS.md).

- **Resource Pooling**: Grouping independent virtual nodes into a unified resource pool (`ResourcePool.h`).
- **Virtual Resources**: Modeling vCPU cores and RAM GB as physical capacity bounds (`Node.h`).
- **Cloud Scheduling**: Algorithmic mapping of pending workloads to compute nodes (`Scheduler.h`).
- **Load Balancing**: Distributing incoming connections across node ingress buffers (`LoadBalancer.h`).
- **Elasticity & Autoscaling**: Dynamically adding or removing virtual instances based on load (`AutoScaler.h`).
- **Fault Tolerance**: Isolating node crashes and evicting affected workloads (`FailureManager.h`).
- **Backpressure**: Rejecting new requests when compute and waiting buffers are saturated (`Node::enqueue()`).
- **Metering & Cost**: Calculating compute hour charges and idle resource waste (`MetricsCollector.h`).
- **SLA Auditing**: Tracking response-time compliance against target latency thresholds (`MetricsCollector.h`).

---

## 7. Discrete-Event Simulation Mechanics

For complete mathematical derivations, see [`docs/SIMULATION_MODEL.md`](docs/SIMULATION_MODEL.md).

In this simulator, virtual time only advances when an event occurs:
1. The engine checks `EventQueue::top()`.
2. The simulation clock jumps directly to that timestamp: `current_time_ = event.timestamp`.
3. The event is popped and executed, potentially generating future events.
4. The cycle repeats until the queue is empty or duration expires.

### Simultaneous Event Tie-Breaking
When multiple events share the exact same timestamp (e.g., $T=10.0\text{s}$), `EventComparator` resolves ties using causality ranking:
1. `NODE_FAILURE` (Rank 0): Hardware fails first.
2. `NODE_RECOVERY` (Rank 1): Rebooted capacity is restored.
3. `TASK_COMPLETE` (Rank 2): Completing tasks deallocate resources, freeing capacity before new work is admitted.
4. `AUTOSCALE_EVAL` (Rank 3): Elasticity evaluations observe post-completion cluster load.
5. `WORKLOAD_SPIKE` (Rank 4): Traffic surges trigger.
6. `TASK_START` (Rank 5): Tasks waiting in node queues start.
7. `REQUEST_ARRIVAL` (Rank 6): Newly arrived work checks capacity.
8. `METRIC_SAMPLE` (Rank 7): Telemetry snapshots are recorded.

---

## 8. Schedulers & Load Balancers

### Scheduling Algorithms (`Scheduler.h`)
- **Round Robin (`ROUND_ROBIN`)**: Cycles systematically through eligible operational nodes ($O(1)$).
- **Least Loaded (`LEAST_LOADED`)**: Evaluates composite utilization $0.60 U_{\text{cpu}} + 0.40 U_{\text{mem}}$ and dispatches to the node with lowest current workload ($O(N)$).
- **Priority-Based (`PRIORITY_BASED`)**: Prioritizes Mission-Critical (P1) tasks for immediate execution, queuing or deferring lower-priority requests ($O(N)$).
- **First Fit (`FIRST_FIT`)**: Scans cluster nodes sequentially and allocates to the first node with sufficient unreserved resources ($O(N)$).

### Load Balancing Policies (`LoadBalancer.h`)
- **Round Robin**: Uniform alternating connection distribution ($O(1)$).
- **Least Connections**: Dispatches to the node executing the fewest active tasks ($O(N)$).
- **Weighted**: Distributes requests proportionally based on node compute capacity weights ($O(N)$).

---

## 9. Mathematical Metric Formulas

All metrics are mathematically derived from discrete event timestamps:

| Metric | Formula | Explanation |
| :--- | :--- | :--- |
| **Response Time (Latency)** | $R = T_{\text{completion}} - T_{\text{arrival}}$ | Total end-to-end request duration. |
| **Queue Waiting Time** | $W_q = T_{\text{start}} - T_{\text{arrival}}$ | Delay spent waiting in a buffer prior to execution. |
| **Execution Duration** | $D = T_{\text{completion}} - T_{\text{start}}$ | Time spent running on allocated vCPUs. |
| **Latency Identity** | $R = W_q + D$ | Response time is the sum of queue wait and execution time. |
| **Throughput** | $\Theta = \frac{N_{\text{completed}}}{T_{\text{simulation}}}$ | Rate of completed requests per simulation second. |
| **Composite Utilization** | $0.60 U_{\text{cpu}} + 0.40 U_{\text{mem}}$ | Balanced measure of compute and memory pressure. |
| **SLA Compliance Rate** | $\frac{N_{\text{completed}} - N_{\text{violated}}}{N_{\text{completed}}} \times 100\%$ | Percentage of requests completing under target threshold. |
| **Simulated Cost** | $\sum (\text{vCPU-hours} \times \$0.048) + (\text{RAM-GB-hours} \times \$0.006)$ | Provider-style instance compute billing. |

---

## 10. Comparison & Experimentation Studio

Located in `frontend/src/pages/ComparisonStudio.jsx`, the Comparison Studio enables controlled scientific benchmarks:
1. Select a base workload preset (e.g. End-to-End Cloud Lifecycle Demo).
2. Choose an independent variable:
   - **Scheduling Policies**: Round Robin vs Least Loaded vs Priority-Based vs First Fit.
   - **Load Balancing**: Round Robin vs Least Connections vs Weighted.
   - **Autoscaling**: Fixed Capacity vs Reactive Elasticity vs Aggressive Elasticity.
3. Choose a deterministic PRNG seed (e.g. 42).
4. Run the experiment: All variants execute against the exact same seed and workload.
5. Inspect the side-by-side metric table, policy ranking leaderboard, and viva defense notes.

---

## 11. Security Implementation

The backend implements defense-in-depth security principles:
- **No Command Injection**: Uses `child_process.spawn()` with an argument array and `shell: false`. Shell command interpolation is impossible.
- **Safety Watchdog Timer**: A 45-second wall-clock timer kills runaway child processes with `SIGKILL`.
- **Zod Schema Validation**: Enforces strict boundaries on numerical inputs before spawning native processes.
- **Network Hardening**: Helmet HTTP security headers, CORS origin control, and rate limiting (120 req/min).

---

## 12. Testing & Quality Assurance

The codebase includes two automated test suites:
1. **C++ Simulation Engine Unit Tests (`tests/test_engine.cpp`)**: 17 unit tests verifying event ordering, simultaneous event tie-breaking, empty queue safety, resource allocation/release, queue backpressure, schedulers, load balancers, autoscaling thresholds, cooldown hysteresis, node failure eviction, metrics consistency ($R = W_q + D$), determinism, and zero-workload edge cases.
2. **Backend API Integration Tests (`backend/tests/api.test.js`)**: 7 integration tests verifying `/health`, `/api/presets`, Zod boundary rejection, C++ engine orchestration, multi-run comparisons, and `/api/compare/experiment`.

For the complete test matrix, see [`tests/README.md`](tests/README.md).

---

## 13. System Limitations (Honest Technical Boundaries)

A strong software engineer understands the boundaries of their model:
- **Abstract Resources**: Compute and memory are modeled as scalar capacity units rather than physical x86-64 machine instructions or physical memory paging.
- **Zero Network Delay**: Network transmission delay across virtual instances is modeled as zero or folded into task execution duration.
- **Instantaneous Provisioning**: Virtual node allocation occurs rapidly in simulation time; real AWS EC2 instances require 30 to 120 seconds to boot.
- **Single Host Execution**: The simulator currently executes on a single host machine rather than a distributed cluster of simulation workers.

---

## 14. Design Decisions: Why Did We Choose X?

- **Why C++?** For deterministic performance, cache locality in priority queues, and zero garbage-collection pauses.
- **Why Node.js?** For asynchronous process management, standard HTTP web APIs, and Server-Sent Events.
- **Why React?** For reactive, component-based dashboard visualization.
- **Why a separate C++ process?** Process isolation prevents engine crashes from affecting the web server.
- **Why `std::priority_queue`?** Provides optimal $O(\log N)$ insertion and $O(1)$ lookup for discrete events.
- **Why Server-Sent Events (SSE)?** Unidirectional streaming over standard HTTP is lighter and more robust than WebSockets for telemetry.
- **Why Mersenne Twister (`std::mt19937`)?** High-quality 32-bit pseudorandom number generator with a massive period of $2^{19937}-1$.
- **Why no database?** For local experimentation, an in-memory registry keeps the system self-contained without requiring PostgreSQL or MongoDB installations.

---

## 15. Future Work (Planned / Not Currently Implemented)

The following architectural enhancements are identified for production deployment:
- **Distributed Worker Pools**: Decoupling simulation execution via an asynchronous message broker (RabbitMQ / AWS SQS) and containerized C++ workers.
- **Persistent Storage**: Migrating simulation history from the in-memory Map to a relational database (PostgreSQL) and telemetry snapshots to object storage (AWS S3).
- **Dynamic In-Flight Chaos**: Allowing users to interactively inject failures into running simulations over bidirectional WebSocket channels.
- **Multi-Region Latency Modeling**: Simulating cross-region latency matrices and geo-distributed replication overhead.

---

## 16. How to Run Locally

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
The launcher compiles the engine, installs dependencies, builds the frontend bundle, launches the server on `http://localhost:5050`, and opens your default browser.

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
