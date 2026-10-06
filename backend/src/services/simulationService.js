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

  const comparisonMatrix = runs.map(r => ({
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
    avgCpuUtil: r.result.summary.avg_cpu_utilization,
    peakCpuUtil: r.result.summary.peak_cpu_utilization,
    scaleUpEvents: r.result.summary.scale_up_events,
    scaleDownEvents: r.result.summary.scale_down_events,
    totalCostUsd: r.result.summary.total_cost_usd,
    costPer1000ReqUsd: r.result.summary.cost_per_1000_requests_usd,
    idleWasteUsd: r.result.summary.idle_waste_cost_usd,
    slaViolations: r.result.summary.sla_violation_count,
    slaCompliancePct: r.result.summary.sla_compliance_rate_pct,
    clusterAvailabilityPct: r.result.summary.cluster_availability_pct
  }));

  // Identify standout metrics & generate viva explanations
  const insights = generateVivaExplanations(comparisonMatrix);

  return {
    runsCount: runs.length,
    matrix: comparisonMatrix,
    insights
  };
}

function generateVivaExplanations(matrix) {
  const notes = [];

  // Sort by throughput
  const bestThroughput = [...matrix].sort((a, b) => b.throughputReqSec - a.throughputReqSec)[0];
  const lowestLatency = [...matrix].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)[0];
  const lowestCost = [...matrix].sort((a, b) => a.totalCostUsd - b.totalCostUsd)[0];
  const highestSla = [...matrix].sort((a, b) => b.slaCompliancePct - a.slaCompliancePct)[0];

  notes.push({
    category: "Throughput Champion",
    title: `${bestThroughput.name} achieved highest throughput (${bestThroughput.throughputReqSec.toFixed(2)} req/s)`,
    explanation: `Using ${bestThroughput.scheduler} with ${bestThroughput.loadBalancer}, this run effectively maximized server parallelism and kept queues moving smoothly.`
  });

  notes.push({
    category: "Latency & Responsiveness",
    title: `${lowestLatency.name} delivered lowest average latency (${lowestLatency.avgLatencyMs.toFixed(1)} ms)`,
    explanation: `P95 latency was ${lowestLatency.p95LatencyMs.toFixed(1)} ms. Proactive workload distribution avoided queuing hotspots on individual virtual nodes.`
  });

  notes.push({
    category: "Cost vs Performance Trade-off",
    title: `${lowestCost.name} had minimum simulated cost ($${lowestCost.totalCostUsd.toFixed(4)})`,
    explanation: `Cost efficiency stood at $${lowestCost.costPer1000ReqUsd.toFixed(4)} per 1,000 requests. Notice how tighter node scaling saves money, but evaluate if it compromised SLA targets.`
  });

  notes.push({
    category: "SLA & Reliability",
    title: `${highestSla.name} maintained highest SLA compliance (${highestSla.slaCompliancePct.toFixed(1)}%)`,
    explanation: `Experienced only ${highestSla.slaViolations} SLA breaches under target threshold. High availability was preserved throughout the test workload.`
  });

  return notes;
}

module.exports = {
  executeSimulation,
  addStreamSubscriber,
  getAllSimulations,
  getSimulationById,
  deleteSimulation,
  compareSimulations
};
