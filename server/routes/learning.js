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

// Add a pattern item (firstPerson, sentenceEnders, fillerWords)
router.post('/pattern', (req, res) => {
  const { category, text } = req.body;
  if (!category || !text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'category and text are required' });
  }
  try {
    learning.addPatternItem(category, text.trim());
    const summary = learning.getProfileSummary();
    res.json({ message: 'Pattern added successfully', summary });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Delete a pattern item
router.delete('/pattern', (req, res) => {
  const { category, text } = req.body;
  if (!category || !text) {
    return res.status(400).json({ error: 'category and text are required' });
  }
  try {
    learning.deletePatternItem(category, text);
    const summary = learning.getProfileSummary();
    res.json({ message: 'Pattern deleted successfully', summary });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
