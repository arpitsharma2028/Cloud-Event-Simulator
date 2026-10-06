#ifndef CLOUD_SIM_AUTO_SCALER_H
#define CLOUD_SIM_AUTO_SCALER_H

#include "ResourcePool.h"
#include <string>
#include <vector>
#include <sstream>
#include <iomanip>

namespace cloudsim {

struct ScalingEventRecord {
    double timestamp;
    std::string action; // "SCALE_UP" or "SCALE_DOWN"
    int previous_node_count;
    int new_node_count;
    double cluster_cpu_util;
    double cluster_mem_util;
    std::string reason;
};

struct AutoScalerConfig {
    bool enabled{true};
    double scale_up_threshold{75.0};   // e.g. 75% CPU/composite util
    double scale_down_threshold{30.0}; // e.g. 30% CPU/composite util
    double cooldown_period{15.0};      // Cooldown in simulation seconds
    int min_nodes{2};
    int max_nodes{10};
    int scale_up_step{1};
    int scale_down_step{1};
    double default_node_cpu{4.0};
    double default_node_mem{8.0};
};

class AutoScaler {
public:
    AutoScaler(const AutoScalerConfig& config)
        : config_(config), last_scaling_time_(-1000.0) {}

    bool isEnabled() const { return config_.enabled; }
    const AutoScalerConfig& getConfig() const { return config_; }
    const std::vector<ScalingEventRecord>& getHistory() const { return history_; }

    // Evaluates cluster state and performs scaling if thresholds and cooldown are met.
    // Returns true if a scaling action was executed.
    bool evaluate(double current_time, ResourcePool& pool, std::vector<Event>& out_evicted, std::string& out_log) {
        if (!config_.enabled) return false;

        // Check cooldown
        if (current_time - last_scaling_time_ < config_.cooldown_period) {
            return false;
        }

        double cpu_util = pool.getAverageCpuUtilization();
        double mem_util = pool.getAverageMemUtilization();
        double composite_util = (cpu_util * 0.6) + (mem_util * 0.4);
        int current_nodes = static_cast<int>(pool.getOperationalNodeCount());

        // 1. Scale Up Check
        if (composite_util > config_.scale_up_threshold && current_nodes < config_.max_nodes) {
            int to_add = std::min(config_.scale_up_step, config_.max_nodes - current_nodes);
            if (to_add > 0) {
                int old_count = current_nodes;
                for (int i = 0; i < to_add; ++i) {
                    next_node_id_++;
                    std::string node_name = "node-" + std::to_string(next_node_id_);
                    auto new_node = std::make_shared<Node>(next_node_id_, node_name, config_.default_node_cpu, config_.default_node_mem);
                    pool.addNode(new_node);
                }
                int new_count = static_cast<int>(pool.getOperationalNodeCount());
                last_scaling_time_ = current_time;

                std::ostringstream ss;
                ss << "SCALE_UP: Cluster load reached " << std::fixed << std::setprecision(1) << composite_util
                   << "% (Threshold " << config_.scale_up_threshold << "%). Added " << to_add
                   << " node(s). Nodes: " << old_count << " -> " << new_count;
                out_log = ss.str();

                history_.push_back({current_time, "SCALE_UP", old_count, new_count, cpu_util, mem_util, out_log});
                return true;
            }
        }

        // 2. Scale Down Check
        if (composite_util < config_.scale_down_threshold && current_nodes > config_.min_nodes) {
            // Find idle or lowest loaded operational nodes to remove
            auto healthy = pool.getHealthyNodes();
            if (healthy.size() > static_cast<size_t>(config_.min_nodes)) {
                // Sort by composite utilization ascending (least loaded first)
                std::vector<std::shared_ptr<Node>> sorted_nodes = healthy;
                std::sort(sorted_nodes.begin(), sorted_nodes.end(), [](const std::shared_ptr<Node>& a, const std::shared_ptr<Node>& b) {
                    return a->getCompositeUtilization() < b->getCompositeUtilization();
                });

                int to_remove = std::min(config_.scale_down_step, current_nodes - config_.min_nodes);
                int removed_count = 0;
                int old_count = current_nodes;

                for (int i = 0; i < to_remove && i < static_cast<int>(sorted_nodes.size()); ++i) {
                    int remove_id = sorted_nodes[i]->id;
                    if (pool.removeNode(remove_id, out_evicted, current_time)) {
                        removed_count++;
                    }
                }

                if (removed_count > 0) {
                    int new_count = static_cast<int>(pool.getOperationalNodeCount());
                    last_scaling_time_ = current_time;

                    std::ostringstream ss;
                    ss << "SCALE_DOWN: Cluster load dropped to " << std::fixed << std::setprecision(1) << composite_util
                       << "% (Threshold " << config_.scale_down_threshold << "%). Removed " << removed_count
                       << " node(s). Nodes: " << old_count << " -> " << new_count;
                    out_log = ss.str();

                    history_.push_back({current_time, "SCALE_DOWN", old_count, new_count, cpu_util, mem_util, out_log});
                    return true;
                }
            }
        }

        return false;
    }

    void setNextNodeId(int id) {
        next_node_id_ = id;
    }

private:
    AutoScalerConfig config_;
    double last_scaling_time_{-1000.0};
    int next_node_id_{100};
    std::vector<ScalingEventRecord> history_;
};

} // namespace cloudsim

#endif // CLOUD_SIM_AUTO_SCALER_H
