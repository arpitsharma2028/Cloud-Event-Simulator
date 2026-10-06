# Backend API & Orchestration Service

The backend of the Cloud Event Simulator is a Node.js and Express service that orchestrates the native C++ simulation engine, validates client requests, provides real-time Server-Sent Events (SSE) streaming, and executes multi-policy experimentation benchmarks.

---

## Navigation
- [System Architecture Specification](../docs/ARCHITECTURE.md)
- [Mathematical Simulation Model](../docs/SIMULATION_MODEL.md)
- [Viva & Technical Interview Guide](../docs/VIVA_AND_INTERVIEW.md)

---

## 1. Directory Structure

```
backend/
  ├── src/
  │   ├── index.js             # Express application setup, security middleware, static hosting
  │   ├── routes/
  │   │   ├── simulations.js   # POST (execute), GET (list/detail), DELETE, /stream (SSE)
  │   │   ├── presets.js       # GET /api/presets, GET /api/presets/:id
  │   │   └── compare.js       # POST /api/compare, POST /api/compare/experiment
  │   ├── services/
  │   │   ├── simulationService.js # Process controller, temp file IPC, SSE broadcast, experiments
  │   │   └── presetsService.js    # Academic preset scenarios catalog
  │   └── schemas/
  │       └── simulationSchema.js  # Zod schema definitions with numerical boundary enforcement
  ├── temp/                    # Isolated directory for temporary IPC configuration and output JSON
  └── tests/
      └── api.test.js          # 7 automated integration tests for health, schema, execution, and compare
```

---

## 2. Core Responsibilities: WHAT, WHY, and HOW

### A. HTTP Web Server & Security (`src/index.js`)
- **WHAT**: Initializes the Express HTTP server on port 5050 and configures global middleware.
- **WHY**: Serves as the gateway for web requests, enforces security headers, controls CORS, and mitigates denial-of-service abuse.
- **HOW**:
  - `helmet()`: Applies standard security headers (`X-Content-Type-Options`, `X-Frame-Options`).
  - `cors()`: Restricts cross-origin requests.
  - `express-rate-limit`: Limits requests to 120 per minute per IP address.
  - `express.static`: Serves the compiled `frontend/dist` React production bundle.

### B. Input Validation (`src/schemas/simulationSchema.js`)
- **WHAT**: Strict schema validation using Zod.
- **WHY**: Untrusted client inputs must never reach process execution or native code without rigorous boundary verification.
- **HOW**:
  - `duration`: $[1.0, 600.0]$ simulation seconds.
  - `initial_nodes`: $[1, 32]$ instances.
  - `request_rate`: $[0.1, 500.0]$ req/s.
  - `node_queue_limit`: $[1, 500]$ tasks.
  - If validation fails, Express halts immediately and returns an HTTP 400 error with descriptive field errors.

### C. C++ Process Controller (`src/services/simulationService.js`)
- **WHAT**: Manages child process spawning, IPC file generation, safety timeouts, and execution cleanup.
- **WHY**: The C++ engine is a separate native binary. The Node controller provides a clean, hardened bridge between web requests and native execution.
- **HOW**:
  - Writes validated configuration to `temp/sim_config_<id>.json`.
  - Spawns executable: `child_process.spawn(ENGINE_PATH, args, { windowsHide: true, shell: false })`.
  - Starts a 45-second watchdog timer: if the process runs longer than 45 seconds, `child.kill('SIGKILL')` terminates it.
  - Reads output JSON from `temp/sim_output_<id>.json`, unlinks temporary files, and stores the record in memory.

### D. Real-Time Streaming Broadcaster (SSE)
- **WHAT**: Broadcasts live discrete-event steps to browser clients using Server-Sent Events.
- **WHY**: Provides instantaneous visual feedback on virtual node loads and event traces as the simulation runs.
- **HOW**:
  - Express endpoint: `GET /api/simulations/:id/stream`.
  - Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
  - Captures C++ stdout chunks, parses NDJSON lines, and emits `event: step`.
  - Upon process exit, emits `event: complete` with summary KPIs and closes the socket.

### E. Multi-Policy Experimentation Engine (`src/services/simulationService.js`)
- **WHAT**: Runs automated benchmark showdowns across policies under identical seeds.
- **WHY**: Essential for scientific evaluation (Round Robin vs Least Loaded vs Priority vs First Fit).
- **HOW**:
  - Implemented in `runExperiment({ baseConfig, experimentType, policies, seed })`.
  - Executes each policy variant sequentially with the exact same PRNG seed and workload.
  - Transposes output into a side-by-side `metricTable`.
  - Computes multi-objective policy rankings (Score 0-100).
  - Generates academic viva defense explanations.

---

## 3. Data Entry & Exit

```
                    [HTTP Client (React)]
                              |
                     JSON Payload (REST)
                              v
             +----------------------------------+
             |    Express Route Handlers        |
             +----------------------------------+
                              |
                  Validated Data Object
                              v
             +----------------------------------+
             |      Zod Schema Validator        |
             +----------------------------------+
                              |
                Writes: temp/sim_config_<id>.json
                              v
             +----------------------------------+
             |    C++ Child Process Spawn       |
             +----------------------------------+
                              |
                 Reads: Stdout NDJSON (Live SSE)
                 Reads: temp/sim_output_<id>.json (Final)
                              v
             +----------------------------------+
             | In-Memory Registry & Formatting  |
             +----------------------------------+
                              |
                    HTTP 201 Response JSON
                    or SSE Stream Events
                              v
                    [HTTP Client (React)]
```

---

## 4. One Complete Request Lifecycle Walkthrough

Trace of: `POST /api/simulations`

1. **Request Received**: Client sends `POST /api/simulations` with a JSON configuration payload.
2. **Rate Limit Checked**: `express-rate-limit` middleware verifies the IP has not exceeded 120 req/min.
3. **Route Invoked**: `src/routes/simulations.js` receives `req.body`.
4. **Schema Validated**: `simulationSchema.parse(req.body)` validates types and numerical boundaries.
5. **ID Generated**: A unique UUID is generated (e.g. `c7a8b9...`).
6. **Config Written**: `fs.writeFileSync('temp/sim_config_c7a8b9.json', ...)` creates the isolated input file.
7. **Process Spawned**: `child_process.spawn(ENGINE_PATH, ['--config', 'temp/sim_config_c7a8b9.json', '--output', 'temp/sim_output_c7a8b9.json'])`.
8. **Watchdog Started**: `setTimeout(..., 45000)` initialized to protect against infinite loops.
9. **Engine Executes**: The native C++ binary runs to completion in ~20 milliseconds.
10. **Exit Handler Fired**: `child.on('close', (code) => { ... })` cancels the timeout, reads the output JSON, deletes both temporary files, caches the run in `simulationRegistry`, and returns `res.status(201).json(record)`.

---

## 5. How to Modify This Module Safely

### Adding a New API Endpoint
1. Open the appropriate route file (e.g. `src/routes/simulations.js` or `src/routes/compare.js`).
2. Define the route handler with `try/catch` and pass errors to `next(err)`.
3. If new input parameters are expected, update `src/schemas/simulationSchema.js` with Zod validation rules.
4. Add an integration test in `backend/tests/api.test.js` to verify expected status codes and error responses.
5. Run tests: `npm test`.

---

## 6. Viva Questions on the Backend

1. **Q: Why use `child_process.spawn()` instead of `child_process.exec()`?**
   *A: `exec()` invokes an operating system shell (`cmd.exe` or `/bin/sh`) and passes arguments as a concatenated string, making it vulnerable to shell command injection. `spawn()` invokes the executable binary directly without a shell, passing arguments as a safe string array.*
2. **Q: What happens if two users run simulations simultaneously?**
   *A: Each simulation receives a unique UUID for its temporary configuration and output files (`sim_config_<uuid>.json`). The two child processes execute in isolated OS process spaces without file collisions.*
3. **Q: Why does the server have a 45-second watchdog timer?**
   *A: To prevent denial-of-service from runaway simulations. If a bug or extreme input causes an infinite loop in the native engine, the watchdog sends `SIGKILL`, cleans up temporary disk files, and returns an error.*
