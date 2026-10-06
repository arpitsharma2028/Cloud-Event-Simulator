# Backend API & Orchestration Service

The backend layer of the Cloud Event Simulator is a hardened Node.js and Express service that orchestrates C++ simulation engine processes, exposes a clean REST API, provides real-time Server-Sent Events (SSE) streaming, and executes multi-policy experimentation benchmarks.

---

## 1. Directory Structure

```
backend/
  ├── src/
  │   ├── index.js             # Express application entrypoint, middleware, static hosting
  │   ├── routes/
  │   │   ├── simulations.js   # POST (execute), GET (list/detail), DELETE, /stream (SSE)
  │   │   ├── presets.js       # GET /api/presets, GET /api/presets/:id
  │   │   └── compare.js       # POST /api/compare, POST /api/compare/experiment
  │   ├── services/
  │   │   ├── simulationService.js # Process spawn, temp file protocol, SSE broadcast, experiments
  │   │   └── presetsService.js    # Pre-configured academic scenarios catalog
  │   └── schemas/
  │       └── simulationSchema.js  # Zod schema definitions with strict parameter bounds
  ├── temp/                    # Isolated directory for temporary IPC configuration & output JSON
  └── tests/
      └── api.test.js          # 7 automated integration tests for health, schema, execution, and compare
```

---

## 2. Core Responsibilities

### A. Process Controller & Inter-Process Communication (IPC)
The backend does not reimplement simulation mechanics in JavaScript; it acts as a controller for the compiled C++ executable:
1. Validates the incoming simulation payload using Zod.
2. Generates an isolated configuration file in `temp/sim_config_<id>.json`.
3. Spawns the native C++ binary (`simulation-engine/bin/cloud_sim_engine.exe`) using `child_process.spawn`. Shell command interpretation is disabled (`shell: false`) to prevent shell injection attacks.
4. Enforces a 45-second wall clock safety timeout; processes exceeding this limit are terminated via `SIGKILL`.
5. Reads standard output NDJSON lines in real time when streaming is requested, broadcasting discrete time-steps to connected browser clients via Server-Sent Events (`/api/simulations/:id/stream`).
6. On process completion, reads the resulting `temp/sim_output_<id>.json`, cleans up temporary files, stores the record in memory, and returns the result to the caller.

### B. Security & Boundary Enforcement
- **Helmet**: Injects standard HTTP security headers (XSS filter, frameguard, noSniff).
- **CORS**: Configured to restrict origin requests.
- **Rate Limiting**: Employs `express-rate-limit` to prevent denial-of-service abuse.
- **Zod Schema Validation**: Enforces numerical bounds on simulation parameters:
  - Duration: $1.0$ to $600.0$ simulation seconds.
  - Initial nodes: $1$ to $32$ nodes.
  - Request rate: $0.1$ to $500.0$ requests per second.
  - vCPU per node: $1.0$ to $128.0$ cores.
  - RAM per node: $1.0$ to $512.0$ GB.
  - Safety caps on spikes and failure schedules.

### C. Multi-Policy Experiment Runner (`/api/compare/experiment`)
Orchestrates automated policy benchmarks:
- Takes a `baseConfig`, an `experimentType` (`SCHEDULING`, `LOAD_BALANCING`, or `AUTOSCALING`), and a fixed PRNG `seed`.
- Executes each algorithm variant consecutively against the exact same seed and workload.
- Computes:
  - `matrix`: Standardized summary metrics across all runs.
  - `metricTable`: Side-by-side metric comparison table with best value highlights.
  - `ranking`: Multi-objective score (0-100) combining SLA compliance, response time, throughput, and cost.
  - `insights`: Academic viva defense explanations of why specific policies outperformed others.

---

## 3. REST API Specification

### Health Check
- `GET /health`
  - Returns `200 OK` with `{ status: "HEALTHY", uptime: ... }`.

### Presets Catalog
- `GET /api/presets`
  - Returns the list of 6 pre-configured academic scenarios (Full Lifecycle, Steady State, Flash Sale, Outage Recovery, Priority Scheduling, Under-Provisioned).
- `GET /api/presets/:id`
  - Returns configuration details for a specific preset ID.

### Simulations
- `POST /api/simulations`
  - Body: Simulation configuration object matching `simulationSchema`.
  - Query parameter: `?stream=true` to enable real-time SSE streaming.
  - Returns `201 Created` with full simulation results and summary.
- `GET /api/simulations`
  - Returns list of all executed simulation records.
- `GET /api/simulations/:id`
  - Returns complete simulation details, node states, scaling logs, and decision traces.
- `GET /api/simulations/:id/stream`
  - Server-Sent Events (SSE) endpoint emitting `step` and `complete` events.
- `DELETE /api/simulations/:id`
  - Removes a simulation record from memory.

### Comparisons & Experiments
- `POST /api/compare`
  - Body: `{ simulationIds: ["id1", "id2", ...] }`
  - Compares existing completed simulation runs.
- `POST /api/compare/experiment`
  - Body: `{ baseConfig: {...}, experimentType: "SCHEDULING", seed: 42 }`
  - Runs a fresh benchmark against identical workload conditions.

---

## 4. Local Execution & Testing

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
node src/index.js
```
The server listens on `http://localhost:5050`.

### Run Backend Integration Test Suite
```bash
npm test
```
Executes all 7 integration tests in `tests/api.test.js`.
