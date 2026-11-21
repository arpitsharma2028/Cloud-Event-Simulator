const assert = require('assert');
const { SimulationSchema } = require('../src/schemas/validation');
const { getPresets } = require('../src/services/presetsService');
const { executeSimulation, runExperiment } = require('../src/services/simulationService');

async function run(config) {
  const result = (await executeSimulation(config)).result;
  const s = result.summary;
  assert.equal(s.total_requests_submitted, s.total_requests_completed + s.total_requests_failed + s.total_requests_rejected + s.total_requests_unfinished);
  assert(result.snapshots.length);
  for (const snap of result.snapshots) {
    assert(Array.isArray(snap.nodes));
    assert.equal(snap.nodes.length, snap.active_nodes);
    assert.equal(snap.nodes.reduce((n, node) => n + node.active_tasks, 0), snap.active_tasks);
    assert.equal(snap.nodes.reduce((n, node) => n + node.queued_tasks, 0), snap.queued_tasks);
    assert(snap.timestamp <= config.duration);
    for (const node of snap.nodes) {
      assert(node.cpu_used <= node.cpu_capacity + 0.001);
      assert(node.mem_used <= node.mem_capacity + 0.001);
    }
  }
  assert(result.decision_trace.every(t => /^\[T=/.test(t)));
  return result;
}

async function main() {
  for (const bad of [
    { workload: { min_mem: 8, max_mem: 1 } },
    { workload: { priority_high_ratio: 1, priority_med_ratio: 1 } },
    { initial_nodes: 16, auto_scaler: { max_nodes: 2 } },
    { auto_scaler: { scale_up_threshold: 20, scale_down_threshold: 80 } },
    { node_weights: [1, 2] }
  ]) assert(!SimulationSchema.safeParse(bad).success);

  for (const p of getPresets()) {
    const r = await run(p.config), s = r.summary;
    if (p.id === 'steady_state') {
      assert.equal(s.scale_up_events + s.scale_down_events, 0);
      assert(s.sla_compliance_rate_pct > 90);
    }
    if (p.id === 'scale_up_and_down' || p.id === 'full_lifecycle') {
      assert(s.scale_up_events > 0, `${p.id}: no scale up`);
      assert(s.scale_down_events > 0, `${p.id}: no scale down`);
    }
    if (p.id === 'scale_down_idle') {
      assert(s.total_requests_completed > 0);
      assert.equal(r.nodes.length, p.config.auto_scaler.min_nodes);
      assert.equal(s.total_requests_failed, 0);
    }
    if (p.id === 'node_outage' || p.id === 'full_lifecycle') {
      assert.equal(s.total_node_failures, 1);
      assert.equal(s.total_node_recoveries, 1);
    }
    if (p.id === 'bottleneck_overload') {
      assert(s.total_requests_rejected > 0);
      assert(s.sla_violation_count > 0);
    }
    console.log(JSON.stringify({ preset: p.id, completed: s.total_requests_completed, up: s.scale_up_events, down: s.scale_down_events, sla: s.sla_compliance_rate_pct, cost: s.total_cost_usd }));
  }

  const impossible = await run({ name: 'Impossible', duration: 20, initial_nodes: 16, default_cpu_per_node: 1, auto_scaler: { enabled: false }, workload: { request_rate: 3, min_cpu: 2, max_cpu: 2 } });
  assert.equal(impossible.summary.total_requests_completed, 0);
  assert.equal(impossible.summary.total_requests_unfinished, 0);
  assert.equal(impossible.summary.total_requests_rejected, impossible.summary.total_requests_submitted);
  assert.equal(impossible.summary.sla_sample_count, 0);
  const weights = await run({ duration: 20, initial_nodes: 3, default_cpu_per_node: 64, default_mem_per_node: 256, node_weights: [1, 2, 4], load_balancer: 'WEIGHTED', auto_scaler: { enabled: false }, workload: { request_rate: 100, min_task_duration: 0.5, max_task_duration: 0.5, min_cpu: 0.5, max_cpu: 0.5, min_mem: 0.5, max_mem: 0.5 } });
  const allocated = weights.nodes.map(node => weights.event_log.filter(e => e.type === 'REQUEST_ARRIVAL' && e.node_id === node.id).length);
  assert(allocated[2] > allocated[1] * 1.8 && allocated[1] > allocated[0] * 1.8, `Weights ignored: ${allocated}`);
  console.log('Weighted routing counts (1:2:4):', allocated);
  const bounds = await run({ duration: 20, initial_nodes: 2, auto_scaler: { enabled: true, min_nodes: 2, max_nodes: 2 }, workload: { request_rate: 100 } });
  assert(bounds.snapshots.every(s => s.active_nodes === 2));
  await assert.rejects(runExperiment({ baseConfig: { duration: -1 }, policies: ['ROUND_ROBIN'] }));
  const emptyExperiment = await runExperiment({ baseConfig: { duration: 5, default_cpu_per_node: 1, auto_scaler: { enabled: false }, workload: { min_cpu: 2, max_cpu: 2 } }, policies: ['ROUND_ROBIN', 'LEAST_LOADED'] });
  assert(emptyExperiment.ranking.every(r => r.completedRequests === 0 && r.score === 0));
  console.log('Behavior regression checks passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
