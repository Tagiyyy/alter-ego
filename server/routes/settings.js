const express = require('express');
const router = express.Router();
const settings = require('../services/settings');

// Get current settings + available relationship options
router.get('/', (req, res) => {
  const current = settings.loadSettings();
  res.json({
    settings: current,
    relationshipOptions: settings.RELATIONSHIP_OPTIONS,
  });
});

// Update relationship setting
router.put('/relationship', (req, res) => {
  const { relationship } = req.body;
  if (!relationship) {
    return res.status(400).json({ error: 'relationship is required' });
  }

  try {
    const updated = settings.setRelationship(relationship);
    res.json({ settings: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
