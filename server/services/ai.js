const learning = require('./learning');
const conversation = require('./conversation');

/**
 * AI Response Generator
 *
 * Generates responses that mimic the user's speaking style
 * based on the learned profile from conversation history.
 * Works entirely offline with no external API dependencies.
 */

// Contextual response templates organized by detected intent
const RESPONSE_TEMPLATES = {
  greeting: [
    '{filler}{greeting_response}',
    '{greeting_response}{ender}',
    '{filler}{greeting_response}{ender}',
  ],
  question: [
    '{filler}それは{topic}の話{ender}',
    '{filler}{topic}について言うと{connector}{opinion}{ender}',
    '{pronoun}が思うに{connector}{opinion}{ender}',
    '{filler}{opinion}{ender}',
  ],
  opinion: [
    '{filler}{pronoun}も{agree_or_disagree}と思う{ender}',
    '{filler}確かに{topic}{connector}{opinion}{ender}',
    '{agree_or_disagree}{ender}{filler}{opinion}{ender}',
  ],
  statement: [
    '{filler}{reaction}{ender}',
    '{reaction}{connector}{follow_up}{ender}',
    '{filler}{pronoun}的には{opinion}{ender}',
    '{reaction}{ender}{filler}{follow_up}{ender}',
  ],
  farewell: [
    '{farewell_response}{ender}',
    '{filler}{farewell_response}{ender}',
  ],
  default: [
    '{filler}{reaction}{ender}',
    '{reaction}{connector}{follow_up}{ender}',
    '{filler}{pronoun}は{opinion}{ender}',
    '{reaction}{ender}',
  ],
};

const GREETING_PATTERNS = [
  'おはよう', 'こんにちは', 'こんばんは', 'やあ', 'ども',
  'はじめまして', 'よろしく', 'ハロー', 'hello', 'hi', 'hey',
  'おつかれ', 'お疲れ', 'ひさしぶり', '久しぶり',
];

const FAREWELL_PATTERNS = [
  'さようなら', 'じゃあね', 'バイバイ', 'またね', 'おやすみ',
  'bye', 'さらば', 'じゃ', 'では',
];

const QUESTION_MARKERS = ['?', '？', 'か？', 'かな', 'かも', 'どう', '何', 'なに', 'なぜ', 'いつ', 'どこ', 'だれ', '誰'];

const REACTIONS_CASUAL = [
  'あー、なるほど', 'うん、わかる', 'それな', 'たしかに',
  'へー、そうなんだ', 'マジか', 'おー', 'いいじゃん',
  'ふーん', 'そっか', 'わかるわかる', 'あるある',
];

const REACTIONS_FORMAL = [
  'なるほど、そうですね', 'おっしゃる通りです', 'それは興味深いですね',
  'そうなんですね', '確かにそうですね', 'よくわかります',
  'そういうことですか', 'ごもっともです',
];

const CONNECTORS_CASUAL = [
  '、っていうか、', '、で、', '、まあ、', '、てか、',
  '。んで、', '。でさ、', '、しかも、', '、あと、',
];

const CONNECTORS_FORMAL = [
  '。それで、', '。また、', '、そして、', '。加えて、',
  '。一方で、', '、ですので、', '。つまり、',
];

const OPINIONS_CASUAL = [
  'いい感じだと思う', 'ありだと思う', '面白いと思う',
  'そういうの好き', '気になる', 'もっと知りたい',
  'よくあるよね', '大事だと思う', 'わかる気がする',
];

const OPINIONS_FORMAL = [
  '良いと思います', '興味深いと思います', '重要だと考えます',
  '理解できます', '共感いたします', 'もっとお聞きしたいです',
];

const FOLLOW_UPS_CASUAL = [
  'もっと詳しく聞かせて', 'それでどうなったの',
  '他には何かある', 'そういえばさ', '続き気になるんだけど',
];

const FOLLOW_UPS_FORMAL = [
  '詳しくお聞かせください', 'それからどうなりましたか',
  '他にもございますか', '続きをお聞かせいただけますか',
];

const GREETING_RESPONSES = {
  casual: ['おー、よっ', 'やあやあ', 'ども', 'おっす', 'よう'],
  formal: ['こんにちは', 'お疲れ様です', 'ご機嫌いかがですか', 'よろしくお願いします'],
};

const FAREWELL_RESPONSES = {
  casual: ['じゃあね', 'またね', 'おつ', 'ばいばい', 'またな'],
  formal: ['それでは', 'お疲れ様でした', 'またお話ししましょう', 'ごきげんよう'],
};

function detectIntent(text) {
  const lower = text.toLowerCase();

  for (const g of GREETING_PATTERNS) {
    if (lower.includes(g)) return 'greeting';
  }
  for (const f of FAREWELL_PATTERNS) {
    if (lower.includes(f)) return 'farewell';
  }
  for (const q of QUESTION_MARKERS) {
    if (text.includes(q)) return 'question';
  }
  // Check for opinion-like statements
  if (text.includes('と思う') || text.includes('と思い') || text.includes('感じ') || text.includes('気がする')) {
    return 'opinion';
  }
  return 'statement';
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick(items) {
  if (!items || items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + item.count, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.count;
    if (r <= 0) return item.text;
  }
  return items[0].text;
}

function extractTopicFromText(text) {
  // Extract meaningful content words (longer segments) from the input
  const segments = text
    .replace(/[、。！？!?,.\n\r]/g, ' ')
    .split(/\s+/)
    .filter((s) => s.length >= 2);
  if (segments.length === 0) return '';
  // Pick a segment from the latter half (more likely to be the topic)
  const topicCandidates = segments.slice(Math.floor(segments.length / 2));
  return pickRandom(topicCandidates) || '';
}

// ===== Normal AI mode =====
// Responds as a helpful, neutral assistant (no user-style mimicry)

const NORMAL_TEMPLATES = {
  greeting: [
    'こんにちは！何かお手伝いできることはありますか？',
    'こんにちは！今日はどんなお話をしましょうか？',
    'こんにちは！何でも聞いてくださいね。',
  ],
  question: [
    'それは良い質問ですね。{topic}については、いろいろな考え方がありますね。もう少し詳しく教えていただけますか？',
    '{topic}についてですね。興味深いテーマです。どのような点が気になりますか？',
    'なるほど、{topic}について知りたいのですね。一緒に考えてみましょう。',
  ],
  opinion: [
    'なるほど、そのようにお考えなのですね。とても興味深い視点だと思います。',
    'そのご意見、よくわかります。{topic}については確かにそういう面がありますね。',
    'おっしゃる通りかもしれませんね。その考え方は大切だと思います。',
  ],
  statement: [
    'そうなんですね。{topic}について、もう少し詳しく聞かせてもらえますか？',
    'なるほど、それは面白いですね。他にも何かありますか？',
    'ありがとうございます。とても参考になります。',
    'そうですか。{topic}って奥が深いですよね。',
  ],
  farewell: [
    'お話できて楽しかったです。またいつでも話しかけてくださいね！',
    'ありがとうございました。また会えるのを楽しみにしています！',
    'お疲れ様でした。良い一日をお過ごしください！',
  ],
  default: [
    'そうですね。もう少し詳しく教えていただけますか？',
    'なるほど、興味深いですね。続きを聞かせてください。',
    'ありがとうございます。何か他にお話ししたいことはありますか？',
  ],
};

function generateNormalResponse(userText) {
  const intent = detectIntent(userText);
  const topic = extractTopicFromText(userText);
  const templates = NORMAL_TEMPLATES[intent] || NORMAL_TEMPLATES.default;
  let response = pickRandom(templates);
  response = response.replace(/\{topic\}/g, topic || 'それ');
  return response;
}

// ===== Alter Ego (user-mimicking) mode =====

function generateAlterEgoResponse(userText, sessionId) {
  const profile = learning.loadProfile();
  const summary = learning.getProfileSummary();
  const intent = detectIntent(userText);
  const isCasual = profile.politenessScore <= 0;

  // Select appropriate language register based on learned politeness
  const reactions = isCasual ? REACTIONS_CASUAL : REACTIONS_FORMAL;
  const connectors = isCasual ? CONNECTORS_CASUAL : CONNECTORS_FORMAL;
  const opinions = isCasual ? OPINIONS_CASUAL : OPINIONS_FORMAL;
  const followUps = isCasual ? FOLLOW_UPS_CASUAL : FOLLOW_UPS_FORMAL;

  // Get user's preferred patterns from profile
  const preferredEnder = summary.topSentenceEnders.length > 0
    ? weightedPick(summary.topSentenceEnders)
    : (isCasual ? 'だね' : 'ですね');

  const preferredFiller = summary.topFillerWords.length > 0
    ? weightedPick(summary.topFillerWords) + '、'
    : '';

  const preferredPronoun = summary.firstPersonUsage.length > 0
    ? weightedPick(summary.firstPersonUsage)
    : (isCasual ? '俺' : '私');

  const topic = extractTopicFromText(userText);

  // Build the template variables
  const vars = {
    filler: Math.random() < 0.6 ? preferredFiller : '',
    ender: preferredEnder,
    pronoun: preferredPronoun,
    reaction: pickRandom(reactions),
    connector: pickRandom(connectors),
    opinion: pickRandom(opinions),
    follow_up: pickRandom(followUps),
    topic: topic || 'それ',
    agree_or_disagree: Math.random() < 0.7 ? 'そう' : 'ちょっと違う',
    greeting_response: pickRandom(isCasual ? GREETING_RESPONSES.casual : GREETING_RESPONSES.formal),
    farewell_response: pickRandom(isCasual ? FAREWELL_RESPONSES.casual : FAREWELL_RESPONSES.formal),
  };

  // Select template based on intent
  const templates = RESPONSE_TEMPLATES[intent] || RESPONSE_TEMPLATES.default;
  let response = pickRandom(templates);

  // Replace template variables
  for (const [key, value] of Object.entries(vars)) {
    response = response.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }

  // Inject learned common phrases occasionally
  if (summary.topPhrases.length > 0 && Math.random() < 0.3) {
    const phrase = weightedPick(summary.topPhrases);
    if (phrase && !response.includes(phrase)) {
      response += `。${phrase}`;
    }
  }

  // Adjust response length to match user's average
  if (profile.averageLength > 0) {
    const targetLen = Math.round(profile.averageLength * 0.8);
    if (response.length > targetLen * 2) {
      // Trim to a natural break point
      const breakPoints = ['。', '、', 'ね', 'よ', 'な'];
      for (const bp of breakPoints) {
        const idx = response.indexOf(bp, targetLen);
        if (idx > 0 && idx < response.length - 1) {
          response = response.substring(0, idx + 1);
          break;
        }
      }
    }
  }

  return response;
}

function generateResponse(userText, sessionId, mode = 'alter-ego') {
  if (mode === 'normal') {
    return generateNormalResponse(userText);
  }
  return generateAlterEgoResponse(userText, sessionId);
}

module.exports = {
  generateResponse,
  detectIntent,
};
