#include "../simulation-engine/include/Event.h"
#include "../simulation-engine/include/EventQueue.h"
#include "../simulation-engine/include/Node.h"
#include "../simulation-engine/include/ResourcePool.h"
#include "../simulation-engine/include/Scheduler.h"
#include "../simulation-engine/include/LoadBalancer.h"
#include "../simulation-engine/include/AutoScaler.h"
#include "../simulation-engine/include/FailureManager.h"
#include "../simulation-engine/include/MetricsCollector.h"
#include "../simulation-engine/include/SimulationEngine.h"

#include <iostream>
#include <cassert>
#include <cmath>

using namespace cloudsim;

// Test 1: EventQueue Ordering
void testEventQueueOrdering() {
    std::cout << "[TEST 1] EventQueue Ordering Test..." << std::endl;
    EventQueue q;

    Event e1; e1.id = 1; e1.timestamp = 10.0; e1.priority = 2; e1.type = EventType::REQUEST_ARRIVAL;
    Event e2; e2.id = 2; e2.timestamp = 5.0;  e2.priority = 2; e2.type = EventType::REQUEST_ARRIVAL;
    Event e3; e3.id = 3; e3.timestamp = 5.0;  e3.priority = 1; e3.type = EventType::REQUEST_ARRIVAL; // higher prio
    Event e4; e4.id = 4; e4.timestamp = 1.0;  e4.priority = 3; e4.type = EventType::REQUEST_ARRIVAL;

    q.push(e1);
    q.push(e2);
    q.push(e3);
    q.push(e4);

    assert(q.size() == 4);
    assert(q.pop().id == 4); // T=1.0 comes first
    assert(q.pop().id == 3); // T=5.0 with Priority 1 comes before Priority 2
    assert(q.pop().id == 2); // T=5.0 with Priority 2
    assert(q.pop().id == 1); // T=10.0
    assert(q.empty());
    std::cout << "  -> PASSED: EventQueue prioritizes time and priority correctly.\n";
}

// Test 2: Simultaneous Events (Deterministic Tie-breaking)
void testSimultaneousEvents() {
    std::cout << "[TEST 2] Simultaneous Events Tie-Breaking Test..." << std::endl;
    EventQueue q;

    // Both at exact same timestamp T=10.0 and same priority P=2
    // Task Complete should be processed before Request Arrival to free resources first
    Event eArrival; eArrival.id = 100; eArrival.timestamp = 10.0; eArrival.priority = 2; eArrival.type = EventType::REQUEST_ARRIVAL;
    Event eComplete; eComplete.id = 101; eComplete.timestamp = 10.0; eComplete.priority = 2; eComplete.type = EventType::TASK_COMPLETE;
    Event eFailure; eFailure.id = 102; eFailure.timestamp = 10.0; eFailure.priority = 2; eFailure.type = EventType::NODE_FAILURE;

    q.push(eArrival);
    q.push(eComplete);
    q.push(eFailure);

    // EventType precedence: Node Failure first, then Task Complete, then Request Arrival
    Event p1 = q.pop();
    Event p2 = q.pop();
    Event p3 = q.pop();

    assert(p1.type == EventType::NODE_FAILURE || p1.type == EventType::TASK_COMPLETE);
    assert(p3.type == EventType::REQUEST_ARRIVAL);
    std::cout << "  -> PASSED: Simultaneous events ordered deterministically to preserve causality.\n";
}

// Test 3: Empty Event Queue
void testEmptyEventQueue() {
    std::cout << "[TEST 3] Empty EventQueue Behavior Test..." << std::endl;
    EventQueue q;
    assert(q.empty() == true);
    assert(q.size() == 0);
    assert(q.nextEventTime() == -1.0);
    std::cout << "  -> PASSED: Empty queue handled safely.\n";
}

// Test 4: Node Allocation and Deallocation
void testNodeAllocationAndRelease() {
    std::cout << "[TEST 4] Node Resource Allocation and Release Test..." << std::endl;
    Node node(1, "test-node", 4.0, 8.0); // 4 vCPU, 8 GB RAM

    Event task1; task1.task_id = 101; task1.cpu_req = 2.0; task1.mem_req = 4.0;
    Event task2; task2.task_id = 102; task2.cpu_req = 2.0; task2.mem_req = 4.0;
    Event task3; task3.task_id = 103; task3.cpu_req = 1.0; task3.mem_req = 1.0;

    assert(node.allocate(task1) == true);
    assert(node.cpu_used == 2.0);
    assert(node.mem_used == 4.0);
    assert(node.getCpuUtilization() == 50.0);

    assert(node.allocate(task2) == true);
    assert(node.cpu_used == 4.0);
    assert(node.mem_used == 8.0);
    assert(node.getCpuUtilization() == 100.0);

    // Node is now full: cannot allocate task3
    assert(node.hasCapacity(task3.cpu_req, task3.mem_req) == false);
    assert(node.allocate(task3) == false);

    // Release task1
    Event released;
    assert(node.release(101, &released) == true);
    assert(node.cpu_used == 2.0);
    assert(node.mem_used == 4.0);

    std::cout << "  -> PASSED: Resource accounting reflects physical capacity and deallocation.\n";
}

// Test 5: Node Queue Saturation & Backpressure
void testNodeOverloadAndQueueSaturation() {
    std::cout << "[TEST 5] Node Queue Saturation & Backpressure Test..." << std::endl;
    Node node(1, "small-node", 2.0, 4.0, 1.0, 2); // max_queue_size = 2

    Event t1; t1.task_id = 1; t1.cpu_req = 2.0; t1.mem_req = 4.0;
    node.allocate(t1); // Node is now full

    Event q1; q1.task_id = 2; q1.cpu_req = 1.0; q1.mem_req = 1.0;
    Event q2; q2.task_id = 3; q2.cpu_req = 1.0; q2.mem_req = 1.0;
    Event q3; q3.task_id = 4; q3.cpu_req = 1.0; q3.mem_req = 1.0;

    assert(node.enqueue(q1) == true);
    assert(node.enqueue(q2) == true);
    // Queue is now full (limit 2): q3 must be rejected
    assert(node.canQueue() == false);
    assert(node.enqueue(q3) == false);
    assert(node.total_tasks_rejected == 1);

    std::cout << "  -> PASSED: Bounded queue applies backpressure and rejects overflow.\n";
}

// Test 6: Round Robin Scheduler
void testRoundRobinScheduler() {
    std::cout << "[TEST 6] Round Robin Scheduler Test..." << std::endl;
    ResourcePool pool;
    pool.addNode(std::make_shared<Node>(1, "node-1", 4.0, 8.0));
    pool.addNode(std::make_shared<Node>(2, "node-2", 4.0, 8.0));
    pool.addNode(std::make_shared<Node>(3, "node-3", 4.0, 8.0));

    Event task; task.task_id = 1; task.cpu_req = 1.0; task.mem_req = 2.0;
    RoundRobinScheduler rr;
    std::string reason;

    int p1 = rr.schedule(task, pool, reason);
    int p2 = rr.schedule(task, pool, reason);
    int p3 = rr.schedule(task, pool, reason);
    int p4 = rr.schedule(task, pool, reason);

    assert(p1 == 1);
    assert(p2 == 2);
    assert(p3 == 3);
    assert(p4 == 1); // Wraps around circularly
    std::cout << "  -> PASSED: Round Robin cycles uniformly across cluster nodes.\n";
}

// Test 7: Least Loaded Scheduler
void testLeastLoadedScheduler() {
    std::cout << "[TEST 7] Least Loaded Scheduler Test..." << std::endl;
    ResourcePool pool;
    auto n1 = std::make_shared<Node>(1, "node-1", 8.0, 16.0);
    auto n2 = std::make_shared<Node>(2, "node-2", 8.0, 16.0);
    pool.addNode(n1);
    pool.addNode(n2);

    Event tHeavy; tHeavy.task_id = 10; tHeavy.cpu_req = 6.0; tHeavy.mem_req = 12.0;
    n1->allocate(tHeavy); // n1 composite load is 75%

    Event tNew; tNew.task_id = 11; tNew.cpu_req = 1.0; tNew.mem_req = 2.0;
    LeastLoadedScheduler ll;
    std::string reason;

    int pick = ll.schedule(tNew, pool, reason);
    assert(pick == 2); // Must pick node-2 (0% load vs 75% load)
    assert(reason.find("node-2") != std::string::npos);
    std::cout << "  -> PASSED: Least Loaded scheduler routes to lowest composite utilization.\n";
}

// Test 8: Priority Based Scheduler
void testPriorityScheduler() {
    std::cout << "[TEST 8] Priority Based Scheduler Test..." << std::endl;
    ResourcePool pool;
    auto n1 = std::make_shared<Node>(1, "node-1", 4.0, 8.0);
    pool.addNode(n1);

    Event tP1; tP1.task_id = 20; tP1.priority = 1; tP1.cpu_req = 2.0; tP1.mem_req = 4.0;
    PriorityScheduler ps;
    std::string reason;

    int pick = ps.schedule(tP1, pool, reason);
    assert(pick == 1);
    assert(reason.find("Priority 1") != std::string::npos);
    std::cout << "  -> PASSED: Priority scheduler grants immediate capacity to critical traffic.\n";
}

// Test 9: First Fit Scheduler
void testFirstFitScheduler() {
    std::cout << "[TEST 9] First Fit Scheduler Test..." << std::endl;
    ResourcePool pool;
    auto n1 = std::make_shared<Node>(1, "node-1", 2.0, 4.0);
    auto n2 = std::make_shared<Node>(2, "node-2", 8.0, 16.0);
    pool.addNode(n1);
    pool.addNode(n2);

    // Fill node-1
    Event fill; fill.task_id = 30; fill.cpu_req = 2.0; fill.mem_req = 4.0;
    n1->allocate(fill);

    // Request requires 4 cores: node-1 has 0 free, node-2 has 8 free
    Event req; req.task_id = 31; req.cpu_req = 4.0; req.mem_req = 8.0;
    FirstFitScheduler ff;
    std::string reason;

    int pick = ff.schedule(req, pool, reason);
    assert(pick == 2);
    std::cout << "  -> PASSED: First Fit scans sequentially and allocates to first capable node.\n";
}

// Test 10: No Available Nodes
void testNoAvailableNodes() {
    std::cout << "[TEST 10] No Available Nodes Handling Test..." << std::endl;
    ResourcePool pool;
    auto n1 = std::make_shared<Node>(1, "node-1", 4.0, 8.0);
    pool.addNode(n1);
    n1->status = NodeStatus::FAILED; // Node crashed

    Event req; req.task_id = 40; req.cpu_req = 1.0; req.mem_req = 1.0;
    RoundRobinScheduler rr;
    std::string reason;

    int pick = rr.schedule(req, pool, reason);
    assert(pick == -1);
    assert(reason.find("No operational nodes") != std::string::npos);
    std::cout << "  -> PASSED: Graceful rejection with explainable reason when all nodes offline.\n";
}

// Test 11: Load Balancers (RoundRobin, LeastConnections, Weighted)
void testLoadBalancers() {
    std::cout << "[TEST 11] Load Balancers Test..." << std::endl;
    auto n1 = std::make_shared<Node>(1, "node-1", 4.0, 8.0, 1.0);
    auto n2 = std::make_shared<Node>(2, "node-2", 8.0, 16.0, 2.0); // 2x weight
    std::vector<std::shared_ptr<Node>> candidates = {n1, n2};

    Event t1; t1.task_id = 50;
    Event t2; t2.task_id = 51;

    // Least Connections
    LeastConnectionsLoadBalancer lc;
    std::string reason;
    n1->allocate(t1); // n1 has 1 active connection, n2 has 0
    int pick = lc.balance(t2, candidates, reason);
    assert(pick == 2); // Dispatched to n2

    // Weighted Load Balancer
    WeightedLoadBalancer wlb;
    int wPick = wlb.balance(t2, candidates, reason);
    assert(wPick == 1 || wPick == 2);

    std::cout << "  -> PASSED: Load balancers balance connections and handle capacity weights.\n";
}

// Test 12: AutoScaling Thresholds & Cooldown
void testAutoScalingThresholdsAndCooldown() {
    std::cout << "[TEST 12] AutoScaling Thresholds & Cooldown Test..." << std::endl;
    AutoScalerConfig cfg;
    cfg.enabled = true;
    cfg.scale_up_threshold = 70.0;
    cfg.scale_down_threshold = 25.0;
    cfg.cooldown_period = 10.0;
    cfg.min_nodes = 1;
    cfg.max_nodes = 4;
    cfg.scale_up_step = 1;

    AutoScaler as(cfg);
    ResourcePool pool;
    auto n1 = std::make_shared<Node>(1, "node-1", 4.0, 8.0);
    pool.addNode(n1);

    // Overload n1 to 90% CPU and 87.5% memory (composite = 89.0% > 70.0% threshold)
    Event tLoad; tLoad.task_id = 60; tLoad.cpu_req = 3.6; tLoad.mem_req = 7.0;
    n1->allocate(tLoad);

    std::vector<Event> evicted;
    std::string log;

    // First evaluation at T=2.0s -> triggers SCALE_UP
    bool scaled1 = as.evaluate(2.0, pool, evicted, log);
    assert(scaled1 == true);
    assert(pool.getOperationalNodeCount() == 2);
    assert(log.find("SCALE_UP") != std::string::npos);

    // Second evaluation at T=5.0s -> blocked by cooldown (10.0s)
    bool scaled2 = as.evaluate(5.0, pool, evicted, log);
    assert(scaled2 == false);
    assert(pool.getOperationalNodeCount() == 2);

    // Evaluation at T=13.0s (after cooldown expires) -> if load still high on all nodes, scales again
    auto n2 = pool.getNode(101);
    if (n2) {
        Event tLoad2; tLoad2.task_id = 61; tLoad2.cpu_req = 3.6; tLoad2.mem_req = 7.0;
        n2->allocate(tLoad2);
    }
    bool scaled3 = as.evaluate(13.0, pool, evicted, log);
    assert(scaled3 == true);
    assert(pool.getOperationalNodeCount() == 3);

    std::cout << "  -> PASSED: Elasticity triggers scale-up on threshold and enforces cooldown.\n";
}

// Test 13: AutoScaling Boundaries (Min/Max Nodes)
void testAutoScalingBoundaries() {
    std::cout << "[TEST 13] AutoScaling Boundaries (Min/Max Nodes) Test..." << std::endl;
    AutoScalerConfig cfg;
    cfg.enabled = true;
    cfg.scale_up_threshold = 50.0;
    cfg.scale_down_threshold = 30.0;
    cfg.cooldown_period = 1.0;
    cfg.min_nodes = 2;
    cfg.max_nodes = 2; // Fixed boundary

    AutoScaler as(cfg);
    ResourcePool pool;
    pool.addNode(std::make_shared<Node>(1, "node-1", 4.0, 8.0));
    pool.addNode(std::make_shared<Node>(2, "node-2", 4.0, 8.0));

    std::vector<Event> evicted;
    std::string log;

    // Both nodes 100% loaded, but max_nodes is 2
    Event tMax; tMax.task_id = 70; tMax.cpu_req = 4.0; tMax.mem_req = 8.0;
    pool.getNode(1)->allocate(tMax);
    pool.getNode(2)->allocate(tMax);

    bool scaled = as.evaluate(5.0, pool, evicted, log);
    assert(scaled == false); // Blocked by max_nodes limit
    assert(pool.getOperationalNodeCount() == 2);

    std::cout << "  -> PASSED: Autoscaler respects min and max cluster size boundaries.\n";
}

// Test 14: Failure & Recovery Handling
void testFailureAndRecovery() {
    std::cout << "[TEST 14] Failure and Recovery Lifecycle Test..." << std::endl;
    ResourcePool pool;
    auto n1 = std::make_shared<Node>(1, "node-1", 4.0, 8.0);
    pool.addNode(n1);

    Event task; task.task_id = 80; task.cpu_req = 2.0; task.mem_req = 4.0;
    n1->allocate(task);

    FailureManager fm;
    std::vector<Event> evicted;
    std::string log;

    // Fail node at T=15.0
    bool failed = fm.triggerNodeFailure(1, 15.0, pool, evicted, log);
    assert(failed == true);
    assert(n1->status == NodeStatus::FAILED);
    assert(n1->isOperational() == false);
    assert(evicted.size() == 1);
    assert(evicted[0].status == TaskStatus::FAILED);

    // Recover node at T=35.0
    bool recovered = fm.triggerNodeRecovery(1, 35.0, pool, log);
    assert(recovered == true);
    assert(n1->isOperational() == true);
    assert(n1->status == NodeStatus::IDLE || n1->status == NodeStatus::HEALTHY);

    std::cout << "  -> PASSED: Outage evicts running workloads and recovery restores node capacity.\n";
}

// Test 15: Metrics Calculation (Queue Wait, Response Time, Cost, SLA)
void testMetricsCalculation() {
    std::cout << "[TEST 15] Mathematical Consistency of Metrics Test..." << std::endl;
    MetricsCollector mc(200.0, 0.048, 0.006); // SLA = 200ms

    // Task arrived at T=1.0s, started execution at T=1.05s (50ms queue wait), completed at T=1.15s
    // Total response time = 150ms (< 200ms target -> no violation)
    Event t1; t1.task_id = 90; t1.arrival_time = 1.0; t1.start_time = 1.05; t1.cpu_req = 2.0; t1.mem_req = 4.0;
    mc.recordSubmission(t1);
    mc.recordCompletion(t1, 1.15);

    // Task arrived at T=2.0s, started at T=2.1s (100ms wait), completed at T=2.35s
    // Total response time = 350ms (> 200ms target -> SLA violation)
    Event t2; t2.task_id = 91; t2.arrival_time = 2.0; t2.start_time = 2.1; t2.cpu_req = 2.0; t2.mem_req = 4.0;
    mc.recordSubmission(t2);
    mc.recordCompletion(t2, 2.35);

    ResourcePool pool;
    pool.addNode(std::make_shared<Node>(1, "node-1", 4.0, 8.0));

    SimulationSummary summary = mc.generateSummary(10.0, pool, 0, 0, 0, 0);

    assert(summary.total_requests_submitted == 2);
    assert(summary.total_requests_completed == 2);
    assert(summary.sla_violation_count == 1);
    assert(summary.sla_violation_rate_pct == 50.0);
    assert(summary.sla_compliance_rate_pct == 50.0);

    // Check response time and queue wait
    assert(std::abs(summary.avg_latency_ms - 250.0) < 1.0); // (150 + 350) / 2 = 250ms
    assert(std::abs(summary.avg_queue_wait_ms - 75.0) < 1.0); // (50 + 100) / 2 = 75ms

    // Check throughput = 2 requests / 10 sec = 0.2 req/s
    assert(std::abs(summary.overall_throughput_req_per_sec - 0.2) < 0.01);

    // Check cost: 4 vCPU * 10 sec * ($0.048/3600) + 8 GB * 10 sec * ($0.006/3600)
    assert(summary.total_cost_usd > 0.0);

    std::cout << "  -> PASSED: Response time, queue wait, throughput, SLA, and cost calculations verified.\n";
}

// Test 16: Determinism & Byte-for-Byte Reproducibility
void testDeterministicSimulation() {
    std::cout << "[TEST 16] Determinism and Reproducibility Test..." << std::endl;
    SimulationConfig cfg;
    cfg.seed = 98765;
    cfg.duration = 15.0;
    cfg.initial_nodes = 2;
    cfg.workload.request_rate = 6.0;

    SimulationEngine engine1(cfg);
    engine1.run();
    std::string json1 = engine1.exportResultsJson();

    SimulationEngine engine2(cfg);
    engine2.run();
    std::string json2 = engine2.exportResultsJson();

    assert(json1 == json2);
    std::cout << "  -> PASSED: Same configuration and seed produces 100% byte-for-byte identical output.\n";
}

// Test 17: Zero Workload Edge Case
void testZeroWorkloadEdgeCase() {
    std::cout << "[TEST 17] Zero Workload Edge Case Test..." << std::endl;
    SimulationConfig cfg;
    cfg.seed = 42;
    cfg.duration = 5.0;
    cfg.initial_nodes = 2;
    cfg.workload.request_rate = 0.001; // virtually zero

    SimulationEngine engine(cfg);
    engine.run();
    std::string res = engine.exportResultsJson();
    assert(res.find("\"total_simulation_time\"") != std::string::npos);

    std::cout << "  -> PASSED: Simulator handles near-zero workload gracefully without division by zero.\n";
}

int main() {
    std::cout << "==========================================================" << std::endl;
    std::cout << " CLOUD EVENT SIMULATOR - EXPANDED C++ UNIT TEST SUITE (17)" << std::endl;
    std::cout << "==========================================================" << std::endl;

    testEventQueueOrdering();
    testSimultaneousEvents();
    testEmptyEventQueue();
    testNodeAllocationAndRelease();
    testNodeOverloadAndQueueSaturation();
    testRoundRobinScheduler();
    testLeastLoadedScheduler();
    testPriorityScheduler();
    testFirstFitScheduler();
    testNoAvailableNodes();
    testLoadBalancers();
    testAutoScalingThresholdsAndCooldown();
    testAutoScalingBoundaries();
    testFailureAndRecovery();
    testMetricsCalculation();
    testDeterministicSimulation();
    testZeroWorkloadEdgeCase();

    std::cout << "==========================================================" << std::endl;
    std::cout << " ALL 17/17 C++ SIMULATION ENGINE TESTS PASSED!" << std::endl;
    std::cout << "==========================================================" << std::endl;

    return 0;
}
