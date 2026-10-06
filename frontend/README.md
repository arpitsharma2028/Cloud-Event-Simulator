# Frontend Engineering Dashboard

The user interface of the Cloud Event Simulator is a single-page application built with React 18, Vite, and a custom CSS design system. It serves as an infrastructure control console for cloud modeling, real-time observability, telemetry inspection, and policy benchmarking.

---

## Navigation
- [System Architecture Specification](../docs/ARCHITECTURE.md)
- [Mathematical Simulation Model](../docs/SIMULATION_MODEL.md)
- [Viva & Technical Interview Guide](../docs/VIVA_AND_INTERVIEW.md)

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
  │   │   ├── TelemetryChart.jsx      # SVG-based time-series telemetry line graphs
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

## 2. Core Responsibilities: WHAT, WHY, and HOW

### A. State Management & Navigation (`src/App.jsx`)
- **WHAT**: Manages active tabs, simulation records, preset catalogs, and comparison results.
- **WHY**: Acts as the central state store coordinating navigation between Workload Studio, Simulation Console, Results Analytics, and Comparison Studio.
- **HOW**:
  - `activeTab`: `'dashboard' | 'studio' | 'console' | 'results' | 'comparison'`.
  - `activeSimulation`: The currently selected simulation object.
  - `comparisonData`: Data payload for side-by-side policy evaluations.
  - On mount, calls `fetchPresets()` and `fetchSimulations()` to hydrate state.

### B. API Service & SSE Streaming (`src/services/api.js`)
- **WHAT**: Handles network communication with the backend.
- **WHY**: Isolates HTTP Fetch calls and Server-Sent Event streaming logic from React UI components.
- **HOW**:
  - `createSimulation(config)`: `POST /api/simulations`.
  - `subscribeToSimulationStream(id, onStep, onComplete, onError)`: Opens `new EventSource('/api/simulations/:id/stream')`, listens for `step` and `complete` events, and invokes callbacks.
  - `runPolicyExperiment(payload)`: `POST /api/compare/experiment`.

### C. Pages
1. **`Dashboard.jsx`**: High-level overview of cluster state, 1-click launchers for the 6 academic presets, and simulation history table.
2. **`WorkloadStudio.jsx`**: Parameter input forms for cluster sizing, schedulers, load balancers, autoscaling thresholds, arrival rates, spikes, and node failure timestamps.
3. **`SimulationConsole.jsx`**: Real-time or scrubbed playback console showing node utilization bars, streaming discrete events, and decision logs.
4. **`ResultsAnalytics.jsx`**: Post-run analytics displaying latency percentiles (P50, P90, P95, P99), queue decomposition ($R = W_q + D$), utilization profiles, and CSV/JSON export.
5. **`ComparisonStudio.jsx`**: Policy benchmark workbench running multi-policy showdowns across identical seeds with side-by-side metric tables and rankings.

### D. Reusable Visualization Components
- **`NodeGrid.jsx`**: Renders virtual node cards with animated progress bars for vCPU utilization and RAM consumption, active task counts, and waiting queue depth.
- **`TelemetryChart.jsx`**: Custom lightweight SVG line graph plotting CPU utilization, active nodes, throughput, or latency over simulation time.
- **`DecisionLog.jsx`**: Chronological trace explaining why specific nodes were selected or why scaling triggered.
- **`ModelReferenceModal.jsx`**: Modal reference explaining discrete-event assumptions and mathematical formulas.

---

## 3. Step-by-Step Walkthrough: "User Clicks Start Simulation"

Here is what happens inside the React application when a user launches a simulation:

1. **User Action**: The user configures parameters in `WorkloadStudio.jsx` and clicks the **Run Simulation** button.
2. **Form Submission**: `WorkloadStudio` invokes `onRunSimulation(config)`.
3. **App State Updated**: `App.jsx` sets `isRunning = true` and `errorMessage = null`.
4. **API Call**: `App.jsx` calls `createSimulation(config)` in `services/api.js`.
5. **HTTP POST**: A `fetch` request is dispatched to `/api/simulations` with the JSON configuration.
6. **Response Received**: Upon HTTP 201 response, `createSimulation()` returns the simulation record with assigned ID.
7. **Full Record Fetched**: `App.jsx` calls `fetchSimulation(id)` to retrieve complete initial data.
8. **Active Simulation Set**: `setActiveSimulation(fullRecord)` stores the new run.
9. **Simulation List Refreshed**: `setSimulations(updatedList)` adds the run to history.
10. **View Switched**: `setActiveTab('console')` automatically transitions the UI to the **Simulation Console**.
11. **Console Mounts**: `SimulationConsole.jsx` renders `NodeGrid`, `DecisionLog`, and `EventTable` populated with the simulator state.

---

## 4. How Components Receive Their Data

- **How `NodeGrid` Gets Data**:
  `SimulationConsole` reads `simulation.result.nodes` (a list of node objects containing `cpu_util`, `mem_util`, `active_tasks`, `queued_tasks`, and `status`). During scrubbed playback, it reads node states from `simulation.result.snapshots`.
- **How `TelemetryChart` Gets Data**:
  `ResultsAnalytics` and `SimulationConsole` pass `simulation.result.snapshots` (an array of `{ timestamp, cpu_util, mem_util, active_nodes, throughput, avg_latency_ms }`). The chart maps timestamps to the X-axis and metric values to the Y-axis.
- **How `DecisionLog` Gets Data**:
  The C++ engine serializes decision explanations into `simulation.result.decision_trace`. `DecisionLog.jsx` displays these strings chronologically with search filtering.

---

## 5. How to Modify This Module Safely

### Adding a New KPI Card to Results Analytics
1. Open `frontend/src/pages/ResultsAnalytics.jsx`.
2. Locate the Primary KPI Metrics grid (`<div style={{ display: 'grid'... }}>`).
3. Add a new `<MetricCard>` component:
   ```jsx
   <MetricCard
     title="My Custom Metric"
     value={s.my_custom_value.toFixed(2)}
     unit="units"
     subtitle="Brief explanation of metric"
     icon={Activity}
     color="blue"
   />
   ```
4. Verify the property exists in `simulation.result.summary`.
5. Rebuild the frontend: `npm run build`.

---

## 6. Viva Questions on the Frontend

1. **Q: Does the React frontend calculate any simulation metrics?**
   *A: No. The frontend strictly visualizes data produced by the C++ engine. Computing metrics on the frontend would violate the single-source-of-truth architecture and risk display inaccuracies.*
2. **Q: How does the time-scrubber work in the Simulation Console?**
   *A: The C++ engine records discrete telemetry points in `snapshots`. The scrubber slider binds to a `currentTime` state, finding the nearest snapshot record and updating the `NodeGrid` and metrics to reflect that instant.*
3. **Q: Why use custom SVG charts instead of a heavy library like Chart.js or Recharts?**
   *A: Custom SVG line charts eliminate third-party dependencies, reduce bundle size, prevent React version peer-dependency conflicts, and render cleanly in dark console styling.*
