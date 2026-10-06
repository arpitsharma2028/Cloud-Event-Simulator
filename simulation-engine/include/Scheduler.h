#ifndef CLOUD_SIM_SCHEDULER_H
#define CLOUD_SIM_SCHEDULER_H

#include "Event.h"
#include "ResourcePool.h"
#include <string>
#include <vector>
#include <memory>
#include <sstream>
#include <iomanip>

namespace cloudsim {

enum class SchedulerType {
    ROUND_ROBIN,
    LEAST_LOADED,
    PRIORITY_BASED,
    FIRST_FIT
};

inline std::string schedulerTypeToString(SchedulerType type) {
    switch (type) {
        case SchedulerType::ROUND_ROBIN: return "ROUND_ROBIN";
        case SchedulerType::LEAST_LOADED: return "LEAST_LOADED";
        case SchedulerType::PRIORITY_BASED: return "PRIORITY_BASED";
        case SchedulerType::FIRST_FIT: return "FIRST_FIT";
        default: return "ROUND_ROBIN";
    }
}

inline SchedulerType stringToSchedulerType(const std::string& str) {
    if (str == "ROUND_ROBIN") return SchedulerType::ROUND_ROBIN;
    if (str == "LEAST_LOADED") return SchedulerType::LEAST_LOADED;
    if (str == "PRIORITY_BASED") return SchedulerType::PRIORITY_BASED;
    if (str == "FIRST_FIT") return SchedulerType::FIRST_FIT;
    return SchedulerType::ROUND_ROBIN;
}

class Scheduler {
public:
    virtual ~Scheduler() = default;
    virtual SchedulerType getType() const = 0;
    virtual std::string getName() const = 0;

    // Returns node_id of selected node, or -1 if no eligible node can accommodate the request
    virtual int schedule(const Event& task, const ResourcePool& pool, std::string& decision_reason) = 0;
};

// 1. Round Robin Scheduler
class RoundRobinScheduler : public Scheduler {
public:
    SchedulerType getType() const override { return SchedulerType::ROUND_ROBIN; }
    std::string getName() const override { return "Round Robin Scheduler"; }

    int schedule(const Event& task, const ResourcePool& pool, std::string& decision_reason) override {
        auto healthy_nodes = pool.getHealthyNodes();
        if (healthy_nodes.empty()) {
            decision_reason = "No operational nodes available in cluster (cluster down or all nodes failed)";
            return -1;
        }

        size_t n = healthy_nodes.size();
        for (size_t i = 0; i < n; ++i) {
            size_t idx = (current_index_ + i) % n;
            auto candidate = healthy_nodes[idx];
            if (candidate->hasCapacity(task.cpu_req, task.mem_req) || candidate->canQueue()) {
                current_index_ = (idx + 1) % n;
                std::ostringstream ss;
                ss << "Round Robin selected " << candidate->name << " (Index " << idx << "/" << n
                   << "). Node load: " << std::fixed << std::setprecision(1) << candidate->getCpuUtilization()
                   << "% CPU, unallocated: " << (candidate->cpu_capacity - candidate->cpu_used) << " vCPUs, "
                   << (candidate->mem_capacity - candidate->mem_used) << " GB RAM";
                decision_reason = ss.str();
                return candidate->id;
            }
        }

        decision_reason = "Round Robin evaluated all " + std::to_string(n) + " operational nodes: all at max capacity and queue limit";
        return -1;
    }

private:
    size_t current_index_{0};
};

// 2. Least Loaded Scheduler
class LeastLoadedScheduler : public Scheduler {
public:
    SchedulerType getType() const override { return SchedulerType::LEAST_LOADED; }
    std::string getName() const override { return "Least Loaded Scheduler"; }

    int schedule(const Event& task, const ResourcePool& pool, std::string& decision_reason) override {
        auto healthy_nodes = pool.getHealthyNodes();
        if (healthy_nodes.empty()) {
            decision_reason = "No operational nodes available in cluster";
            return -1;
        }

        std::shared_ptr<Node> best_node = nullptr;
        double min_composite_load = 1e9;
        std::ostringstream candidates_ss;
        candidates_ss << "[";

        for (size_t i = 0; i < healthy_nodes.size(); ++i) {
            const auto& node = healthy_nodes[i];
            double load = node->getCompositeUtilization();
            candidates_ss << node->name << ": " << std::fixed << std::setprecision(1) << load << "%";
            if (i + 1 < healthy_nodes.size()) candidates_ss << ", ";

            if (node->hasCapacity(task.cpu_req, task.mem_req) || node->canQueue()) {
                if (load < min_composite_load) {
                    min_composite_load = load;
                    best_node = node;
                }
            }
        }
        candidates_ss << "]";

        if (best_node) {
            std::ostringstream ss;
            ss << "Least Loaded evaluated candidates " << candidates_ss.str()
               << " -> Selected " << best_node->name << " with lowest composite load ("
               << std::fixed << std::setprecision(1) << min_composite_load << "%). Unallocated: "
               << (best_node->cpu_capacity - best_node->cpu_used) << " vCPUs, "
               << (best_node->mem_capacity - best_node->mem_used) << " GB RAM";
            decision_reason = ss.str();
            return best_node->id;
        }

        decision_reason = "Least Loaded evaluated all operational nodes: no node has capacity or queue space";
        return -1;
    }
};

// 3. Priority Based Scheduler
class PriorityScheduler : public Scheduler {
public:
    SchedulerType getType() const override { return SchedulerType::PRIORITY_BASED; }
    std::string getName() const override { return "Priority Based Scheduler"; }

    int schedule(const Event& task, const ResourcePool& pool, std::string& decision_reason) override {
        auto healthy_nodes = pool.getHealthyNodes();
        if (healthy_nodes.empty()) {
            decision_reason = "No operational nodes available in cluster";
            return -1;
        }

        // Phase 1: Prioritize nodes with IMMEDIATE capacity, choosing least loaded
        std::shared_ptr<Node> best_node = nullptr;
        double min_load = 1e9;

        for (const auto& node : healthy_nodes) {
            if (node->hasCapacity(task.cpu_req, task.mem_req)) {
                double load = node->getCompositeUtilization();
                if (load < min_load) {
                    min_load = load;
                    best_node = node;
                }
            }
        }

        if (best_node) {
            std::ostringstream ss;
            ss << "Priority Scheduler: Priority " << task.priority
               << " request granted immediate execution on " << best_node->name
               << " (Unallocated: " << (best_node->cpu_capacity - best_node->cpu_used) << " vCPUs, Load: "
               << std::fixed << std::setprecision(1) << min_load << "%)";
            decision_reason = ss.str();
            return best_node->id;
        }

        // Phase 2: If saturated, place on node with shortest waiting queue
        size_t min_queue = 1e9;
        for (const auto& node : healthy_nodes) {
            if (node->canQueue()) {
                if (node->waiting_queue.size() < min_queue) {
                    min_queue = node->waiting_queue.size();
                    best_node = node;
                }
            }
        }

        if (best_node) {
            std::ostringstream ss;
            ss << "Priority Scheduler: Immediate capacity saturated; queued Priority "
               << task.priority << " task on " << best_node->name
               << " with shortest queue length (" << min_queue << " ahead)";
            decision_reason = ss.str();
            return best_node->id;
        }

        decision_reason = "Priority Scheduler: Cluster fully saturated, all queues at capacity for Priority " + std::to_string(task.priority);
        return -1;
    }
};

// 4. First Fit Scheduler
class FirstFitScheduler : public Scheduler {
public:
    SchedulerType getType() const override { return SchedulerType::FIRST_FIT; }
    std::string getName() const override { return "First Fit Scheduler"; }

    int schedule(const Event& task, const ResourcePool& pool, std::string& decision_reason) override {
        auto healthy_nodes = pool.getHealthyNodes();
        if (healthy_nodes.empty()) {
            decision_reason = "No operational nodes available in cluster";
            return -1;
        }

        // Sequential check (0, 1, 2, ...)
        for (size_t i = 0; i < healthy_nodes.size(); ++i) {
            const auto& node = healthy_nodes[i];
            if (node->hasCapacity(task.cpu_req, task.mem_req)) {
                std::ostringstream ss;
                ss << "First Fit scanned sequentially: Node " << i << " (" << node->name
                   << ") has sufficient unallocated capacity (" << (node->cpu_capacity - node->cpu_used)
                   << " vCPUs, " << (node->mem_capacity - node->mem_used) << " GB RAM free). Allocated immediately.";
                decision_reason = ss.str();
                return node->id;
            }
        }

        // Fallback: Queue on first available node with queue slot
        for (size_t i = 0; i < healthy_nodes.size(); ++i) {
            const auto& node = healthy_nodes[i];
            if (node->canQueue()) {
                std::ostringstream ss;
                ss << "First Fit queued on first available queue slot: " << node->name
                   << " (Queue depth: " << node->waiting_queue.size() << ")";
                decision_reason = ss.str();
                return node->id;
            }
        }

        decision_reason = "First Fit scanned all nodes: insufficient capacity and all queue slots filled";
        return -1;
    }
};

inline std::unique_ptr<Scheduler> createScheduler(SchedulerType type) {
    switch (type) {
        case SchedulerType::ROUND_ROBIN: return std::unique_ptr<Scheduler>(new RoundRobinScheduler());
        case SchedulerType::LEAST_LOADED: return std::unique_ptr<Scheduler>(new LeastLoadedScheduler());
        case SchedulerType::PRIORITY_BASED: return std::unique_ptr<Scheduler>(new PriorityScheduler());
        case SchedulerType::FIRST_FIT: return std::unique_ptr<Scheduler>(new FirstFitScheduler());
        default: return std::unique_ptr<Scheduler>(new RoundRobinScheduler());
    }
}

} // namespace cloudsim

#endif // CLOUD_SIM_SCHEDULER_H
