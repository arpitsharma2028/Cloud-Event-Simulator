#ifndef CLOUD_SIM_NODE_H
#define CLOUD_SIM_NODE_H

#include "Event.h"
#include <string>
#include <vector>
#include <deque>
#include <algorithm>
#include <cmath>

namespace cloudsim {

enum class NodeStatus {
    IDLE,
    HEALTHY,
    BUSY,
    OVERLOADED,
    FAILED,
    RECOVERING
};

inline std::string nodeStatusToString(NodeStatus s) {
    switch (s) {
        case NodeStatus::IDLE: return "IDLE";
        case NodeStatus::HEALTHY: return "HEALTHY";
        case NodeStatus::BUSY: return "BUSY";
        case NodeStatus::OVERLOADED: return "OVERLOADED";
        case NodeStatus::FAILED: return "FAILED";
        case NodeStatus::RECOVERING: return "RECOVERING";
        default: return "UNKNOWN";
    }
}

class Node {
public:
    int id;
    std::string name;
    double cpu_capacity;   // Cores (e.g. 4, 8, 16)
    double mem_capacity;   // GB (e.g. 8, 16, 32)
    double cpu_used{0.0};
    double mem_used{0.0};
    double weight{1.0};    // For weighted load balancing
    int max_queue_size{50}; // Bounded queue for backpressure

    NodeStatus status{NodeStatus::IDLE};
    std::vector<Event> active_tasks;
    std::deque<Event> waiting_queue;

    // Statistics & Telemetry
    uint64_t total_tasks_processed{0};
    uint64_t total_tasks_failed{0};
    uint64_t total_tasks_rejected{0};
    double total_uptime{0.0};
    double total_downtime{0.0};
    double last_status_change_time{0.0};

    Node(int node_id, const std::string& node_name, double cpu, double mem, double node_weight = 1.0, int queue_limit = 50)
        : id(node_id), name(node_name), cpu_capacity(cpu), mem_capacity(mem), weight(node_weight),
          max_queue_size(queue_limit), status(NodeStatus::IDLE) {}

    bool isOperational() const {
        return status != NodeStatus::FAILED && status != NodeStatus::RECOVERING;
    }

    double getCpuUtilization() const {
        if (cpu_capacity <= 0.0) return 0.0;
        return std::min(100.0, (cpu_used / cpu_capacity) * 100.0);
    }

    double getMemUtilization() const {
        if (mem_capacity <= 0.0) return 0.0;
        return std::min(100.0, (mem_used / mem_capacity) * 100.0);
    }

    double getCompositeUtilization() const {
        // Weighted composite: 60% CPU, 40% Memory
        return (getCpuUtilization() * 0.6) + (getMemUtilization() * 0.4);
    }

    bool hasCapacity(double cpu_req, double mem_req) const {
        if (!isOperational()) return false;
        return (cpu_used + cpu_req <= cpu_capacity + 1e-6) &&
               (mem_used + mem_req <= mem_capacity + 1e-6);
    }

    bool canQueue() const {
        if (!isOperational()) return false;
        return static_cast<int>(waiting_queue.size()) < max_queue_size;
    }

    bool allocate(const Event& task) {
        if (!hasCapacity(task.cpu_req, task.mem_req)) {
            return false;
        }
        cpu_used += task.cpu_req;
        mem_used += task.mem_req;
        active_tasks.push_back(task);
        updateDynamicStatus();
        return true;
    }

    bool enqueue(const Event& task) {
        if (!canQueue()) {
            total_tasks_rejected++;
            return false;
        }
        waiting_queue.push_back(task);
        updateDynamicStatus();
        return true;
    }

    bool release(uint64_t task_id, Event* released_task = nullptr) {
        for (auto it = active_tasks.begin(); it != active_tasks.end(); ++it) {
            if (it->task_id == task_id) {
                cpu_used = std::max(0.0, cpu_used - it->cpu_req);
                mem_used = std::max(0.0, mem_used - it->mem_req);
                total_tasks_processed++;
                if (released_task) {
                    *released_task = *it;
                }
                active_tasks.erase(it);
                updateDynamicStatus();
                return true;
            }
        }
        return false;
    }

    std::vector<Event> fail(double current_time) {
        updateTimeTracking(current_time);
        status = NodeStatus::FAILED;
        last_status_change_time = current_time;

        std::vector<Event> evicted_tasks;
        for (auto& task : active_tasks) {
            task.status = TaskStatus::FAILED;
            task.finish_time = current_time;
            task.decision_log = "Failed due to node outage on " + name;
            total_tasks_failed++;
            evicted_tasks.push_back(task);
        }
        active_tasks.clear();

        for (auto& task : waiting_queue) {
            task.status = TaskStatus::FAILED;
            task.finish_time = current_time;
            task.decision_log = "Dropped from waiting queue due to node outage on " + name;
            total_tasks_failed++;
            evicted_tasks.push_back(task);
        }
        waiting_queue.clear();

        cpu_used = 0.0;
        mem_used = 0.0;
        return evicted_tasks;
    }

    void recover(double current_time) {
        updateTimeTracking(current_time);
        status = NodeStatus::IDLE;
        last_status_change_time = current_time;
        cpu_used = 0.0;
        mem_used = 0.0;
        updateDynamicStatus();
    }

    void updateTimeTracking(double current_time) {
        double delta = current_time - last_status_change_time;
        if (delta > 0.0) {
            if (status == NodeStatus::FAILED || status == NodeStatus::RECOVERING) {
                total_downtime += delta;
            } else {
                total_uptime += delta;
            }
        }
    }

    void updateDynamicStatus() {
        if (status == NodeStatus::FAILED || status == NodeStatus::RECOVERING) {
            return;
        }
        if (active_tasks.empty() && waiting_queue.empty()) {
            status = NodeStatus::IDLE;
            return;
        }
        double composite = getCompositeUtilization();
        if (composite >= 90.0 || waiting_queue.size() > 10) {
            status = NodeStatus::OVERLOADED;
        } else if (composite >= 60.0 || !waiting_queue.empty()) {
            status = NodeStatus::BUSY;
        } else {
            status = NodeStatus::HEALTHY;
        }
    }
};

} // namespace cloudsim

#endif // CLOUD_SIM_NODE_H
