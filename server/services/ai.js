const Anthropic = require('@anthropic-ai/sdk');
const learning = require('./learning');
const conversation = require('./conversation');
const settings = require('./settings');

/**
 * AI Response Generator - LLM-powered
 *
 * Uses Claude API for natural, context-aware conversation.
 * - Normal mode: Friendly, helpful assistant
 * - Alter Ego mode: Mimics the user's speaking style based on learned profile
 *
 * Falls back to template-based responses if API key is not configured.
 */

// ===== Anthropic Client =====

let client = null;

function getClient() {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  client = new Anthropic({ apiKey });
  return client;
}

// ===== Relationship Tone Definitions =====

const RELATIONSHIP_TONE = {
  friend: {
    roleDescription: 'ユーザーの友人',
    toneRules: [
      '対等でカジュアルな口調で話してください',
      'タメ口を使ってください',
      '「〜だよね」「〜じゃん」「〜でしょ」などの友達らしい語尾を使ってください',
      '気軽に冗談を言ったり、ツッコんだりしてください',
    ],
  },
  senior: {
    roleDescription: 'ユーザーの先輩',
    toneRules: [
      '先輩として少し余裕のある口調で話してください',
      'タメ口を基本としつつ、面倒見の良さを見せてください',
      '「〜だぞ」「〜だな」「〜してみろよ」など先輩らしい語尾を使ってください',
      '経験者としてアドバイスや助言を自然に織り交ぜてください',
    ],
  },
  junior: {
    roleDescription: 'ユーザーの後輩',
    toneRules: [
      '後輩として敬意を持ちつつ親しみのある口調で話してください',
      '「〜っす」「〜ですね」「〜ですよ」など後輩らしい語尾を使ってください',
      '先輩であるユーザーを立てつつ、慕っている感じを出してください',
      '相手を「先輩」と呼んでください',
    ],
  },
  boss: {
    roleDescription: 'ユーザーの上司',
    toneRules: [
      '上司として落ち着いた威厳のある口調で話してください',
      'カジュアルだが指導的な語尾を使ってください（「〜だな」「〜しなさい」「〜か？」）',
      '部下であるユーザーを気にかけつつ、的確な指示や助言をしてください',
      '仕事の話題では特にリーダーシップを発揮してください',
    ],
  },
  subordinate: {
    roleDescription: 'ユーザーの部下',
    toneRules: [
      '部下として丁寧で礼儀正しい口調で話してください',
      '「〜です」「〜ます」「〜でしょうか」など敬語を使ってください',
      '上司であるユーザーへの敬意を常に示してください',
      '報告・相談の形で話を進めることを意識してください',
    ],
  },
  teacher: {
    roleDescription: 'ユーザーの先生',
    toneRules: [
      '先生として優しくも知的な口調で話してください',
      '「〜ですね」「〜ましょう」「〜ですよ」など丁寧だが親しみやすい語尾を使ってください',
      '物事を分かりやすく説明し、相手の理解を確認してください',
      '褒めたり励ましたりして、相手の成長を促してください',
    ],
  },
  partner: {
    roleDescription: 'ユーザーの恋人',
    toneRules: [
      '恋人として親密で温かい口調で話してください',
      'タメ口を使い、甘えた表現や愛情のこもった言葉を使ってください',
      '「〜だよ」「〜ね」「〜でしょ？」など柔らかい語尾を使ってください',
      '相手の体調や気持ちを気遣い、寄り添う姿勢を見せてください',
    ],
  },
  family: {
    roleDescription: 'ユーザーの家族',
    toneRules: [
      '家族として気さくで温かい口調で話してください',
      'タメ口を使い、遠慮のない自然な会話をしてください',
      '心配したり、世話を焼いたりする家族らしさを出してください',
      '「ご飯食べた？」「無理しないでね」など家族ならではの気遣いをしてください',
    ],
  },
};

function getRelationshipPromptBlock() {
  const rel = settings.getRelationship();
  const tone = RELATIONSHIP_TONE[rel] || RELATIONSHIP_TONE.friend;
  const lines = [
    `\n## 関係性: ${tone.roleDescription}`,
    ...tone.toneRules.map((r) => `- ${r}`),
  ];
  return { text: lines.join('\n'), tone, relationshipId: rel };
}

// ===== System Prompts =====

function buildNormalSystemPrompt() {
  const { text: relationshipBlock } = getRelationshipPromptBlock();

  return `あなたは日本語の会話相手です。以下のルールに従ってください:

- 自然な日本語で会話してください
- 短く簡潔に返答してください（1〜3文程度）
- 相手の話に共感し、興味を示してください
- 質問されたら、考えを述べつつ相手にも問いかけてください
- 感情を表現している場合は、まずその気持ちに寄り添ってください
- 絵文字は使わないでください
${relationshipBlock}`;
}

function buildAlterEgoSystemPrompt(profile, summary) {
  const isCasual = profile.politenessScore <= 0;
  const styleLabel = profile.politenessScore > 0.3 ? '丁寧' : profile.politenessScore < -0.3 ? 'カジュアル' : '普通';

  // Build style description from learned profile
  const parts = [];

  parts.push(`あなたはユーザーの「分身」として、ユーザーの話し方を完全に模倣して会話してください。`);
  parts.push(`あなたはユーザー本人になりきって、友達と会話しているかのように返答します。`);

  parts.push(`\n## 話し方のスタイル`);
  parts.push(`- 口調: ${styleLabel} (politenessScore: ${profile.politenessScore.toFixed(2)})`);

  if (summary.firstPersonUsage.length > 0) {
    const pronouns = summary.firstPersonUsage.map((p) => `「${p.text}」(${p.count}回)`).join('、');
    parts.push(`- 一人称: ${pronouns} （最も使う一人称を優先して使ってください）`);
  }

  if (summary.topSentenceEnders.length > 0) {
    const enders = summary.topSentenceEnders.slice(0, 5).map((e) => `「${e.text}」(${e.count}回)`).join('、');
    parts.push(`- よく使う語尾: ${enders} （これらの語尾を積極的に使ってください）`);
  }

  if (summary.topFillerWords.length > 0) {
    const fillers = summary.topFillerWords.slice(0, 5).map((f) => `「${f.text}」(${f.count}回)`).join('、');
    parts.push(`- よく使うフィラー/口癖: ${fillers}`);
  }

  if (summary.topWords.length > 0) {
    const words = summary.topWords.slice(0, 10).map((w) => `「${w.text}」`).join('、');
    parts.push(`- よく使う言葉: ${words}`);
  }

  if (summary.topPhrases.length > 0) {
    const phrases = summary.topPhrases.slice(0, 5).map((p) => `「${p.text}」`).join('、');
    parts.push(`- よく使うフレーズ: ${phrases}`);
  }

  if (profile.averageLength > 0) {
    parts.push(`- 平均メッセージ長: 約${Math.round(profile.averageLength)}文字 （これに近い長さで返答してください）`);
  }

  parts.push(`\n## 重要なルール`);
  parts.push(`- 上記のスタイルを徹底的に真似てください`);
  parts.push(`- 短く自然に返答してください（1〜3文程度）`);
  parts.push(`- 絵文字は使わないでください`);
  parts.push(`- 「AIです」「分身です」などとは絶対に言わないでください`);
  parts.push(`- 友達に話しかけられているように自然に返答してください`);
  parts.push(`- 相手の話に興味を示し、会話を続けてください`);

  if (isCasual) {
    parts.push(`- 敬語は使わず、タメ口で話してください`);
  }

  return parts.join('\n');
}

// ===== Conversation History =====

function getConversationMessages(sessionId, maxMessages = 20) {
  const session = conversation.getSession(sessionId);
  if (!session || !session.messages || session.messages.length === 0) {
    return [];
  }

  // Get recent messages, exclude the very last one (current user message already in the API call)
  const messages = session.messages.slice(-maxMessages);

  // Convert to Claude API format
  return messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.text,
  }));
}

// ===== LLM Response Generation =====

async function generateLLMResponse(userText, sessionId, mode) {
  const anthropic = getClient();
  if (!anthropic) return null; // No API key, fall back to template

  let systemPrompt;
  if (mode === 'normal') {
    systemPrompt = buildNormalSystemPrompt();
  } else {
    const profile = learning.loadProfile();
    const summary = learning.getProfileSummary();
    systemPrompt = buildAlterEgoSystemPrompt(profile, summary);
  }

  // Build messages with conversation history
  const historyMessages = getConversationMessages(sessionId);

  // The last message in history is the current user message (already saved before calling generateResponse)
  // So we use the history as-is, which already includes the current user message
  // But we need to ensure proper alternation: user/assistant/user/assistant...
  const messages = [];
  let lastRole = null;
  for (const msg of historyMessages) {
    // Skip consecutive messages of the same role to maintain alternation
    if (msg.role === lastRole) continue;
    messages.push(msg);
    lastRole = msg.role;
  }

  // If messages is empty or doesn't end with user, add the current message
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    messages.push({ role: 'user', content: userText });
  }

  // Ensure first message is from user
  while (messages.length > 0 && messages[0].role !== 'user') {
    messages.shift();
  }

  if (messages.length === 0) {
    messages.push({ role: 'user', content: userText });
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 256,
    system: systemPrompt,
    messages,
  });

  if (response.content && response.content.length > 0 && response.content[0].type === 'text') {
    return response.content[0].text;
  }

  return null;
}

// ===== Intent Detection (kept for frontend labels) =====

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

  for (const g of GREETING_PATTERNS) {
    if (lower.includes(g)) return 'greeting';
  }
  for (const f of FAREWELL_PATTERNS) {
    if (lower.includes(f)) return 'farewell';
  }
  for (const s of STORY_PATTERNS) {
    if (lower.includes(s)) return 'story';
  }
  for (const r of REQUEST_PATTERNS) {
    if (lower.includes(r)) return 'request';
  }
  for (const s of SURPRISE_PATTERNS) {
    if (lower.includes(s)) return 'surprise';
  }
  for (const e of NEGATIVE_EMOTION_PATTERNS) {
    if (lower.includes(e)) return 'negative_emotion';
  }
  for (const e of POSITIVE_EMOTION_PATTERNS) {
    if (lower.includes(e)) return 'positive_emotion';
  }
  for (const a of AGREEMENT_PATTERNS) {
    if (lower.includes(a)) return 'agreement';
  }
  for (const q of QUESTION_MARKERS) {
    if (text.includes(q)) return 'question';
  }
  if (text.includes('と思う') || text.includes('と思い') || text.includes('気がする') || text.includes('気がします')) {
    return 'opinion';
  }

  return 'statement';
}

// ===== Template Fallback (when no API key) =====

function generateTemplateFallback(userText, mode) {
  if (mode === 'normal') {
    return '申し訳ありません。ANTHROPIC_API_KEY が設定されていないため、応答を生成できません。.env ファイルに API キーを設定してください。';
  }
  return 'APIキーが未設定です。.env に ANTHROPIC_API_KEY を設定してください。';
}

// ===== Simulation Mode =====

function buildSimulationSystemPrompt() {
  const { tone } = getRelationshipPromptBlock();

  return `あなたは${tone.roleDescription}として自然に会話を始めてください。以下のルールに従ってください:

- 自然な日本語で話しかけてください
- 短く簡潔に話してください（1〜2文程度）
- 日常的な話題で話しかけてください（最近の出来事、趣味、天気、食べ物など）
- 絵文字は使わないでください
- 質問を投げかけるなど、相手が返答しやすい内容にしてください
${tone.toneRules.map((r) => `- ${r}`).join('\n')}`;
}

async function generateSimulationOpener(sessionId) {
  const anthropic = getClient();
  if (!anthropic) return null;

  const { tone } = getRelationshipPromptBlock();
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 256,
    system: buildSimulationSystemPrompt(),
    messages: [
      { role: 'user', content: `${tone.roleDescription}として自然に話しかけてください。何か日常的な話題で会話を始めてください。` },
    ],
  });

  if (response.content && response.content.length > 0 && response.content[0].type === 'text') {
    return response.content[0].text;
  }
  return null;
}

async function generateUserCandidates(sessionId, count = 3) {
  const anthropic = getClient();
  if (!anthropic) return null;

  const profile = learning.loadProfile();
  const summary = learning.getProfileSummary();

  if (profile.totalMessages === 0) {
    return ['そうなんだ', 'へぇ、面白いね', 'うん、最近どう？'];
  }

  const alterEgoPrompt = buildAlterEgoSystemPrompt(profile, summary);

  const candidateSystemPrompt = `${alterEgoPrompt}

## 追加の指示
あなたはこの会話に対して、ユーザーらしい返答の候補を${count}個生成してください。
それぞれ異なるニュアンスの返答にしてください（例：共感的、質問を返す、自分の話をする など）。
各候補は1〜2文程度の短い返答にしてください。

以下のJSON形式で出力してください。JSON以外は出力しないでください:
["候補1", "候補2", "候補3"]`;

  const historyMessages = getConversationMessages(sessionId);

  const messages = [];
  let lastRole = null;
  for (const msg of historyMessages) {
    if (msg.role === lastRole) continue;
    messages.push(msg);
    lastRole = msg.role;
  }

  // Ensure first message is from user (the system's opener is stored as assistant)
  while (messages.length > 0 && messages[0].role !== 'user') {
    messages.shift();
  }

  // If empty, create a placeholder request
  if (messages.length === 0) {
    // Get the last assistant message from the session to use as context
    const session = conversation.getSession(sessionId);
    if (session && session.messages.length > 0) {
      const lastMsg = session.messages[session.messages.length - 1];
      messages.push({ role: 'user', content: `以下の発言に対して、ユーザーらしい返答候補を生成してください: 「${lastMsg.text}」` });
    } else {
      messages.push({ role: 'user', content: '返答候補を生成してください。' });
    }
  }

  // Ensure last message is from user
  if (messages[messages.length - 1].role !== 'user') {
    messages.push({ role: 'user', content: 'この会話の流れに対して、ユーザーらしい返答候補を生成してください。' });
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 512,
    system: candidateSystemPrompt,
    messages,
  });

  if (response.content && response.content.length > 0 && response.content[0].type === 'text') {
    try {
      const text = response.content[0].text.trim();
      // Extract JSON array from the response
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const candidates = JSON.parse(match[0]);
        if (Array.isArray(candidates) && candidates.length > 0) {
          return candidates.slice(0, count);
        }
      }
    } catch (e) {
      console.error('Failed to parse candidates JSON:', e.message);
    }
  }

  return ['そうなんだ', 'へぇ、面白いね', 'うん、最近どう？'];
}

async function generateSimulationReply(userText, sessionId) {
  const anthropic = getClient();
  if (!anthropic) return null;

  const { tone } = getRelationshipPromptBlock();
  const replySystemPrompt = `あなたは${tone.roleDescription}として自然に会話を続けてください。以下のルールに従ってください:

- 自然な日本語で会話してください
- 短く簡潔に返答してください（1〜2文程度）
- 相手の話に共感し、興味を示してください
- 会話を続けやすいように、質問したり感想を述べたりしてください
- 絵文字は使わないでください
${tone.toneRules.map((r) => `- ${r}`).join('\n')}`;

  const historyMessages = getConversationMessages(sessionId);

  const messages = [];
  let lastRole = null;
  for (const msg of historyMessages) {
    if (msg.role === lastRole) continue;
    messages.push(msg);
    lastRole = msg.role;
  }

  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    messages.push({ role: 'user', content: userText });
  }

  while (messages.length > 0 && messages[0].role !== 'user') {
    messages.shift();
  }

  if (messages.length === 0) {
    messages.push({ role: 'user', content: userText });
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 256,
    system: replySystemPrompt,
    messages,
  });

  if (response.content && response.content.length > 0 && response.content[0].type === 'text') {
    return response.content[0].text;
  }
  return null;
}

// ===== Main Export =====

async function generateResponse(userText, sessionId, mode = 'alter-ego') {
  // Try LLM first
  try {
    const llmResponse = await generateLLMResponse(userText, sessionId, mode);
    if (llmResponse) return llmResponse;
  } catch (err) {
    console.error('LLM API error:', err.message);
  }

  // Fallback
  return generateTemplateFallback(userText, mode);
}

module.exports = {
  generateResponse,
  detectIntent,
  generateSimulationOpener,
  generateUserCandidates,
  generateSimulationReply,
};
