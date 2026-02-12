const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');

function loadConversations() {
  if (!fs.existsSync(CONVERSATIONS_FILE)) {
    return { sessions: {} };
  }
  return JSON.parse(fs.readFileSync(CONVERSATIONS_FILE, 'utf-8'));
}

function saveConversations(data) {
  fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function createSession() {
  const data = loadConversations();
  const sessionId = uuidv4();
  data.sessions[sessionId] = {
    id: sessionId,
    createdAt: new Date().toISOString(),
    messages: [],
  };
  saveConversations(data);
  return data.sessions[sessionId];
}

function addMessage(sessionId, role, text) {
  const data = loadConversations();
  if (!data.sessions[sessionId]) {
    data.sessions[sessionId] = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      messages: [],
    };
  }
  const message = {
    id: uuidv4(),
    role,
    text,
    timestamp: new Date().toISOString(),
  };
  data.sessions[sessionId].messages.push(message);
  saveConversations(data);
  return message;
}

function getSession(sessionId) {
  const data = loadConversations();
  return data.sessions[sessionId] || null;
}

function getAllMessages() {
  const data = loadConversations();
  const allMessages = [];
  for (const session of Object.values(data.sessions)) {
    allMessages.push(...session.messages);
  }
  return allMessages;
}

function getUserMessages() {
  return getAllMessages().filter((m) => m.role === 'user');
}

module.exports = {
  createSession,
  addMessage,
  getSession,
  getAllMessages,
  getUserMessages,
};
