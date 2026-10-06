#include "../include/SimulationEngine.h"
#include "../include/json_helper.h"

#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

using namespace cloudsim;

SimulationConfig parseConfigFromJson(const std::string& json_str) {
    SimulationConfig cfg;

    cfg.name = json::findStringValue(json_str, "name", "Cloud Simulation");
    cfg.seed = static_cast<uint32_t>(json::findIntValue(json_str, "seed", 42));
    cfg.duration = json::findDoubleValue(json_str, "duration", 60.0);
    cfg.time_step = json::findDoubleValue(json_str, "time_step", 0.5);

    // Cluster
    cfg.initial_nodes = json::findIntValue(json_str, "initial_nodes", 3);
    cfg.default_cpu_per_node = json::findDoubleValue(json_str, "default_cpu_per_node", 8.0);
    cfg.default_mem_per_node = json::findDoubleValue(json_str, "default_mem_per_node", 16.0);
    cfg.node_queue_limit = json::findIntValue(json_str, "node_queue_limit", 50);

    // Policies
    std::string sched_str = json::findStringValue(json_str, "scheduler", "ROUND_ROBIN");
    cfg.scheduler_type = stringToSchedulerType(sched_str);

    std::string lb_str = json::findStringValue(json_str, "load_balancer", "ROUND_ROBIN");
    cfg.load_balancer_type = stringToLoadBalancerType(lb_str);

    // Auto Scaler
    std::string as_obj = json::extractObject(json_str, "auto_scaler");
    if (!as_obj.empty()) {
        cfg.auto_scaler.enabled = json::findBoolValue(as_obj, "enabled", true);
        cfg.auto_scaler.scale_up_threshold = json::findDoubleValue(as_obj, "scale_up_threshold", 75.0);
        cfg.auto_scaler.scale_down_threshold = json::findDoubleValue(as_obj, "scale_down_threshold", 30.0);
        cfg.auto_scaler.cooldown_period = json::findDoubleValue(as_obj, "cooldown_period", 15.0);
        cfg.auto_scaler.min_nodes = json::findIntValue(as_obj, "min_nodes", 2);
        cfg.auto_scaler.max_nodes = json::findIntValue(as_obj, "max_nodes", 10);
        cfg.auto_scaler.scale_up_step = json::findIntValue(as_obj, "scale_up_step", 1);
        cfg.auto_scaler.scale_down_step = json::findIntValue(as_obj, "scale_down_step", 1);
        cfg.auto_scaler.default_node_cpu = cfg.default_cpu_per_node;
        cfg.auto_scaler.default_node_mem = cfg.default_mem_per_node;
    }

    // Workload
    std::string wl_obj = json::extractObject(json_str, "workload");
    if (!wl_obj.empty()) {
        cfg.workload.total_duration = cfg.duration;
        cfg.workload.request_rate = json::findDoubleValue(wl_obj, "request_rate", 10.0);
        cfg.workload.min_task_duration = json::findDoubleValue(wl_obj, "min_task_duration", 1.0);
        cfg.workload.max_task_duration = json::findDoubleValue(wl_obj, "max_task_duration", 5.0);
        cfg.workload.min_cpu = json::findDoubleValue(wl_obj, "min_cpu", 1.0);
        cfg.workload.max_cpu = json::findDoubleValue(wl_obj, "max_cpu", 2.0);
        cfg.workload.min_mem = json::findDoubleValue(wl_obj, "min_mem", 1.0);
        cfg.workload.max_mem = json::findDoubleValue(wl_obj, "max_mem", 4.0);
        cfg.workload.priority_high_ratio = json::findDoubleValue(wl_obj, "priority_high_ratio", 0.2);
        cfg.workload.priority_med_ratio = json::findDoubleValue(wl_obj, "priority_med_ratio", 0.6);
        cfg.workload.priority_low_ratio = json::findDoubleValue(wl_obj, "priority_low_ratio", 0.2);
    }

    // Spikes
    std::string spikes_arr = json::extractArray(json_str, "spikes");
    if (!spikes_arr.empty()) {
        auto spike_objs = json::splitArrayObjects(spikes_arr);
        for (const auto& so : spike_objs) {
            SpikeConfig sc;
            sc.start_time = json::findDoubleValue(so, "start_time", 20.0);
            sc.duration = json::findDoubleValue(so, "duration", 10.0);
            sc.additional_requests = json::findIntValue(so, "additional_requests", 100);
            cfg.spikes.push_back(sc);
        }
    }

    // Failures
    std::string fails_arr = json::extractArray(json_str, "failures");
    if (!fails_arr.empty()) {
        auto fail_objs = json::splitArrayObjects(fails_arr);
        for (const auto& fo : fail_objs) {
            ScheduledFailure sf;
            sf.node_id = json::findIntValue(fo, "node_id", 1);
            sf.fail_time = json::findDoubleValue(fo, "fail_time", 25.0);
            sf.recovery_time = json::findDoubleValue(fo, "recovery_time", 45.0);
            cfg.failures.push_back(sf);
        }
    }

    // SLA & Cost
    cfg.sla_target_ms = json::findDoubleValue(json_str, "sla_target_ms", 250.0);
    cfg.cost_per_vcpu_hr = json::findDoubleValue(json_str, "cost_per_vcpu_hr", 0.048);
    cfg.cost_per_gb_hr = json::findDoubleValue(json_str, "cost_per_gb_hr", 0.006);

    return cfg;
}

int main(int argc, char* argv[]) {
    std::string config_path = "";
    std::string output_path = "";
    bool stream_mode = false;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--config" && i + 1 < argc) {
            config_path = argv[++i];
        } else if (arg == "--output" && i + 1 < argc) {
            output_path = argv[++i];
        } else if (arg == "--stream") {
            stream_mode = true;
        } else if (arg == "--help") {
            std::cout << "Cloud Event Simulator Engine\n";
            std::cout << "Usage: cloud_sim_engine [--config <path>] [--output <path>] [--stream]\n";
            return 0;
        }
    }

    std::string json_content;
    if (!config_path.empty()) {
        std::ifstream file(config_path);
        if (!file.is_open()) {
            std::cerr << "Error: Could not open config file: " << config_path << std::endl;
            return 1;
        }
        std::stringstream ss;
        ss << file.rdbuf();
        json_content = ss.str();
    } else {
        // Read from stdin
        std::string line;
        std::stringstream ss;
        while (std::getline(std::cin, line)) {
            ss << line << "\n";
        }
        json_content = ss.str();
    }

    if (json_content.empty()) {
        // Fallback default config
        json_content = "{}";
    }

    try {
        SimulationConfig cfg = parseConfigFromJson(json_content);
        SimulationEngine engine(cfg);

        if (stream_mode) {
            std::string step_json;
            while (!engine.isFinished()) {
                if (engine.step(&step_json)) {
                    std::cout << step_json;
                    std::cout.flush();
                }
            }
        } else {
            engine.run();
        }

        std::string results_json = engine.exportResultsJson();

        if (!output_path.empty() && output_path != "stdout") {
            std::ofstream out_file(output_path);
            if (!out_file.is_open()) {
                std::cerr << "Error: Could not open output file for writing: " << output_path << std::endl;
                return 1;
            }
            out_file << results_json;
            out_file.close();
        } else if (!stream_mode) {
            std::cout << results_json;
        }

    } catch (const std::exception& ex) {
        std::cerr << "Engine execution exception: " << ex.what() << std::endl;
        return 1;
    }

    return 0;
}
