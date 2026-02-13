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

  async function sendMessage(text, mode) {
    if (!sessionId) {
      await createSession();
    }
    const res = await fetch(`${API_BASE}/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, text, mode }),
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

  async function startSimulation() {
    const res = await fetch(`${API_BASE}/simulation/start`, { method: 'POST' });
    return res.json();
  }

  async function sendSimulationReply(simSessionId, text) {
    const res = await fetch(`${API_BASE}/simulation/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: simSessionId, text }),
    });
    return res.json();
  }

  async function getSettings() {
    const res = await fetch(`${API_BASE}/settings`);
    return res.json();
  }

  async function updateRelationship(relationship) {
    const res = await fetch(`${API_BASE}/settings/relationship`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relationship }),
    });
    return res.json();
  }

  async function getBackgroundImage(relationship) {
    const res = await fetch(`${API_BASE}/settings/background/${relationship}`);
    return res.json();
  }

  async function uploadBackgroundImage(relationship, file) {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${API_BASE}/settings/background/${relationship}`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  }

  async function deleteBackgroundImage(relationship) {
    const res = await fetch(`${API_BASE}/settings/background/${relationship}`, {
      method: 'DELETE',
    });
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
    startSimulation,
    sendSimulationReply,
    getSettings,
    updateRelationship,
    getBackgroundImage,
    uploadBackgroundImage,
    deleteBackgroundImage,
  };
})();
