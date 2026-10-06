# Frontend Engineering Dashboard

The user interface of the Cloud Event Simulator is an infrastructure control console built with React 18 and Vite.

It provides real-time visualization of C++ simulator state, interactive workload authoring, live step-by-step decision tracing, telemetry charting, and an experimentation studio.

---

## 1. Directory Structure

```
frontend/
  ├── src/
  │   ├── components/
  │   │   ├── TopNav.jsx              # Navigation header, system indicators, assumptions modal trigger
  │   │   ├── ModelReferenceModal.jsx # Assumptions and mathematical metrics reference documentation
  │   │   ├── MetricCard.jsx          # KPI card with JetBrains Mono numbers and threshold coloring
  │   │   ├── NodeGrid.jsx            # Virtual compute node cards with vCPU and RAM progress bars
  │   │   ├── EventTable.jsx          # Searchable, filterable discrete event log table
  │   │   ├── DecisionLog.jsx         # Chronological decision trace for scheduling and scaling
  │   │   ├── TelemetryChart.jsx      # Time-series telemetry line graphs
  │   │   └── StatusBadge.jsx         # Status tags (Healthy, Failed, Busy, Idle)
  │   ├── pages/
  │   │   ├── Dashboard.jsx           # Cluster overview, preset launchers, recent simulation history
  │   │   ├── WorkloadStudio.jsx      # Workload, cluster sizing, policy, spike, and chaos configuration
  │   │   ├── SimulationConsole.jsx   # Live or scrubbed playback view of node pool and event streams
  │   │   ├── ResultsAnalytics.jsx    # Latency percentiles, queue wait decomposition, cost audit, CSV export
  │   │   └── ComparisonStudio.jsx    # Policy experiment benchmark, side-by-side table, rankings, grouped charts
  │   ├── services/
  │   │   └── api.js                  # REST API client and Server-Sent Events (SSE) stream listener
  │   ├── App.jsx                     # Top-level state coordinator and view router
  │   ├── index.css                   # Custom CSS design system (dark slate infrastructure console)
  │   └── main.jsx                    # React 18 DOM mount point
  ├── dist/                           # Compiled production bundle served directly by Express
  ├── index.html                      # HTML template with Google Fonts (Inter, JetBrains Mono)
  └── vite.config.js                  # Vite configuration with API reverse proxy to port 5050
```

---

## 2. Page Workflows & Features

### 1. Dashboard (`Dashboard.jsx`)
- High-level cluster overview with active run counts.
- Academic preset launcher cards: 1-click execution for scenarios such as End-to-End Cloud Lifecycle, Flash Sale Spike, Chaos Outage, Priority Scheduling, and Under-Provisioned Cluster.
- History table of executed simulations with status badges, throughput rates, and direct links to inspect results.

### 2. Workload Studio (`WorkloadStudio.jsx`)
- **Cluster Sizing**: Initial node count, default vCPU cores per node, RAM (GB) per node, and queue buffer limits.
- **Policy Selection**: Schedulers (Round Robin, Least Loaded, Priority, First Fit) and Load Balancers (Round Robin, Least Connections, Weighted).
- **Autoscaling Elasticity**: Min/max nodes, scale-up threshold, scale-down threshold, cooldown duration, and scaling step sizes.
- **Workload Parameters**: Base request arrival rate (Poisson process), execution duration range, vCPU demand range, RAM demand range, and priority tier ratios.
- **Chaos & Outages**: Interactive schedule of node failure timestamps, affected node IDs, and recovery timestamps.

### 3. Simulation Console (`SimulationConsole.jsx`)
- Visual representation of virtual node capacity: Instantaneous vCPU utilization and RAM consumption bars.
- Live streaming updates: Receives real-time steps over Server-Sent Events (`EventSource`).
- Time-scrubber slider: Allows inspecting historical cluster states at any discrete second.
- Decision Trace Log: Explains scheduling rationale, candidate node evaluations, load balancing decisions, and autoscaling triggers.

### 4. Results & Analytics (`ResultsAnalytics.jsx`)
- Primary KPI Cards: Success rate, mean latency, throughput, SLA compliance rate, total simulated cost, cluster availability.
- **Queue Wait Decomposition**: Explains latency as:
  $$\text{Response Time} = \text{Queue Wait Time} + \text{Execution Duration}$$
- Tail latency analysis: Minimum, Median (P50), P90, P95, P99, and Maximum latency.
- Financial breakdown: Compute charges, memory charges, idle capacity waste, and cost per 1,000 completed requests.
- Export options: Download full JSON dataset or timeseries CSV for spreadsheet analysis.

### 5. Comparison Studio (`ComparisonStudio.jsx`)
- **Policy Experiment Benchmark**: Select a base workload and PRNG seed to run an automated, deterministic showdown between policies:
  - Scheduling Policies (Round Robin vs Least Loaded vs Priority vs First Fit)
  - Load Balancers (Round Robin vs Least Connections vs Weighted)
  - Autoscaling (Fixed Capacity vs Reactive Elasticity vs Aggressive Elasticity)
- **Side-by-Side Metric Comparison Table**: Transposed matrix comparing all primary engineering metrics with the best performer highlighted per row.
- **Multi-Objective Policy Ranking**: Composite score (0-100) based on SLA compliance, response latency, throughput, and cost.
- **Grouped Visual Bar Charts**: CSS-based comparison of latency, throughput, SLA, and cost.
- **Viva Defense Insights**: Academic explanations detailing the specific trade-offs observed.

### 6. Model Assumptions & Metrics Reference (`ModelReferenceModal.jsx`)
- Accessible from the top navigation bar at all times.
- Documents simulation mechanics, virtual capacity accounting, mathematical formulas, Little's Law relationships, and billing equations.

---

## 3. Development & Build Commands

### Install Dependencies
```bash
npm install
```

### Run Local Vite Development Server
```bash
npm run dev
```
Runs at `http://localhost:5173`. Proxies `/api` requests to backend at `http://localhost:5050`.

### Build Production Bundle
```bash
npm run build
```
Compiles optimized assets to `frontend/dist/`, which are automatically served by the Express backend.
