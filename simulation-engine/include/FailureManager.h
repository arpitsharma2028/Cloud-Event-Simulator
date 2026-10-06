#ifndef CLOUD_SIM_FAILURE_MANAGER_H
#define CLOUD_SIM_FAILURE_MANAGER_H

#include "ResourcePool.h"
#include <string>
#include <vector>
#include <sstream>

namespace cloudsim {

struct FailureEventRecord {
    double timestamp;
    int node_id;
    std::string node_name;
    std::string action; // "NODE_FAILURE" or "NODE_RECOVERY"
    size_t affected_tasks_count;
    std::string details;
};

struct ScheduledFailure {
    int node_id;
    double fail_time;
    double recovery_time; // If > fail_time, recovery will be triggered
};

class FailureManager {
public:
    FailureManager() = default;

    void addScheduledFailure(const ScheduledFailure& sf) {
        scheduled_failures_.push_back(sf);
    }

    const std::vector<ScheduledFailure>& getScheduledFailures() const {
        return scheduled_failures_;
    }

    const std::vector<FailureEventRecord>& getHistory() const {
        return history_;
    }

    bool triggerNodeFailure(int node_id, double current_time, ResourcePool& pool, std::vector<Event>& out_evicted, std::string& out_log) {
        auto node = pool.getNode(node_id);
        if (!node) {
            out_log = "Node ID " + std::to_string(node_id) + " not found for failure injection";
            return false;
        }

        if (!node->isOperational()) {
            out_log = "Node " + node->name + " is already non-operational";
            return false;
        }

        out_evicted = node->fail(current_time);

        std::ostringstream ss;
        ss << "NODE_FAILURE: " << node->name << " (ID " << node_id << ") suffered catastrophic failure at T="
           << current_time << "s. Evicted " << out_evicted.size() << " active/queued task(s).";
        out_log = ss.str();

        history_.push_back({current_time, node_id, node->name, "NODE_FAILURE", out_evicted.size(), out_log});
        total_failures_++;
        return true;
    }

    bool triggerNodeRecovery(int node_id, double current_time, ResourcePool& pool, std::string& out_log) {
        auto node = pool.getNode(node_id);
        if (!node) {
            out_log = "Node ID " + std::to_string(node_id) + " not found for recovery";
            return false;
        }

        node->recover(current_time);

        std::ostringstream ss;
        ss << "NODE_RECOVERY: " << node->name << " (ID " << node_id << ") recovered and returned to active pool at T="
           << current_time << "s.";
        out_log = ss.str();

        history_.push_back({current_time, node_id, node->name, "NODE_RECOVERY", 0, out_log});
        total_recoveries_++;
        return true;
    }

    size_t getTotalFailures() const { return total_failures_; }
    size_t getTotalRecoveries() const { return total_recoveries_; }

private:
    std::vector<ScheduledFailure> scheduled_failures_;
    std::vector<FailureEventRecord> history_;
    size_t total_failures_{0};
    size_t total_recoveries_{0};
};

} // namespace cloudsim

#endif // CLOUD_SIM_FAILURE_MANAGER_H
