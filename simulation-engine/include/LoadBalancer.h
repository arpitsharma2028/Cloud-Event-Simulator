#ifndef CLOUD_SIM_LOAD_BALANCER_H
#define CLOUD_SIM_LOAD_BALANCER_H

#include "Event.h"
#include "ResourcePool.h"
#include <string>
#include <vector>
#include <memory>
#include <sstream>
#include <iomanip>

namespace cloudsim {

enum class LoadBalancerType {
    ROUND_ROBIN,
    LEAST_CONNECTIONS,
    WEIGHTED
};

inline std::string loadBalancerTypeToString(LoadBalancerType type) {
    switch (type) {
        case LoadBalancerType::ROUND_ROBIN: return "ROUND_ROBIN";
        case LoadBalancerType::LEAST_CONNECTIONS: return "LEAST_CONNECTIONS";
        case LoadBalancerType::WEIGHTED: return "WEIGHTED";
        default: return "ROUND_ROBIN";
    }
}

inline LoadBalancerType stringToLoadBalancerType(const std::string& str) {
    if (str == "ROUND_ROBIN") return LoadBalancerType::ROUND_ROBIN;
    if (str == "LEAST_CONNECTIONS") return LoadBalancerType::LEAST_CONNECTIONS;
    if (str == "WEIGHTED") return LoadBalancerType::WEIGHTED;
    return LoadBalancerType::ROUND_ROBIN;
}

class LoadBalancer {
public:
    virtual ~LoadBalancer() = default;
    virtual LoadBalancerType getType() const = 0;
    virtual std::string getName() const = 0;

    // Distributes request among eligible candidates
    virtual int balance(const Event& task, const std::vector<std::shared_ptr<Node>>& candidates, std::string& decision_reason) = 0;
};

// 1. Round Robin Load Balancer
class RoundRobinLoadBalancer : public LoadBalancer {
public:
    LoadBalancerType getType() const override { return LoadBalancerType::ROUND_ROBIN; }
    std::string getName() const override { return "Round Robin Load Balancer"; }

    int balance(const Event& task, const std::vector<std::shared_ptr<Node>>& candidates, std::string& decision_reason) override {
        if (candidates.empty()) {
            decision_reason = "No candidate nodes supplied to Load Balancer";
            return -1;
        }

        size_t idx = current_index_ % candidates.size();
        current_index_ = (idx + 1) % candidates.size();
        auto target = candidates[idx];

        std::ostringstream ss;
        ss << "LB [Round Robin]: Dispatched task #" << task.task_id << " to " << target->name
           << " (Active: " << target->active_tasks.size() << ", Util: "
           << std::fixed << std::setprecision(1) << target->getCompositeUtilization() << "%)";
        decision_reason = ss.str();
        return target->id;
    }

private:
    size_t current_index_{0};
};

// 2. Least Connections Load Balancer
class LeastConnectionsLoadBalancer : public LoadBalancer {
public:
    LoadBalancerType getType() const override { return LoadBalancerType::LEAST_CONNECTIONS; }
    std::string getName() const override { return "Least Connections Load Balancer"; }

    int balance(const Event& task, const std::vector<std::shared_ptr<Node>>& candidates, std::string& decision_reason) override {
        if (candidates.empty()) {
            decision_reason = "No candidate nodes supplied to Load Balancer";
            return -1;
        }

        std::shared_ptr<Node> selected = nullptr;
        size_t min_connections = 1e9;

        for (const auto& node : candidates) {
            size_t conns = node->active_tasks.size();
            if (conns < min_connections) {
                min_connections = conns;
                selected = node;
            }
        }

        if (selected) {
            std::ostringstream ss;
            ss << "LB [Least Connections]: Dispatched to " << selected->name
               << " with lowest active connections (" << min_connections << " active tasks)";
            decision_reason = ss.str();
            return selected->id;
        }

        decision_reason = "Could not identify least connected node";
        return -1;
    }
};

// 3. Weighted Load Balancer
class WeightedLoadBalancer : public LoadBalancer {
public:
    LoadBalancerType getType() const override { return LoadBalancerType::WEIGHTED; }
    std::string getName() const override { return "Weighted Load Balancer"; }

    int balance(const Event& task, const std::vector<std::shared_ptr<Node>>& candidates, std::string& decision_reason) override {
        if (candidates.empty()) {
            decision_reason = "No candidate nodes supplied to Load Balancer";
            return -1;
        }

        // Weighted selection based on node weight (or CPU capacity proportion)
        // Smooth weighted round-robin
        double total_weight = 0.0;
        for (const auto& node : candidates) {
            total_weight += (node->weight > 0.0 ? node->weight : 1.0);
        }

        // If only 1 node, return it
        if (candidates.size() == 1) {
            decision_reason = "LB [Weighted]: Single candidate available: " + candidates[0]->name;
            return candidates[0]->id;
        }

        // Cycle through step counter
        step_counter_++;
        double pick_val = fmod(step_counter_ * 1.61803398875, 1.0) * total_weight; // Golden ratio quasi-random distribution
        double accum = 0.0;
        std::shared_ptr<Node> selected = candidates[0];

        for (const auto& node : candidates) {
            accum += (node->weight > 0.0 ? node->weight : 1.0);
            if (pick_val <= accum) {
                selected = node;
                break;
            }
        }

        std::ostringstream ss;
        ss << "LB [Weighted]: Dispatched to " << selected->name
           << " (Node weight: " << std::fixed << std::setprecision(1) << selected->weight
           << ", Active: " << selected->active_tasks.size() << ")";
        decision_reason = ss.str();
        return selected->id;
    }

private:
    uint64_t step_counter_{0};
};

inline std::unique_ptr<LoadBalancer> createLoadBalancer(LoadBalancerType type) {
    switch (type) {
        case LoadBalancerType::ROUND_ROBIN: return std::unique_ptr<LoadBalancer>(new RoundRobinLoadBalancer());
        case LoadBalancerType::LEAST_CONNECTIONS: return std::unique_ptr<LoadBalancer>(new LeastConnectionsLoadBalancer());
        case LoadBalancerType::WEIGHTED: return std::unique_ptr<LoadBalancer>(new WeightedLoadBalancer());
        default: return std::unique_ptr<LoadBalancer>(new RoundRobinLoadBalancer());
    }
}

} // namespace cloudsim

#endif // CLOUD_SIM_LOAD_BALANCER_H
