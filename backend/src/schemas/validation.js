const { z } = require('zod');

const SimulationSchema = z.object({
  name: z.string().min(1).max(100).default("Cloud Simulation"),
  seed: z.number().int().min(0).max(2147483647).default(42),
  duration: z.number().min(5).max(300).default(60.0),
  time_step: z.number().min(0.1).max(5.0).default(0.5),

  initial_nodes: z.number().int().min(1).max(20).default(3),
  default_cpu_per_node: z.number().min(1).max(64).default(8.0),
  default_mem_per_node: z.number().min(1).max(256).default(16.0),
  node_queue_limit: z.number().int().min(1).max(500).default(50),
  node_weights: z.array(z.number().min(0.1).max(100)).max(20).default([]),

  scheduler: z.enum([
    "ROUND_ROBIN",
    "LEAST_LOADED",
    "PRIORITY_BASED",
    "FIRST_FIT"
  ]).default("ROUND_ROBIN"),

  load_balancer: z.enum([
    "NONE",
    "ROUND_ROBIN",
    "LEAST_CONNECTIONS",
    "WEIGHTED"
  ]).default("NONE"),

  auto_scaler: z.object({
    enabled: z.boolean().default(true),
    scale_up_threshold: z.number().min(10).max(100).default(75.0),
    scale_down_threshold: z.number().min(5).max(90).default(30.0),
    cooldown_period: z.number().min(1).max(60).default(15.0),
    min_nodes: z.number().int().min(1).max(20).default(2),
    max_nodes: z.number().int().min(1).max(20).default(10),
    scale_up_step: z.number().int().min(1).max(5).default(1),
    scale_down_step: z.number().int().min(1).max(5).default(1)
  }).default({}),

  workload: z.object({
    request_rate: z.number().min(0.1).max(100.0).default(10.0),
    min_task_duration: z.number().min(0.1).max(30.0).default(1.0),
    max_task_duration: z.number().min(0.5).max(60.0).default(5.0),
    min_cpu: z.number().min(0.5).max(16.0).default(1.0),
    max_cpu: z.number().min(0.5).max(16.0).default(2.0),
    min_mem: z.number().min(0.5).max(32.0).default(1.0),
    max_mem: z.number().min(0.5).max(32.0).default(4.0),
    priority_high_ratio: z.number().min(0.0).max(1.0).default(0.2),
    priority_med_ratio: z.number().min(0.0).max(1.0).default(0.6),
    priority_low_ratio: z.number().min(0.0).max(1.0).default(0.2)
  }).default({}),

  spikes: z.array(z.object({
    start_time: z.number().min(0).max(300),
    duration: z.number().min(1).max(60),
    additional_requests: z.number().int().min(1).max(1000)
  })).default([]),

  failures: z.array(z.object({
    node_id: z.number().int().min(1).max(20),
    fail_time: z.number().min(0).max(300),
    recovery_time: z.number().min(0).max(300)
  })).default([]),

  sla_target_ms: z.number().min(10).max(10000).default(250.0),
  cost_per_vcpu_hr: z.number().min(0.001).max(10.0).default(0.048),
  cost_per_gb_hr: z.number().min(0.0001).max(5.0).default(0.006)
}).superRefine((data, ctx) => {
  const issue = (path, message) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  if (data.auto_scaler.enabled) {
    if (data.initial_nodes < data.auto_scaler.min_nodes || data.initial_nodes > data.auto_scaler.max_nodes)
      issue(['initial_nodes'], 'Initial nodes must be within the autoscaling minimum and maximum.');
    if (data.auto_scaler.scale_down_threshold >= data.auto_scaler.scale_up_threshold)
      issue(['auto_scaler', 'scale_down_threshold'], 'Scale-down threshold must be below scale-up threshold.');
  }
  if (data.workload.min_mem > data.workload.max_mem) issue(['workload', 'min_mem'], 'Minimum RAM cannot exceed maximum RAM.');
  const sum = data.workload.priority_high_ratio + data.workload.priority_med_ratio + data.workload.priority_low_ratio;
  if (Math.abs(sum - 1) > 0.00001) issue(['workload'], 'Priority ratios must sum to 1.');
  if (data.node_weights.length && data.node_weights.length !== data.initial_nodes)
    issue(['node_weights'], 'Provide one weight per initial node, or leave weights empty for equal routing.');
  for (const [i, spike] of data.spikes.entries()) {
    if (spike.start_time + spike.duration > data.duration) issue(['spikes', i], 'Spike must fit within simulation duration.');
  }
  for (const [i, failure] of data.failures.entries()) {
    if (failure.node_id > data.initial_nodes) issue(['failures', i, 'node_id'], 'Choose an initial node for a scheduled failure.');
    if (failure.fail_time >= failure.recovery_time || failure.recovery_time > data.duration)
      issue(['failures', i], 'Failure must occur before recovery, within simulation duration.');
    if (data.failures.some((other, j) => j < i && other.node_id === failure.node_id && other.fail_time < failure.recovery_time && failure.fail_time < other.recovery_time))
      issue(['failures', i], 'Outages on the same node cannot overlap.');
  }
  if (data.spikes.reduce((sum, s) => sum + s.additional_requests, 0) > 5000)
    issue(['spikes'], 'Combined spikes cannot exceed 5000 extra requests.');
}).refine(data => {
  return data.auto_scaler.min_nodes <= data.auto_scaler.max_nodes;
}, {
  message: "Auto-scaler minimum nodes cannot be greater than maximum nodes.",
  path: ["auto_scaler", "min_nodes"]
}).refine(data => {
  return data.workload.min_task_duration <= data.workload.max_task_duration;
}, {
  message: "Workload minimum task duration cannot exceed maximum task duration.",
  path: ["workload", "min_task_duration"]
}).refine(data => {
  return data.workload.min_cpu <= data.workload.max_cpu;
}, {
  message: "Workload minimum CPU cannot exceed maximum CPU.",
  path: ["workload", "min_cpu"]
});

module.exports = {
  SimulationSchema
};
