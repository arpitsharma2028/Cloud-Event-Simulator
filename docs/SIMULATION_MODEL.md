# Discrete-Event Simulation Model Specification

This document describes the mathematical and algorithmic simulation model used in the **Cloud Event Simulator**. It details how virtual time advances, how events are scheduled and ordered, how physical capacity is managed, and how metrics are derived.

---

## 1. What is Discrete-Event Simulation (DES)?

In a continuous simulation, time advances in fixed tiny intervals $\Delta t$ (e.g. every millisecond), regardless of whether anything happens. This wastes massive CPU cycles on idle periods and causes discretization errors.

In a **Discrete-Event Simulation (DES)**:
1. The system state only changes when a discrete **Event** occurs.
2. The simulation clock **jumps directly** from the timestamp of the current event to the timestamp of the next earliest event in the event queue.
3. If no event happens between $T=5.0\text{s}$ and $T=15.0\text{s}$, the clock instantly leaps from 5.0 to 15.0 in zero wall-clock time.

```
Continuous Simulation:
[t=0] -> [t=1] -> [t=2] -> [t=3] -> [t=4] -> [t=5]  (Evaluates every tick)

Discrete-Event Simulation:
[t=0: Arrival] --------------> [t=3.2: Complete] ---> [t=8.0: Spike]  (Jumps to next event)
```

---

## 2. The Simulation Clock

The virtual clock is represented as a 64-bit floating-point variable:
```cpp
double current_time_{0.0};
```
- Starts at $0.0$ simulation seconds.
- The clock is strictly monotonic non-decreasing ($t_{k+1} \ge t_k$).
- Real wall-clock time has zero impact on virtual simulation time. Running the engine on an ultra-fast CPU or a slow machine produces the exact same timestamps.

---

## 3. Event Representation & Queue Ordering

### Event Data Structure (`Event.h`)
Each discrete event contains:
```cpp
struct Event {
    uint64_t id;             // Unique monotonically increasing event ID
    double timestamp;        // Simulation time at which this event fires
    EventType type;          // Category of state change
    int priority;            // Task priority (1 = High, 2 = Medium, 3 = Low)
    int node_id;             // Target virtual compute node
    uint64_t task_id;        // Associated workload identifier
    double cpu_req;          // vCPU cores demanded
    double mem_req;          // RAM (GB) demanded
    double duration;         // Task execution duration
    double arrival_time;     // Ingestion timestamp
    double start_time;       // Execution start timestamp
    double completion_time;  // Finish timestamp
    TaskStatus status;       // PENDING, RUNNING, COMPLETED, FAILED, REJECTED
    std::string decision_log;// Explanation string for auditability
};
```

### Deterministic Multi-Criteria Priority Queue (`EventQueue.h`)
The event queue wraps `std::priority_queue`. Because `std::priority_queue` in C++ is a max-heap by default, the comparator `EventComparator::operator()(a, b)` returns `true` if `a` should be popped **after** `b`.

Ordering logic:
1. **Timestamp ($T$)**: Earliest timestamp pops first (`a.timestamp > b.timestamp`).
2. **Priority ($P$)**: Lower integer means higher priority ($P_1 > P_2 > P_3$) (`a.priority > b.priority`).
3. **Causality Precedence Rank**: Tie-breaking when timestamps collide (`getEventTypeCausalityRank(a.type) > getEventTypeCausalityRank(b.type)`).
4. **Deterministic Tie-Breaker**: Unique event ID (`a.id > b.id`).

```
Event Causality Precedence Table (When timestamps are identical):
Rank 0: NODE_FAILURE    (Hardware failure happens before new work starts)
Rank 1: NODE_RECOVERY   (Restored capacity is available for work)
Rank 2: TASK_COMPLETE   (Releases vCPU/RAM before new tasks check capacity)
Rank 3: AUTOSCALE_EVAL  (Evaluates cluster utilization after releases)
Rank 4: WORKLOAD_SPIKE  (Surges arrive)
Rank 5: TASK_START      (Queued work starts in newly freed capacity)
Rank 6: REQUEST_ARRIVAL (New incoming requests are admitted)
Rank 7: METRIC_SAMPLE   (Observes final state for this instant)
```

---

## 4. Virtual Node Capacity & Resource Management

### Virtual Node Model (`Node.h`)
A compute node is modeled with physical limits:
- $C_{\text{cpu}}$: Total vCPU capacity.
- $C_{\text{mem}}$: Total RAM capacity (GB).
- $U_{\text{cpu}}$: Currently allocated vCPU cores ($\sum \tau_{\text{cpu}}$).
- $U_{\text{mem}}$: Currently allocated RAM GB ($\sum \tau_{\text{mem}}$).
- $Q_{\text{limit}}$: Bounded queue limit (e.g. 50 tasks).

### Utilization Formulas
$$\text{CPU Utilization} = \frac{U_{\text{cpu}}}{C_{\text{cpu}}} \times 100\%$$
$$\text{Memory Utilization} = \frac{U_{\text{mem}}}{C_{\text{mem}}} \times 100\%$$
$$\text{Composite Utilization} = (0.60 \times \text{CPU Utilization}) + (0.40 \times \text{Memory Utilization})$$

### Workload Admission Flow
When a task $\tau$ with requirements $(\tau_{\text{cpu}}, \tau_{\text{mem}})$ is assigned to node $N$:

```
                   Is node operational?
                         |
                   +-- No -> Task REJECTED
                   |
                  Yes
                   |
  Does node have spare capacity?
  (cpu_used + tau_cpu <= cpu_cap) AND (mem_used + tau_mem <= mem_cap)
       |                                     |
      Yes                                   No
       |                                     |
  Task starts RUNNING           Is waiting_queue.size() < queue_limit?
  Allocate resources                         |
  Schedule TASK_COMPLETE               +-- Yes -> Enqueue in waiting_queue (PENDING)
                                       |
                                       +-- No  -> Backpressure! Task REJECTED
```

---

## 5. Task Lifecycle & State Transitions

A task transitions through the following discrete state machine:

```
  [REQUEST_ARRIVAL]
          |
     Admitted?
     /        \
   Yes         No (Node queue saturated / cluster offline)
   /             \
Active capacity?  [TaskStatus::REJECTED]
  /            \
Yes             No (Queued in buffer)
 |               |
[TaskStatus::RUNNING] <--- Dequeued when capacity freed
 |
Event during execution?
 |
 |-- Normal finish -----> [TaskStatus::COMPLETED] (Resources released)
 |
 +-- Node crashes ------> [TaskStatus::FAILED] (Evicted by FailureManager)
```

---

## 6. Scheduling Policies

The engine supports four deterministic scheduling algorithms:

### 1. Round Robin (`ROUND_ROBIN`)
- Maintains an integer index `current_index_`.
- For each arrival, inspects the node at `current_index_`.
- Advances `current_index_ = (current_index_ + 1) % N`.
- **Complexity**: $O(1)$ per request.
- **Trade-off**: Fast and uniform, but ignores task duration and resource demands.

### 2. Least Loaded (`LEAST_LOADED`)
- Scans all operational nodes in `ResourcePool`.
- Evaluates composite utilization $0.60 U_{\text{cpu}} + 0.40 U_{\text{mem}}$.
- Dispatches to the node with the lowest current load that can admit the task.
- **Complexity**: $O(N)$ where $N$ is the number of nodes.
- **Trade-off**: Prevents node hotspots and minimizes queuing delay.

### 3. Priority-Based (`PRIORITY_BASED`)
- Checks task priority tier:
  - $P_1$ (High / Mission Critical): Searches for a node with available capacity; grants immediate allocation.
  - $P_2$ (Medium / Interactive): Normal load balancing.
  - $P_3$ (Low / Batch): Only admitted if the target node composite utilization is below $75\%$; queued otherwise.
- **Complexity**: $O(N)$.
- **Trade-off**: Protects mission-critical workloads during high cluster congestion.

### 4. First Fit (`FIRST_FIT`)
- Iterates through the node vector from index 0 to $N-1$.
- Assigns to the very first node where `canAllocate(cpu_req, mem_req)` evaluates to true.
- **Complexity**: $O(N)$ worst case.
- **Trade-off**: Tends to pack work onto earlier nodes, leaving later nodes idle (useful for energy conservation or scale-down).

---

## 7. Autoscaling Mechanism & Cooldown

The autoscaling loop is governed by periodic `AUTOSCALE_EVAL` events (default: every 1.0 or 2.0 simulation seconds).

### Scale-Up Decision
$$\text{Trigger Condition: } U_{\text{cluster\_composite}} > \theta_{\text{up}} \quad \text{AND} \quad (T - T_{\text{last\_scale}}) \ge T_{\text{cooldown}} \quad \text{AND} \quad N < N_{\text{max}}$$
- Adds $\min(\text{step}, N_{\text{max}} - N)$ nodes.
- Updates $T_{\text{last\_scale}} = T$.

### Scale-Down Decision
$$\text{Trigger Condition: } U_{\text{cluster\_composite}} < \theta_{\text{down}} \quad \text{AND} \quad (T - T_{\text{last\_scale}}) \ge T_{\text{cooldown}} \quad \text{AND} \quad N > N_{\text{min}}$$
- Sorts healthy nodes by composite utilization ascending.
- Removes up to `scale_down_step` nodes, draining running tasks and migrating queued work.
- Updates $T_{\text{last\_scale}} = T$.

---

## 8. Failure & Recovery Model

1. **Failure Injection**:
   - `triggerNodeFailure(node_id, current_time)` is invoked.
   - Node status set to `NodeStatus::FAILED`.
   - Running tasks on the node are evicted; `task.status = TaskStatus::FAILED`.
   - Queued tasks are evicted; `task.status = TaskStatus::FAILED`.
   - Metrics collector increments `total_requests_failed` and records eviction.
2. **Recovery Injection**:
   - `triggerNodeRecovery(node_id, current_time)` is invoked.
   - Node status restored to `NodeStatus::HEALTHY`.
   - `cpu_used` and `mem_used` verified reset to 0.0.
   - Node re-added to operational scheduling vector.

---

## 9. Mathematical Metric Formulas

### 1. Latency & Queue Wait Decomposition
$$R = T_{\text{completion}} - T_{\text{arrival}}$$
$$W_q = T_{\text{start}} - T_{\text{arrival}}$$
$$D = T_{\text{completion}} - T_{\text{start}}$$
$$\text{Mathematical Identity: } R = W_q + D$$

### 2. Throughput
$$\Theta = \frac{N_{\text{completed}}}{T_{\text{simulation}}} \quad (\text{requests per second})$$

### 3. Latency Percentiles (P50, P90, P95, P99)
- Collect all completion response times in a vector `std::vector<double> latencies_`.
- Sort vector in ascending order: `std::sort(latencies_.begin(), latencies_.end())`.
- For percentile $P$:
  $$\text{index} = \min\left( \lfloor \frac{P}{100} \times (\text{size} - 1) \rfloor, \text{size} - 1 \right)$$
  - P50 (Median): $P = 50$
  - P90: $P = 90$
  - P95: $P = 95$
  - P99: $P = 99$

### 4. Financial Cost Integration
For each node $n \in \text{Nodes}$ over time slice $\Delta t$:
$$\text{Compute Cost} = \sum_n \left( C_{\text{cpu}}(n) \times \frac{\Delta t}{3600} \times \text{Rate}_{\text{cpu}} \right)$$
$$\text{Memory Cost} = \sum_n \left( C_{\text{mem}}(n) \times \frac{\Delta t}{3600} \times \text{Rate}_{\text{mem}} \right)$$
$$\text{Total Cost} = \text{Compute Cost} + \text{Memory Cost}$$
Default rates: $\text{Rate}_{\text{cpu}} = \$0.048/\text{hr}$, $\text{Rate}_{\text{mem}} = \$0.006/\text{GB-hr}$.

### 5. SLA Compliance
$$\text{SLA Compliance Rate} = \frac{N_{\text{completed}} - N_{\text{violated}}}{N_{\text{completed}}} \times 100\%$$
A request is a violation if $R > \text{sla\_target\_latency\_ms}$.

---

## 10. Determinism & Randomness

All stochastic processes (Poisson inter-arrival intervals, task durations, resource demands) use the C++ standard Mersenne Twister engine:
```cpp
std::mt19937 rng_(config_.seed);
```
- A seed is a 32-bit unsigned integer (e.g. 42 or 12345).
- Two simulation runs initialized with the exact same seed, duration, and workload configuration will generate the exact same random numbers in the exact same sequence.
- Combined with deterministic priority queue ordering, this guarantees **100% byte-for-byte identical output**.
