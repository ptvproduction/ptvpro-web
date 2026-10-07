// ============================================================
// js/audio.js — In-App Harmonic Notification Chime (Web Audio API)
// Menghasilkan audio chime sintetis bernuansa studio tanpa dependensi file
// ============================================================

let _audioCtx = null;

function _getAudioContext() {
  if (!_audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      _audioCtx = new AudioContext();
    }
  }
  if (_audioCtx && _audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
  return _audioCtx;
}

/**
 * Mainkan nada chime notifikasi harmonik (Azure studio bell)
 */
export function playChime() {
  try {
    const ctx = _getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Harmonic bell frequencies (C6 & E6 dual chord)
    const tones = [
      { freq: 1046.50, gain: 0.12, duration: 0.8 }, // C6
      { freq: 1318.51, gain: 0.10, duration: 1.0 }, // E6
      { freq: 1567.98, gain: 0.06, duration: 1.2 }, // G6
    ];

    tones.forEach((tone, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(tone.freq, now + idx * 0.06);

      // Envelope: Fast attack, smooth exponential decay
      gain.gain.setValueAtTime(0.0001, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(tone.gain, now + idx * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + tone.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + tone.duration + 0.05);
    });
  } catch (err) {
    console.warn('[AUDIO] Failed to play chime:', err);
  }
}

// Global window exposure for toast integration
window.ptvPlayChime = playChime;
