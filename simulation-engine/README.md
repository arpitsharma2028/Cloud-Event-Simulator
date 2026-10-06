# C++ Discrete-Event Simulation Engine

The core simulation engine of the Cloud Event Simulator is a deterministic discrete-event simulator (DES) written in standard C++14 with zero external dependencies.

It serves as the single source of truth for all cloud infrastructure behavior, resource accounting, scheduling decisions, elasticity transitions, hardware failures, and metrics telemetry.

---

## Navigation
- [System Architecture Specification](../docs/ARCHITECTURE.md)
- [Mathematical Simulation Model](../docs/SIMULATION_MODEL.md)
- [Viva & Technical Interview Guide](../docs/VIVA_AND_INTERVIEW.md)

---

## 1. Directory Structure & Files

```
simulation-engine/
  ├── include/
  │   ├── Event.h              # Event, Task, and Priority data structures
  │   ├── EventQueue.h         # Priority queue with 4-level causality comparator
  │   ├── Node.h               # Virtual compute node model with vCPU/RAM tracking
  │   ├── ResourcePool.h       # Cluster resource pooling and instance lifecycle
  │   ├── Scheduler.h          # Polymorphic schedulers (Round Robin, Least Loaded, Priority, First Fit)
  │   ├── LoadBalancer.h       # Polymorphic load balancers (Round Robin, Least Connections, Weighted)
  │   ├── AutoScaler.h         # Threshold-based horizontal elasticity with cooldown hysteresis
  │   ├── FailureManager.h     # Chaos failure injection, task eviction, and node recovery
  │   ├── MetricsCollector.h   # Telemetry, latencies, cost, and SLA auditing
  │   ├── SimulationEngine.h   # Master DES coordinator and virtual clock loop
  │   └── json_helper.h        # Zero-dependency JSON parser and serializer
  ├── src/
  │   └── main.cpp             # CLI driver (--config, --output, --stream)
  └── bin/
      └── cloud_sim_engine.exe # Compiled native binary
```

---

## 2. Component Breakdown: WHAT, WHY, and HOW

### A. `Event.h`
- **WHAT**: Defines the data structures for events, tasks, priority tiers, and task statuses.
- **WHY**: A discrete-event simulator requires unified records representing state changes over time.
- **HOW**:
  - `EventType`: `REQUEST_ARRIVAL`, `TASK_START`, `TASK_COMPLETE`, `NODE_FAILURE`, `NODE_RECOVERY`, `AUTOSCALE_EVAL`, `METRIC_SAMPLE`, `WORKLOAD_SPIKE`.
  - `TaskPriority`: `HIGH = 1`, `MEDIUM = 2`, `LOW = 3`.
  - `TaskStatus`: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `REJECTED`.
  - `Event`: 64-bit timestamps, CPU demands, memory demands, execution durations, and decision logs.

### B. `EventQueue.h`
- **WHAT**: A deterministic priority queue storing future events ordered chronologically.
- **WHY**: Events must be popped strictly in timestamp order to model causal time progression.
- **HOW**:
  - Wraps `std::priority_queue<Event, std::vector<Event>, EventComparator>`.
  - `EventComparator` enforces four-tier tie-breaking:
    1. Timestamp ($T_a < T_b$)
    2. Priority ($P_1 > P_2 > P_3$)
    3. Causality Rank (`getEventTypeCausalityRank`): `NODE_FAILURE` (0) -> `NODE_RECOVERY` (1) -> `TASK_COMPLETE` (2) -> `AUTOSCALE_EVAL` (3) -> `WORKLOAD_SPIKE` (4) -> `TASK_START` (5) -> `REQUEST_ARRIVAL` (6) -> `METRIC_SAMPLE` (7).
    4. Unique Event ID for deterministic stability.
  - Push complexity: $O(\log N)$. Pop complexity: $O(\log N)$. Peek top: $O(1)$.

### C. `Node.h`
- **WHAT**: Models a virtual compute instance with vCPU, RAM, and queue limits.
- **WHY**: Real servers have finite physical capacity and experience backpressure under saturation.
- **HOW**:
  - Resource counters: `cpu_capacity`, `mem_capacity`, `cpu_used`, `mem_used`.
  - `canAllocate(cpu, mem)`: Checks `(cpu_used + cpu <= cpu_capacity) && (mem_used + mem <= mem_capacity) && isOperational()`.
  - `active_tasks`: `std::unordered_map<uint64_t, Event>` mapping task ID to event.
  - `waiting_queue`: `std::deque<Event>` bounded by `queue_limit`.
  - Backpressure: If capacity is full and `waiting_queue.size() >= queue_limit`, `enqueue()` returns false, triggering rejection.

### D. `ResourcePool.h`
- **WHAT**: Aggregates the cluster of virtual compute nodes.
- **WHY**: Schedulers and autoscalers need cluster-wide inventory and aggregate utilization metrics.
- **HOW**:
  - Stores `std::vector<std::shared_ptr<Node>> nodes_`.
  - Computes average cluster CPU, memory, and composite utilizations.
  - Supports dynamic addition (`addNode`) and graceful draining/removal (`removeNode`).

### E. `Scheduler.h`
- **WHAT**: Algorithmic policies mapping tasks to nodes.
- **WHY**: Efficient cluster operation requires intelligent placement of pending workloads.
- **HOW**:
  - Polymorphic interface with `selectNode(event, pool, candidates)`.
  - Concrete strategies: `RoundRobinScheduler`, `LeastLoadedScheduler`, `PriorityScheduler`, `FirstFitScheduler`.
  - Every decision writes evaluated candidate states and rationales into `event.decision_log`.

### F. `LoadBalancer.h`
- **WHAT**: Ingress traffic distributor across nodes.
- **WHY**: Balances connection volume before or alongside scheduling.
- **HOW**:
  - Concrete strategies: `RoundRobinLoadBalancer`, `LeastConnectionsLoadBalancer`, `WeightedLoadBalancer`.

### G. `AutoScaler.h`
- **WHAT**: Horizontal cluster elasticity controller.
- **WHY**: Adapts cluster capacity to dynamic traffic surges while minimizing cost.
- **HOW**:
  - Evaluates composite utilization $0.60 U_{\text{cpu}} + 0.40 U_{\text{mem}}$ against `scale_up_threshold` and `scale_down_threshold`.
  - Enforces `cooldown_period` to prevent rapid scaling thrashing (flapping).
  - Respects `min_nodes` and `max_nodes` limits.

### H. `FailureManager.h`
- **WHAT**: Chaos engineering outage injector and recovery manager.
- **WHY**: Verifies system resilience under unexpected hardware crashes.
- **HOW**:
  - `triggerNodeFailure()`: Sets status `FAILED`, evicts active tasks as `FAILED`, and drains queues.
  - `triggerNodeRecovery()`: Resets load to 0.0 and restores status `HEALTHY`.

### I. `MetricsCollector.h`
- **WHAT**: Auditing and financial telemetry engine.
- **WHY**: Produces mathematical verification of latency, throughput, cost, and SLA compliance.
- **HOW**:
  - Stores completed latencies in `std::vector<double>` and sorts to extract P50, P90, P95, P99 percentiles.
  - Enforces the identity: $R = W_q + D$ (Response Time = Queue Wait + Execution Duration).
  - Integrates instance cost: $(\text{vCPU-hr} \times \$0.048) + (\text{RAM-GB-hr} \times \$0.006)$.

### J. `SimulationEngine.h`
- **WHAT**: The master discrete-event coordination engine.
- **WHY**: Orchestrates virtual time progression, event dispatching, and output generation.
- **HOW**:
  - Manages the central loop in `run()`.
  - Advances `current_time_` discontinuously.
  - Emits streaming NDJSON progress lines to stdout if `--stream` is enabled.
  - Generates comprehensive output JSON via `exportResultsJson()`.

---

## 3. Class Relationships & Ownership Model

```
SimulationEngine (Owns simulation state)
  |-- EventQueue (std::priority_queue<Event>)
  |-- ResourcePool
  |     └── std::vector<std::shared_ptr<Node>>
  |           ├── active_tasks (std::unordered_map<uint64_t, Event>)
  |           └── waiting_queue (std::deque<Event>)
  |-- std::unique_ptr<Scheduler> (Polymorphic)
  |-- std::unique_ptr<LoadBalancer> (Polymorphic)
  |-- AutoScaler
  |-- FailureManager
  |-- MetricsCollector
  └── std::mt19937 (Seeded PRNG)
```

- **Shared Ownership**: `Node` instances are held via `std::shared_ptr<Node>` so that `ResourcePool`, `Scheduler`, and `LoadBalancer` can reference identical node instances without copying state.
- **Unique Ownership**: Schedulers and load balancers are held via `std::unique_ptr` by `SimulationEngine`.

---

## 4. The Main Simulation Loop (`SimulationEngine::run()`)

```cpp
void SimulationEngine::run() {
    initialize(); // Populates initial nodes, schedules arrival stream, spikes, failures

    while (!event_queue_.empty() && current_time_ < config_.duration) {
        Event current_event = event_queue_.pop();
        current_time_ = current_event.timestamp;

        switch (current_event.type) {
            case EventType::REQUEST_ARRIVAL:
                handleRequestArrival(current_event);
                break;
            case EventType::TASK_START:
                handleTaskStart(current_event);
                break;
            case EventType::TASK_COMPLETE:
                handleTaskComplete(current_event);
                break;
            case EventType::AUTOSCALE_EVAL:
                handleAutoscaleEval(current_event);
                break;
            case EventType::NODE_FAILURE:
                handleNodeFailure(current_event);
                break;
            case EventType::NODE_RECOVERY:
                handleNodeRecovery(current_event);
                break;
            case EventType::METRIC_SAMPLE:
                handleMetricSample(current_event);
                break;
            case EventType::WORKLOAD_SPIKE:
                handleWorkloadSpike(current_event);
                break;
        }

        // If streaming requested, output NDJSON line on stdout for Express SSE
        if (config_.stream_enabled && shouldEmitStep(current_time_)) {
            emitStepNdjson();
        }
    }

    finalize(); // Computes tail percentiles, cost totals, SLA compliance rates
}
```

---

## 5. How to Modify This Module Safely

### Adding a New Scheduling Strategy
1. Open `simulation-engine/include/Scheduler.h`.
2. Create a new class inheriting from `Scheduler`:
   ```cpp
   class MyCustomScheduler : public Scheduler {
   public:
       int selectNode(Event& event, ResourcePool& pool, std::vector<int>& out_candidates) override {
           // Your scheduling logic here
       }
       std::string getName() const override { return "MY_CUSTOM_SCHEDULER"; }
   };
   ```
3. Register the new scheduler in `createScheduler()` inside `Scheduler.h`.
4. Update `simulation-engine/include/Event.h` or `SimulationEngine.h` string mappings.
5. Recompile: `g++ -std=c++14 -O3 simulation-engine/src/main.cpp -o simulation-engine/bin/cloud_sim_engine.exe`.
6. Run unit tests: `tests/test_engine.exe`.

---

## 6. Viva Questions on the C++ Engine

1. **Q: Why use `std::priority_queue` over a sorted `std::vector`?**
   *A: Inserting into a sorted vector requires $O(N)$ element shifts. In a binary heap priority queue, insertion is $O(\log N)$ and popping the minimum is $O(\log N)$, making it significantly faster for large event sets.*
2. **Q: How is memory managed inside the engine?**
   *A: Nodes are managed with `std::shared_ptr`, schedulers with `std::unique_ptr`, and active tasks with STL containers (`unordered_map` and `deque`). No raw manual `new`/`delete` pointers are used, eliminating memory leaks.*
3. **Q: How does the engine prevent division by zero when workload is empty?**
   *A: In `MetricsCollector::generateSummary()`, all metric divisions check if `total_requests_completed > 0` and `total_simulation_time > 0`, safely defaulting to 0.0.*
