const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// In-memory registry of simulations
const simulationRegistry = new Map();
// Active streaming subscriptions: simId -> Set of SSE response objects
const streamSubscribers = new Map();

// Path to compiled C++ simulation engine binary
const ENGINE_PATH = path.resolve(__dirname, '../../../simulation-engine/bin/cloud_sim_engine.exe');

/**
 * Runs a deterministic simulation through the C++ executable
 * @param {Object} validatedConfig 
 * @param {Boolean} isStream 
 * @returns {Promise<Object>}
 */
async function executeSimulation(validatedConfig, isStream = false) {
  const simulationId = uuidv4();
  const startTime = Date.now();

  const record = {
    id: simulationId,
    config: validatedConfig,
    status: "RUNNING",
    createdAt: new Date().toISOString(),
    result: null,
    error: null,
    executionTimeMs: 0
  };

  simulationRegistry.set(simulationId, record);

  if (!fs.existsSync(ENGINE_PATH)) {
    record.status = "FAILED";
    record.error = `C++ simulation engine binary not found at ${ENGINE_PATH}. Please compile it first.`;
    throw new Error(record.error);
  }

  // Create temporary config file for process execution
  const tempConfigDir = path.resolve(__dirname, '../../temp');
  if (!fs.existsSync(tempConfigDir)) {
    fs.mkdirSync(tempConfigDir, { recursive: true });
  }

  const tempConfigFile = path.join(tempConfigDir, `sim_${simulationId}_config.json`);
  const tempOutputFile = path.join(tempConfigDir, `sim_${simulationId}_result.json`);

  fs.writeFileSync(tempConfigFile, JSON.stringify(validatedConfig, null, 2), 'utf8');

  return new Promise((resolve, reject) => {
    const args = ['--config', tempConfigFile, '--output', tempOutputFile];
    if (isStream) {
      args.push('--stream');
    }

    // Direct process spawn prevents shell command injection
    const child = spawn(ENGINE_PATH, args, {
      windowsHide: true
    });

    let stderrData = '';

    // Safety timeout: 45 seconds max wall clock
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      record.status = "TIMEOUT";
      record.error = "Simulation execution exceeded the 45-second wall clock safety timeout.";
      cleanupTempFiles();
      reject(new Error(record.error));
    }, 45000);

    // If streaming mode, capture NDJSON lines from stdout and push to SSE subscribers
    if (isStream) {
      let buffer = '';
      child.stdout.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.length > 0) {
            broadcastToSubscribers(simulationId, {
              event: 'step',
              data: trimmed
            });
          }
        }
      });
    }

    child.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      record.status = "FAILED";
      record.error = `Failed to spawn simulation engine process: ${err.message}`;
      cleanupTempFiles();
      reject(new Error(record.error));
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      record.executionTimeMs = Date.now() - startTime;

      if (code !== 0) {
        record.status = "FAILED";
        record.error = `Engine process exited with code ${code}. Error output: ${stderrData || "Unknown internal error"}`;
        cleanupTempFiles();
        reject(new Error(record.error));
        return;
      }

      try {
        if (fs.existsSync(tempOutputFile)) {
          const rawResult = fs.readFileSync(tempOutputFile, 'utf8');
          const parsedResult = JSON.parse(rawResult);
          record.result = parsedResult;
          record.status = "COMPLETED";

          broadcastToSubscribers(simulationId, {
            event: 'complete',
            data: JSON.stringify({ status: "COMPLETED", summary: parsedResult.summary })
          });

          cleanupTempFiles();
          resolve(record);
        } else {
          record.status = "FAILED";
          record.error = "Engine completed execution but result file was not generated.";
          cleanupTempFiles();
          reject(new Error(record.error));
        }
      } catch (parseErr) {
        record.status = "FAILED";
        record.error = `Failed to parse engine output JSON: ${parseErr.message}`;
        cleanupTempFiles();
        reject(new Error(record.error));
      }
    });

    function cleanupTempFiles() {
      try {
        if (fs.existsSync(tempConfigFile)) fs.unlinkSync(tempConfigFile);
        if (fs.existsSync(tempOutputFile)) fs.unlinkSync(tempOutputFile);
      } catch (e) {
        // Ignored
      }
    }
  });
}

function broadcastToSubscribers(simulationId, payload) {
  const subscribers = streamSubscribers.get(simulationId);
  if (!subscribers) return;

  const message = `event: ${payload.event}\ndata: ${payload.data}\n\n`;
  for (const res of subscribers) {
    try {
      res.write(message);
    } catch (e) {
      subscribers.delete(res);
    }
  }
}

function addStreamSubscriber(simulationId, res) {
  if (!streamSubscribers.has(simulationId)) {
    streamSubscribers.set(simulationId, new Set());
  }
  streamSubscribers.get(simulationId).add(res);

  res.on('close', () => {
    const set = streamSubscribers.get(simulationId);
    if (set) {
      set.delete(res);
      if (set.size === 0) {
        streamSubscribers.delete(simulationId);
      }
    }
  });
}

function getAllSimulations() {
  const list = [];
  for (const [id, rec] of simulationRegistry.entries()) {
    list.push({
      id: rec.id,
      name: rec.config.name,
      status: rec.status,
      createdAt: rec.createdAt,
      executionTimeMs: rec.executionTimeMs,
      summary: rec.result ? rec.result.summary : null,
      scheduler: rec.config.scheduler,
      loadBalancer: rec.config.load_balancer,
      autoScalerEnabled: rec.config.auto_scaler ? rec.config.auto_scaler.enabled : false
    });
  }
  // Sort descending by creation date
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getSimulationById(id) {
  return simulationRegistry.get(id) || null;
}

function deleteSimulation(id) {
  return simulationRegistry.delete(id);
}

/**
 * Transform simulation runs into standardized comparative matrix
 */
function buildMatrixFromRuns(runs) {
  return runs.map(r => ({
    id: r.id,
    name: r.config.name,
    scheduler: r.config.scheduler,
    loadBalancer: r.config.load_balancer,
    autoScalerEnabled: r.config.auto_scaler ? r.config.auto_scaler.enabled : false,
    initialNodes: r.config.initial_nodes,
    totalRequests: r.result.summary.total_requests_submitted,
    completedRequests: r.result.summary.total_requests_completed,
    failedRequests: r.result.summary.total_requests_failed,
    rejectedRequests: r.result.summary.total_requests_rejected,
    successRatePct: r.result.summary.overall_success_rate_pct,
    throughputReqSec: r.result.summary.overall_throughput_req_per_sec,
    avgLatencyMs: r.result.summary.avg_latency_ms,
    p95LatencyMs: r.result.summary.p95_latency_ms,
    p99LatencyMs: r.result.summary.p99_latency_ms,
    avgQueueWaitMs: r.result.summary.avg_queue_wait_ms ?? 0,
    maxQueueWaitMs: r.result.summary.max_queue_wait_ms ?? 0,
    avgQueueLength: r.result.summary.avg_queue_length ?? 0,
    peakQueueLength: r.result.summary.peak_queue_length ?? 0,
    avgCpuUtil: r.result.summary.avg_cpu_utilization,
    peakCpuUtil: r.result.summary.peak_cpu_utilization,
    avgMemUtil: r.result.summary.avg_mem_utilization ?? 0,
    peakMemUtil: r.result.summary.peak_mem_utilization ?? 0,
    scaleUpEvents: r.result.summary.scale_up_events,
    scaleDownEvents: r.result.summary.scale_down_events,
    nodeFailures: r.result.summary.total_node_failures ?? 0,
    nodeRecoveries: r.result.summary.total_node_recoveries ?? 0,
    totalCostUsd: r.result.summary.total_cost_usd,
    costPer1000ReqUsd: r.result.summary.cost_per_1000_requests_usd,
    idleWasteUsd: r.result.summary.idle_waste_cost_usd,
    slaViolations: r.result.summary.sla_violation_count,
    slaCompliancePct: r.result.summary.sla_compliance_rate_pct,
    clusterAvailabilityPct: r.result.summary.cluster_availability_pct
  }));
}

/**
 * Format side-by-side metric comparison table matching Section 3 requirements:
 * Metric | Variant 1 | Variant 2 | Variant 3...
 */
function formatMetricTable(matrix) {
  const definitions = [
    { label: "Avg Response Time", key: "avgLatencyMs", unit: "ms", lowerIsBetter: true },
    { label: "Avg Queue Wait", key: "avgQueueWaitMs", unit: "ms", lowerIsBetter: true },
    { label: "Throughput", key: "throughputReqSec", unit: "req/s", lowerIsBetter: false },
    { label: "Avg CPU Utilization", key: "avgCpuUtil", unit: "%", lowerIsBetter: null },
    { label: "Avg Memory Utilization", key: "avgMemUtil", unit: "%", lowerIsBetter: null },
    { label: "Peak Queue Length", key: "peakQueueLength", unit: "tasks", lowerIsBetter: true },
    { label: "Completed Requests", key: "completedRequests", unit: "reqs", lowerIsBetter: false },
    { label: "Failed Requests", key: "failedRequests", unit: "reqs", lowerIsBetter: true },
    { label: "SLA Violations", key: "slaViolations", unit: "breaches", lowerIsBetter: true },
    { label: "SLA Compliance Rate", key: "slaCompliancePct", unit: "%", lowerIsBetter: false },
    { label: "Scaling Events", key: "scalingEvents", unit: "events", lowerIsBetter: null,
      format: r => `+${r.scaleUpEvents} / -${r.scaleDownEvents}` },
    { label: "Node Failures", key: "nodeFailures", unit: "events", lowerIsBetter: true },
    { label: "Simulated Cost", key: "totalCostUsd", unit: "$", lowerIsBetter: true,
      format: r => `$${r.totalCostUsd.toFixed(4)}` },
    { label: "Cost per 1k Reqs", key: "costPer1000ReqUsd", unit: "$", lowerIsBetter: true,
      format: r => `$${r.costPer1000ReqUsd.toFixed(4)}` }
  ];

  return definitions.map(def => {
    const values = {};
    let bestVariantId = null;
    let bestValue = null;

    matrix.forEach(run => {
      const rawVal = run[def.key];
      values[run.id] = def.format ? def.format(run) : (typeof rawVal === 'number' ? Number(rawVal.toFixed(2)) : rawVal);

      if (def.lowerIsBetter !== null && typeof rawVal === 'number') {
        if (bestValue === null) {
          bestValue = rawVal;
          bestVariantId = run.id;
        } else if (def.lowerIsBetter && rawVal < bestValue) {
          bestValue = rawVal;
          bestVariantId = run.id;
        } else if (!def.lowerIsBetter && rawVal > bestValue) {
          bestValue = rawVal;
          bestVariantId = run.id;
        }
      }
    });

    return {
      metric: def.label,
      unit: def.unit,
      values,
      bestVariantId
    };
  });
}

/**
 * Multi-objective policy ranking based on SLA, Latency, Throughput, and Cost
 */
function calculatePolicyRankings(matrix) {
  const maxLatency = Math.max(...matrix.map(m => m.avgLatencyMs || 1));
  const maxThroughput = Math.max(...matrix.map(m => m.throughputReqSec || 1));
  const maxCost = Math.max(...matrix.map(m => m.totalCostUsd || 1));

  const scored = matrix.map(m => {
    const slaScore = (m.slaCompliancePct / 100) * 35;
    const latencyScore = ((maxLatency - m.avgLatencyMs) / maxLatency) * 25;
    const throughputScore = (m.throughputReqSec / maxThroughput) * 20;
    const costScore = ((maxCost - m.totalCostUsd) / maxCost) * 20;
    const compositeScore = Math.max(0, Math.min(100, slaScore + latencyScore + throughputScore + costScore));

    return {
      id: m.id,
      name: m.name,
      scheduler: m.scheduler,
      loadBalancer: m.loadBalancer,
      score: Number(compositeScore.toFixed(1)),
      slaCompliancePct: m.slaCompliancePct,
      avgLatencyMs: m.avgLatencyMs,
      throughputReqSec: m.throughputReqSec,
      totalCostUsd: m.totalCostUsd
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.map((s, idx) => ({
    ...s,
    rank: idx + 1,
    grade: s.score >= 85 ? 'A+' : s.score >= 70 ? 'A' : s.score >= 55 ? 'B' : 'C'
  }));
}

/**
 * Compare two or more completed simulation runs side-by-side
 * Generates comparative metric matrix and academic insights
 */
function compareSimulations(simIds) {
  const runs = [];
  for (const id of simIds) {
    const rec = simulationRegistry.get(id);
    if (rec && rec.result && rec.result.summary) {
      runs.push(rec);
    }
  }

  if (runs.length < 2) {
    throw new Error("At least two completed simulations are required for comparison.");
  }

  const comparisonMatrix = buildMatrixFromRuns(runs);
  const metricTable = formatMetricTable(comparisonMatrix);
  const ranking = calculatePolicyRankings(comparisonMatrix);
  const insights = generateVivaExplanations(comparisonMatrix);

  return {
    runsCount: runs.length,
    matrix: comparisonMatrix,
    metricTable,
    ranking,
    insights
  };
}

/**
 * Run a multi-policy experimentation benchmark on identical workload & seed
 */
async function runExperiment({ baseConfig, experimentType = 'SCHEDULING', policies = [], seed }) {
  if (!baseConfig) {
    throw new Error("baseConfig is required for policy experimentation.");
  }

  const experimentSeed = seed !== undefined ? Number(seed) : (baseConfig.seed || 42);
  let variants = [];

  if (experimentType === 'SCHEDULING') {
    const targetPolicies = policies.length > 0
      ? policies
      : ['ROUND_ROBIN', 'LEAST_LOADED', 'PRIORITY_BASED', 'FIRST_FIT'];

    variants = targetPolicies.map(p => ({
      name: `${p.replace(/_/g, ' ')} Policy`,
      scheduler: p,
      loadBalancer: baseConfig.load_balancer || 'ROUND_ROBIN',
      autoScaler: baseConfig.auto_scaler
    }));
  } else if (experimentType === 'LOAD_BALANCING') {
    const targetLBs = policies.length > 0
      ? policies
      : ['ROUND_ROBIN', 'LEAST_CONNECTIONS', 'WEIGHTED'];

    variants = targetLBs.map(lb => ({
      name: `${lb.replace(/_/g, ' ')} Load Balancer`,
      scheduler: baseConfig.scheduler || 'ROUND_ROBIN',
      loadBalancer: lb,
      autoScaler: baseConfig.auto_scaler
    }));
  } else if (experimentType === 'AUTOSCALING') {
    variants = [
      {
        name: 'Fixed Capacity (No Scaling)',
        scheduler: baseConfig.scheduler || 'LEAST_LOADED',
        loadBalancer: baseConfig.load_balancer || 'LEAST_CONNECTIONS',
        autoScaler: { enabled: false, min_nodes: baseConfig.initial_nodes || 2, max_nodes: baseConfig.initial_nodes || 2 }
      },
      {
        name: 'Reactive Elasticity (Std Thresholds)',
        scheduler: baseConfig.scheduler || 'LEAST_LOADED',
        loadBalancer: baseConfig.load_balancer || 'LEAST_CONNECTIONS',
        autoScaler: { enabled: true, scale_up_threshold: 70.0, scale_down_threshold: 30.0, cooldown_period: 10.0, min_nodes: 2, max_nodes: 6, scale_up_step: 1, scale_down_step: 1 }
      },
      {
        name: 'Aggressive Elasticity (Fast Scale)',
        scheduler: baseConfig.scheduler || 'LEAST_LOADED',
        loadBalancer: baseConfig.load_balancer || 'LEAST_CONNECTIONS',
        autoScaler: { enabled: true, scale_up_threshold: 55.0, scale_down_threshold: 35.0, cooldown_period: 6.0, min_nodes: 2, max_nodes: 8, scale_up_step: 2, scale_down_step: 1 }
      }
    ];
  } else {
    throw new Error(`Unsupported experimentType: ${experimentType}`);
  }

  // Execute each variant with exact same seed and workload
  const completedRuns = [];
  for (const variant of variants) {
    const runConfig = {
      ...baseConfig,
      name: variant.name,
      seed: experimentSeed,
      scheduler: variant.scheduler,
      load_balancer: variant.loadBalancer,
      auto_scaler: variant.autoScaler
    };

    const runRecord = await executeSimulation(runConfig);
    completedRuns.push(runRecord);
  }

  const matrix = buildMatrixFromRuns(completedRuns);
  const metricTable = formatMetricTable(matrix);
  const ranking = calculatePolicyRankings(matrix);
  const insights = generateVivaExplanations(matrix);

  return {
    experimentType,
    seed: experimentSeed,
    runsCount: completedRuns.length,
    matrix,
    metricTable,
    ranking,
    insights
  };
}

function generateVivaExplanations(matrix) {
  const notes = [];

  const bestThroughput = [...matrix].sort((a, b) => b.throughputReqSec - a.throughputReqSec)[0];
  const lowestLatency = [...matrix].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)[0];
  const lowestCost = [...matrix].sort((a, b) => a.totalCostUsd - b.totalCostUsd)[0];
  const highestSla = [...matrix].sort((a, b) => b.slaCompliancePct - a.slaCompliancePct)[0];

  if (bestThroughput) {
    notes.push({
      category: "Throughput Champion",
      title: `${bestThroughput.name} achieved highest throughput (${bestThroughput.throughputReqSec.toFixed(2)} req/s)`,
      explanation: `Using ${bestThroughput.scheduler} with ${bestThroughput.loadBalancer}, this configuration maximized cluster concurrency and minimized idling.`
    });
  }

  if (lowestLatency) {
    notes.push({
      category: "Latency & Responsiveness",
      title: `${lowestLatency.name} delivered lowest average latency (${lowestLatency.avgLatencyMs.toFixed(1)} ms)`,
      explanation: `Average queue wait time was ${lowestLatency.avgQueueWaitMs.toFixed(1)} ms. Proactive load balancing minimized task queuing behind heavy jobs.`
    });
  }

  if (lowestCost) {
    notes.push({
      category: "Cost vs Performance Trade-off",
      title: `${lowestCost.name} had minimum simulated cost ($${lowestCost.totalCostUsd.toFixed(4)})`,
      explanation: `Cost efficiency was $${lowestCost.costPer1000ReqUsd.toFixed(4)} per 1,000 requests. Note the balance between provisioned node hours and SLA targets.`
    });
  }

  if (highestSla) {
    notes.push({
      category: "SLA & Reliability",
      title: `${highestSla.name} maintained highest SLA compliance (${highestSla.slaCompliancePct.toFixed(1)}%)`,
      explanation: `Experienced ${highestSla.slaViolations} SLA breaches under target threshold. High service availability was preserved throughout the test workload.`
    });
  }

  return notes;
}

module.exports = {
  executeSimulation,
  addStreamSubscriber,
  getAllSimulations,
  getSimulationById,
  deleteSimulation,
  compareSimulations,
  runExperiment
};
