/**
 * Chat module - handles API communication and message management.
 */
const Chat = (() => {
  const API_BASE = '/api';
  let sessionId = null;

  async function createSession() {
    const res = await fetch(`${API_BASE}/chat/session`, { method: 'POST' });
    const data = await res.json();
    sessionId = data.sessionId;
    return sessionId;
  }

  async function sendMessage(text) {
    if (!sessionId) {
      await createSession();
    }
    const res = await fetch(`${API_BASE}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, text }),
    });
    return res.json();
  }

  async function getProfile() {
    const res = await fetch(`${API_BASE}/learning/profile`);
    return res.json();
  }

  async function rebuildProfile() {
    const res = await fetch(`${API_BASE}/learning/rebuild`, { method: 'POST' });
    return res.json();
  }

  function getSessionId() {
    return sessionId;
  }

  return {
    createSession,
    sendMessage,
    getProfile,
    rebuildProfile,
    getSessionId,
  };
})();
