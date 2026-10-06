#ifndef CLOUD_SIM_SIMULATION_ENGINE_H
#define CLOUD_SIM_SIMULATION_ENGINE_H

#include "Event.h"
#include "EventQueue.h"
#include "Node.h"
#include "ResourcePool.h"
#include "Scheduler.h"
#include "LoadBalancer.h"
#include "AutoScaler.h"
#include "FailureManager.h"
#include "MetricsCollector.h"
#include "json_helper.h"

#include <vector>
#include <string>
#include <memory>
#include <random>
#include <sstream>
#include <iostream>
#include <iomanip>

namespace cloudsim {

struct WorkloadConfig {
    double total_duration{60.0};       // Simulation duration in seconds
    double request_rate{10.0};         // Requests per second (mean arrival rate)
    double min_task_duration{1.0};     // Min execution time (sec)
    double max_task_duration{5.0};     // Max execution time (sec)
    double min_cpu{1.0};               // Min vCPU required
    double max_cpu{2.0};               // Max vCPU required
    double min_mem{1.0};               // Min RAM GB required
    double max_mem{4.0};               // Max RAM GB required
    double priority_high_ratio{0.2};   // 20% high priority
    double priority_med_ratio{0.6};    // 60% medium priority
    double priority_low_ratio{0.2};    // 20% low priority
};

struct SpikeConfig {
    double start_time{20.0};
    double duration{10.0};
    int additional_requests{100};
};

struct SimulationConfig {
    std::string name{"Cloud Simulation Run"};
    uint32_t seed{42};
    double duration{60.0};
    double time_step{0.5}; // Metric sample interval

    // Cluster
    int initial_nodes{3};
    double default_cpu_per_node{8.0};
    double default_mem_per_node{16.0};
    int node_queue_limit{50};

    // Policies
    SchedulerType scheduler_type{SchedulerType::ROUND_ROBIN};
    LoadBalancerType load_balancer_type{LoadBalancerType::ROUND_ROBIN};

    // Autoscaling
    AutoScalerConfig auto_scaler;

    // Workload
    WorkloadConfig workload;
    std::vector<SpikeConfig> spikes;

    // Failures
    std::vector<ScheduledFailure> failures;

    // SLA & Cost
    double sla_target_ms{250.0};
    double cost_per_vcpu_hr{0.048};
    double cost_per_gb_hr{0.006};
};

class SimulationEngine {
public:
    SimulationEngine(const SimulationConfig& config)
        : config_(config),
          rng_(config.seed),
          scheduler_(createScheduler(config.scheduler_type)),
          load_balancer_(createLoadBalancer(config.load_balancer_type)),
          auto_scaler_(config.auto_scaler),
          metrics_(config.sla_target_ms, config.cost_per_vcpu_hr, config.cost_per_gb_hr) {
        initCluster();
        initEvents();
    }

    double getCurrentTime() const { return current_time_; }
    bool isFinished() const {
        return event_queue_.empty() || current_time_ >= config_.duration;
    }

    bool step(std::string* out_event_json = nullptr) {
        if (event_queue_.empty()) return false;

        Event current_event = event_queue_.pop();
        if (current_event.timestamp > config_.duration && current_event.type != EventType::TASK_COMPLETE) {
            return false;
        }

        current_time_ = current_event.timestamp;

        switch (current_event.type) {
            case EventType::REQUEST_ARRIVAL:
                handleRequestArrival(current_event);
                break;
            case EventType::TASK_COMPLETE:
                handleTaskComplete(current_event);
                break;
            case EventType::NODE_FAILURE:
                handleNodeFailure(current_event);
                break;
            case EventType::NODE_RECOVERY:
                handleNodeRecovery(current_event);
                break;
            case EventType::AUTOSCALE_EVAL:
                handleAutoscaleEval(current_event);
                break;
            case EventType::METRIC_SAMPLE:
                handleMetricSample(current_event);
                break;
            case EventType::WORKLOAD_SPIKE:
                handleWorkloadSpike(current_event);
                break;
            default:
                break;
        }

        if (out_event_json) {
            *out_event_json = serializeCurrentStepJson(current_event);
        }

        return true;
    }

    void run() {
        while (!isFinished()) {
            step();
        }
        // Final metric snapshot at end of simulation
        metrics_.recordSnapshot(current_time_, pool_);
    }

    std::string exportResultsJson() {
        SimulationSummary summary = metrics_.generateSummary(
            current_time_, pool_,
            scale_up_count_, scale_down_count_,
            failure_mgr_.getTotalFailures(), failure_mgr_.getTotalRecoveries()
        );

        std::ostringstream json;
        json << "{\n";
        json << "  \"simulation_name\": " << json::quote(config_.name) << ",\n";
        json << "  \"seed\": " << config_.seed << ",\n";
        json << "  \"scheduler\": " << json::quote(schedulerTypeToString(config_.scheduler_type)) << ",\n";
        json << "  \"load_balancer\": " << json::quote(loadBalancerTypeToString(config_.load_balancer_type)) << ",\n";
        json << "  \"auto_scaler_enabled\": " << (config_.auto_scaler.enabled ? "true" : "false") << ",\n";

        // Summary
        json << "  \"summary\": {\n";
        json << "    \"total_simulation_time\": " << summary.total_simulation_time << ",\n";
        json << "    \"total_requests_submitted\": " << summary.total_requests_submitted << ",\n";
        json << "    \"total_requests_completed\": " << summary.total_requests_completed << ",\n";
        json << "    \"total_requests_failed\": " << summary.total_requests_failed << ",\n";
        json << "    \"total_requests_rejected\": " << summary.total_requests_rejected << ",\n";
        json << "    \"overall_success_rate_pct\": " << summary.overall_success_rate_pct << ",\n";
        json << "    \"overall_throughput_req_per_sec\": " << summary.overall_throughput_req_per_sec << ",\n";
        json << "    \"avg_latency_ms\": " << summary.avg_latency_ms << ",\n";
        json << "    \"min_latency_ms\": " << summary.min_latency_ms << ",\n";
        json << "    \"max_latency_ms\": " << summary.max_latency_ms << ",\n";
        json << "    \"p50_latency_ms\": " << summary.p50_latency_ms << ",\n";
        json << "    \"p90_latency_ms\": " << summary.p90_latency_ms << ",\n";
        json << "    \"p95_latency_ms\": " << summary.p95_latency_ms << ",\n";
        json << "    \"p99_latency_ms\": " << summary.p99_latency_ms << ",\n";
        json << "    \"avg_cpu_utilization\": " << summary.avg_cpu_utilization << ",\n";
        json << "    \"peak_cpu_utilization\": " << summary.peak_cpu_utilization << ",\n";
        json << "    \"avg_mem_utilization\": " << summary.avg_mem_utilization << ",\n";
        json << "    \"peak_mem_utilization\": " << summary.peak_mem_utilization << ",\n";
        json << "    \"scale_up_events\": " << summary.scale_up_events << ",\n";
        json << "    \"scale_down_events\": " << summary.scale_down_events << ",\n";
        json << "    \"min_nodes_observed\": " << summary.min_nodes_observed << ",\n";
        json << "    \"max_nodes_observed\": " << summary.max_nodes_observed << ",\n";
        json << "    \"total_node_failures\": " << summary.total_node_failures << ",\n";
        json << "    \"total_node_recoveries\": " << summary.total_node_recoveries << ",\n";
        json << "    \"cluster_availability_pct\": " << summary.cluster_availability_pct << ",\n";
        json << "    \"compute_cost_usd\": " << summary.compute_cost_usd << ",\n";
        json << "    \"memory_cost_usd\": " << summary.memory_cost_usd << ",\n";
        json << "    \"total_cost_usd\": " << summary.total_cost_usd << ",\n";
        json << "    \"cost_per_1000_requests_usd\": " << summary.cost_per_1000_requests_usd << ",\n";
        json << "    \"idle_waste_cost_usd\": " << summary.idle_waste_cost_usd << ",\n";
        json << "    \"sla_target_latency_ms\": " << summary.sla_target_latency_ms << ",\n";
        json << "    \"sla_violation_count\": " << summary.sla_violation_count << ",\n";
        json << "    \"sla_violation_rate_pct\": " << summary.sla_violation_rate_pct << ",\n";
        json << "    \"sla_compliance_rate_pct\": " << summary.sla_compliance_rate_pct << "\n";
        json << "  },\n";

        // Snapshots (timeseries for charts)
        json << "  \"snapshots\": [\n";
        const auto& snaps = metrics_.getSnapshots();
        for (size_t i = 0; i < snaps.size(); ++i) {
            const auto& s = snaps[i];
            json << "    {\"timestamp\":" << s.timestamp
                 << ",\"cpu_util\":" << s.cpu_utilization
                 << ",\"mem_util\":" << s.mem_utilization
                 << ",\"composite_util\":" << s.composite_utilization
                 << ",\"active_nodes\":" << s.active_nodes
                 << ",\"healthy_nodes\":" << s.healthy_nodes
                 << ",\"active_tasks\":" << s.active_tasks
                 << ",\"queued_tasks\":" << s.queued_tasks
                 << ",\"throughput\":" << s.throughput
                 << ",\"avg_latency_ms\":" << s.avg_latency_ms
                 << ",\"cost_rate\":" << s.instantaneous_cost_rate << "}"
                 << (i + 1 < snaps.size() ? ",\n" : "\n");
        }
        json << "  ],\n";

        // Final Node States
        json << "  \"nodes\": [\n";
        const auto& all_nodes = pool_.getAllNodes();
        for (size_t i = 0; i < all_nodes.size(); ++i) {
            const auto& n = all_nodes[i];
            json << "    {\"id\":" << n->id
                 << ",\"name\":" << json::quote(n->name)
                 << ",\"cpu_capacity\":" << n->cpu_capacity
                 << ",\"mem_capacity\":" << n->mem_capacity
                 << ",\"cpu_used\":" << n->cpu_used
                 << ",\"mem_used\":" << n->mem_used
                 << ",\"cpu_util\":" << n->getCpuUtilization()
                 << ",\"mem_util\":" << n->getMemUtilization()
                 << ",\"status\":" << json::quote(nodeStatusToString(n->status))
                 << ",\"active_tasks\":" << n->active_tasks.size()
                 << ",\"queued_tasks\":" << n->waiting_queue.size()
                 << ",\"total_processed\":" << n->total_tasks_processed
                 << ",\"total_failed\":" << n->total_tasks_failed
                 << ",\"total_rejected\":" << n->total_tasks_rejected
                 << ",\"uptime_sec\":" << n->total_uptime
                 << ",\"downtime_sec\":" << n->total_downtime << "}"
                 << (i + 1 < all_nodes.size() ? ",\n" : "\n");
        }
        json << "  ],\n";

        // Scaling History
        json << "  \"scaling_events\": [\n";
        const auto& scaling_hist = auto_scaler_.getHistory();
        for (size_t i = 0; i < scaling_hist.size(); ++i) {
            const auto& sh = scaling_hist[i];
            json << "    {\"timestamp\":" << sh.timestamp
                 << ",\"action\":" << json::quote(sh.action)
                 << ",\"prev_count\":" << sh.previous_node_count
                 << ",\"new_count\":" << sh.new_node_count
                 << ",\"cpu_util\":" << sh.cluster_cpu_util
                 << ",\"mem_util\":" << sh.cluster_mem_util
                 << ",\"reason\":" << json::quote(sh.reason) << "}"
                 << (i + 1 < scaling_hist.size() ? ",\n" : "\n");
        }
        json << "  ],\n";

        // Failure History
        json << "  \"failure_events\": [\n";
        const auto& fail_hist = failure_mgr_.getHistory();
        for (size_t i = 0; i < fail_hist.size(); ++i) {
            const auto& fh = fail_hist[i];
            json << "    {\"timestamp\":" << fh.timestamp
                 << ",\"node_id\":" << fh.node_id
                 << ",\"node_name\":" << json::quote(fh.node_name)
                 << ",\"action\":" << json::quote(fh.action)
                 << ",\"affected_tasks\":" << fh.affected_tasks_count
                 << ",\"details\":" << json::quote(fh.details) << "}"
                 << (i + 1 < fail_hist.size() ? ",\n" : "\n");
        }
        json << "  ],\n";

        // Event Log (Sample up to 500 events for client inspection)
        json << "  \"event_log\": [\n";
        size_t log_count = std::min<size_t>(event_log_.size(), 500);
        for (size_t i = 0; i < log_count; ++i) {
            const auto& e = event_log_[i];
            json << "    {\"id\":" << e.id
                 << ",\"timestamp\":" << e.timestamp
                 << ",\"type\":" << json::quote(eventTypeToString(e.type))
                 << ",\"priority\":" << e.priority
                 << ",\"node_id\":" << e.node_id
                 << ",\"task_id\":" << e.task_id
                 << ",\"cpu\":" << e.cpu_req
                 << ",\"mem\":" << e.mem_req
                 << ",\"status\":" << json::quote(taskStatusToString(e.status))
                 << ",\"log\":" << json::quote(e.decision_log) << "}"
                 << (i + 1 < log_count ? ",\n" : "\n");
        }
        json << "  ],\n";

        // Decision Trace (Chronological explainable log)
        json << "  \"decision_trace\": [\n";
        size_t trace_count = std::min<size_t>(decision_trace_.size(), 300);
        for (size_t i = 0; i < trace_count; ++i) {
            json << "    " << json::quote(decision_trace_[i])
                 << (i + 1 < trace_count ? ",\n" : "\n");
        }
        json << "  ]\n";

        json << "}\n";
        return json.str();
    }

private:
    SimulationConfig config_;
    std::mt19937 rng_;
    double current_time_{0.0};
    uint64_t next_event_id_{1};
    uint64_t next_task_id_{1};

    EventQueue event_queue_;
    ResourcePool pool_;
    std::unique_ptr<Scheduler> scheduler_;
    std::unique_ptr<LoadBalancer> load_balancer_;
    AutoScaler auto_scaler_;
    FailureManager failure_mgr_;
    MetricsCollector metrics_;

    size_t scale_up_count_{0};
    size_t scale_down_count_{0};

    std::vector<Event> event_log_;
    std::vector<std::string> decision_trace_;

    void initCluster() {
        for (int i = 1; i <= config_.initial_nodes; ++i) {
            std::string name = "node-" + std::to_string(i);
            auto node = std::make_shared<Node>(
                i, name,
                config_.default_cpu_per_node,
                config_.default_mem_per_node,
                1.0,
                config_.node_queue_limit
            );
            pool_.addNode(node);
        }
        auto_scaler_.setNextNodeId(config_.initial_nodes);
    }

    void initEvents() {
        // 1. Generate requests using Poisson arrival process
        std::exponential_distribution<double> inter_arrival_dist(config_.workload.request_rate);
        std::uniform_real_distribution<double> dur_dist(config_.workload.min_task_duration, config_.workload.max_task_duration);
        std::uniform_real_distribution<double> cpu_dist(config_.workload.min_cpu, config_.workload.max_cpu);
        std::uniform_real_distribution<double> mem_dist(config_.workload.min_mem, config_.workload.max_mem);
        std::uniform_real_distribution<double> prio_dist(0.0, 1.0);

        double t = 0.0;
        while (t < config_.duration) {
            double delta = inter_arrival_dist(rng_);
            t += delta;
            if (t >= config_.duration) break;

            Event req;
            req.id = next_event_id_++;
            req.task_id = next_task_id_++;
            req.timestamp = t;
            req.arrival_time = t;
            req.type = EventType::REQUEST_ARRIVAL;
            req.duration = std::round(dur_dist(rng_) * 10.0) / 10.0;
            req.cpu_req = std::round(cpu_dist(rng_) * 10.0) / 10.0;
            req.mem_req = std::round(mem_dist(rng_) * 10.0) / 10.0;

            double p = prio_dist(rng_);
            if (p < config_.workload.priority_high_ratio) req.priority = 1;
            else if (p < config_.workload.priority_high_ratio + config_.workload.priority_med_ratio) req.priority = 2;
            else req.priority = 3;

            event_queue_.push(req);
        }

        // 2. Schedule workload spikes
        for (const auto& spike : config_.spikes) {
            Event sp;
            sp.id = next_event_id_++;
            sp.timestamp = spike.start_time;
            sp.type = EventType::WORKLOAD_SPIKE;
            sp.spike_request_count = spike.additional_requests;
            sp.spike_interval = spike.duration;
            event_queue_.push(sp);
        }

        // 3. Schedule failures
        for (const auto& fail : config_.failures) {
            failure_mgr_.addScheduledFailure(fail);
            Event f_event;
            f_event.id = next_event_id_++;
            f_event.timestamp = fail.fail_time;
            f_event.type = EventType::NODE_FAILURE;
            f_event.target_node_id = fail.node_id;
            f_event.recovery_duration = (fail.recovery_time > fail.fail_time) ? (fail.recovery_time - fail.fail_time) : 0.0;
            event_queue_.push(f_event);
        }

        // 4. Schedule periodic autoscaling checks
        if (config_.auto_scaler.enabled) {
            for (double t_eval = 2.0; t_eval < config_.duration; t_eval += 2.0) {
                Event eval_ev;
                eval_ev.id = next_event_id_++;
                eval_ev.timestamp = t_eval;
                eval_ev.type = EventType::AUTOSCALE_EVAL;
                event_queue_.push(eval_ev);
            }
        }

        // 5. Schedule periodic metric samples
        double sample_step = (config_.time_step > 0.1) ? config_.time_step : 1.0;
        for (double t_sample = 0.0; t_sample <= config_.duration; t_sample += sample_step) {
            Event sm;
            sm.id = next_event_id_++;
            sm.timestamp = t_sample;
            sm.type = EventType::METRIC_SAMPLE;
            event_queue_.push(sm);
        }
    }

    void handleRequestArrival(Event& req) {
        metrics_.recordSubmission(req);

        // Step 1: Scheduler decides which node gets the request
        std::string sched_reason;
        int target_node_id = scheduler_->schedule(req, pool_, sched_reason);

        // Step 2: If healthy nodes available and load balancer has choice among candidate matches
        if (target_node_id != -1 && config_.load_balancer_type != LoadBalancerType::ROUND_ROBIN) {
            auto healthy = pool_.getHealthyNodes();
            std::vector<std::shared_ptr<Node>> capable_nodes;
            for (const auto& hn : healthy) {
                if (hn->hasCapacity(req.cpu_req, req.mem_req)) {
                    capable_nodes.push_back(hn);
                }
            }
            if (!capable_nodes.empty()) {
                std::string lb_reason;
                int lb_pick = load_balancer_->balance(req, capable_nodes, lb_reason);
                if (lb_pick != -1) {
                    target_node_id = lb_pick;
                    sched_reason += " | " + lb_reason;
                }
            }
        }

        req.node_id = target_node_id;

        if (target_node_id == -1) {
            req.status = TaskStatus::REJECTED;
            req.finish_time = current_time_;
            req.decision_log = sched_reason;
            metrics_.recordRejection(req);

            std::ostringstream trace;
            trace << "[T=" << std::fixed << std::setprecision(2) << current_time_
                  << "s] REJECT: Request #" << req.task_id << " (vCPU: " << req.cpu_req
                  << ", RAM: " << req.mem_req << "GB) dropped. Reason: " << sched_reason;
            decision_trace_.push_back(trace.str());
            event_log_.push_back(req);
            return;
        }

        auto node = pool_.getNode(target_node_id);
        if (!node) {
            req.status = TaskStatus::REJECTED;
            req.decision_log = "Node disappeared during assignment";
            metrics_.recordRejection(req);
            event_log_.push_back(req);
            return;
        }

        // Try direct allocation
        if (node->hasCapacity(req.cpu_req, req.mem_req)) {
            req.status = TaskStatus::RUNNING;
            req.start_time = current_time_;
            node->allocate(req);

            req.decision_log = sched_reason;
            event_log_.push_back(req);

            // Schedule completion event
            Event comp;
            comp.id = next_event_id_++;
            comp.task_id = req.task_id;
            comp.node_id = target_node_id;
            comp.timestamp = current_time_ + req.duration;
            comp.type = EventType::TASK_COMPLETE;
            comp.arrival_time = req.arrival_time;
            comp.start_time = req.start_time;
            comp.duration = req.duration;
            comp.cpu_req = req.cpu_req;
            comp.mem_req = req.mem_req;
            comp.priority = req.priority;
            event_queue_.push(comp);

            std::ostringstream trace;
            trace << "[T=" << std::fixed << std::setprecision(2) << current_time_
                  << "s] ALLOC: Request #" << req.task_id << " (Priority: " << req.priority
                  << ", vCPU: " << req.cpu_req << ", RAM: " << req.mem_req << "GB) -> "
                  << node->name << " [Finishes at T=" << comp.timestamp << "s]. " << sched_reason;
            decision_trace_.push_back(trace.str());
        } else if (node->canQueue()) {
            req.status = TaskStatus::QUEUED;
            req.decision_log = "Queued on " + node->name + " (Queue depth: " + std::to_string(node->waiting_queue.size() + 1) + ")";
            node->enqueue(req);
            event_log_.push_back(req);

            std::ostringstream trace;
            trace << "[T=" << std::fixed << std::setprecision(2) << current_time_
                  << "s] QUEUED: Request #" << req.task_id << " placed in queue of "
                  << node->name << " (Queue slot: " << node->waiting_queue.size() << ")";
            decision_trace_.push_back(trace.str());
        } else {
            req.status = TaskStatus::REJECTED;
            req.decision_log = "Node queue limit reached on " + node->name;
            metrics_.recordRejection(req);
            event_log_.push_back(req);

            std::ostringstream trace;
            trace << "[T=" << std::fixed << std::setprecision(2) << current_time_
                  << "s] DROP: Request #" << req.task_id << " dropped by " << node->name
                  << " (Queue full)";
            decision_trace_.push_back(trace.str());
        }
    }

    void handleTaskComplete(Event& comp) {
        auto node = pool_.getNode(comp.node_id);
        if (node) {
            Event released;
            if (node->release(comp.task_id, &released)) {
                comp.status = TaskStatus::COMPLETED;
                comp.finish_time = current_time_;
                metrics_.recordCompletion(comp, current_time_);

                std::ostringstream trace;
                trace << "[T=" << std::fixed << std::setprecision(2) << current_time_
                      << "s] COMPLETE: Task #" << comp.task_id << " finished on "
                      << node->name << " (Duration: " << comp.duration << "s, Latency: "
                      << (current_time_ - comp.arrival_time) * 1000.0 << "ms)";
                decision_trace_.push_back(trace.str());

                // Check node's waiting queue to dispatch next task if capacity freed
                while (!node->waiting_queue.empty()) {
                    const auto& next_task = node->waiting_queue.front();
                    if (node->hasCapacity(next_task.cpu_req, next_task.mem_req)) {
                        Event queued_task = node->waiting_queue.front();
                        node->waiting_queue.pop_front();

                        queued_task.status = TaskStatus::RUNNING;
                        queued_task.start_time = current_time_;
                        node->allocate(queued_task);

                        // Completion event
                        Event next_comp;
                        next_comp.id = next_event_id_++;
                        next_comp.task_id = queued_task.task_id;
                        next_comp.node_id = node->id;
                        next_comp.timestamp = current_time_ + queued_task.duration;
                        next_comp.type = EventType::TASK_COMPLETE;
                        next_comp.arrival_time = queued_task.arrival_time;
                        next_comp.start_time = current_time_;
                        next_comp.duration = queued_task.duration;
                        next_comp.cpu_req = queued_task.cpu_req;
                        next_comp.mem_req = queued_task.mem_req;
                        next_comp.priority = queued_task.priority;
                        event_queue_.push(next_comp);

                        std::ostringstream q_trace;
                        q_trace << "[T=" << std::fixed << std::setprecision(2) << current_time_
                                << "s] DEQUEUE: Task #" << queued_task.task_id << " promoted from queue on "
                                << node->name << " to active execution";
                        decision_trace_.push_back(q_trace.str());
                    } else {
                        break;
                    }
                }
            }
        }
    }

    void handleNodeFailure(Event& ev) {
        std::vector<Event> evicted;
        std::string log;
        if (failure_mgr_.triggerNodeFailure(ev.target_node_id, current_time_, pool_, evicted, log)) {
            decision_trace_.push_back(log);
            for (auto& task : evicted) {
                metrics_.recordFailure(task);
                event_log_.push_back(task);
            }

            // Schedule recovery if duration was specified
            if (ev.recovery_duration > 0.0) {
                Event rec;
                rec.id = next_event_id_++;
                rec.timestamp = current_time_ + ev.recovery_duration;
                rec.type = EventType::NODE_RECOVERY;
                rec.target_node_id = ev.target_node_id;
                event_queue_.push(rec);
            }
        }
    }

    void handleNodeRecovery(Event& ev) {
        std::string log;
        if (failure_mgr_.triggerNodeRecovery(ev.target_node_id, current_time_, pool_, log)) {
            decision_trace_.push_back(log);
        }
    }

    void handleAutoscaleEval(Event& ev) {
        std::vector<Event> evicted;
        std::string log;
        if (auto_scaler_.evaluate(current_time_, pool_, evicted, log)) {
            decision_trace_.push_back(log);
            if (log.find("SCALE_UP") != std::string::npos) {
                scale_up_count_++;
            } else if (log.find("SCALE_DOWN") != std::string::npos) {
                scale_down_count_++;
                for (auto& t : evicted) {
                    metrics_.recordFailure(t);
                    event_log_.push_back(t);
                }
            }
        }
    }

    void handleMetricSample(Event& ev) {
        metrics_.recordSnapshot(current_time_, pool_);
    }

    void handleWorkloadSpike(Event& ev) {
        std::uniform_real_distribution<double> dur_dist(config_.workload.min_task_duration, config_.workload.max_task_duration);
        std::uniform_real_distribution<double> cpu_dist(config_.workload.min_cpu, config_.workload.max_cpu);
        std::uniform_real_distribution<double> mem_dist(config_.workload.min_mem, config_.workload.max_mem);
        std::uniform_real_distribution<double> time_spread(0.0, ev.spike_interval);

        for (int i = 0; i < ev.spike_request_count; ++i) {
            double req_time = current_time_ + time_spread(rng_);
            Event req;
            req.id = next_event_id_++;
            req.task_id = next_task_id_++;
            req.timestamp = req_time;
            req.arrival_time = req_time;
            req.type = EventType::REQUEST_ARRIVAL;
            req.duration = std::round(dur_dist(rng_) * 10.0) / 10.0;
            req.cpu_req = std::round(cpu_dist(rng_) * 10.0) / 10.0;
            req.mem_req = std::round(mem_dist(rng_) * 10.0) / 10.0;
            req.priority = 1; // Spikes are high priority traffic bursts
            event_queue_.push(req);
        }

        std::ostringstream trace;
        trace << "[T=" << std::fixed << std::setprecision(2) << current_time_
              << "s] WORKLOAD_SPIKE: Injected burst of " << ev.spike_request_count
              << " requests across window of " << ev.spike_interval << " seconds";
        decision_trace_.push_back(trace.str());
    }

    std::string serializeCurrentStepJson(const Event& ev) {
        std::ostringstream json;
        json << "{\"type\":\"STEP\",\"time\":" << current_time_
             << ",\"event\":{\"id\":" << ev.id
             << ",\"type\":" << json::quote(eventTypeToString(ev.type))
             << ",\"node_id\":" << ev.node_id
             << ",\"task_id\":" << ev.task_id << "}"
             << ",\"cluster\":{\"cpu_util\":" << pool_.getAverageCpuUtilization()
             << ",\"mem_util\":" << pool_.getAverageMemUtilization()
             << ",\"nodes\":" << pool_.getTotalNodeCount()
             << ",\"healthy\":" << pool_.getOperationalNodeCount()
             << ",\"active_tasks\":" << pool_.getTotalActiveTasks()
             << ",\"queued_tasks\":" << pool_.getTotalQueuedTasks() << "}}\n";
        return json.str();
    }
};

} // namespace cloudsim

#endif // CLOUD_SIM_SIMULATION_ENGINE_H
