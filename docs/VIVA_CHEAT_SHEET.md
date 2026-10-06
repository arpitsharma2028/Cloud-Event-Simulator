# Viva Examination Cheat Sheet (15-Minute Revision)

Quick-reference review sheet for academic viva examinations and technical interviews. Read this 15-20 minutes before your examination.

---

## 1. System Architecture at a Glance

```
React 18 Dashboard  <==== HTTP REST / SSE ====>  Node.js / Express  <==== Child Process IPC ====>  C++ Native Engine (DES)
(Visualization/UI)                                (Controller/API)                                    (Source of Truth)
```

- **Frontend**: React 18, Vite, custom CSS. No business or simulation logic.
- **Backend**: Express on port 5050. Zod input validation, Helmet, CORS, Rate limiting, 45s safety watchdog timer.
- **Engine**: C++14 native binary (`cloud_sim_engine.exe`). Priority queue, virtual clock, deterministic PRNG.

---

## 2. Core Execution Loop

```
Event Ingestion -> PriorityQueue -> Pop Earliest -> Advance Clock -> Dispatch (Scheduler/LB) -> Allocate vCPU/RAM -> Task Complete -> Metrics
```

- Time advances **discontinuously** (leaps from event timestamp to event timestamp).
- When timestamps collide, **Causality Rank** orders them:
  `Failure (0)` -> `Recovery (1)` -> `Task Complete (2)` -> `Autoscale (3)` -> `Spike (4)` -> `Task Start (5)` -> `Arrival (6)` -> `Sample (7)`.

---

## 3. Implemented Algorithms & Complexities

| Category | Algorithm | Time Complexity | How It Decides |
| :--- | :--- | :--- | :--- |
| **Scheduler** | **Round Robin** | $O(1)$ | Advances pointer `(index + 1) % N` sequentially across healthy nodes. |
| **Scheduler** | **Least Loaded** | $O(N)$ | Picks node with lowest composite load: $0.60 \cdot U_{\text{cpu}} + 0.40 \cdot U_{\text{mem}}$. |
| **Scheduler** | **Priority-Based** | $O(N)$ | Grants immediate capacity to P1 Critical tasks; queues P3 Batch tasks if load $> 75\%$. |
| **Scheduler** | **First Fit** | $O(N)$ | Scans nodes $0 \dots N-1$; assigns to first node with spare vCPU and RAM. |
| **Load Balancer** | **Round Robin** | $O(1)$ | Alternates connection targets across healthy nodes. |
| **Load Balancer** | **Least Connections**| $O(N)$ | Dispatches to node with fewest active + queued tasks. |
| **Load Balancer** | **Weighted** | $O(N)$ | Routes proportionally to node capacity weight ($10 \cdot \text{cpu} + 5 \cdot \text{mem}$). |

---

## 4. Key Mathematical Formulas

1. **Response Time (Latency)**:
   $$R = T_{\text{completion}} - T_{\text{arrival}} = \text{Queue Wait } (W_q) + \text{Execution Duration } (D)$$
2. **Queue Waiting Time**:
   $$W_q = T_{\text{start}} - T_{\text{arrival}}$$
3. **Throughput**:
   $$\Theta = \frac{\text{Total Completed Requests}}{\text{Total Simulation Seconds}} \quad (\text{req/s})$$
4. **Little's Law**:
   $$L = \lambda \cdot W \quad (\text{Concurrency} = \text{Arrival Rate} \times \text{Residence Time})$$
5. **Composite Node Utilization**:
   $$U_{\text{comp}} = (0.60 \cdot U_{\text{cpu}}) + (0.40 \cdot U_{\text{mem}})$$
6. **SLA Compliance Rate**:
   $$\text{SLA Compliance \%} = \frac{\text{Completed Requests} - \text{Violations}}{\text{Completed Requests}} \times 100\%$$
   *(Violation occurs when $R > \text{sla\_target\_latency\_ms}$)*
7. **Simulated Instance Cost**:
   $$\text{Cost} = (\text{vCPU-hours} \times \$0.048) + (\text{RAM-GB-hours} \times \$0.006)$$

---

## 5. Elasticity & Failure Parameters

- **Autoscaling Scale-Up**: Triggered when $U_{\text{composite}} > \text{scale\_up\_threshold}$ (e.g. 70%) AND cooldown expired AND nodes $< \text{max\_nodes}$.
- **Autoscaling Scale-Down**: Triggered when $U_{\text{composite}} < \text{scale\_down\_threshold}$ (e.g. 28%) AND cooldown expired AND nodes $> \text{min\_nodes}$.
- **Cooldown Hysteresis**: Deadband time window (e.g. 10s) blocking subsequent scaling to eliminate flapping/thrashing.
- **Node Failure**: Transitions node to `FAILED`, evicts active tasks as `FAILED`, and bypasses node.
- **Node Recovery**: Restores node to `HEALTHY`, clears load to 0.0, and re-adds to active pool.
- **Backpressure**: When active capacity is full AND waiting queue reaches `queue_limit`, incoming tasks are rejected (`TaskStatus::REJECTED`).

---

## 6. Top 30 Rapid-Fire Viva Questions & Answers

1. **Q: What is this project?**
   *A: A discrete-event cloud behavior simulation platform modeling scheduling, elasticity, and fault tolerance.*
2. **Q: Does it provision real AWS or Azure VMs?**
   *A: No. It simulates virtual compute instances and discrete workload arrivals entirely in software.*
3. **Q: Why is simulation logic written in C++?**
   *A: For deterministic performance, cache locality in priority queues, and zero garbage-collection pauses.*
4. **Q: Why not run the C++ simulation directly in the browser using WebAssembly?**
   *A: The Node backend decouples execution, enforces security, and supports headless testing and background scaling.*
5. **Q: What is a discrete-event simulation?**
   *A: A simulation where the clock leaps directly from event timestamp to event timestamp.*
6. **Q: What data structure powers the event queue?**
   *A: A min-heap priority queue (`std::priority_queue`) with a custom multi-criteria comparator.*
7. **Q: What tie-breaking rule handles simultaneous events?**
   *A: A causality rank: failures (0) and completions (2) process before arrivals (6) at the exact same instant.*
8. **Q: How does the engine achieve determinism?**
   *A: It uses the Mersenne Twister PRNG (`std::mt19937`) initialized with an explicit user seed.*
9. **Q: What is the difference between scheduling and load balancing?**
   *A: Load balancing distributes ingress connections; scheduling maps pending tasks to CPU/RAM hardware slices.*
10. **Q: How does Least Loaded calculate load?**
    *A: Using composite utilization: $0.60 \times \text{CPU Utilization} + 0.40 \times \text{RAM Utilization}$.*
11. **Q: Why not use 100% CPU for Least Loaded?**
    *A: Because memory-heavy tasks would overflow node RAM while CPU load appeared low.*
12. **Q: What is backpressure?**
    *A: Rejecting new requests when both active compute and bounded waiting buffers are saturated.*
13. **Q: What happens when a node fails?**
    *A: The node is marked FAILED; all executing tasks are evicted as FAILED; new traffic bypasses the node.*
14. **Q: What happens when a node recovers?**
    *A: Node status returns to HEALTHY, load counters reset to 0.0, and the node re-enters the active pool.*
15. **Q: What is autoscaling cooldown?**
    *A: A mandatory quiet period after scaling that prevents rapid oscillatory thrashing.*
16. **Q: What is the mathematical identity for response time?**
    *A: $\text{Response Time} = \text{Queue Wait Time} + \text{Execution Duration}$ ($R = W_q + D$).*
17. **Q: How is throughput calculated?**
    *A: Total completed requests divided by total simulation wall seconds.*
18. **Q: What is an SLA violation?**
    *A: Any completed request whose total response time exceeds `sla_target_latency_ms`.*
19. **Q: What is idle waste cost?**
    *A: Money spent paying for provisioned node capacity that sat idle without running workloads.*
20. **Q: How does Node communicate with C++?**
    *A: Node writes a temp JSON config, spawns the binary via `child_process.spawn`, reads stdout NDJSON, and reads output JSON.*
21. **Q: Why use Server-Sent Events (SSE)?**
    *A: Because simulation telemetry is unidirectional from server to client; SSE is simpler than WebSockets.*
22. **Q: How does the backend prevent shell injection?**
    *A: It uses `child_process.spawn()` with an argument array and `shell: false`.*
23. **Q: How does the backend prevent runaway infinite loops?**
    *A: A 45-second wall-clock safety watchdog timer kills the child process via `SIGKILL`.*
24. **Q: What does the Comparison Studio do?**
    *A: Runs the exact same workload and seed across multiple policies for side-by-side benchmarking.*
25. **Q: How are policy rankings calculated?**
    *A: A composite score (0-100) weighting SLA compliance (35%), latency (25%), throughput (20%), and cost (20%).*
26. **Q: What happens if an empty queue is popped?**
    *A: `EventQueue::empty()` checks prevent popping; `nextEventTime()` safely returns -1.0.*
27. **Q: How are latency percentiles (P95, P99) calculated?**
    *A: All completion response times are stored in a vector, sorted ascending, and indexed at $\lfloor 0.95 \times (N-1) \rfloor$.*
28. **Q: What is the primary limitation of this simulator?**
    *A: It models abstract compute/memory capacities rather than physical OS kernel drivers or real network packets.*
29. **Q: How would you scale this to 100,000 simulations?**
    *A: Decouple the API with an SQS/RabbitMQ queue and run containerized C++ worker engines on Kubernetes.*
30. **Q: How is determinism verified in your tests?**
    *A: Test 16 runs two independent engines with seed 98765 and asserts their output JSON strings match byte-for-byte.*
