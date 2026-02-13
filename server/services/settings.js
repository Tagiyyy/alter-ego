const fs = require('fs');
const path = require('path');

/**
 * Settings Service - persists user settings (relationship, etc.)
 *
 * Stores settings in data/settings.json.
 */

const SETTINGS_FILE = path.join(__dirname, '..', '..', 'data', 'settings.json');

const RELATIONSHIP_OPTIONS = [
  { id: 'friend', label: '友人', description: '対等でカジュアルな関係' },
  { id: 'senior', label: '先輩', description: 'AIが先輩として接する' },
  { id: 'junior', label: '後輩', description: 'AIが後輩として接する' },
  { id: 'boss', label: '上司', description: 'AIが上司として接する' },
  { id: 'subordinate', label: '部下', description: 'AIが部下として接する' },
  { id: 'teacher', label: '先生', description: 'AIが先生として接する' },
  { id: 'partner', label: '恋人', description: 'AIが恋人として接する' },
  { id: 'family', label: '家族', description: 'AIが家族として接する' },
];

const DEFAULT_SETTINGS = {
  relationship: 'friend',
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('Failed to load settings:', e.message);
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const merged = { ...loadSettings(), ...settings };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

function getRelationship() {
  const settings = loadSettings();
  return settings.relationship || DEFAULT_SETTINGS.relationship;
}

function setRelationship(relationship) {
  const valid = RELATIONSHIP_OPTIONS.find((o) => o.id === relationship);
  if (!valid) {
    throw new Error(`Invalid relationship: ${relationship}`);
  }
  return saveSettings({ relationship });
}

module.exports = {
  RELATIONSHIP_OPTIONS,
  loadSettings,
  saveSettings,
  getRelationship,
  setRelationship,
};
