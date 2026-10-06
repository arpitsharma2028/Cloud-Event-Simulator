#ifndef CLOUD_SIM_EVENT_H
#define CLOUD_SIM_EVENT_H

#include <string>
#include <cstdint>

namespace cloudsim {

enum class EventType {
    REQUEST_ARRIVAL = 0,
    TASK_START = 1,
    TASK_COMPLETE = 2,
    NODE_FAILURE = 3,
    NODE_RECOVERY = 4,
    AUTOSCALE_EVAL = 5,
    METRIC_SAMPLE = 6,
    WORKLOAD_SPIKE = 7
};

inline std::string eventTypeToString(EventType type) {
    switch (type) {
        case EventType::REQUEST_ARRIVAL: return "REQUEST_ARRIVAL";
        case EventType::TASK_START: return "TASK_START";
        case EventType::TASK_COMPLETE: return "TASK_COMPLETE";
        case EventType::NODE_FAILURE: return "NODE_FAILURE";
        case EventType::NODE_RECOVERY: return "NODE_RECOVERY";
        case EventType::AUTOSCALE_EVAL: return "AUTOSCALE_EVAL";
        case EventType::METRIC_SAMPLE: return "METRIC_SAMPLE";
        case EventType::WORKLOAD_SPIKE: return "WORKLOAD_SPIKE";
        default: return "UNKNOWN";
    }
}

inline EventType stringToEventType(const std::string& str) {
    if (str == "REQUEST_ARRIVAL") return EventType::REQUEST_ARRIVAL;
    if (str == "TASK_START") return EventType::TASK_START;
    if (str == "TASK_COMPLETE") return EventType::TASK_COMPLETE;
    if (str == "NODE_FAILURE") return EventType::NODE_FAILURE;
    if (str == "NODE_RECOVERY") return EventType::NODE_RECOVERY;
    if (str == "AUTOSCALE_EVAL") return EventType::AUTOSCALE_EVAL;
    if (str == "METRIC_SAMPLE") return EventType::METRIC_SAMPLE;
    if (str == "WORKLOAD_SPIKE") return EventType::WORKLOAD_SPIKE;
    return EventType::REQUEST_ARRIVAL;
}

enum class TaskStatus {
    PENDING,
    QUEUED,
    RUNNING,
    COMPLETED,
    FAILED,
    REJECTED
};

inline std::string taskStatusToString(TaskStatus s) {
    switch (s) {
        case TaskStatus::PENDING: return "PENDING";
        case TaskStatus::QUEUED: return "QUEUED";
        case TaskStatus::RUNNING: return "RUNNING";
        case TaskStatus::COMPLETED: return "COMPLETED";
        case TaskStatus::FAILED: return "FAILED";
        case TaskStatus::REJECTED: return "REJECTED";
        default: return "UNKNOWN";
    }
}

struct Event {
    uint64_t id{0};
    double timestamp{0.0};
    EventType type{EventType::REQUEST_ARRIVAL};
    int priority{2}; // 1 = High, 2 = Medium, 3 = Low

    // Task / Workload payload
    uint64_t task_id{0};
    int node_id{-1};
    double cpu_req{1.0};
    double mem_req{1.0};
    double duration{1.0};
    double arrival_time{0.0};
    double start_time{-1.0};
    double finish_time{-1.0};
    TaskStatus status{TaskStatus::PENDING};
    std::string decision_log{""};

    // For node failure events
    int target_node_id{-1};
    double recovery_duration{0.0};

    // For workload spikes
    int spike_request_count{0};
    double spike_interval{0.0};
};

} // namespace cloudsim

#endif // CLOUD_SIM_EVENT_H
