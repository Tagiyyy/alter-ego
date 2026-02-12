const learning = require('./learning');
const conversation = require('./conversation');

/**
 * AI Response Generator
 *
 * Generates responses that mimic the user's speaking style
 * based on the learned profile from conversation history.
 * Works entirely offline with no external API dependencies.
 *
 * Major improvements:
 * - Conversation context awareness (uses recent messages for coherent dialogue)
 * - Richer intent detection (emotion, agreement, story, request, etc.)
 * - Content-aware responses that reference what the user actually said
 * - Better topic extraction from user input
 */

// ===== Intent Detection =====

const GREETING_PATTERNS = [
  'おはよう', 'こんにちは', 'こんばんは', 'やあ', 'ども',
  'はじめまして', 'よろしく', 'ハロー', 'hello', 'hi', 'hey',
  'おつかれ', 'お疲れ', 'ひさしぶり', '久しぶり',
];

const FAREWELL_PATTERNS = [
  'さようなら', 'じゃあね', 'バイバイ', 'またね', 'おやすみ',
  'bye', 'さらば', 'じゃ、', 'では、', 'またな', 'おつー',
];

const QUESTION_MARKERS = [
  '?', '？', 'か？', 'かな', 'どう思う', 'どうかな',
  'どうすれば', '何が', 'なにが', 'なぜ', 'いつ', 'どこ',
  'だれ', '誰', 'どんな', 'どっち', 'どれ', 'どの',
  'ってなに', 'って何', 'ってどう', 'ですか',
  '知ってる', '知ってますか', 'わかる？',
];

const POSITIVE_EMOTION_PATTERNS = [
  'うれしい', '嬉しい', '楽しい', '楽しかった', 'たのしい',
  '最高', 'さいこう', 'やったー', 'やった', 'よかった',
  '幸せ', 'しあわせ', 'ハッピー', 'わくわく', 'ワクワク',
  '好き', 'すき', 'いいね', '素敵', 'すてき', 'かわいい',
  '面白い', 'おもしろい', '笑', 'ウケる', 'うける',
  '感動', 'すごい', 'すばらしい', 'アツい', 'テンション上がる',
];

const NEGATIVE_EMOTION_PATTERNS = [
  'つらい', '辛い', 'しんどい', 'きつい', '疲れた', 'つかれた',
  '悲しい', 'かなしい', '寂しい', 'さびしい', '落ち込', '凹',
  'むかつく', 'イライラ', 'いらいら', '腹立つ', '怒り',
  '不安', 'ふあん', '心配', 'しんぱい', '困った', 'こまった',
  'だるい', 'めんどくさい', 'めんどい', 'やだ', '嫌だ', 'いやだ',
  '最悪', 'さいあく', 'ひどい', '無理', 'むり', 'ダメ',
  'ストレス', 'うんざり',
];

const AGREEMENT_PATTERNS = [
  'そうそう', 'たしかに', '確かに', 'その通り', 'そのとおり',
  'わかる', 'それな', 'ほんとそれ', 'ほんとに', '本当に',
  '同感', 'だよね', 'ですよね', 'そうだよね', 'まさに',
  'いいね', 'ナイス', '賛成', 'うん', 'そうそうそう',
  'ほんまそれ', 'まじそれ', 'わかりみ',
];

const STORY_PATTERNS = [
  '今日は', 'きょうは', '昨日', 'きのう', 'さっき', 'この前',
  'こないだ', '先日', '実は', 'じつは', 'そしたら',
  'そうしたら', '〜したら', '〜てさ', '〜でさ', '聞いて',
  '知ってる？聞いて', 'びっくり', 'ちなみに', '話変わるけど',
  '報告', 'あのさ', 'あのね', '〜したんだけど', 'んだけど',
  '〜があって', '〜が起きて', '思ったんだけど',
];

const REQUEST_PATTERNS = [
  'おすすめ', 'オススメ', '教えて', 'おしえて', 'アドバイス',
  'どうしたらいい', 'どうすればいい', '方法', 'やり方',
  '助けて', 'たすけて', 'ヘルプ', '相談', 'したいんだけど',
  '〜ほしい', 'してほしい', '頼み', 'お願い', 'おねがい',
  '〜してくれ', '〜して', '提案', '意見ちょうだい',
];

const SURPRISE_PATTERNS = [
  'マジ', 'まじ', 'えっ', 'ええ', 'うそ', '嘘', 'ほんと',
  '本当', 'びっくり', 'やばい', 'ヤバい', 'やば',
  '信じられない', 'しんじられない', '驚い', 'おどろ',
  'まさか', 'すごくない', 'ありえない', 'ありえん',
];

function detectIntent(text) {
  const lower = text.toLowerCase();

  // Greeting (highest priority)
  for (const g of GREETING_PATTERNS) {
    if (lower.includes(g)) return 'greeting';
  }
  // Farewell
  for (const f of FAREWELL_PATTERNS) {
    if (lower.includes(f)) return 'farewell';
  }
  // Story/narration (check BEFORE emotions - "昨日面白いことがあってさ" is a story, not just positive emotion)
  for (const s of STORY_PATTERNS) {
    if (lower.includes(s)) return 'story';
  }
  // Request/advice seeking (check before question - "教えて" is a request)
  for (const r of REQUEST_PATTERNS) {
    if (lower.includes(r)) return 'request';
  }
  // Surprise
  for (const s of SURPRISE_PATTERNS) {
    if (lower.includes(s)) return 'surprise';
  }
  // Negative emotion (check before positive - "辛い" takes priority over "楽しい" if both appear)
  for (const e of NEGATIVE_EMOTION_PATTERNS) {
    if (lower.includes(e)) return 'negative_emotion';
  }
  // Positive emotion
  for (const e of POSITIVE_EMOTION_PATTERNS) {
    if (lower.includes(e)) return 'positive_emotion';
  }
  // Agreement
  for (const a of AGREEMENT_PATTERNS) {
    if (lower.includes(a)) return 'agreement';
  }
  // Question
  for (const q of QUESTION_MARKERS) {
    if (text.includes(q)) return 'question';
  }
  // Opinion
  if (text.includes('と思う') || text.includes('と思い') || text.includes('気がする') || text.includes('気がします')) {
    return 'opinion';
  }

  return 'statement';
}

// ===== Topic & Content Extraction =====

// Stop words that shouldn't be treated as topic content
const STOP_WORDS = new Set([
  'これ', 'それ', 'あれ', 'この', 'その', 'あの', 'ここ', 'そこ', 'あそこ',
  'こう', 'そう', 'ああ', 'どう', 'こんな', 'そんな', 'あんな', 'どんな',
  'なん', 'なに', 'いつ', 'どこ', 'だれ', 'なぜ', 'って', 'という',
  'から', 'けど', 'でも', 'だから', 'なので', 'ので', 'のに', 'して',
  'する', 'した', 'します', 'してる', 'している', 'される', 'された',
  'ない', 'ある', 'いる', 'なる', 'できる', 'もう', 'まだ', 'ただ',
  'すごく', 'とても', 'かなり', 'めっちゃ', 'ちょっと', 'すごい',
  'やっぱり', 'やっぱ', 'まあ', 'なんか', 'えーと', 'あの', 'えっと',
]);

function extractTopicFromText(text) {
  // Strategy: try specific noun extraction patterns first, then fall back to general splitting

  // 1. Try to extract noun using specific patterns
  const nounPatterns = [
    /([ァ-ヶー]{2,10})/, // Katakana words (loanwords, brand names)
    /(?:おすすめの|お気に入りの|最近の|新しい)([^、。！？\sを教えてくださいほしい]{2,6})/, // Adj/prefix + Noun
    /([一-龯ぁ-ん]{2,4})(?:を|が|は|に|で|の)/, // Noun before particle
  ];

  for (const pattern of nounPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length >= 2 && !STOP_WORDS.has(match[1])) {
      return match[1];
    }
    // For katakana, use the full match if group 1 isn't distinct
    if (match && match[0] && match[0].length >= 2 && !STOP_WORDS.has(match[0])) {
      return match[0].length > 10 ? match[0].substring(0, 10) : match[0];
    }
  }

  // 2. Fall back: split on punctuation and pick the best segment
  const cleaned = text
    .replace(/[、。！？!?,.\n\r「」『』（）()・…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const segments = cleaned
    .split(/\s+/)
    .filter((s) => s.length >= 2 && s.length <= 12 && !STOP_WORDS.has(s));

  if (segments.length === 0) return '';

  // Score: prefer moderate length, katakana, kanji
  const scoredSegments = segments.map((s) => {
    let score = 0;
    if (s.length >= 2 && s.length <= 8) score = s.length * 2;
    else if (s.length > 8) score = 8;
    if (/[\u30A0-\u30FF]/.test(s)) score += 4;
    if (/[\u4E00-\u9FFF]/.test(s)) score += 3;
    return { text: s.length > 10 ? s.substring(0, 10) : s, score };
  });
  scoredSegments.sort((a, b) => b.score - a.score);

  return scoredSegments[0].text;
}

function extractKeyPhrases(text) {
  // Extract meaningful phrases by splitting on punctuation only (not particles, which break Japanese words)
  const cleaned = text
    .replace(/[！？!?,.\n\r「」『』（）()・…]/g, ' ')
    .trim();

  // Split on sentence-level boundaries: 、。and whitespace
  const phrases = cleaned
    .split(/[、。\s]+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2 && !STOP_WORDS.has(p));

  return phrases.slice(0, 3);
}

function extractUserSubject(text) {
  // Try to extract what the user is talking about (subject/object of the sentence)
  const patterns = [
    /([^、。！？\s]{2,10})のこと/, // Xのこと
    /([^、。！？\s]{2,10})って(?:さ|ね|は|の|いう|どう|なに|最高|すごい|やばい|いい|面白い)/, // Xってさ/ね/は
    /([^、。！？\s]{2,10})(?:を)(?:した|して|する|食べた|食べて|見た|見て|買った|買って|読んだ|読んで)/, // X を した
    /([^、。！？\s]{2,10})(?:に)(?:行った|行って|行く|行きたい|いた|いって)/, // X に 行った
    /([^、。！？\s]{2,10})(?:が)(?:好き|嫌い|ほしい|いい|すごい|面白い|楽し|つら|大変|ある|ない)/, // X が 好き
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length >= 2 && !STOP_WORDS.has(match[1].trim())) {
      let result = match[1].trim();
      // Strip leading particles and common prefixes
      result = result.replace(/^.*?[はがをでにともの](?=[^\s])/, '');
      if (result.length >= 2) return result;
    }
  }
  return null;
}

// ===== Conversation Context =====

function getRecentContext(sessionId, maxMessages = 6) {
  const session = conversation.getSession(sessionId);
  if (!session || !session.messages || session.messages.length === 0) {
    return { messages: [], lastUserMessage: null, lastAssistantMessage: null, turnCount: 0 };
  }

  const recent = session.messages.slice(-maxMessages);
  const userMessages = recent.filter((m) => m.role === 'user');
  const assistantMessages = recent.filter((m) => m.role === 'assistant');

  return {
    messages: recent,
    lastUserMessage: userMessages.length > 1 ? userMessages[userMessages.length - 2] : null,
    lastAssistantMessage: assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1] : null,
    turnCount: Math.floor(session.messages.length / 2),
  };
}

function isTopicContinuation(currentText, context) {
  if (!context.lastUserMessage) return false;
  const prevText = context.lastUserMessage.text;
  // Check if the current message shares key words with the previous one
  const prevWords = new Set(prevText.split(/[\s、。！？!?,.\n\r]+/).filter((w) => w.length >= 2));
  const currentWords = currentText.split(/[\s、。！？!?,.\n\r]+/).filter((w) => w.length >= 2);
  const overlap = currentWords.filter((w) => prevWords.has(w));
  return overlap.length > 0;
}

function isShortResponse(text) {
  return text.length <= 8;
}

// ===== Utility =====

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

// ===== Normal AI Mode =====

const NORMAL_TEMPLATES = {
  greeting: [
    'こんにちは！今日はどんなことがありましたか？',
    'こんにちは！お元気ですか？何かお話しましょう。',
    'こんにちは！何か話したいことはありますか？',
    'どうも！調子はどうですか？',
  ],
  farewell: [
    'お話できて楽しかったです。またいつでも話しかけてくださいね！',
    'ありがとうございました。また会えるのを楽しみにしています！',
    'お疲れ様でした。良い一日をお過ごしください！',
  ],
  question: [
    '{topic}については、{pronoun_insight}。もう少し状況を教えてもらえると、一緒に考えられるかもしれません。',
    '{topic}についてですね。{pronoun_insight}。どんなところが特に気になりますか？',
    '{topic}ですか。いくつか考え方があると思います。{follow_up}',
    'いい質問ですね。{topic}については{pronoun_insight}。あなたはどう考えていますか？',
  ],
  positive_emotion: [
    'それはいいですね！{echo_content}、いい話じゃないですか。',
    '素敵ですね！{echo_content}って、なかなかないですよね。',
    'おお、{echo_content}ですか！嬉しさが伝わってきます。何があったんですか？',
    'いいですね！そういう気持ちになれるのは大事なことですよね。',
  ],
  negative_emotion: [
    'それは大変でしたね。{echo_content}のは辛いですよね。',
    'そうですか…。{echo_content}って、しんどいですよね。無理しないでくださいね。',
    'お気持ちわかります。{echo_content}の時って、なかなか気分が晴れないですよね。',
    '大変でしたね…。何か話すことで少しでも楽になれたらいいのですが。',
  ],
  surprise: [
    'えっ、{echo_content}ですか？それは驚きですね！詳しく聞かせてください。',
    '{echo_content}ってすごいですね！もっと聞きたいです。',
    'おお、それは意外ですね！{echo_content}って、なかなかないですよ。',
  ],
  agreement: [
    '共感してもらえて嬉しいです。{follow_up}',
    'ですよね！{echo_content}って思いますよね。',
    'やっぱりそう思いますか。同じ考えの人がいると安心しますね。',
  ],
  request: [
    '{echo_content}についてですね。どんな場面で必要になりそうですか？もう少し聞かせてください。',
    '{echo_content}ですか。いくつか方向性がありそうですが、何か条件とかありますか？',
    'なるほど、{echo_content}を知りたいんですね。具体的にどんなことで困っていますか？',
    '{echo_content}ですね。好みや条件があれば教えてください。',
  ],
  story: [
    'へえ、{echo_content}ですか！それでどうなったんですか？',
    '{echo_content}なんですね。面白いですね、続きを聞かせてください。',
    'そうだったんですか。{echo_content}って意外ですね。それからどうなりました？',
    '{echo_content}ですか。それは気になりますね！',
  ],
  opinion: [
    'なるほど、{echo_content}と考えているんですね。面白い視点だと思います。',
    'そういう見方もありますね。{echo_content}というのは大事な点ですよね。',
    '{echo_content}ですか。確かにそういう面はありますね。何がそう思わせたんですか？',
  ],
  statement: [
    'なるほど、{echo_content}ですか。それについてもう少し聞かせてもらえますか？',
    '{echo_content}なんですね。それは知らなかったです。',
    'そうなんですね。{echo_content}って面白いですね。',
    'へえ、{echo_content}ですか。他にも何かありますか？',
  ],
  default: [
    'そうなんですね。もう少し聞かせてください。',
    'なるほど。それで、どうなりましたか？',
    '面白いですね。続きを聞かせてください。',
  ],
  // Continuity templates (when the user continues talking about the same topic)
  continuation: [
    'なるほど、さっきの話の続きですね。{echo_content}ですか。',
    'さっきの{prev_topic}の話ですよね。{echo_content}は興味深いですね。',
    'まだ{prev_topic}の話ですね。{follow_up}',
  ],
  // Short input templates (when user gives a very brief response)
  short_input: [
    'もう少し詳しく聞かせてもらえますか？',
    'そうですか。それはどういう意味ですか？',
    'ふむふむ。で、どうしたいですか？',
    'なるほど。それでそれで？',
  ],
};

const NORMAL_INSIGHTS = [
  '色々な考え方がありそうですね',
  '奥が深いテーマだと思います',
  '人によって意見が分かれるところですよね',
  '興味深い話題ですね',
  '大事なことだと思います',
];

const NORMAL_FOLLOW_UPS = [
  'あなたはどう思いますか？',
  'どんなところが気になりますか？',
  'きっかけは何かあったんですか？',
  'もう少し詳しく聞かせてください。',
  '他に何か感じたことはありますか？',
];

function generateNormalResponse(userText, sessionId) {
  const intent = detectIntent(userText);
  const topic = extractTopicFromText(userText);
  const keyPhrases = extractKeyPhrases(userText);
  const subject = extractUserSubject(userText);
  const context = getRecentContext(sessionId);

  // Handle very short input specially
  if (isShortResponse(userText) && intent === 'statement') {
    return pickRandom(NORMAL_TEMPLATES.short_input);
  }

  // Handle short agreement (うん, そうそう, etc.) - don't echo the word back
  if (isShortResponse(userText) && intent === 'agreement') {
    return pickRandom([
      '共感してもらえて嬉しいです。{follow_up}',
      'やっぱりそう思いますか。同じ考えの人がいると安心しますね。',
      'ありがとうございます。{follow_up}',
    ]).replace(/\{follow_up\}/g, pickRandom(NORMAL_FOLLOW_UPS));
  }

  // Check for topic continuation
  if (context.lastUserMessage && isTopicContinuation(userText, context)) {
    const prevTopic = extractTopicFromText(context.lastUserMessage.text);
    if (prevTopic && Math.random() < 0.4) {
      const template = pickRandom(NORMAL_TEMPLATES.continuation);
      return applyNormalVars(template, { topic, keyPhrases, subject, prevTopic, userText });
    }
  }

  const templates = NORMAL_TEMPLATES[intent] || NORMAL_TEMPLATES.default;
  let response = pickRandom(templates);
  return applyNormalVars(response, { topic, keyPhrases, subject, prevTopic: '', userText });
}

function applyNormalVars(template, { topic, keyPhrases, subject, prevTopic, userText }) {
  // Build echo_content - the key thing the user said, for natural-sounding replies
  let echoContent = subject || topic || (keyPhrases.length > 0 ? keyPhrases[0] : '') || 'そういうこと';

  // Clean up echo content: remove fillers, limit length to keep natural
  echoContent = echoContent.replace(/^(えーと|あの|まあ|なんか|ちょっと)、?/, '').trim();
  if (echoContent.length > 8) {
    // Try to cut at a natural point
    const cutPoints = ['の', 'が', 'を', 'に', 'で', 'と', 'は', 'も'];
    let cut = -1;
    for (const cp of cutPoints) {
      const idx = echoContent.indexOf(cp, 3);
      if (idx > 0 && idx <= 8) { cut = idx; break; }
    }
    echoContent = cut > 0 ? echoContent.substring(0, cut) : echoContent.substring(0, 8);
  }
  if (echoContent.length < 2) echoContent = 'そういうこと';

  const result = template
    .replace(/\{topic\}/g, topic || 'それ')
    .replace(/\{echo_content\}/g, echoContent)
    .replace(/\{pronoun_insight\}/g, pickRandom(NORMAL_INSIGHTS))
    .replace(/\{follow_up\}/g, pickRandom(NORMAL_FOLLOW_UPS))
    .replace(/\{prev_topic\}/g, prevTopic || 'さっき');

  return result;
}

// ===== Alter Ego (user-mimicking) Mode =====

// Contextual response templates organized by detected intent
// IMPORTANT: Use {ender} only ONCE per template to avoid repetitive sentence endings
const RESPONSE_TEMPLATES = {
  greeting: [
    '{greeting_response}！',
    '{filler}{greeting_response}！',
    '{greeting_response}！今日どうだった？',
    '{greeting_response}、何かあった{ender}？',
  ],
  farewell: [
    '{farewell_response}{ender}',
    '{filler}{farewell_response}、また話そう！',
    '{farewell_response}！',
  ],
  question: [
    '{filler}{topic}か〜。{pronoun}的には{opinion}',
    '{topic}について？{filler}{opinion}って感じかな',
    '{pronoun}が思うに、{topic}は{opinion}',
    '{filler}{topic}ね。{connector}{opinion}',
    '{reaction}。{topic}は{opinion}',
  ],
  positive_emotion: [
    '{reaction}！{echo_content}、いいじゃん{ender}',
    '{filler}{echo_content}って最高{ender}',
    'おお！{echo_content}、{pronoun}も嬉しい！',
    '{reaction}！{pronoun}もそういうの好き{ender}',
    'めっちゃわかる！{echo_content}って{opinion}',
  ],
  negative_emotion: [
    '{filler}それはきついな。{echo_content}って大変だよね',
    '{reaction}…。{echo_content}はしんどい{ender}',
    'マジか…{echo_content}か。{pronoun}でよかったら話聞くよ',
    '{filler}無理しなくていいよ。{echo_content}のは辛いよね',
    'うわ…それはきついな。大丈夫{ender}？',
  ],
  surprise: [
    '{filler}マジで！？{echo_content}って！',
    'えっ、{echo_content}！？すごくない{ender}',
    '{reaction}！{echo_content}ってやばくない？',
    'うそでしょ！{echo_content}！',
  ],
  agreement: [
    'それな！{pronoun}もそう思ってた{ender}',
    '{reaction}！{echo_content}って{pronoun}もそう思う',
    'わかるわかる！{echo_content}だよね',
    'ほんとそれ。{pronoun}も前から思ってた{ender}',
  ],
  request: [
    '{filler}{topic}ね。{pronoun}的には{opinion}かな',
    '{topic}か〜。{connector}{pronoun}なら{opinion}',
    '{filler}それなら{opinion}のがいいと思う',
    '{reaction}。{topic}なら{opinion}かな',
  ],
  story: [
    '{reaction}！{echo_content}ってマジ？で、どうなったの',
    '{filler}{echo_content}！それやばい。続き聞かせて{ender}',
    '{reaction}！{echo_content}か〜。{follow_up}',
    'えっ、{echo_content}！{pronoun}も気になる{ender}',
  ],
  opinion: [
    '{filler}{pronoun}もそう思う。{echo_content}ってまさに{ender}',
    '{reaction}。{echo_content}って{pronoun}もそう感じてた',
    '{filler}確かに{echo_content}。{pronoun}的にも{opinion}',
    '{agree_or_disagree}。{echo_content}は{opinion}',
  ],
  statement: [
    '{reaction}。{echo_content}{ender}',
    '{filler}{echo_content}か〜。{follow_up}',
    '{reaction}！{echo_content}って{opinion}',
    '{filler}{echo_content}なんだ。{connector}{follow_up}',
    '{reaction}。{pronoun}も{echo_content}気になってた{ender}',
  ],
  default: [
    '{filler}{reaction}。で？',
    '{reaction}{ender}。{follow_up}',
    '{filler}{pronoun}的には{opinion}',
    '{reaction}。もっと聞かせて{ender}',
  ],
  // Topic continuation
  continuation: [
    'あ、さっきの{prev_topic}の話ね。{echo_content}{ender}',
    '{filler}まだ{prev_topic}の話？{reaction}。{echo_content}{ender}',
    '{prev_topic}ね〜。{echo_content}って{opinion}',
  ],
  // Short input responses
  short_input: [
    '{filler}もっと詳しく{ender}',
    'え、それだけ？もっと聞かせて{ender}',
    '{reaction}。で？',
    '{filler}続き続き{ender}',
  ],
};

const REACTIONS_CASUAL = [
  'あー、なるほど', 'うん、わかる', 'それな', 'たしかに',
  'へー、そうなんだ', 'マジか', 'おー', 'いいじゃん',
  'ふーん', 'そっか', 'わかるわかる', 'あるある',
  'おお', 'ほんとだ', 'なるほどね',
];

const REACTIONS_FORMAL = [
  'なるほど、そうですね', 'おっしゃる通りです', 'それは興味深いですね',
  'そうなんですね', '確かにそうですね', 'よくわかります',
  'そういうことですか', 'ごもっともです', 'なるほどです',
];

const CONNECTORS_CASUAL = [
  'っていうか、', 'で、', 'まあ、', 'てか、',
  'んで、', 'でさ、', 'しかも、', 'あと、', 'ってか、',
];

const CONNECTORS_FORMAL = [
  'それで、', 'また、', 'そして、', '加えて、',
  '一方で、', 'ですので、', 'つまり、',
];

const OPINIONS_CASUAL = [
  'いい感じだと思う', 'ありだと思う', '面白いと思う',
  'そういうの好き', '気になる', 'もっと知りたい',
  'よくあるよね', '大事だと思う', 'わかる気がする',
  'いいんじゃない', 'アリだね', '共感する',
];

const OPINIONS_FORMAL = [
  '良いと思います', '興味深いと思います', '重要だと考えます',
  '理解できます', '共感いたします', 'もっとお聞きしたいです',
  '素晴らしいですね', '大切なことですね',
];

const FOLLOW_UPS_CASUAL = [
  'もっと詳しく聞かせて', 'それでどうなったの',
  '他には何かある', 'そういえばさ', '続き気になるんだけど',
  'で、どうするの', 'マジで？で？', 'それからどうなったの',
];

const FOLLOW_UPS_FORMAL = [
  '詳しくお聞かせください', 'それからどうなりましたか',
  '他にもございますか', '続きをお聞かせいただけますか',
  'その後はいかがでしたか',
];

const GREETING_RESPONSES = {
  casual: ['おー、よっ', 'やあやあ', 'ども', 'おっす', 'よう', 'おー', 'やっほー'],
  formal: ['こんにちは', 'お疲れ様です', 'ご機嫌いかがですか', 'よろしくお願いします'],
};

const FAREWELL_RESPONSES = {
  casual: ['じゃあね', 'またね', 'おつ', 'ばいばい', 'またな', 'おつかれ〜', 'じゃ！'],
  formal: ['それでは', 'お疲れ様でした', 'またお話ししましょう', 'ごきげんよう'],
};

function generateAlterEgoResponse(userText, sessionId) {
  const profile = learning.loadProfile();
  const summary = learning.getProfileSummary();
  const intent = detectIntent(userText);
  const isCasual = profile.politenessScore <= 0;
  const context = getRecentContext(sessionId);

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
  const keyPhrases = extractKeyPhrases(userText);
  const subject = extractUserSubject(userText);

  // Build echo content from user's message
  let echoContent = subject || topic || (keyPhrases.length > 0 ? keyPhrases[0] : '') || '';
  echoContent = echoContent.replace(/^(えーと|あの|まあ|なんか|ちょっと)、?/, '').trim();
  if (echoContent.length > 8) {
    const cutPoints = ['の', 'が', 'を', 'に', 'で', 'と', 'は', 'も'];
    let cut = -1;
    for (const cp of cutPoints) {
      const idx = echoContent.indexOf(cp, 3);
      if (idx > 0 && idx <= 8) { cut = idx; break; }
    }
    echoContent = cut > 0 ? echoContent.substring(0, cut) : echoContent.substring(0, 8);
  }
  if (echoContent.length < 2) echoContent = '';

  // Build the template variables
  const vars = {
    filler: Math.random() < 0.5 ? preferredFiller : '',
    ender: preferredEnder,
    pronoun: preferredPronoun,
    reaction: pickRandom(reactions),
    connector: pickRandom(connectors),
    opinion: pickRandom(opinions),
    follow_up: pickRandom(followUps),
    topic: topic || 'それ',
    echo_content: echoContent || 'それ',
    agree_or_disagree: Math.random() < 0.7
      ? pickRandom(isCasual ? ['そうだよね', 'わかる', 'だよね'] : ['おっしゃる通り', '同意です', 'そうですよね'])
      : pickRandom(isCasual ? ['うーん、どうだろ', 'ちょっと違うかも'] : ['少し違う気もしますが', 'どうでしょうか']),
    greeting_response: pickRandom(isCasual ? GREETING_RESPONSES.casual : GREETING_RESPONSES.formal),
    farewell_response: pickRandom(isCasual ? FAREWELL_RESPONSES.casual : FAREWELL_RESPONSES.formal),
    prev_topic: '',
  };

  // Determine which template set to use
  let templateSet;

  // Handle short agreement (うん, そうそう) - simple responses without echoing the word
  if (isShortResponse(userText) && intent === 'agreement') {
    const shortAgreements = isCasual
      ? ['それな！', 'だよね！', 'わかるわかる', 'ほんとそれ']
      : ['そうですよね', 'ですよね', 'おっしゃる通りです', '同感です'];
    return pickRandom(shortAgreements);
  }
  // Handle short input
  if (isShortResponse(userText) && intent === 'statement') {
    templateSet = RESPONSE_TEMPLATES.short_input;
  }
  // Handle topic continuation
  else if (context.lastUserMessage && isTopicContinuation(userText, context) && Math.random() < 0.35) {
    templateSet = RESPONSE_TEMPLATES.continuation;
    vars.prev_topic = extractTopicFromText(context.lastUserMessage.text) || 'さっき';
  }
  // Normal intent-based selection
  else {
    templateSet = RESPONSE_TEMPLATES[intent] || RESPONSE_TEMPLATES.default;
  }

  let response = pickRandom(templateSet);

  // Replace template variables
  for (const [key, value] of Object.entries(vars)) {
    response = response.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }

  // Inject learned common phrases occasionally
  if (summary.topPhrases.length > 0 && Math.random() < 0.2) {
    const phrase = weightedPick(summary.topPhrases);
    if (phrase && !response.includes(phrase) && phrase.length >= 3) {
      response += `。${phrase}`;
    }
  }

  // Adjust response length to match user's average
  if (profile.averageLength > 0) {
    const targetLen = Math.round(profile.averageLength * 0.9);
    if (response.length > targetLen * 2.5) {
      // Trim to a natural break point
      const breakPoints = ['。', '、', 'ね', 'よ', 'な', 'ー'];
      for (const bp of breakPoints) {
        const idx = response.indexOf(bp, targetLen);
        if (idx > 0 && idx < response.length - 1) {
          response = response.substring(0, idx + 1);
          break;
        }
      }
    }
  }

  // Clean up artifacts: double enders, empty fillers, repeated patterns
  const enderPattern = preferredEnder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  response = response
    // Remove consecutive identical enders (e.g. "だねだね" → "だね")
    .replace(new RegExp(`(${enderPattern}){2,}`, 'g'), preferredEnder)
    // Remove ender appearing right before punctuation + ender (e.g. "だね。だね" → "。だね")
    .replace(new RegExp(`${enderPattern}([。、！？!?])${enderPattern}`, 'g'), `$1${preferredEnder}`)
    .replace(/、、/g, '、')
    .replace(/。。/g, '。')
    .replace(/！！/g, '！')
    .replace(/^\s*、/, '')
    .replace(/\s+/g, '')
    .trim();

  return response;
}

// ===== Main export =====

function generateResponse(userText, sessionId, mode = 'alter-ego') {
  if (mode === 'normal') {
    return generateNormalResponse(userText, sessionId);
  }
  return generateAlterEgoResponse(userText, sessionId);
}

module.exports = {
  generateResponse,
  detectIntent,
};
