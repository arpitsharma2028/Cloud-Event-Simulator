const express = require('express');
const router = express.Router();
const { compareSimulations } = require('../services/simulationService');

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

module.exports = router;
