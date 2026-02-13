const fs = require('fs');
const path = require('path');
const conversation = require('./conversation');
const settings = require('./settings');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PROFILES_DIR = path.join(DATA_DIR, 'profiles');
const LEGACY_PROFILE_FILE = path.join(DATA_DIR, 'user_profile.json');

function getProfileFile(relationship) {
  const rel = relationship || settings.getRelationship();
  return path.join(PROFILES_DIR, `${rel}.json`);
}

// Migrate legacy single profile to the default relationship (friend)
function migrateLegacyProfile() {
  if (!fs.existsSync(LEGACY_PROFILE_FILE)) return;
  const friendFile = path.join(PROFILES_DIR, 'friend.json');
  if (fs.existsSync(friendFile)) return; // Already migrated

  if (!fs.existsSync(PROFILES_DIR)) {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
  }
  try {
    const data = fs.readFileSync(LEGACY_PROFILE_FILE, 'utf-8');
    fs.writeFileSync(friendFile, data, 'utf-8');
    console.log('Migrated legacy user_profile.json to profiles/friend.json');
  } catch (e) {
    console.error('Failed to migrate legacy profile:', e.message);
  }
}

// Run migration once on module load
migrateLegacyProfile();

// --- Japanese linguistic helpers ---

// Common Japanese particles and sentence-enders for pattern extraction
const JAPANESE_SENTENCE_ENDERS = [
  'だよね', 'だよな', 'じゃん', 'じゃね', 'かな', 'かも',
  'だね', 'だな', 'よね', 'よな', 'わね', 'のよ', 'のね',
  'ですね', 'ですよ', 'ますね', 'ますよ', 'でしょ', 'でしょう',
  'だろう', 'だろ', 'っす', 'っすね', 'っすよ',
  'やん', 'やんな', 'やんね', 'やで', 'やねん',
  'だぜ', 'だぞ', 'ぜ', 'ぞ', 'さ', 'な', 'ね', 'よ', 'わ',
];

const FILLER_WORDS = [
  'えーと', 'えっと', 'あのー', 'あの', 'まあ', 'なんか',
  'ちょっと', 'やっぱり', 'やっぱ', 'とりあえず', '一応',
  'ほんと', 'マジで', 'まじで', 'ぶっちゃけ', 'っていうか',
  'なんていうか', 'そうだな', 'うーん', 'ええと',
];

const FIRST_PERSON_PRONOUNS = [
  '俺', '僕', '私', 'わたし', 'あたし', 'うち', '自分', 'わし', 'おいら',
];

const POLITENESS_MARKERS = {
  formal: ['です', 'ます', 'ございます', 'いたします', 'くださる', 'でしょうか'],
  casual: ['だよ', 'だぜ', 'じゃん', 'っす', 'だろ', 'だな', 'やん'],
};

function loadProfile(relationship) {
  const file = getProfileFile(relationship);
  if (!fs.existsSync(file)) {
    return createEmptyProfile();
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function saveProfile(profile, relationship) {
  if (!fs.existsSync(PROFILES_DIR)) {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
  }
  const file = getProfileFile(relationship);
  fs.writeFileSync(file, JSON.stringify(profile, null, 2), 'utf-8');
}

function createEmptyProfile() {
  return {
    totalMessages: 0,
    wordFrequency: {},
    sentenceEnders: {},
    fillerWords: {},
    firstPerson: {},
    averageLength: 0,
    politenessScore: 0, // -1 casual <-> +1 formal
    commonPhrases: {},
    topicKeywords: {},
    responsePatterns: {},
    lastUpdated: null,
  };
}

// Simple character-based tokenization for Japanese
function tokenize(text) {
  // Split on spaces, punctuation, and between character type changes
  // This handles both Japanese and mixed Japanese-English text
  const tokens = [];
  // Split by whitespace and common punctuation first
  const rough = text.split(/[\s、。！？!?,.\n\r]+/).filter(Boolean);
  for (const segment of rough) {
    // For short segments, keep as-is
    if (segment.length <= 4) {
      tokens.push(segment);
      continue;
    }
    // For longer segments, also extract character n-grams
    tokens.push(segment);
    // Extract 2-gram and 3-gram substrings for pattern detection
    for (let n = 2; n <= 3 && n <= segment.length; n++) {
      for (let i = 0; i <= segment.length - n; i++) {
        tokens.push(segment.substring(i, i + n));
      }
    }
  }
  return rough; // Return rough tokens for word frequency
}

function extractNGrams(text, n) {
  const grams = [];
  for (let i = 0; i <= text.length - n; i++) {
    grams.push(text.substring(i, i + n));
  }
  return grams;
}

function analyzeMessage(text, profile) {
  profile.totalMessages += 1;

  // Update average message length
  const prevTotal = profile.averageLength * (profile.totalMessages - 1);
  profile.averageLength = (prevTotal + text.length) / profile.totalMessages;

  // Word frequency
  const words = tokenize(text);
  for (const word of words) {
    if (word.length >= 2) {
      profile.wordFrequency[word] = (profile.wordFrequency[word] || 0) + 1;
    }
  }

  // Sentence enders detection
  for (const ender of JAPANESE_SENTENCE_ENDERS) {
    if (text.includes(ender)) {
      profile.sentenceEnders[ender] = (profile.sentenceEnders[ender] || 0) + 1;
    }
  }

  // Filler words detection
  for (const filler of FILLER_WORDS) {
    if (text.includes(filler)) {
      profile.fillerWords[filler] = (profile.fillerWords[filler] || 0) + 1;
    }
  }

  // First person pronoun usage
  for (const pronoun of FIRST_PERSON_PRONOUNS) {
    if (text.includes(pronoun)) {
      profile.firstPerson[pronoun] = (profile.firstPerson[pronoun] || 0) + 1;
    }
  }

  // Politeness scoring
  let formalCount = 0;
  let casualCount = 0;
  for (const marker of POLITENESS_MARKERS.formal) {
    if (text.includes(marker)) formalCount++;
  }
  for (const marker of POLITENESS_MARKERS.casual) {
    if (text.includes(marker)) casualCount++;
  }
  if (formalCount + casualCount > 0) {
    const messageScore = (formalCount - casualCount) / (formalCount + casualCount);
    // Exponential moving average
    const alpha = 0.3;
    profile.politenessScore = alpha * messageScore + (1 - alpha) * profile.politenessScore;
  }

  // Common phrases (3-8 character substrings that appear repeatedly)
  for (let len = 3; len <= Math.min(8, text.length); len++) {
    for (let i = 0; i <= text.length - len; i++) {
      const phrase = text.substring(i, i + len);
      // Skip if purely punctuation or whitespace
      if (/^[\s、。！？!?,.\n\r]+$/.test(phrase)) continue;
      profile.commonPhrases[phrase] = (profile.commonPhrases[phrase] || 0) + 1;
    }
  }

  // Prune low-frequency phrases to keep memory manageable
  const phraseEntries = Object.entries(profile.commonPhrases);
  if (phraseEntries.length > 5000) {
    const sorted = phraseEntries.sort((a, b) => b[1] - a[1]);
    profile.commonPhrases = Object.fromEntries(sorted.slice(0, 2000));
  }

  profile.lastUpdated = new Date().toISOString();
  return profile;
}

function rebuildProfile() {
  const relationship = settings.getRelationship();
  let profile = createEmptyProfile();
  const userMessages = conversation.getUserMessagesByRelationship(relationship);
  for (const msg of userMessages) {
    profile = analyzeMessage(msg.text, profile);
  }
  saveProfile(profile, relationship);
  return profile;
}

function updateProfile(text) {
  const relationship = settings.getRelationship();
  let profile = loadProfile(relationship);
  profile = analyzeMessage(text, profile);
  saveProfile(profile, relationship);
  return profile;
}

function getTopItems(obj, n = 10) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, value]) => ({ text: key, count: value }));
}

function getProfileSummary() {
  const relationship = settings.getRelationship();
  const profile = loadProfile(relationship);
  const relOption = settings.RELATIONSHIP_OPTIONS.find((o) => o.id === relationship);
  return {
    relationship,
    relationshipLabel: relOption ? relOption.label : relationship,
    totalMessages: profile.totalMessages,
    averageLength: Math.round(profile.averageLength),
    politenessScore: profile.politenessScore,
    politenessLabel: profile.politenessScore > 0.3
      ? '丁寧'
      : profile.politenessScore < -0.3
        ? 'カジュアル'
        : '普通',
    topWords: getTopItems(profile.wordFrequency, 15),
    topSentenceEnders: getTopItems(profile.sentenceEnders, 10),
    topFillerWords: getTopItems(profile.fillerWords, 10),
    firstPersonUsage: getTopItems(profile.firstPerson, 5),
    topPhrases: getTopItems(profile.commonPhrases, 15)
      .filter((p) => p.count >= 2 && p.text.length >= 3),
    lastUpdated: profile.lastUpdated,
  };
}

module.exports = {
  loadProfile,
  updateProfile,
  rebuildProfile,
  getProfileSummary,
  getTopItems,
  JAPANESE_SENTENCE_ENDERS,
  FILLER_WORDS,
  FIRST_PERSON_PRONOUNS,
};
