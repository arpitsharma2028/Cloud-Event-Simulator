const express = require('express');
const router = express.Router();
const { getPresets, getPresetById } = require('../services/presetsService');

// GET /api/presets - Get all preset simulation workloads
router.get('/', (req, res) => {
  res.json({ presets: getPresets() });
});

// GET /api/presets/:id - Get specific preset
router.get('/:id', (req, res) => {
  const preset = getPresetById(req.params.id);
  if (!preset) {
    return res.status(404).json({ error: "Preset scenario not found" });
  }
  res.json(preset);
});

module.exports = router;
