const fs = require('fs');
const path = require('path');

/**
 * Settings Service - persists user settings (relationship, background images, etc.)
 *
 * Stores settings in data/settings.json.
 * Background images stored in public/img/backgrounds/.
 */

const SETTINGS_FILE = path.join(__dirname, '..', '..', 'data', 'settings.json');
const BACKGROUNDS_DIR = path.join(__dirname, '..', '..', 'public', 'img', 'backgrounds');

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
  backgroundImages: {},
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

function getBackgroundImage(relationship) {
  const rel = relationship || getRelationship();
  const current = loadSettings();
  const filename = current.backgroundImages && current.backgroundImages[rel];
  if (filename) {
    return `/img/backgrounds/${filename}`;
  }
  return null;
}

function setBackgroundImage(relationship, filename) {
  const valid = RELATIONSHIP_OPTIONS.find((o) => o.id === relationship);
  if (!valid) {
    throw new Error(`Invalid relationship: ${relationship}`);
  }
  const current = loadSettings();
  const backgroundImages = { ...(current.backgroundImages || {}), [relationship]: filename };
  return saveSettings({ backgroundImages });
}

function removeBackgroundImage(relationship) {
  const valid = RELATIONSHIP_OPTIONS.find((o) => o.id === relationship);
  if (!valid) {
    throw new Error(`Invalid relationship: ${relationship}`);
  }
  const current = loadSettings();
  const backgroundImages = { ...(current.backgroundImages || {}) };
  const oldFilename = backgroundImages[relationship];
  delete backgroundImages[relationship];

  // Delete the file
  if (oldFilename) {
    const filePath = path.join(BACKGROUNDS_DIR, oldFilename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  return saveSettings({ backgroundImages });
}

function ensureBackgroundsDir() {
  if (!fs.existsSync(BACKGROUNDS_DIR)) {
    fs.mkdirSync(BACKGROUNDS_DIR, { recursive: true });
  }
}

module.exports = {
  RELATIONSHIP_OPTIONS,
  BACKGROUNDS_DIR,
  loadSettings,
  saveSettings,
  getRelationship,
  setRelationship,
  getBackgroundImage,
  setBackgroundImage,
  removeBackgroundImage,
  ensureBackgroundsDir,
};
