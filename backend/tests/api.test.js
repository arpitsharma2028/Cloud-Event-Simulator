process.env.NODE_ENV = 'test';
const http = require('http');
const assert = require('assert');
const app = require('../src/index');

let server;
const TEST_PORT = 5099;

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: TEST_PORT,
      ...options
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, rawBody: body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log("=========================================");
  console.log(" BACKEND API INTEGRATION TEST SUITE");
  console.log("=========================================");

  server = app.listen(TEST_PORT);

  try {
    // Test 1: Health check
    console.log("[TEST 1] Testing /health endpoint...");
    const healthRes = await request({ path: '/health', method: 'GET' });
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthRes.body.status, "HEALTHY");
    console.log("  -> PASSED: Health endpoint operational.");

    // Test 2: Presets list
    console.log("[TEST 2] Testing /api/presets endpoint...");
    const presetsRes = await request({ path: '/api/presets', method: 'GET' });
    assert.strictEqual(presetsRes.status, 200);
    assert(Array.isArray(presetsRes.body.presets));
    assert(presetsRes.body.presets.length >= 4);
    console.log(`  -> PASSED: Successfully loaded ${presetsRes.body.presets.length} presets.`);

    // Test 3: Validation error handling
    console.log("[TEST 3] Testing validation error on bad input...");
    const badInputRes = await request({
      path: '/api/simulations',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      duration: -5, // Invalid duration
      initial_nodes: 999 // Invalid node count
    });
    assert.strictEqual(badInputRes.status, 400);
    assert.strictEqual(badInputRes.body.error, "Validation failed");
    console.log("  -> PASSED: Schema validation rejected malformed request.");

    // Test 4: Full Simulation Execution via C++ engine
    console.log("[TEST 4] Testing execution of simulation through C++ binary...");
    const simRes1 = await request({
      path: '/api/simulations',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: "API Test Run 1 (Round Robin)",
      seed: 123,
      duration: 10.0,
      initial_nodes: 2,
      scheduler: "ROUND_ROBIN",
      load_balancer: "ROUND_ROBIN",
      workload: {
        request_rate: 6.0,
        min_task_duration: 1.0,
        max_task_duration: 2.0
      }
    });
    assert.strictEqual(simRes1.status, 201);
    assert.strictEqual(simRes1.body.status, "COMPLETED");
    assert(simRes1.body.summary);
    assert(simRes1.body.summary.total_requests_submitted > 0);
    assert(simRes1.body.result.nodes.length >= 2);
    console.log(`  -> PASSED: Run 1 completed successfully (${simRes1.body.summary.total_requests_completed} completed).`);

    // Test 5: Run second simulation with Least Loaded
    console.log("[TEST 5] Testing execution of second simulation (Least Loaded)...");
    const simRes2 = await request({
      path: '/api/simulations',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: "API Test Run 2 (Least Loaded)",
      seed: 123,
      duration: 10.0,
      initial_nodes: 2,
      scheduler: "LEAST_LOADED",
      load_balancer: "LEAST_CONNECTIONS",
      workload: {
        request_rate: 6.0,
        min_task_duration: 1.0,
        max_task_duration: 2.0
      }
    });
    assert.strictEqual(simRes2.status, 201);
    assert.strictEqual(simRes2.body.status, "COMPLETED");
    console.log("  -> PASSED: Run 2 completed successfully.");

    // Test 6: Compare runs
    console.log("[TEST 6] Testing /api/compare endpoint...");
    const compareRes = await request({
      path: '/api/compare',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      simulationIds: [simRes1.body.id, simRes2.body.id]
    });
    assert.strictEqual(compareRes.status, 200);
    assert.strictEqual(compareRes.body.runsCount, 2);
    assert(Array.isArray(compareRes.body.matrix));
    assert(Array.isArray(compareRes.body.metricTable));
    assert(Array.isArray(compareRes.body.ranking));
    assert(Array.isArray(compareRes.body.insights));
    console.log(`  -> PASSED: Generated comparative analytics with ${compareRes.body.insights.length} Viva insights.`);

    // Test 7: Multi-Policy Experiment Benchmark (/api/compare/experiment)
    console.log("[TEST 7] Testing /api/compare/experiment endpoint (Fixed Seed Workbench)...");
    const experimentRes = await request({
      path: '/api/compare/experiment',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      baseConfig: {
        duration: 10.0,
        initial_nodes: 2,
        seed: 42,
        workload: {
          request_rate: 8.0,
          min_task_duration: 1.0,
          max_task_duration: 2.0
        }
      },
      experimentType: "SCHEDULING",
      policies: ["ROUND_ROBIN", "LEAST_LOADED", "PRIORITY_BASED"]
    });
    assert.strictEqual(experimentRes.status, 200);
    assert.strictEqual(experimentRes.body.runsCount, 3);
    assert(Array.isArray(experimentRes.body.matrix));
    assert(Array.isArray(experimentRes.body.metricTable));
    assert(Array.isArray(experimentRes.body.ranking));
    assert.strictEqual(experimentRes.body.ranking.length, 3);
    assert(experimentRes.body.metricTable.some(m => m.metric === "Avg Response Time"));
    assert(experimentRes.body.metricTable.some(m => m.metric === "Throughput"));
    assert(experimentRes.body.metricTable.some(m => m.metric === "Simulated Cost"));
    console.log(`  -> PASSED: Experiment benchmark completed with ranking (#1: ${experimentRes.body.ranking[0].name}).`);

    console.log("=========================================");
    console.log(" ALL BACKEND API TESTS PASSED (7/7)!");
    console.log("=========================================");
    process.exit(0);
  } finally {
    if (server) server.close();
  }
}

runTests().catch(err => {
  console.error("Test failed:", err);
  if (server) server.close();
  process.exit(1);
});
