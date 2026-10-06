#include "../simulation-engine/include/Event.h"
#include "../simulation-engine/include/EventQueue.h"
#include "../simulation-engine/include/Node.h"
#include "../simulation-engine/include/ResourcePool.h"
#include "../simulation-engine/include/Scheduler.h"
#include "../simulation-engine/include/LoadBalancer.h"
#include "../simulation-engine/include/AutoScaler.h"
#include "../simulation-engine/include/FailureManager.h"
#include "../simulation-engine/include/SimulationEngine.h"

#include <iostream>
#include <cassert>
#include <cmath>

using namespace cloudsim;

void testEventQueueOrdering() {
    std::cout << "[TEST] Running EventQueue Ordering Test..." << std::endl;
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

void testNodeAllocationAndRelease() {
    std::cout << "[TEST] Running Node Resource Allocation and Release Test..." << std::endl;
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

    // Queue task3
    assert(node.enqueue(task3) == true);
    assert(node.waiting_queue.size() == 1);

    // Release task1
    Event released;
    assert(node.release(101, &released) == true);
    assert(node.cpu_used == 2.0);
    assert(node.mem_used == 4.0);

    std::cout << "  -> PASSED: Node allocation, saturation, queueing, and deallocation work as expected.\n";
}

void testSchedulers() {
    std::cout << "[TEST] Running Schedulers Test..." << std::endl;
    ResourcePool pool;
    auto n1 = std::make_shared<Node>(1, "node-1", 4.0, 8.0);
    auto n2 = std::make_shared<Node>(2, "node-2", 4.0, 8.0);
    pool.addNode(n1);
    pool.addNode(n2);

    Event task; task.task_id = 1; task.cpu_req = 2.0; task.mem_req = 4.0; task.priority = 1;

    // 1. Round Robin
    RoundRobinScheduler rr;
    std::string reason;
    int pick1 = rr.schedule(task, pool, reason);
    int pick2 = rr.schedule(task, pool, reason);
    assert(pick1 != pick2); // Should alternate between node 1 and 2

    // 2. Least Loaded
    n1->allocate(task); // n1 now has 50% load, n2 has 0% load
    LeastLoadedScheduler ll;
    int pick_ll = ll.schedule(task, pool, reason);
    assert(pick_ll == 2); // Must pick node-2 because it is least loaded

    // 3. First Fit
    FirstFitScheduler ff;
    int pick_ff = ff.schedule(task, pool, reason);
    assert(pick_ff == 1 || pick_ff == 2);

    std::cout << "  -> PASSED: Schedulers behave deterministically according to their algorithm.\n";
}

void testLoadBalancers() {
    std::cout << "[TEST] Running Load Balancer Test..." << std::endl;
    auto n1 = std::make_shared<Node>(1, "node-1", 4.0, 8.0, 1.0);
    auto n2 = std::make_shared<Node>(2, "node-2", 8.0, 16.0, 2.0); // 2x weight
    std::vector<std::shared_ptr<Node>> nodes = {n1, n2};

    Event t1; t1.task_id = 1;
    Event t2; t2.task_id = 2;

    LeastConnectionsLoadBalancer lc;
    std::string reason;
    n1->allocate(t1); // n1 has 1 active task, n2 has 0
    int pick = lc.balance(t2, nodes, reason);
    assert(pick == 2); // Must pick n2 (0 active connections)

    std::cout << "  -> PASSED: Load balancers correctly balance traffic.\n";
}

void testFailureAndRecovery() {
    std::cout << "[TEST] Running Failure and Recovery Test..." << std::endl;
    ResourcePool pool;
    auto n1 = std::make_shared<Node>(1, "node-1", 4.0, 8.0);
    pool.addNode(n1);

    Event task; task.task_id = 200; task.cpu_req = 2.0; task.mem_req = 4.0;
    n1->allocate(task);

    FailureManager fm;
    std::vector<Event> evicted;
    std::string log;

    // Fail node at T=10.0
    bool failed = fm.triggerNodeFailure(1, 10.0, pool, evicted, log);
    assert(failed == true);
    assert(n1->status == NodeStatus::FAILED);
    assert(n1->isOperational() == false);
    assert(evicted.size() == 1);
    assert(evicted[0].status == TaskStatus::FAILED);

    // Recover node at T=20.0
    bool recovered = fm.triggerNodeRecovery(1, 20.0, pool, log);
    assert(recovered == true);
    assert(n1->isOperational() == true);

    std::cout << "  -> PASSED: Failure marks node unoperational, evicts tasks, and recovery restores it.\n";
}

void testDeterministicSimulation() {
    std::cout << "[TEST] Running Determinism and Reproducibility Test..." << std::endl;
    SimulationConfig cfg;
    cfg.seed = 12345;
    cfg.duration = 20.0;
    cfg.initial_nodes = 2;
    cfg.workload.request_rate = 5.0;

    SimulationEngine engine1(cfg);
    engine1.run();
    std::string json1 = engine1.exportResultsJson();

    SimulationEngine engine2(cfg);
    engine2.run();
    std::string json2 = engine2.exportResultsJson();

    assert(json1 == json2);
    std::cout << "  -> PASSED: Same configuration and seed produces 100% byte-for-byte identical output.\n";
}

int main() {
    std::cout << "========================================" << std::endl;
    std::cout << " CLOUD EVENT SIMULATOR - C++ UNIT TESTS" << std::endl;
    std::cout << "========================================" << std::endl;

    testEventQueueOrdering();
    testNodeAllocationAndRelease();
    testSchedulers();
    testLoadBalancers();
    testFailureAndRecovery();
    testDeterministicSimulation();

    std::cout << "========================================" << std::endl;
    std::cout << " ALL C++ ENGINE TESTS PASSED (6/6)!" << std::endl;
    std::cout << "========================================" << std::endl;

    return 0;
}
