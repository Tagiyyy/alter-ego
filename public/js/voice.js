/**
 * Voice module - handles speech recognition (STT) and speech synthesis (TTS)
 * using the Web Speech API.
 */
const Voice = (() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;

  let recognition = null;
  let isListening = false;
  let onResultCallback = null;
  let onStatusCallback = null;
  let currentUtterance = null;

  function isSupported() {
    return !!SpeechRecognition;
  }

  function isSynthSupported() {
    return !!synth;
  }

  function init(options = {}) {
    if (!isSupported()) {
      console.warn('Speech Recognition is not supported in this browser.');
      return false;
    }

    recognition = new SpeechRecognition();
    recognition.lang = options.lang || 'ja-JP';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListening = true;
      if (onStatusCallback) onStatusCallback('listening');
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (onStatusCallback) {
        onStatusCallback('transcribing', interimTranscript || finalTranscript);
      }

      if (finalTranscript && onResultCallback) {
        onResultCallback(finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      isListening = false;
      if (onStatusCallback) {
        const messages = {
          'no-speech': '音声が検出されませんでした',
          'audio-capture': 'マイクが見つかりません',
          'not-allowed': 'マイクの使用が許可されていません',
          'network': 'ネットワークエラー',
        };
        onStatusCallback('error', messages[event.error] || `エラー: ${event.error}`);
      }
    };

    recognition.onend = () => {
      isListening = false;
      if (onStatusCallback) onStatusCallback('idle');
    };

    return true;
  }

  function startListening() {
    if (!recognition) {
      if (!init()) return false;
    }
    // Stop any ongoing speech synthesis
    if (synth && synth.speaking) {
      synth.cancel();
    }
    try {
      recognition.start();
      return true;
    } catch (e) {
      console.error('Failed to start recognition:', e);
      return false;
    }
  }

  function stopListening() {
    if (recognition && isListening) {
      recognition.stop();
    }
  }

  function speak(text, options = {}) {
    return new Promise((resolve, reject) => {
      if (!isSynthSupported()) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      // Cancel any ongoing speech
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options.lang || 'ja-JP';
      utterance.rate = options.rate || 1.0;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 1.0;

      // Try to use a Japanese voice
      const voices = synth.getVoices();
      const jaVoice = voices.find((v) => v.lang.startsWith('ja'));
      if (jaVoice) {
        utterance.voice = jaVoice;
      }

      currentUtterance = utterance;

      utterance.onstart = () => {
        if (onStatusCallback) onStatusCallback('speaking');
      };

      utterance.onend = () => {
        currentUtterance = null;
        if (onStatusCallback) onStatusCallback('idle');
        resolve();
      };

      utterance.onerror = (event) => {
        currentUtterance = null;
        if (onStatusCallback) onStatusCallback('idle');
        reject(event.error);
      };

      synth.speak(utterance);
    });
  }

  function stopSpeaking() {
    if (synth && synth.speaking) {
      synth.cancel();
      currentUtterance = null;
    }
  }

  function onResult(callback) {
    onResultCallback = callback;
  }

  function onStatus(callback) {
    onStatusCallback = callback;
  }

  function getIsListening() {
    return isListening;
  }

  function isSpeaking() {
    return synth && synth.speaking;
  }

  // Pre-load voices (some browsers need this)
  if (synth) {
    synth.getVoices();
    synth.onvoiceschanged = () => synth.getVoices();
  }

  return {
    isSupported,
    isSynthSupported,
    init,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    onResult,
    onStatus,
    getIsListening,
    isSpeaking,
  };
})();
