const PRESETS = [
  {
    id: "full_lifecycle",
    name: "End-to-End Cloud Lifecycle (Spike, Auto-Scale, Failure, Recovery, Scale-Down)",
    description: "Comprehensive demonstration: Normal workload -> traffic surge at T=15s -> high cluster utilization -> reactive autoscaling adds node -> Node 2 crashes at T=34s -> task eviction and redistribution -> Node 2 recovers at T=54s -> surge abates and cluster scales down.",
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
    name: "Baseline Steady-State Cloud",
    description: "Standard balanced workload showing smooth scheduling and high SLA compliance under normal traffic.",
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
    name: "Flash Sale Spike & Elastic Autoscaling",
    description: "Sudden traffic surge at T=20s triggers horizontal auto-scaling, adding nodes to protect SLA before cooling down.",
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
    name: "Chaos Outage & Node Recovery",
    description: "Simulates sudden crash of Node 2 at T=20s with task eviction, followed by automated node recovery at T=42s.",
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
    name: "Priority-Based Workload Scheduling",
    description: "Evaluates prioritization of Mission-Critical (P1) tasks over Batch (P3) workloads during heavy cluster utilization.",
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
    name: "Under-Provisioned Cluster & SLA Breach",
    description: "Severe overload on fixed-capacity cluster to demonstrate backpressure queue saturation and high SLA breach rate.",
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
