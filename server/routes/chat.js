const express = require('express');
const router = express.Router();
const conversation = require('../services/conversation');
const learning = require('../services/learning');
const ai = require('../services/ai');

// Create a new session
router.post('/session', (req, res) => {
  const session = conversation.createSession();
  res.json({ sessionId: session.id });
});

// Send a message and get a response
router.post('/message', async (req, res) => {
  const { sessionId, text, mode } = req.body;
  if (!sessionId || !text) {
    return res.status(400).json({ error: 'sessionId and text are required' });
  }

  const aiMode = mode === 'normal' ? 'normal' : 'alter-ego';

  // Save user message
  const userMessage = conversation.addMessage(sessionId, 'user', text);

  // Update learning profile (always learn, regardless of mode)
  learning.updateProfile(text);

  try {
    // Generate response based on selected mode (async - uses LLM)
    const responseText = await ai.generateResponse(text, sessionId, aiMode);

    // Save assistant response
    const assistantMessage = conversation.addMessage(sessionId, 'assistant', responseText);

    res.json({
      userMessage,
      assistantMessage,
      intent: ai.detectIntent(text),
      mode: aiMode,
    });
  } catch (err) {
    console.error('Error generating response:', err);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// Get session history
router.get('/session/:sessionId', (req, res) => {
  const session = conversation.getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session);
});

module.exports = router;
