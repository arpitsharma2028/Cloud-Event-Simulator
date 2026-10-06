#ifndef CLOUD_SIM_RESOURCE_POOL_H
#define CLOUD_SIM_RESOURCE_POOL_H

#include "Node.h"
#include <vector>
#include <memory>
#include <algorithm>
#include <stdexcept>

namespace cloudsim {

class ResourcePool {
public:
    ResourcePool() = default;

    void addNode(std::shared_ptr<Node> node) {
        if (!node) return;
        nodes_.push_back(node);
    }

    std::shared_ptr<Node> getNode(int node_id) const {
        for (const auto& n : nodes_) {
            if (n->id == node_id) return n;
        }
        return nullptr;
    }

    const std::vector<std::shared_ptr<Node>>& getAllNodes() const {
        return nodes_;
    }

    std::vector<std::shared_ptr<Node>> getHealthyNodes() const {
        std::vector<std::shared_ptr<Node>> result;
        for (const auto& n : nodes_) {
            if (n->isOperational()) {
                result.push_back(n);
            }
        }
        return result;
    }

    bool removeNode(int node_id, std::vector<Event>& out_evicted_tasks, double current_time) {
        for (auto it = nodes_.begin(); it != nodes_.end(); ++it) {
            if ((*it)->id == node_id) {
                // If it has active tasks, evict them
                std::vector<Event> evicted = (*it)->fail(current_time);
                out_evicted_tasks.insert(out_evicted_tasks.end(), evicted.begin(), evicted.end());
                nodes_.erase(it);
                return true;
            }
        }
        return false;
    }

    double getTotalCpuCapacity() const {
        double total = 0.0;
        for (const auto& n : nodes_) {
            if (n->isOperational()) total += n->cpu_capacity;
        }
        return total;
    }

    double getTotalMemCapacity() const {
        double total = 0.0;
        for (const auto& n : nodes_) {
            if (n->isOperational()) total += n->mem_capacity;
        }
        return total;
    }

    double getTotalCpuUsed() const {
        double total = 0.0;
        for (const auto& n : nodes_) {
            if (n->isOperational()) total += n->cpu_used;
        }
        return total;
    }

    double getTotalMemUsed() const {
        double total = 0.0;
        for (const auto& n : nodes_) {
            if (n->isOperational()) total += n->mem_used;
        }
        return total;
    }

    double getAverageCpuUtilization() const {
        double cap = getTotalCpuCapacity();
        if (cap <= 0.0) return 0.0;
        return std::min(100.0, (getTotalCpuUsed() / cap) * 100.0);
    }

    double getAverageMemUtilization() const {
        double cap = getTotalMemCapacity();
        if (cap <= 0.0) return 0.0;
        return std::min(100.0, (getTotalMemUsed() / cap) * 100.0);
    }

    size_t getOperationalNodeCount() const {
        size_t count = 0;
        for (const auto& n : nodes_) {
            if (n->isOperational()) count++;
        }
        return count;
    }

    size_t getTotalNodeCount() const {
        return nodes_.size();
    }

    size_t getTotalActiveTasks() const {
        size_t count = 0;
        for (const auto& n : nodes_) {
            count += n->active_tasks.size();
        }
        return count;
    }

    size_t getTotalQueuedTasks() const {
        size_t count = 0;
        for (const auto& n : nodes_) {
            count += n->waiting_queue.size();
        }
        return count;
    }

private:
    std::vector<std::shared_ptr<Node>> nodes_;
};

} // namespace cloudsim

#endif // CLOUD_SIM_RESOURCE_POOL_H
