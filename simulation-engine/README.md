# C++ Discrete-Event Simulation Engine

The core simulation engine of the Cloud Event Simulator is a high-performance, deterministic discrete-event simulator (DES) written in standard C++14 with zero external third-party dependencies.

It serves as the single source of truth for all cloud infrastructure behavior, resource accounting, scheduling decisions, elasticity transitions, hardware failures, and metrics telemetry.

---

## 1. Directory Structure

```
simulation-engine/
  ├── include/
  │   ├── Event.h              # Event, Task, and Priority definitions
  │   ├── EventQueue.h         # Deterministic priority queue with causality tie-breaking
  │   ├── Node.h               # Virtual compute node model with vCPU, RAM, and bounded queue
  │   ├── ResourcePool.h       # Cluster resource pooling and instance lifecycle management
  │   ├── Scheduler.h          # Polymorphic scheduling algorithms (Round Robin, Least Loaded, Priority, First Fit)
  │   ├── LoadBalancer.h       # Polymorphic load balancers (Round Robin, Least Connections, Weighted)
  │   ├── AutoScaler.h         # Threshold-based horizontal elasticity with cooldown hysteresis
  │   ├── FailureManager.h     # Chaos failure injection, task eviction, and node recovery
  │   ├── MetricsCollector.h   # Telemetry time-series, latency percentiles, cost, and SLA auditing
  │   ├── SimulationEngine.h   # Master DES coordinator and virtual clock loop
  │   └── json_helper.h        # Lightweight, zero-dependency JSON parser and serializer
  ├── src/
  │   └── main.cpp             # CLI entrypoint supporting file config, file output, and NDJSON streaming
  └── bin/
      └── cloud_sim_engine.exe # Compiled native x64 binary
```

---

## 2. Core Modules & Responsibilities

### `Event.h`
Defines the discrete events that drive simulation state changes:
- `REQUEST_ARRIVAL`: Ingestion of an incoming task with required vCPU, RAM, duration, and priority (P1 High, P2 Medium, P3 Low).
- `TASK_START`: Dispatches a queued task into active execution on an assigned node.
- `TASK_COMPLETE`: Workload finished; releases reserved vCPU and RAM back to the node pool.
- `NODE_FAILURE`: Simulates a sudden node crash, evicting all active workloads with status `FAILED`.
- `NODE_RECOVERY`: Restores a crashed node back to operational health with clean zero utilization.
- `AUTOSCALE_EVAL`: Periodically evaluates cluster composite load against scale-up/scale-down thresholds.
- `WORKLOAD_SPIKE`: Injects temporary traffic surges into the arrival queue.
- `METRIC_SAMPLE`: Captures instantaneous cluster metrics (utilization, active tasks, queue depth, cost rate).

### `EventQueue.h`
Implements a min-priority queue over `Event` records using `std::priority_queue`.
To maintain causality when multiple events share the exact same timestamp, `EventComparator` applies a strict four-level ordering:
1. **Timestamp**: Smaller timestamp processed first ($T_a < T_b$).
2. **Task Priority**: Higher priority tier processed first ($P_1 > P_2 > P_3$).
3. **Causality Rank (`getEventTypeCausalityRank`)**:
   - `NODE_FAILURE` (Rank 0): Hardware crashes occur first.
   - `NODE_RECOVERY` (Rank 1): Rebooted node capacity is restored.
   - `TASK_COMPLETE` (Rank 2): Tasks deallocate resources, freeing capacity before new work is evaluated.
   - `AUTOSCALE_EVAL` (Rank 3): Elasticity evaluations observe the updated cluster state.
   - `WORKLOAD_SPIKE` (Rank 4): Traffic surges trigger.
   - `TASK_START` (Rank 5): Tasks waiting in node queues start.
   - `REQUEST_ARRIVAL` (Rank 6): New arrivals are admitted.
   - `METRIC_SAMPLE` (Rank 7): State telemetry recorded.
4. **Deterministic Tie-Breaker**: Lexicographical order by unique event ID.

### `Node.h`
Models an individual virtual compute instance:
- Tracks total and allocated `cpu_capacity` (vCPUs) and `mem_capacity` (GB).
- Computes instantaneous CPU utilization: `(cpu_used / cpu_capacity) * 100%`.
- Computes instantaneous Memory utilization: `(mem_used / mem_capacity) * 100%`.
- Computes composite utilization: `(0.60 * cpu_util) + (0.40 * mem_util)`.
- Maintains active executing tasks (`active_tasks`) and a bounded waiting queue (`waiting_queue`).
- Enforces backpressure: When active capacity is full and `waiting_queue.size() >= node_queue_limit`, incoming tasks are rejected with status `REJECTED`.

### `ResourcePool.h`
Maintains the cluster topology:
- Aggregates operational nodes, healthy nodes, and offline nodes.
- Computes aggregate cluster-wide CPU, memory, and composite utilizations.
- Handles dynamic addition (`addNode`) and removal/drain (`removeNode`) of instances.

### `Scheduler.h`
Abstract base class `Scheduler` with four concrete algorithmic implementations:
- **`RoundRobinScheduler`**: Cycles deterministically across eligible operational nodes using an internal cursor.
- **`LeastLoadedScheduler`**: Inspects candidate nodes and dispatches to the node with the lowest composite utilization.
- **`PriorityScheduler`**: Evaluates task priority; grants immediate allocation slots to Mission-Critical (P1) tasks while deferring Batch (P3) tasks.
- **`FirstFitScheduler`**: Scans nodes sequentially and allocates to the first node with sufficient unreserved vCPU and RAM.
- *Explainability*: Every scheduling decision writes candidate node IDs, loads, and explicit rationales into the event's `decision_log`.

### `LoadBalancer.h`
Distributes incoming requests before or alongside node schedulers:
- **`RoundRobinLoadBalancer`**: Uniform alternating distribution.
- **`LeastConnectionsLoadBalancer`**: Selects the node executing the fewest active tasks.
- **`WeightedLoadBalancer`**: Routes probabilistically proportional to configured node compute capacities.

### `AutoScaler.h`
Autonomous horizontal elasticity:
- Evaluates composite cluster utilization against `scale_up_threshold` (e.g. 70%) and `scale_down_threshold` (e.g. 28%).
- Enforces `cooldown_period` hysteresis to eliminate oscillation and flapping.
- Respects hard boundaries: `min_nodes` and `max_nodes`.
- Logs all scaling actions with timestamp, old node count, new node count, and reason string.

### `FailureManager.h`
Chaos engineering and resilience:
- Schedules and triggers node outages at exact timestamps.
- Evicts active workloads on failed nodes, marking them `FAILED`.
- Automatically excludes unhealthy nodes from scheduling candidate pools.
- Executes node recovery, clearing failed states and re-adding nodes to the active pool.

### `MetricsCollector.h`
Auditing and financial telemetry:
- Tracks latency percentiles: Minimum, Median (P50), P90, P95, P99, and Maximum.
- Tracks queue wait times: `avg_queue_wait_ms`, `max_queue_wait_ms`, `peak_queue_length`.
- Calculates throughput: `Completed Requests / Total Simulation Time`.
- Computes infrastructure cost: `(vCPU-hours * $0.048) + (RAM-GB-hours * $0.006)`.
- Tracks idle waste: Resource charges accrued while compute capacity was unutilized.
- Evaluates SLA compliance against user-specified target latency (e.g. 250ms).

### `SimulationEngine.h`
The master discrete-event loop:
1. Initializes pseudorandom number generator with user-provided 32-bit seed (`std::mt19937`).
2. Populates initial nodes and schedules request arrivals, spikes, failures, and metric samples.
3. While the event queue is not empty and virtual clock $< \text{duration}$:
   - Pops the next chronological event from `EventQueue`.
   - Advances `current_time_` to event timestamp.
   - Dispatches event to appropriate handler (`handleRequestArrival`, `handleTaskComplete`, `handleNodeFailure`, etc.).
   - Emits optional streaming NDJSON steps to stdout for live SSE client updates.
4. Generates comprehensive structured JSON export containing summary KPIs, timeseries snapshots, node states, scaling history, failure logs, and full decision traces.

---

## 3. Compilation & CLI Usage

### Build Native Binary with MinGW / GCC
```bash
g++ -std=c++14 -O3 simulation-engine/src/main.cpp -o simulation-engine/bin/cloud_sim_engine.exe
```

### CLI Arguments
```text
Usage: cloud_sim_engine [--config <path>] [--output <path>] [--stream]

Options:
  --config <path>    Path to input simulation configuration JSON file
  --output <path>    Path to output results JSON file
  --stream           Emit real-time NDJSON progress events to stdout
```

### Run Simulation via CLI
```bash
./simulation-engine/bin/cloud_sim_engine.exe --config config.json --output results.json
```
