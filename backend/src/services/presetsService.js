const PRESETS = [
  {
    id: "full_lifecycle",
    name: "Complete Demo — Spike, Scale, Failure & Recovery",
    description: "A full tour: traffic rises, servers scale up, one server fails and recovers, then unused capacity is removed.",
    category: "Full Lifecycle",
    config: {
      name: "End-to-End Cloud Lifecycle Demo",
      seed: 12345,
      duration: 80.0,
      time_step: 0.5,
      initial_nodes: 2,
      default_cpu_per_node: 6.0,
      default_mem_per_node: 12.0,
      node_queue_limit: 50,
      scheduler: "LEAST_LOADED",
      load_balancer: "LEAST_CONNECTIONS",
      auto_scaler: {
        enabled: true,
        scale_up_threshold: 65.0,
        scale_down_threshold: 28.0,
        cooldown_period: 8.0,
        min_nodes: 2,
        max_nodes: 5,
        scale_up_step: 1,
        scale_down_step: 1
      },
      workload: {
        request_rate: 2.2,
        min_task_duration: 1.0,
        max_task_duration: 2.5,
        min_cpu: 1.0,
        max_cpu: 2.0,
        min_mem: 1.5,
        max_mem: 3.0,
        priority_high_ratio: 0.25,
        priority_med_ratio: 0.55,
        priority_low_ratio: 0.20
      },
      spikes: [
        {
          start_time: 14.0,
          duration: 16.0,
          additional_requests: 120
        }
      ],
      failures: [
        {
          node_id: 2,
          fail_time: 34.0,
          recovery_time: 54.0
        }
      ],
      sla_target_ms: 300.0,
      cost_per_vcpu_hr: 0.048,
      cost_per_gb_hr: 0.006
    }
  },
  {
    id: "steady_state",
    name: "Normal Traffic — Stable Cluster",
    description: "A calm everyday workload. Use this first to see requests shared across servers without dramatic events.",
    category: "Basics",
    config: {
      name: "Baseline Steady-State Cloud",
      seed: 42,
      duration: 60.0,
      time_step: 0.5,
      initial_nodes: 3,
      default_cpu_per_node: 8.0,
      default_mem_per_node: 16.0,
      node_queue_limit: 50,
      scheduler: "ROUND_ROBIN",
      load_balancer: "ROUND_ROBIN",
      auto_scaler: {
        enabled: true,
        scale_up_threshold: 75.0,
        scale_down_threshold: 30.0,
        cooldown_period: 15.0,
        min_nodes: 2,
        max_nodes: 6,
        scale_up_step: 1,
        scale_down_step: 1
      },
      workload: {
        request_rate: 8.0,
        min_task_duration: 1.0,
        max_task_duration: 4.0,
        min_cpu: 1.0,
        max_cpu: 2.0,
        min_mem: 1.0,
        max_mem: 4.0,
        priority_high_ratio: 0.15,
        priority_med_ratio: 0.70,
        priority_low_ratio: 0.15
      },
      spikes: [],
      failures: [],
      sla_target_ms: 250.0,
      cost_per_vcpu_hr: 0.048,
      cost_per_gb_hr: 0.006
    }
  },
  {
    id: "elastic_spike",
    name: "Traffic Surge — Scale Up",
    description: "A short flash-sale spike adds servers when the starting two cannot keep up.",
    category: "Elasticity",
    config: {
      name: "Flash Sale Spike & Elastic Autoscaling",
      seed: 101,
      duration: 60.0,
      time_step: 0.5,
      initial_nodes: 2,
      default_cpu_per_node: 8.0,
      default_mem_per_node: 16.0,
      node_queue_limit: 60,
      scheduler: "LEAST_LOADED",
      load_balancer: "LEAST_CONNECTIONS",
      auto_scaler: {
        enabled: true,
        scale_up_threshold: 70.0,
        scale_down_threshold: 25.0,
        cooldown_period: 10.0,
        min_nodes: 2,
        max_nodes: 8,
        scale_up_step: 2,
        scale_down_step: 1
      },
      workload: {
        request_rate: 6.0,
        min_task_duration: 1.5,
        max_task_duration: 4.5,
        min_cpu: 1.5,
        max_cpu: 3.0,
        min_mem: 2.0,
        max_mem: 6.0,
        priority_high_ratio: 0.3,
        priority_med_ratio: 0.5,
        priority_low_ratio: 0.2
      },
      spikes: [
        {
          start_time: 18.0,
          duration: 12.0,
          additional_requests: 120
        }
      ],
      failures: [],
      sla_target_ms: 300.0,
      cost_per_vcpu_hr: 0.048,
      cost_per_gb_hr: 0.006
    }
  },
  {
    id: "node_outage",
    name: "Server Failure — Recover",
    description: "Server 2 fails, its work is affected, and the same server returns later.",
    category: "Fault Tolerance",
    config: {
      name: "Chaos Outage & Node Recovery",
      seed: 777,
      duration: 60.0,
      time_step: 0.5,
      initial_nodes: 3,
      default_cpu_per_node: 8.0,
      default_mem_per_node: 16.0,
      node_queue_limit: 40,
      scheduler: "LEAST_LOADED",
      load_balancer: "LEAST_CONNECTIONS",
      auto_scaler: {
        enabled: false,
        min_nodes: 3,
        max_nodes: 3
      },
      workload: {
        request_rate: 10.0,
        min_task_duration: 1.0,
        max_task_duration: 4.0,
        min_cpu: 1.0,
        max_cpu: 2.5,
        min_mem: 2.0,
        max_mem: 4.0,
        priority_high_ratio: 0.25,
        priority_med_ratio: 0.50,
        priority_low_ratio: 0.25
      },
      spikes: [],
      failures: [
        {
          node_id: 2,
          fail_time: 20.0,
          recovery_time: 42.0
        }
      ],
      sla_target_ms: 250.0,
      cost_per_vcpu_hr: 0.048,
      cost_per_gb_hr: 0.006
    }
  },
  {
    id: "priority_preemption",
    name: "Priority Traffic — Important Requests First",
    description: "Shows how high-priority requests are handled when the cluster is busy.",
    category: "Scheduling",
    config: {
      name: "Priority-Based Workload Scheduling",
      seed: 555,
      duration: 45.0,
      time_step: 0.5,
      initial_nodes: 2,
      default_cpu_per_node: 8.0,
      default_mem_per_node: 16.0,
      node_queue_limit: 50,
      scheduler: "PRIORITY_BASED",
      load_balancer: "LEAST_CONNECTIONS",
      auto_scaler: {
        enabled: false,
        min_nodes: 2,
        max_nodes: 2
      },
      workload: {
        request_rate: 14.0,
        min_task_duration: 2.0,
        max_task_duration: 6.0,
        min_cpu: 1.5,
        max_cpu: 3.5,
        min_mem: 2.0,
        max_mem: 6.0,
        priority_high_ratio: 0.35,
        priority_med_ratio: 0.35,
        priority_low_ratio: 0.30
      },
      spikes: [],
      failures: [],
      sla_target_ms: 200.0,
      cost_per_vcpu_hr: 0.048,
      cost_per_gb_hr: 0.006
    }
  },
  {
    id: "bottleneck_overload",
    name: "Too Few Servers — Queue & SLA Breach",
    description: "A fixed small cluster becomes overloaded, so requests wait or fail and the SLA is missed.",
    category: "SLA Analysis",
    config: {
      name: "Under-Provisioned Cluster & SLA Breach",
      seed: 888,
      duration: 40.0,
      time_step: 0.5,
      initial_nodes: 2,
      default_cpu_per_node: 4.0,
      default_mem_per_node: 8.0,
      node_queue_limit: 15,
      scheduler: "ROUND_ROBIN",
      load_balancer: "ROUND_ROBIN",
      auto_scaler: {
        enabled: false,
        min_nodes: 2,
        max_nodes: 2
      },
      workload: {
        request_rate: 18.0,
        min_task_duration: 2.5,
        max_task_duration: 5.5,
        min_cpu: 1.5,
        max_cpu: 3.0,
        min_mem: 2.0,
        max_mem: 4.0,
        priority_high_ratio: 0.2,
        priority_med_ratio: 0.5,
        priority_low_ratio: 0.3
      },
      spikes: [],
      failures: [],
      sla_target_ms: 150.0,
      cost_per_vcpu_hr: 0.048,
      cost_per_gb_hr: 0.006
    }
  },
  {
    id: "scale_up_and_down",
    name: "Autoscaling Story — Scale Up Then Down",
    description: "A burst arrives early, extra servers are added, and they are removed again after the burst finishes.",
    category: "Elasticity",
    config: {
      name: "Scale Up Then Down Demo",
      seed: 2026,
      duration: 50.0,
      time_step: 0.5,
      initial_nodes: 1,
      default_cpu_per_node: 4.0,
      default_mem_per_node: 8.0,
      node_queue_limit: 100,
      scheduler: "LEAST_LOADED",
      load_balancer: "LEAST_CONNECTIONS",
      auto_scaler: {
        enabled: true,
        scale_up_threshold: 45.0,
        scale_down_threshold: 15.0,
        cooldown_period: 4.0,
        min_nodes: 1,
        max_nodes: 5,
        scale_up_step: 1,
        scale_down_step: 1
      },
      workload: {
        request_rate: 0.3,
        min_task_duration: 1.0,
        max_task_duration: 2.0,
        min_cpu: 1.5,
        max_cpu: 2.0,
        min_mem: 2.0,
        max_mem: 3.0,
        priority_high_ratio: 0.2,
        priority_med_ratio: 0.6,
        priority_low_ratio: 0.2
      },
      spikes: [{ start_time: 6.0, duration: 10.0, additional_requests: 120 }],
      failures: [],
      sla_target_ms: 300.0,
      cost_per_vcpu_hr: 0.048,
      cost_per_gb_hr: 0.006
    }
  },
  {
    id: "scale_down_idle",
    name: "Scale Down — Remove Idle Servers",
    description: "Starts with too many servers and removes idle capacity one server at a time until only two remain.",
    category: "Elasticity",
    config: {
      name: "Idle Capacity Scale-Down Demo",
      seed: 314,
      duration: 32.0,
      time_step: 0.5,
      initial_nodes: 6,
      default_cpu_per_node: 4.0,
      default_mem_per_node: 8.0,
      node_queue_limit: 30,
      scheduler: "LEAST_LOADED",
      load_balancer: "LEAST_CONNECTIONS",
      auto_scaler: {
        enabled: true,
        scale_up_threshold: 85.0,
        scale_down_threshold: 20.0,
        cooldown_period: 4.0,
        min_nodes: 2,
        max_nodes: 6,
        scale_up_step: 1,
        scale_down_step: 1
      },
      workload: {
        request_rate: 0.1,
        min_task_duration: 0.5,
        max_task_duration: 1.0,
        min_cpu: 0.5,
        max_cpu: 1.0,
        min_mem: 0.5,
        max_mem: 1.0,
        priority_high_ratio: 0.2,
        priority_med_ratio: 0.6,
        priority_low_ratio: 0.2
      },
      spikes: [],
      failures: [],
      sla_target_ms: 300.0,
      cost_per_vcpu_hr: 0.048,
      cost_per_gb_hr: 0.006
    }
  }
];

function getPresets() {
  return PRESETS;
}

function getPresetById(id) {
  return PRESETS.find(p => p.id === id);
}

module.exports = {
  getPresets,
  getPresetById
};
