#ifndef CLOUD_SIM_EVENT_QUEUE_H
#define CLOUD_SIM_EVENT_QUEUE_H

#include "Event.h"
#include <queue>
#include <vector>
#include <cstddef>

namespace cloudsim {

inline int getEventTypeCausalityRank(EventType t) {
    switch (t) {
        case EventType::NODE_FAILURE:   return 0; // Failures occur first
        case EventType::NODE_RECOVERY:  return 1; // Recoveries restore capacity
        case EventType::TASK_COMPLETE:  return 2; // Releases resources
        case EventType::AUTOSCALE_EVAL: return 3; // Evaluates capacity
        case EventType::WORKLOAD_SPIKE: return 4; // Triggers spike
        case EventType::TASK_START:     return 5; // Starts queued task
        case EventType::REQUEST_ARRIVAL:return 6; // New work arrivals
        case EventType::METRIC_SAMPLE:  return 7; // Sampling metrics
        default:                        return 8;
    }
}

// Comparator for Priority Queue
// std::priority_queue returns largest element first, so operator() returns true if a should be placed AFTER b.
struct EventComparator {
    bool operator()(const Event& a, const Event& b) const {
        // Earlier timestamp comes first
        if (a.timestamp != b.timestamp) {
            return a.timestamp > b.timestamp;
        }
        // Higher priority (lower number, e.g. 1 vs 3) comes first
        if (a.priority != b.priority) {
            return a.priority > b.priority;
        }
        // Causality ordering: Failures and completions happen before arrivals at the exact same instant
        if (a.type != b.type) {
            return getEventTypeCausalityRank(a.type) > getEventTypeCausalityRank(b.type);
        }
        // Deterministic tie-breaker by ID
        return a.id > b.id;
    }
};

class EventQueue {
public:
    EventQueue() = default;

    void push(const Event& event) {
        queue_.push(event);
    }

    Event pop() {
        Event top = queue_.top();
        queue_.pop();
        return top;
    }

    const Event& top() const {
        return queue_.top();
    }

    bool empty() const {
        return queue_.empty();
    }

    size_t size() const {
        return queue_.size();
    }

    double nextEventTime() const {
        if (queue_.empty()) return -1.0;
        return queue_.top().timestamp;
    }

    void clear() {
        while (!queue_.empty()) {
            queue_.pop();
        }
    }

private:
    std::priority_queue<Event, std::vector<Event>, EventComparator> queue_;
};

} // namespace cloudsim

#endif // CLOUD_SIM_EVENT_QUEUE_H
