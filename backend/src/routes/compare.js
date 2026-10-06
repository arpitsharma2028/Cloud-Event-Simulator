const express = require('express');
const router = express.Router();
const { compareSimulations, runExperiment } = require('../services/simulationService');

// POST /api/compare - Compare multiple simulation runs
router.post('/', (req, res, next) => {
  try {
    const { simulationIds } = req.body;
    if (!simulationIds || !Array.isArray(simulationIds) || simulationIds.length < 2) {
      return res.status(400).json({
        error: "Please provide an array of at least 2 simulation IDs in 'simulationIds' to perform comparison."
      });
    }

    const comparison = compareSimulations(simulationIds);
    res.json(comparison);
  } catch (err) {
    next(err);
  }
});

// POST /api/compare/experiment - Run multi-policy experiment on identical workload and seed
router.post('/experiment', async (req, res, next) => {
  try {
    const { baseConfig, experimentType, policies, seed } = req.body;
    if (!baseConfig) {
      return res.status(400).json({
        error: "baseConfig is required to run a comparison experiment."
      });
    }

    const result = await runExperiment({
      baseConfig,
      experimentType: experimentType || 'SCHEDULING',
      policies: policies || [],
      seed
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
