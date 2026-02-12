/**
 * App module - orchestrates voice, chat, and UI.
 */
(() => {
  // DOM references
  const chatMessages = document.getElementById('chatMessages');
  const voiceBtn = document.getElementById('voiceBtn');
  const voiceStatus = document.getElementById('voiceStatus');
  const textInput = document.getElementById('textInput');
  const sendBtn = document.getElementById('sendBtn');
  const profileBtn = document.getElementById('profileBtn');
  const profileModal = document.getElementById('profileModal');
  const profileClose = document.getElementById('profileClose');
  const profileBody = document.getElementById('profileBody');
  const rebuildBtn = document.getElementById('rebuildBtn');

  let isProcessing = false;

  // ---- UI Helpers ----

  function clearWelcome() {
    const welcome = chatMessages.querySelector('.chat__welcome');
    if (welcome) welcome.remove();
  }

  function addMessage(role, text, intent) {
    clearWelcome();
    const div = document.createElement('div');
    div.className = `message message--${role === 'user' ? 'user' : 'ai'}`;

    const label = document.createElement('div');
    label.className = 'message__label';
    label.textContent = role === 'user' ? 'あなた' : 'Alter Ego';

    const bubble = document.createElement('div');
    bubble.className = 'message__bubble';
    bubble.textContent = text;

    div.appendChild(label);
    div.appendChild(bubble);

    if (intent && role !== 'user') {
      const intentLabel = document.createElement('div');
      intentLabel.className = 'message__intent';
      const intentNames = {
        greeting: '挨拶',
        farewell: '別れ',
        question: '質問',
        opinion: '意見',
        statement: '発言',
      };
      intentLabel.textContent = `検出: ${intentNames[intent] || intent}`;
      div.appendChild(intentLabel);
    }

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  }

  function addSpeakingIndicator() {
    clearWelcome();
    const div = document.createElement('div');
    div.className = 'message message--ai';
    div.id = 'speakingIndicator';

    const label = document.createElement('div');
    label.className = 'message__label';
    label.textContent = 'Alter Ego';

    const bubble = document.createElement('div');
    bubble.className = 'message__bubble';

    const indicator = document.createElement('div');
    indicator.className = 'speaking-indicator';
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.className = 'speaking-indicator__dot';
      indicator.appendChild(dot);
    }
    bubble.appendChild(indicator);
    div.appendChild(label);
    div.appendChild(bubble);

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  }

  function removeSpeakingIndicator() {
    const ind = document.getElementById('speakingIndicator');
    if (ind) ind.remove();
  }

  function setVoiceStatus(text) {
    voiceStatus.textContent = text;
  }

  // ---- Message Handling ----

  async function handleUserMessage(text) {
    if (!text.trim() || isProcessing) return;
    isProcessing = true;

    addMessage('user', text);
    const indicator = addSpeakingIndicator();

    try {
      const result = await Chat.sendMessage(text);
      removeSpeakingIndicator();
      addMessage('assistant', result.assistantMessage.text, result.intent);

      // Speak the response
      if (Voice.isSynthSupported()) {
        try {
          await Voice.speak(result.assistantMessage.text);
        } catch (e) {
          console.warn('TTS error:', e);
        }
      }
    } catch (err) {
      removeSpeakingIndicator();
      addMessage('assistant', '(通信エラーが発生しました)');
      console.error('API error:', err);
    }

    isProcessing = false;
  }

  // ---- Voice Setup ----

  function setupVoice() {
    if (!Voice.isSupported()) {
      voiceBtn.disabled = true;
      setVoiceStatus('音声認識非対応のブラウザです');
      return;
    }

    Voice.init({ lang: 'ja-JP' });

    Voice.onResult((transcript) => {
      handleUserMessage(transcript);
    });

    Voice.onStatus((status, detail) => {
      switch (status) {
        case 'listening':
          setVoiceStatus('聞いています...');
          voiceBtn.classList.add('recording');
          break;
        case 'transcribing':
          setVoiceStatus(detail || '文字起こし中...');
          break;
        case 'speaking':
          setVoiceStatus('話しています...');
          break;
        case 'error':
          setVoiceStatus(detail || 'エラー');
          voiceBtn.classList.remove('recording');
          break;
        case 'idle':
        default:
          setVoiceStatus('待機中');
          voiceBtn.classList.remove('recording');
          break;
      }
    });

    voiceBtn.addEventListener('click', () => {
      if (Voice.getIsListening()) {
        Voice.stopListening();
      } else if (Voice.isSpeaking()) {
        Voice.stopSpeaking();
      } else {
        Voice.startListening();
      }
    });
  }

  // ---- Text Input ----

  function setupTextInput() {
    sendBtn.addEventListener('click', () => {
      const text = textInput.value.trim();
      if (text) {
        textInput.value = '';
        handleUserMessage(text);
      }
    });

    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        const text = textInput.value.trim();
        if (text) {
          textInput.value = '';
          handleUserMessage(text);
        }
      }
    });
  }

  // ---- Profile Modal ----

  function renderProfile(profile) {
    if (profile.totalMessages === 0) {
      profileBody.innerHTML = '<p class="no-data">まだ会話データがありません。話しかけてみてください。</p>';
      return;
    }

    let html = '';

    // Stats cards
    html += '<div class="profile-stats">';
    html += `<div class="stat-card">
      <div class="stat-card__value">${profile.totalMessages}</div>
      <div class="stat-card__label">総メッセージ数</div>
    </div>`;
    html += `<div class="stat-card">
      <div class="stat-card__value">${profile.averageLength}</div>
      <div class="stat-card__label">平均文字数</div>
    </div>`;
    html += `<div class="stat-card">
      <div class="stat-card__value">${profile.politenessLabel}</div>
      <div class="stat-card__label">話し方</div>
    </div>`;
    html += '</div>';

    // First person
    if (profile.firstPersonUsage.length > 0) {
      html += '<div class="profile-section">';
      html += '<div class="profile-section__title">一人称</div>';
      html += '<div class="tag-list">';
      for (const item of profile.firstPersonUsage) {
        html += `<span class="tag">${item.text}<span class="tag__count">${item.count}</span></span>`;
      }
      html += '</div></div>';
    }

    // Sentence enders
    if (profile.topSentenceEnders.length > 0) {
      html += '<div class="profile-section">';
      html += '<div class="profile-section__title">語尾パターン</div>';
      html += '<div class="tag-list">';
      for (const item of profile.topSentenceEnders) {
        html += `<span class="tag">${item.text}<span class="tag__count">${item.count}</span></span>`;
      }
      html += '</div></div>';
    }

    // Filler words
    if (profile.topFillerWords.length > 0) {
      html += '<div class="profile-section">';
      html += '<div class="profile-section__title">口癖・フィラー</div>';
      html += '<div class="tag-list">';
      for (const item of profile.topFillerWords) {
        html += `<span class="tag">${item.text}<span class="tag__count">${item.count}</span></span>`;
      }
      html += '</div></div>';
    }

    // Top words
    if (profile.topWords.length > 0) {
      html += '<div class="profile-section">';
      html += '<div class="profile-section__title">よく使う言葉</div>';
      html += '<div class="tag-list">';
      for (const item of profile.topWords) {
        html += `<span class="tag">${item.text}<span class="tag__count">${item.count}</span></span>`;
      }
      html += '</div></div>';
    }

    // Common phrases
    if (profile.topPhrases.length > 0) {
      html += '<div class="profile-section">';
      html += '<div class="profile-section__title">頻出フレーズ</div>';
      html += '<div class="tag-list">';
      for (const item of profile.topPhrases) {
        html += `<span class="tag">${item.text}<span class="tag__count">${item.count}</span></span>`;
      }
      html += '</div></div>';
    }

    if (profile.lastUpdated) {
      html += `<p style="font-size:0.7rem;color:var(--text-muted);text-align:right;margin-top:12px;">
        最終更新: ${new Date(profile.lastUpdated).toLocaleString('ja-JP')}
      </p>`;
    }

    profileBody.innerHTML = html;
  }

  function setupProfileModal() {
    profileBtn.addEventListener('click', async () => {
      profileModal.hidden = false;
      profileBody.innerHTML = '<p class="loading">読み込み中...</p>';
      try {
        const profile = await Chat.getProfile();
        renderProfile(profile);
      } catch (e) {
        profileBody.innerHTML = '<p class="no-data">プロフィールの読み込みに失敗しました。</p>';
      }
    });

    profileClose.addEventListener('click', () => {
      profileModal.hidden = true;
    });

    profileModal.querySelector('.modal__backdrop').addEventListener('click', () => {
      profileModal.hidden = true;
    });

    rebuildBtn.addEventListener('click', async () => {
      rebuildBtn.disabled = true;
      rebuildBtn.textContent = '再構築中...';
      try {
        const result = await Chat.rebuildProfile();
        renderProfile(result.summary);
      } catch (e) {
        console.error('Rebuild failed:', e);
      }
      rebuildBtn.disabled = false;
      rebuildBtn.textContent = 'プロフィール再構築';
    });
  }

  // ---- Init ----

  function init() {
    setupVoice();
    setupTextInput();
    setupProfileModal();
    Chat.createSession();
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
