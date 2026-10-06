# Viva Examination & Technical Interview Study Guide

This document is an exhaustive technical study guide for academic viva examinations and software engineering technical interviews.

Questions are categorized into five progressive levels of difficulty. For every question, four sections are provided:
1. **Short Answer**: The direct, concise answer for an interviewer (30-45 seconds).
2. **Detailed Explanation**: The deep engineering explanation demonstrating mastery.
3. **Code Location**: The exact files, classes, or methods implementing the concept.
4. **Follow-Up Question**: What a senior interviewer or external examiner will ask next.

---

## Table of Contents
- [Level 1: Basic Project Understanding](#level-1-basic-project-understanding)
- [Level 2: Implementation & Algorithms](#level-2-implementation--algorithms)
- [Level 3: Multi-Tier Architecture & Systems](#level-3-multi-tier-architecture--systems)
- [Level 4: System Design & Scaling](#level-4-system-design--scaling)
- [Level 5: Critical Analysis, Assumptions & Trade-offs](#level-5-critical-analysis-assumptions--trade-offs)

---

## Level 1: Basic Project Understanding

### Q1.1: What is the Cloud Event Simulator?
- **Short Answer**: The Cloud Event Simulator is a discrete-event simulation platform that models the behavior of cloud infrastructure (scheduling, elasticity, resource pooling, and chaos failures) without deploying physical cloud hardware.
- **Detailed Explanation**: In production cloud environments, experimenting with scheduling policies and failure modes is expensive and noisy. This platform models compute nodes as discrete capacity abstractions (vCPU and RAM) and simulates requests, queues, scaling events, and node outages deterministically using a native C++ discrete-event engine.
- **Code Location**: Root project overview; orchestrated by `backend/src/index.js` and `simulation-engine/src/main.cpp`.
- **Follow-Up**: *Does it create real virtual machines on AWS or your local machine?* (Answer: No. It is an algorithmic discrete-event model; capacity and time are simulated in memory.)

### Q1.2: What problem does this project solve?
- **Short Answer**: It solves the problem of cost, nondeterminism, and slow feedback loops when studying and benchmarking cloud infrastructure policies.
- **Detailed Explanation**: Setting up a real multi-node Kubernetes or EC2 cluster to test how Least Loaded scheduling compares to Round Robin during a 200% traffic surge costs real money, takes minutes to provision, and suffers from network jitter. The simulator allows researchers to run the exact same workload against multiple policies with zero cloud bills in under 50 milliseconds.
- **Code Location**: Documented in `README.md`; demonstrated in `frontend/src/pages/ComparisonStudio.jsx`.
- **Follow-Up**: *Why can't you just use mathematical queuing formulas like M/M/c instead of a simulation?* (Answer: Pure analytical formulas break down when dynamic autoscaling, priority preemption, and cascading hardware failures interact simultaneously.)

### Q1.3: What is a "virtual node" in this project?
- **Short Answer**: A virtual node is a C++ class representing a compute server with defined vCPU core capacity, RAM capacity in GB, an active task map, and a bounded waiting queue.
- **Detailed Explanation**: Rather than running a full operating system VM, `Node` tracks physical resource limits. When tasks arrive, the node checks if `cpu_used + task.cpu_req <= cpu_capacity`. If capacity is available, resources are allocated; if full, the task waits in a bounded deque; if the deque is full, backpressure rejects the request.
- **Code Location**: `simulation-engine/include/Node.h` (Class `cloudsim::Node`).
- **Follow-Up**: *What happens to a node's resources when a task finishes?* (Answer: `Node::deallocate()` removes the task ID and immediately restores the exact vCPU and RAM amounts.)

### Q1.4: What is an "event" in discrete-event simulation?
- **Short Answer**: An event is a data structure representing an instantaneous state change in the cloud system at a specific simulation timestamp.
- **Detailed Explanation**: An event encapsulates the timestamp, type, priority, and target node. Key types include `REQUEST_ARRIVAL` (new work enters), `TASK_COMPLETE` (work finishes, freeing resources), `AUTOSCALE_EVAL` (elasticity evaluation), `NODE_FAILURE` (hardware outage), and `METRIC_SAMPLE` (telemetry capture).
- **Code Location**: `simulation-engine/include/Event.h` (Struct `cloudsim::Event`, Enum `cloudsim::EventType`).
- **Follow-Up**: *How does the simulation clock move between events?* (Answer: The clock advances discontinuously by jumping directly from the current event timestamp to the next earliest event timestamp in the priority queue.)

### Q1.5: What is cloud scheduling?
- **Short Answer**: Scheduling is the algorithmic policy that assigns pending tasks to appropriate compute nodes based on resource availability, load balance, or priority.
- **Detailed Explanation**: When requests arrive at the cloud boundary, multiple servers could theoretically handle them. The scheduler evaluates cluster nodes and selects the most appropriate candidate according to its policy (e.g. Round Robin, Least Loaded, Priority, or First Fit).
- **Code Location**: `simulation-engine/include/Scheduler.h`.
- **Follow-Up**: *How does scheduling differ from load balancing?* (Answer: Load balancing distributes incoming network connections across node ingress queues; scheduling decides how tasks waiting in the system are admitted to virtual vCPU and RAM hardware slices.)

---

## Level 2: Implementation & Algorithms

### Q2.1: How does an event move through the priority queue?
- **Short Answer**: Events are inserted into a min-priority queue (`std::priority_queue`). The comparator sorts events chronologically by timestamp, then by priority tier, then by causality precedence rank, and finally by event ID.
- **Detailed Explanation**: When `EventQueue::push()` is called, the element is inserted into the underlying binary heap in $O(\log N)$ time. The engine pops the root element with `EventQueue::pop()`, advances `current_time_` to that timestamp, and calls the corresponding event handler.
- **Code Location**: `simulation-engine/include/EventQueue.h` (`EventComparator` struct).
- **Follow-Up**: *What happens if a task completion and a new arrival share the exact same timestamp $T=10.0$?* (Answer: The causality comparator assigns rank 2 to `TASK_COMPLETE` and rank 6 to `REQUEST_ARRIVAL`. The completion pops first, releasing resources so the new arrival can use them.)

### Q2.2: How does the Least Loaded scheduler calculate node utilization?
- **Short Answer**: It uses a weighted composite formula: $0.60 \times \text{CPU Utilization} + 0.40 \times \text{Memory Utilization}$.
- **Detailed Explanation**: In cloud workloads, computing bottlenecks occur in both processor cores and memory. If routing used CPU alone, a node with 10% CPU usage but 95% RAM usage would receive more work and crash with an out-of-memory error. The 60/40 weighting balances both dimensions, favoring CPU slightly as it is the primary driver of execution latency.
- **Code Location**: `simulation-engine/include/Node.h` (`getCompositeUtilization()`) and `simulation-engine/include/Scheduler.h` (`LeastLoadedScheduler::selectNode()`).
- **Follow-Up**: *What is the time complexity of Least Loaded scheduling?* (Answer: $O(N)$ where $N$ is the number of operational nodes, because it must scan all candidate nodes to find the minimum load.)

### Q2.3: How does the Priority scheduler prevent low-priority task starvation?
- **Short Answer**: It grants immediate execution capacity to Mission-Critical (P1) tasks, but admits Batch (P3) tasks as long as target node composite load remains below 75%.
- **Detailed Explanation**: Priority scheduling protects high-tier service traffic from latency degradation. When a P1 task arrives, the scheduler searches for the healthiest operational node with capacity. P3 batch tasks are permitted to run during off-peak times, but if cluster utilization crosses 75%, P3 tasks are held in node waiting buffers until load drops.
- **Code Location**: `simulation-engine/include/Scheduler.h` (`PriorityScheduler::selectNode()`).
- **Follow-Up**: *What happens if low-priority tasks wait in the queue for too long?* (Answer: Their queue wait time $W_q$ increases, inflating total response time $R = W_q + D$, which may eventually cause an SLA breach.)

### Q2.4: How does the autoscaler decide when to scale up or down?
- **Short Answer**: It evaluates aggregate cluster composite load against configured thresholds (`scale_up_threshold` and `scale_down_threshold`), strictly enforcing a cooldown timer and min/max node boundaries.
- **Detailed Explanation**: During periodic `AUTOSCALE_EVAL` events:
  1. If `composite_util > scale_up_threshold` (e.g. 70%), `nodes < max_nodes`, and `current_time - last_scale >= cooldown`, it provisions new nodes.
  2. If `composite_util < scale_down_threshold` (e.g. 28%), `nodes > min_nodes`, and `current_time - last_scale >= cooldown`, it drains and terminates the lowest-loaded node.
- **Code Location**: `simulation-engine/include/AutoScaler.h` (`AutoScaler::evaluate()`).
- **Follow-Up**: *Why is cooldown hysteresis necessary?* (Answer: It prevents scaling thrashing or flapping, where a system repeatedly adds and removes servers in rapid succession because recent capacity additions have not yet taken effect.)

### Q2.5: What happens internally when a node suffers a catastrophic failure?
- **Short Answer**: The node status transitions to `FAILED`. All running and queued workloads on that node are evicted and marked `TaskStatus::FAILED`, and the node is removed from the scheduler candidate pool.
- **Detailed Explanation**: `FailureManager::triggerNodeFailure()` executes at the scheduled failure timestamp. It marks the node offline, iterates over `node->active_tasks`, records eviction events in the metrics collector, and empties the node queue. Subsequent arrivals bypass the node until a `NODE_RECOVERY` event occurs, which resets the node's load to 0.0 and marks it `HEALTHY`.
- **Code Location**: `simulation-engine/include/FailureManager.h` (`triggerNodeFailure()` and `triggerNodeRecovery()`).
- **Follow-Up**: *Can the evicted tasks be automatically retried on another node?* (Answer: In the current engine, evicted tasks are recorded as failed to audit the impact of the outage. Workload redistribution applies to newly arriving requests; automatic task migration/retry is a planned feature.)

---

## Level 3: Multi-Tier Architecture & Systems

### Q3.1: Why is the architecture split into React, Node.js, and C++ rather than building everything in one language?
- **Short Answer**: Separation of concerns. C++ handles high-throughput deterministic simulation math; Node.js handles network orchestration, validation, and streaming; React handles visualization and user interaction.
- **Detailed Explanation**: Writing an HTTP server, CORS middleware, and a complex dashboard directly in C++ results in brittle, bloated native code. Conversely, running a discrete-event loop with 50,000 priority queue operations in JavaScript suffers from V8 garbage collection pauses and slower execution. Splitting the system gives each layer its optimal tool.
- **Code Location**: Documented in `docs/ARCHITECTURE.md`.
- **Follow-Up**: *Could you replace Node.js with Python or Go?* (Answer: Yes. Any lightweight orchestration layer with HTTP and process control capabilities could manage the C++ binary.)

### Q3.2: How does Node communicate with the C++ process?
- **Short Answer**: Node writes configuration JSON to an isolated temporary file, spawns `cloud_sim_engine.exe` via `child_process.spawn`, reads stdout NDJSON lines for real-time streaming, and reads final results from an output JSON file upon process exit.
- **Detailed Explanation**: This file-and-pipe protocol decouples memory management between processes. Node invokes the binary without a shell (`shell: false`) to prevent command injection, captures stdout chunk buffers, splits lines by newline (`\n`), and broadcasts discrete step events to connected SSE clients.
- **Code Location**: `backend/src/services/simulationService.js` (`executeSimulation()`).
- **Follow-Up**: *Why not pass the entire input configuration through command-line arguments?* (Answer: Command-line string length is constrained by operating system limits, e.g., 8,191 characters on Windows `cmd.exe`. Writing to a temporary file allows arbitrarily complex workload configurations.)

### Q3.3: Why did you use Server-Sent Events (SSE) instead of WebSockets?
- **Short Answer**: Communication during simulation execution is strictly unidirectional: the C++ engine streams progress events to the browser client. SSE is simpler, runs over standard HTTP, and natively supports automatic reconnection.
- **Detailed Explanation**: WebSockets provide full-duplex bidirectional channels, which introduce protocol overhead (handshake upgrades, frame masking, ping/pong keepalives). Because the client only needs to receive time-step updates after initiating a simulation, HTTP-based SSE (`text/event-stream`) is the optimal engineering choice.
- **Code Location**: `backend/src/routes/simulations.js` (`/api/simulations/:id/stream`) and `frontend/src/services/api.js` (`subscribeToSimulationStream()`).
- **Follow-Up**: *When would WebSockets be required in this project?* (Answer: If the user needed to pause, resume, or inject dynamic interactive chaos events into the running C++ engine mid-simulation.)

### Q3.4: How does the backend prevent Denial of Service (DoS) or runaway processes?
- **Short Answer**: Through Zod schema boundary validation, rate limiting (120 req/min), and a 45-second wall-clock safety watchdog timer that terminates runaway C++ processes with `SIGKILL`.
- **Detailed Explanation**: If a user submits an invalid configuration (e.g. duration = -5 or initial_nodes = 99999), Zod rejects the request with HTTP 400 before the C++ process is spawned. If a simulation enters an infinite loop, the 45-second watchdog timer fires, kills the child process, cleans up temporary files, and returns an HTTP 500 error.
- **Code Location**: `backend/src/schemas/simulationSchema.js` and `backend/src/services/simulationService.js`.
- **Follow-Up**: *What prevents a malicious user from injecting shell commands like `& rm -rf /` in the node parameters?* (Answer: The process is spawned using `child_process.spawn()` with an array of arguments, not `child_process.exec()`. Shell interpretation is disabled.)

---

## Level 4: System Design & Scaling

### Q4.1: How would you scale this platform to support 100,000 concurrent simulations?
- **Short Answer**: Decouple the web API from simulation execution by introducing an asynchronous job queue (e.g. AWS SQS or RabbitMQ) and worker pools running containerized C++ engines on Kubernetes.
- **Detailed Explanation**: Currently, Node spawns the C++ binary locally on the host machine. To scale to 100,000 simulations:
  1. The API layer receives requests, validates configurations, writes job specifications to a durable message broker, and returns a Job ID.
  2. A scalable worker pool (e.g. AWS ECS or Kubernetes worker pods) pulls jobs from the queue.
  3. Workers execute the C++ binary inside isolated, resource-constrained containers.
  4. Final results are written to an object store (e.g. AWS S3) and metadata to a database (e.g. PostgreSQL).
  5. Clients receive real-time updates via Redis Pub/Sub connected to a WebSocket/SSE gateway.
- **Code Location**: Theoretical system design question; discussed in `README.md` Section 26.
- **Follow-Up**: *What becomes the primary bottleneck in this distributed design?* (Answer: CPU core contention on worker nodes and message queue throughput.)

### Q4.2: How would you persist historical simulation runs across server restarts?
- **Short Answer**: Replace the in-memory `simulationRegistry` JavaScript Map with an indexed relational database like PostgreSQL or a document store like MongoDB.
- **Detailed Explanation**: Currently, simulation metadata and summary metrics are stored in a JavaScript `Map()` in memory (`backend/src/services/simulationService.js`), meaning restarting the Node server clears history. Persisting records requires writing the JSON result payload to a `simulations` table with columns for `id`, `user_id`, `created_at`, `status`, and indexed fields for `scheduler`, `latency_ms`, and `sla_compliance`.
- **Code Location**: `backend/src/services/simulationService.js` (`simulationRegistry`).
- **Follow-Up**: *Would you store timeseries snapshots in the same relational table?* (Answer: No. Storing thousands of telemetry points per simulation in PostgreSQL would bloat table rows. Summary metrics belong in PostgreSQL; high-resolution timeseries belong in object storage like S3 or a timeseries database like InfluxDB/TimescaleDB.)

---

## Level 5: Critical Analysis, Assumptions & Trade-offs

### Q5.1: What are the fundamental limitations of this simulation model?
- **Short Answer**: It models abstract CPU and RAM capacities rather than physical OS kernel hardware, assumes instantaneous network links without packet drops, and does not simulate disk I/O or multi-region routing.
- **Detailed Explanation**: A competent software engineer understands the boundary of their model:
  - **Networking**: Network transmission delay is modeled as zero or folded into task duration; real cloud systems face TCP retransmissions, MTU limits, and cross-AZ latency.
  - **Memory Contention**: Memory is treated as a flat capacity reserve; real operating systems experience memory paging, cache misses, and swap thrashing.
  - **Instantaneous Provisioning**: Virtual node addition happens quickly in the model; real AWS EC2 instances require 30 to 120 seconds for kernel boot and cloud-init.
- **Code Location**: Documented in `README.md` Section 24 and `docs/SIMULATION_MODEL.md`.
- **Follow-Up**: *Given these limitations, why is the simulator still valuable?* (Answer: It provides a rigorous, controlled environment for comparing algorithmic logic. Relative performance differences between policies like Least Loaded and Round Robin hold true even when absolute cloud latencies differ.)

### Q5.2: How do you mathematically prove that Response Time is consistent in your engine?
- **Short Answer**: Through the mathematical identity $R = W_q + D$. Response time equals the difference between completion timestamp and arrival timestamp, which is proven equal to queue waiting time plus active execution duration.
- **Detailed Explanation**: When a task arrives at $T_{\text{arr}}$, it queues until $T_{\text{start}}$, giving queue wait $W_q = T_{\text{start}} - T_{\text{arr}}$. It runs for duration $D$, completing at $T_{\text{comp}} = T_{\text{start}} + D$. Total response time is $R = T_{\text{comp}} - T_{\text{arr}} = (T_{\text{start}} + D) - T_{\text{arr}} = (T_{\text{start}} - T_{\text{arr}}) + D = W_q + D$. This identity is verified programmatically in Unit Test 15.
- **Code Location**: `simulation-engine/include/MetricsCollector.h` and `tests/test_engine.cpp` (`testMetricsCalculation()`).
- **Follow-Up**: *Under what condition would $W_q$ equal zero?* (Answer: When the assigned node has immediate unallocated capacity for the task's vCPU and RAM requirements upon arrival, allowing execution to start with zero queue delay.)

### Q5.3: Why should an interviewer trust your comparison results over an AI-generated dashboard?
- **Short Answer**: Because every value in our Comparison Studio is produced by the native C++ discrete-event engine executing deterministic event loops from an identical random seed, backed by 17 unit tests verifying resource accounting and determinism.
- **Detailed Explanation**: Many student projects use React state hooks to generate random numbers or fake smooth curves. In this project, if you run Round Robin vs Least Loaded with seed 42, both runs process the exact same sequence of task arrival times, CPU demands, and durations. The differences in throughput, latency, and SLA compliance are 100% attributable to the scheduling policy, not random variations.
- **Code Location**: `backend/src/routes/compare.js` (`/api/compare/experiment`), `tests/test_engine.cpp` (`testDeterministicSimulation()`).
- **Follow-Up**: *How do you prove determinism in code?* (Answer: Unit Test 16 runs two independent `SimulationEngine` instances with seed 98765 and asserts that `engine1.exportResultsJson() == engine2.exportResultsJson()` byte-for-byte.)
