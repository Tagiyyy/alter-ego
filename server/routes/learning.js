const express = require('express');
const router = express.Router();
const learning = require('../services/learning');

// Get the current learning profile summary
router.get('/profile', (req, res) => {
  const summary = learning.getProfileSummary();
  res.json(summary);
});

// Force a full rebuild of the profile from all conversation history
router.post('/rebuild', (req, res) => {
  const profile = learning.rebuildProfile();
  const summary = learning.getProfileSummary();
  res.json({ message: 'Profile rebuilt successfully', summary });
});

module.exports = router;
