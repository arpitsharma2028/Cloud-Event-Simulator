#ifndef CLOUD_SIM_METRICS_COLLECTOR_H
#define CLOUD_SIM_METRICS_COLLECTOR_H

#include "Event.h"
#include "ResourcePool.h"
#include <vector>
#include <algorithm>
#include <numeric>
#include <cmath>

namespace cloudsim {

struct MetricSnapshot {
    double timestamp;
    double cpu_utilization;
    double mem_utilization;
    double composite_utilization;
    size_t active_nodes;
    size_t healthy_nodes;
    size_t active_tasks;
    size_t queued_tasks;
    double throughput;       // req/sec in this window
    double avg_latency_ms;   // average latency of recent completions
    double instantaneous_cost_rate; // $/hour
};

struct SimulationSummary {
    double total_simulation_time{0.0};
    uint64_t total_requests_submitted{0};
    uint64_t total_requests_completed{0};
    uint64_t total_requests_failed{0};
    uint64_t total_requests_rejected{0};
    
    // Latencies (ms)
    // Response Time = Queue Waiting Time + Execution Duration
    double min_latency_ms{0.0};
    double max_latency_ms{0.0};
    double avg_latency_ms{0.0};
    double p50_latency_ms{0.0};
    double p90_latency_ms{0.0};
    double p95_latency_ms{0.0};
    double p99_latency_ms{0.0};

    // Queue Waiting Time (ms)
    double avg_queue_wait_ms{0.0};
    double max_queue_wait_ms{0.0};
    size_t peak_queue_length{0};
    double avg_queue_length{0.0};

    // System Throughput (req/sec = completed / total_time)
    double overall_throughput_req_per_sec{0.0};

    // Cluster Utilization
    double avg_cpu_utilization{0.0};
    double peak_cpu_utilization{0.0};
    double avg_mem_utilization{0.0};
    double peak_mem_utilization{0.0};

    // Elasticity
    size_t scale_up_events{0};
    size_t scale_down_events{0};
    size_t min_nodes_observed{0};
    size_t max_nodes_observed{0};

    // Reliability & Faults
    size_t total_node_failures{0};
    size_t total_node_recoveries{0};
    double cluster_availability_pct{100.0};

    // Cost ($)
    // Formula: (vCPU_hours * $0.048) + (RAM_GB_hours * $0.006)
    double compute_cost_usd{0.0};
    double memory_cost_usd{0.0};
    double total_cost_usd{0.0};
    double cost_per_1000_requests_usd{0.0};
    double idle_waste_cost_usd{0.0};

    // SLA Compliance
    double sla_target_latency_ms{250.0};
    uint64_t sla_violation_count{0};
    double sla_violation_rate_pct{0.0};
    double sla_compliance_rate_pct{100.0};
    double overall_success_rate_pct{100.0};
};

class MetricsCollector {
public:
    MetricsCollector(double sla_target_ms = 250.0, double cost_per_vcpu_hr = 0.048, double cost_per_gb_hr = 0.006)
        : sla_target_ms_(sla_target_ms), cost_per_vcpu_hr_(cost_per_vcpu_hr), cost_per_gb_hr_(cost_per_gb_hr) {}

    void recordSubmission(const Event& event) {
        total_submitted_++;
    }

    void recordRejection(const Event& event) {
        total_rejected_++;
    }

    void recordCompletion(const Event& task, double completion_time) {
        total_completed_++;
        
        // Total Response Time = Completion Time - Arrival Time
        double latency_sec = completion_time - task.arrival_time;
        if (latency_sec < 0.0) latency_sec = 0.0;
        double latency_ms = latency_sec * 1000.0;
        latencies_ms_.push_back(latency_ms);

        // Queue Waiting Time = Start Time - Arrival Time
        double wait_sec = 0.0;
        if (task.start_time > task.arrival_time) {
            wait_sec = task.start_time - task.arrival_time;
        }
        queue_waits_ms_.push_back(wait_sec * 1000.0);

        if (latency_ms > sla_target_ms_) {
            sla_violations_++;
        }
    }

    void recordFailure(const Event& task) {
        total_failed_++;
    }

    void recordSnapshot(double current_time, const ResourcePool& pool) {
        MetricSnapshot snap;
        snap.timestamp = current_time;
        snap.cpu_utilization = pool.getAverageCpuUtilization();
        snap.mem_utilization = pool.getAverageMemUtilization();
        snap.composite_utilization = (snap.cpu_utilization * 0.6) + (snap.mem_utilization * 0.4);
        snap.active_nodes = pool.getTotalNodeCount();
        snap.healthy_nodes = pool.getOperationalNodeCount();
        snap.active_tasks = pool.getTotalActiveTasks();
        snap.queued_tasks = pool.getTotalQueuedTasks();

        // Track peak queue length
        if (snap.queued_tasks > peak_queue_length_) {
            peak_queue_length_ = snap.queued_tasks;
        }

        // Throughput calculation: completed requests up to current time
        snap.throughput = (current_time > 0.0) ? (static_cast<double>(total_completed_) / current_time) : 0.0;

        // Recent latency window
        if (!latencies_ms_.empty()) {
            size_t window_size = std::min<size_t>(latencies_ms_.size(), 20);
            double sum = 0.0;
            for (size_t i = latencies_ms_.size() - window_size; i < latencies_ms_.size(); ++i) {
                sum += latencies_ms_[i];
            }
            snap.avg_latency_ms = sum / window_size;
        } else {
            snap.avg_latency_ms = 0.0;
        }

        // Cost rate ($/hour): total vCPUs * cost_per_vcpu_hr + total GB * cost_per_gb_hr
        double total_cpu = pool.getTotalCpuCapacity();
        double total_mem = pool.getTotalMemCapacity();
        snap.instantaneous_cost_rate = (total_cpu * cost_per_vcpu_hr_) + (total_mem * cost_per_gb_hr_);

        snapshots_.push_back(snap);
    }

    SimulationSummary generateSummary(double final_time, const ResourcePool& pool, size_t scale_up_events, size_t scale_down_events, size_t failures, size_t recoveries) {
        SimulationSummary s;
        s.total_simulation_time = final_time;
        s.total_requests_submitted = total_submitted_;
        s.total_requests_completed = total_completed_;
        s.total_requests_failed = total_failed_;
        s.total_requests_rejected = total_rejected_;
        s.scale_up_events = scale_up_events;
        s.scale_down_events = scale_down_events;
        s.total_node_failures = failures;
        s.total_node_recoveries = recoveries;
        s.sla_target_latency_ms = sla_target_ms_;
        s.sla_violation_count = sla_violations_;
        s.peak_queue_length = peak_queue_length_;

        // Latency percentiles
        if (!latencies_ms_.empty()) {
            std::vector<double> sorted = latencies_ms_;
            std::sort(sorted.begin(), sorted.end());

            s.min_latency_ms = sorted.front();
            s.max_latency_ms = sorted.back();

            double sum = std::accumulate(sorted.begin(), sorted.end(), 0.0);
            s.avg_latency_ms = sum / sorted.size();

            auto getPercentile = [&](double p) {
                size_t idx = static_cast<size_t>(std::ceil(p * sorted.size())) - 1;
                if (idx >= sorted.size()) idx = sorted.size() - 1;
                return sorted[idx];
            };

            s.p50_latency_ms = getPercentile(0.50);
            s.p90_latency_ms = getPercentile(0.90);
            s.p95_latency_ms = getPercentile(0.95);
            s.p99_latency_ms = getPercentile(0.99);
        }

        // Queue wait stats
        if (!queue_waits_ms_.empty()) {
            double sum_wait = std::accumulate(queue_waits_ms_.begin(), queue_waits_ms_.end(), 0.0);
            s.avg_queue_wait_ms = sum_wait / queue_waits_ms_.size();
            s.max_queue_wait_ms = *std::max_element(queue_waits_ms_.begin(), queue_waits_ms_.end());
        }

        // System throughput
        if (final_time > 0.0) {
            s.overall_throughput_req_per_sec = static_cast<double>(total_completed_) / final_time;
        }

        // Utilization averages, peak, and average queue length across snapshots
        if (!snapshots_.empty()) {
            double sum_cpu = 0.0;
            double sum_mem = 0.0;
            double sum_queue = 0.0;
            size_t min_nodes = 999999;
            size_t max_nodes = 0;

            for (const auto& snap : snapshots_) {
                sum_cpu += snap.cpu_utilization;
                sum_mem += snap.mem_utilization;
                sum_queue += snap.queued_tasks;
                s.peak_cpu_utilization = std::max(s.peak_cpu_utilization, snap.cpu_utilization);
                s.peak_mem_utilization = std::max(s.peak_mem_utilization, snap.mem_utilization);
                min_nodes = std::min(min_nodes, snap.active_nodes);
                max_nodes = std::max(max_nodes, snap.active_nodes);
            }
            s.avg_cpu_utilization = sum_cpu / snapshots_.size();
            s.avg_mem_utilization = sum_mem / snapshots_.size();
            s.avg_queue_length = sum_queue / snapshots_.size();
            s.min_nodes_observed = (min_nodes == 999999) ? 0 : min_nodes;
            s.max_nodes_observed = max_nodes;
        }

        // Success and SLA rates
        if (total_submitted_ > 0) {
            s.overall_success_rate_pct = (static_cast<double>(total_completed_) / total_submitted_) * 100.0;
        }
        if (total_completed_ > 0) {
            s.sla_violation_rate_pct = (static_cast<double>(sla_violations_) / total_completed_) * 100.0;
            s.sla_compliance_rate_pct = 100.0 - s.sla_violation_rate_pct;
        }

        // Cost and Availability from Node tracking
        double total_uptime_node_sec = 0.0;
        double total_downtime_node_sec = 0.0;
        double total_cpu_capacity_sec = 0.0;
        double total_mem_capacity_sec = 0.0;

        for (const auto& node : pool.getAllNodes()) {
            double delta = final_time - node->last_status_change_time;
            double node_uptime = node->total_uptime;
            double node_downtime = node->total_downtime;
            if (delta > 0.0) {
                if (node->status == NodeStatus::FAILED || node->status == NodeStatus::RECOVERING) {
                    node_downtime += delta;
                } else {
                    node_uptime += delta;
                }
            }
            total_uptime_node_sec += node_uptime;
            total_downtime_node_sec += node_downtime;
            total_cpu_capacity_sec += (node->cpu_capacity * node_uptime);
            total_mem_capacity_sec += (node->mem_capacity * node_uptime);
        }

        double total_time_node_sec = total_uptime_node_sec + total_downtime_node_sec;
        if (total_time_node_sec > 0.0) {
            s.cluster_availability_pct = (total_uptime_node_sec / total_time_node_sec) * 100.0;
        }

        // Cost in USD: ($ per hr / 3600) * total_capacity_sec
        s.compute_cost_usd = (cost_per_vcpu_hr_ / 3600.0) * total_cpu_capacity_sec;
        s.memory_cost_usd = (cost_per_gb_hr_ / 3600.0) * total_mem_capacity_sec;
        s.total_cost_usd = s.compute_cost_usd + s.memory_cost_usd;

        if (total_completed_ > 0) {
            s.cost_per_1000_requests_usd = (s.total_cost_usd / total_completed_) * 1000.0;
        }

        // Idle waste estimate: portion of compute cost while utilization was below 100%
        if (s.avg_cpu_utilization > 0.0) {
            double idle_factor = std::max(0.0, 1.0 - (s.avg_cpu_utilization / 100.0));
            s.idle_waste_cost_usd = s.total_cost_usd * idle_factor;
        }

        return s;
    }

    const std::vector<MetricSnapshot>& getSnapshots() const { return snapshots_; }
    const std::vector<double>& getLatencies() const { return latencies_ms_; }

private:
    double sla_target_ms_{250.0};
    double cost_per_vcpu_hr_{0.048};
    double cost_per_gb_hr_{0.006};

    uint64_t total_submitted_{0};
    uint64_t total_completed_{0};
    uint64_t total_failed_{0};
    uint64_t total_rejected_{0};
    uint64_t sla_violations_{0};
    size_t peak_queue_length_{0};

    std::vector<double> latencies_ms_;
    std::vector<double> queue_waits_ms_;
    std::vector<MetricSnapshot> snapshots_;
};

} // namespace cloudsim

#endif // CLOUD_SIM_METRICS_COLLECTOR_H
