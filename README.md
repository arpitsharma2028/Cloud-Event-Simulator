# Cloud Event Simulator

A high-performance, deterministic cloud infrastructure behavior and discrete-event simulation platform built for academic and software engineering evaluation.

The simulator models cloud infrastructure mechanics without provisioning physical cloud hardware, producing deterministic, explainable results suitable for viva defense and algorithm benchmarking.

---

## 1. System Architecture

The platform uses a strict three-tier layered architecture:

```
+--------------------------------------------------------------------------+
|                     REACT FRONTEND DASHBOARD                             |
|  - Dashboard: System KPI cards & Academic Scenario quick launchers       |
|  - Workload Studio: Cluster sizing, policy selector, chaos parameters    |
|  - Simulation Console: Interactive time-scrubber, node pool, traces      |
|  - Results & Analytics: Latency percentiles, cost metering, SLA audit    |
|  - Comparison Studio: Multi-run side-by-side benchmark matrix & insights |
+------------------------------------+-------------------------------------+
                                     | REST API + SSE
+------------------------------------v-------------------------------------+
|                  NODE.JS / EXPRESS ORCHESTRATION API                     |
|  - Request validation (Zod schema bounds enforcement)                    |
|  - Child process execution manager with 45s safety timeout               |
|  - Security middleware: Helmet, CORS, Rate Limiting (express-rate-limit) |
|  - Real-time Server-Sent Events (SSE) broadcaster                        |
|  - Comparative analytics and Viva explanation generator                  |
+------------------------------------+-------------------------------------+
                                     | Stdin/Stdout Pipes (JSON Protocol)
+------------------------------------v-------------------------------------+
|                   C++ DISCRETE EVENT SIMULATION ENGINE                   |
|  - Discrete Event Simulation (DES) core with virtual clock               |
|  - Priority Queue with multi-criteria comparator                         |
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

## 2. Core Cloud Computing Concepts Modeled

### A. Resource Pooling & Virtual Resources
- Virtual nodes represent physical or virtual server instances.
- Each node defines capacity limits for vCPU cores and RAM (GB).
- Strict capacity admission checks prevent over-allocation.
- Bounded waiting queues apply backpressure when nodes are saturated.

### B. Cloud Scheduling Policies
- **Round Robin**: Cycles systematically through eligible operational nodes.
- **Least Loaded**: Evaluates composite utilization `(0.6 * CPU% + 0.4 * RAM%)` and routes to the node with the lowest current workload.
- **Priority-Based**: Prioritizes Mission-Critical (P1) workloads for immediate execution, queuing or deferring lower-priority requests.
- **First Fit**: Scans cluster nodes sequentially and allocates to the first node with sufficient unreserved resources.

### C. Load Balancing Strategies
- **Round Robin**: Alternating connection distribution.
- **Least Connections**: Dispatches to the node with the fewest active executing tasks.
- **Weighted**: Distributes requests proportional to configured node compute capacity weights.

### D. Elastic Auto-Scaling
- Periodic threshold evaluations against cluster average load.
- Scale-up triggered when composite utilization exceeds configured threshold (e.g. 75%).
- Scale-down triggered when composite utilization falls below threshold (e.g. 30%).
- Cooldown timer prevents thrashing / rapid oscillatory scaling.
- Min/Max node bounds are strictly enforced.

### E. Chaos Injection & Fault Tolerance
- Scheduled node outages simulate hardware failures.
- Active workloads on failed nodes are evicted and logged.
- Traffic automatically bypasses non-operational nodes.
- Node recovery restores the instance to the active pool.

### F. Monitoring, Metering, Cost & SLA
- **Latency Percentiles**: P50 (median), P90, P95, and P99 tail latency.
- **Throughput**: Processed requests per simulation second.
- **Cost Modeling**:
  - vCPU compute: $0.048 per vCPU-hour
  - RAM memory: $0.006 per GB-hour
  - Idle waste: Cost incurred while allocated resources remained unutilized
  - Cost per 1,000 successful requests
- **SLA Tracking**: Target response time threshold (ms), SLA violation counts, SLA compliance rate (%), and cluster uptime availability (%).

---

## 3. Project Directory Structure

```
e:\Cloud Event Simulator\
  ├── start.bat                    # One-click Windows batch startup script
  ├── start.ps1                    # PowerShell all-in-one startup script
  ├── .gitignore                   # Git exclusion rules
  ├── .env.example                 # Environment configuration template
  ├── package.json                 # Root script definitions
  │
  ├── simulation-engine/           # C++ Discrete Event Simulation Core
  │   ├── include/
  │   │   ├── Event.h              # Event & Task data structures
  │   │   ├── EventQueue.h         # Priority queue with custom comparator
  │   │   ├── Node.h               # Virtual node model with vCPU/RAM tracking
  │   │   ├── ResourcePool.h       # Cluster resource pooling & node lifecycle
  │   │   ├── Scheduler.h          # Polymorphic Schedulers
  │   │   ├── LoadBalancer.h       # Polymorphic Load Balancers
  │   │   ├── AutoScaler.h         # Threshold-based elasticity engine
  │   │   ├── FailureManager.h     # Chaos injection & recovery manager
  │   │   ├── MetricsCollector.h   # Telemetry, latencies, cost & SLA model
  │   │   ├── SimulationEngine.h   # Master DES coordination engine
  │   │   └── json_helper.h        # Zero-dependency JSON parser & serializer
  │   ├── src/
  │   │   └── main.cpp             # CLI driver (--config, --output, --stream)
  │   └── bin/
  │       └── cloud_sim_engine.exe # Compiled native binary
  │
  ├── backend/                     # Node.js / Express API Service
  │   ├── src/
  │   │   ├── index.js             # Express server with Helmet, CORS, rate limits
  │   │   ├── routes/              # /api/simulations, /api/presets, /api/compare
  │   │   ├── services/            # Process controller, SSE streaming, comparison
  │   │   └── schemas/             # Zod validation schemas
  │   └── tests/
  │       └── api.test.js          # Backend integration test suite
  │
  ├── frontend/                    # React 18 + Vite Engineering Dashboard
  │   ├── src/
  │   │   ├── components/          # TopNav, MetricCard, NodeGrid, TelemetryChart, EventTable, DecisionLog
  │   │   ├── pages/               # Dashboard, WorkloadStudio, SimulationConsole, ResultsAnalytics, ComparisonStudio
  │   │   ├── services/            # API client and SSE streaming listener
  │   │   ├── App.jsx              # Main router & state manager
  │   │   └── index.css            # Dark slate engineering console styling
  │   └── dist/                    # Compiled production build
  │
  └── tests/
      └── test_engine.cpp          # C++ unit tests for engine mechanics
```

---

## 4. Building and Running

### Option A: One-Click Startup (Recommended)

Run the automated startup script from the root folder:

- **Windows Batch (Command Prompt or Double-Click):**
  ```cmd
  start.bat
  ```

- **PowerShell:**
  ```powershell
  .\start.ps1
  ```

This single command automatically:
1. Detects Node.js, npm, and g++ in your PATH.
2. Compiles the C++ simulation engine binary if not present.
3. Installs backend dependencies (`npm install`).
4. Installs frontend dependencies and builds the React bundle (`npm run build`).
5. Launches the unified server on `http://localhost:5050`.
6. Opens your default browser automatically.

---

### Option B: Development Mode with Live Reloading

For active code changes with hot module replacement:

```powershell
.\start.ps1 -Dev
```
- Starts the Node.js API with file watching on port `5050`.
- Starts the Vite frontend development server on port `5173` with automatic API proxying.

---

### Option C: Manual Step-by-Step Setup

1. **Build C++ Simulation Engine**:
   ```bash
   g++ -std=c++14 -O3 simulation-engine/src/main.cpp -o simulation-engine/bin/cloud_sim_engine.exe
   ```

2. **Run C++ Engine Unit Tests**:
   ```bash
   g++ -std=c++14 -O3 tests/test_engine.cpp -o tests/test_engine.exe
   ./tests/test_engine.exe
   ```

3. **Install Dependencies & Start Server**:
   ```bash
   # Backend
   cd backend
   npm install
   node src/index.js
   ```

   Server endpoints:
   - **Unified Web UI & REST API**: `http://localhost:5050`
   - **Health Check**: `http://localhost:5050/health`
   - **Presets Catalog**: `http://localhost:5050/api/presets`

4. **Run Backend Integration Tests**:
   ```bash
   cd backend
   npm test
   ```

---

## 5. Academic Presets Included

The platform includes 5 pre-configured scenarios designed for presentation and examination:

1. **Baseline Steady-State Cloud**:
   Smooth Poisson arrival stream demonstrating standard round-robin scheduling, balanced node utilization, and high SLA compliance.

2. **Flash Sale Spike & Elastic Autoscaling**:
   Traffic surge at T=18s triggers horizontal auto-scaling, scaling out the cluster from 2 to 4+ nodes before cooling down.

3. **Chaos Outage & Node Recovery**:
   Simulates catastrophic crash of Node 2 at T=20s with task eviction, followed by automated node recovery at T=42s.

4. **Priority-Based Workload Scheduling**:
   Demonstrates starvation-free prioritization of Mission-Critical (P1) tasks over Batch (P3) workloads during heavy cluster utilization.

5. **Under-Provisioned Cluster & SLA Breach**:
   Severe workload overload on fixed-capacity cluster demonstrating backpressure queue saturation, dropped requests, and SLA degradation.

---

## 6. Strict Engineering Design Compliance

- **No AI Marketing Cliches**: No vague slogans, no fake testimonials, no AI badges.
- **No Em Dashes**: Hyphens and standard colons used exclusively.
- **Modest Application Controls**: Rectangular and slightly rounded buttons; zero pill-shaped buttons.
- **Restrained Palette**: Dark slate console theme with functional status indicators (green/yellow/red/blue).
- **Deterministic**: Given identical configuration and seed, simulation produces byte-for-byte identical output.
