const express = require('express');
const router = express.Router();
const conversation = require('../services/conversation');
const ai = require('../services/ai');
const settings = require('../services/settings');

// Start a simulation session: create session + generate opener
router.post('/start', async (req, res) => {
  try {
    const session = conversation.createSession();

    const openerText = await ai.generateSimulationOpener(session.id);
    if (!openerText) {
      return res.status(500).json({ error: 'Failed to generate opener' });
    }

    // Save the opener as an assistant message
    const openerMessage = conversation.addMessage(session.id, 'assistant', openerText);

    // Generate candidate responses for the user
    const candidates = await ai.generateUserCandidates(session.id);

    res.json({
      sessionId: session.id,
      openerMessage,
      candidates,
    });
  } catch (err) {
    console.error('Simulation start error:', err);
    res.status(500).json({ error: 'Failed to start simulation' });
  }
});

// Send user's selected/edited response and get system reply + new candidates
router.post('/reply', async (req, res) => {
  const { sessionId, text } = req.body;
  if (!sessionId || !text) {
    return res.status(400).json({ error: 'sessionId and text are required' });
  }

  try {
    // Save user message with current relationship tag
    const relationship = settings.getRelationship();
    const userMessage = conversation.addMessage(sessionId, 'user', text, { relationship });

    // Generate system reply
    const replyText = await ai.generateSimulationReply(text, sessionId);
    if (!replyText) {
      return res.status(500).json({ error: 'Failed to generate reply' });
    }

    // Save system reply
    const replyMessage = conversation.addMessage(sessionId, 'assistant', replyText);

    // Generate next set of candidate responses
    const candidates = await ai.generateUserCandidates(sessionId);

    res.json({
      userMessage,
      replyMessage,
      candidates,
    });
  } catch (err) {
    console.error('Simulation reply error:', err);
    res.status(500).json({ error: 'Failed to generate reply' });
  }
});

module.exports = router;
