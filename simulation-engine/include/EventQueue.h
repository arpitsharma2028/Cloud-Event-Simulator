#ifndef CLOUD_SIM_EVENT_QUEUE_H
#define CLOUD_SIM_EVENT_QUEUE_H

#include "Event.h"
#include <queue>
#include <vector>
#include <cstddef>

namespace cloudsim {

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
        // Event type ordering: Failures and completions happen before arrivals at the exact same instant
        if (a.type != b.type) {
            return static_cast<int>(a.type) > static_cast<int>(b.type);
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
