const express = require('express');
const router = express.Router();
const { SimulationSchema } = require('../schemas/validation');
const {
  executeSimulation,
  addStreamSubscriber,
  getAllSimulations,
  getSimulationById,
  deleteSimulation
} = require('../services/simulationService');

// POST /api/simulations - Create and execute new simulation
router.post('/', async (req, res, next) => {
  try {
    const parseResult = SimulationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parseResult.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }

    const stream = req.query.stream === 'true';
    const simulationRecord = await executeSimulation(parseResult.data, stream);

    res.status(201).json({
      id: simulationRecord.id,
      name: simulationRecord.config.name,
      status: simulationRecord.status,
      executionTimeMs: simulationRecord.executionTimeMs,
      summary: simulationRecord.result ? simulationRecord.result.summary : null,
      result: simulationRecord.result
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/simulations - List all simulations
router.get('/', (req, res) => {
  const sims = getAllSimulations();
  res.json({ count: sims.length, simulations: sims });
});

// GET /api/simulations/:id - Get specific simulation full results
router.get('/:id', (req, res) => {
  const sim = getSimulationById(req.params.id);
  if (!sim) {
    return res.status(404).json({ error: "Simulation not found" });
  }
  res.json(sim);
});

// GET /api/simulations/:id/events - Get events log
router.get('/:id/events', (req, res) => {
  const sim = getSimulationById(req.params.id);
  if (!sim || !sim.result) {
    return res.status(404).json({ error: "Simulation or results not found" });
  }
  res.json({ events: sim.result.event_log || [] });
});

// GET /api/simulations/:id/metrics - Get timeseries telemetry metrics
router.get('/:id/metrics', (req, res) => {
  const sim = getSimulationById(req.params.id);
  if (!sim || !sim.result) {
    return res.status(404).json({ error: "Simulation or results not found" });
  }
  res.json({ snapshots: sim.result.snapshots || [] });
});

// GET /api/simulations/:id/nodes - Get nodes state
router.get('/:id/nodes', (req, res) => {
  const sim = getSimulationById(req.params.id);
  if (!sim || !sim.result) {
    return res.status(404).json({ error: "Simulation or results not found" });
  }
  res.json({ nodes: sim.result.nodes || [] });
});

// GET /api/simulations/:id/trace - Get explainable trace logs
router.get('/:id/trace', (req, res) => {
  const sim = getSimulationById(req.params.id);
  if (!sim || !sim.result) {
    return res.status(404).json({ error: "Simulation or results not found" });
  }
  res.json({ trace: sim.result.decision_trace || [] });
});

// GET /api/simulations/:id/stream - Server-Sent Events (SSE) live updates
router.get('/:id/stream', (req, res) => {
  const sim = getSimulationById(req.params.id);
  if (!sim) {
    return res.status(404).json({ error: "Simulation not found" });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ id: sim.id, status: sim.status })}\n\n`);

  addStreamSubscriber(req.params.id, res);
});

// DELETE /api/simulations/:id - Delete simulation
router.delete('/:id', (req, res) => {
  const success = deleteSimulation(req.params.id);
  if (!success) {
    return res.status(404).json({ error: "Simulation not found" });
  }
  res.json({ message: "Simulation deleted successfully" });
});

module.exports = router;
