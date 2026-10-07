
/* Synthesized combat effects + user-supplied, embedded music. Nothing is fetched.
 * Music streams through media elements instead of decoding both full MP3s into
 * large PCM buffers. Every output shares the master limiter and mute control. */
window.RiftAudio = class RiftAudio {
  constructor() {
    this.context = null;
    this.volume = 0.65;
    this.muted = false;
    this.voices = new Set();
    this.lastSound = new Map();
    this.tension = 0;
    this.beat = 0;
    this.nextBeat = 0;
    this.available = true;
    this._unlockSource = null;
    this.musicVolume = 0.3;
    this.musicScene = 'ambient';
    this.musicTracks = new Map();
    this.musicReady = false;
    this.musicError = '';
    this.suspended = false;
    this.unlocked = false;
    this.duckUntil = 0;
    this.duckLevel = 1;
  }
  async start() {
    // Safari can leave an unauthorized resume() pending until a later gesture.
    // Never put that promise in front of the next touchend/click's resume/play.
      try {
        // On supporting iOS versions, use the same playback audio session as
        // media players instead of the default, silence-switch-sensitive mode.
        try {
          if (typeof navigator !== 'undefined' && navigator.audioSession &&
              navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback';
        } catch (_) { /* Optional API; older browsers still use normal Web Audio. */ }
        if (!this.context) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) { this.available = false; return false; }
          this.context = new AudioContext({ latencyHint: 'interactive' });
          const c = this.context;
          this.master = c.createGain();
          this.master.gain.value = this.muted || this.suspended ? 0 : this.volume;
          this.limiter = c.createDynamicsCompressor();
          this.limiter.threshold.value = -12;
          this.limiter.knee.value = 8;
          this.limiter.ratio.value = 12;
          this.limiter.attack.value = 0.001;
          this.limiter.release.value = 0.12;
          this.master.connect(this.limiter);
          // Leave ordinary music/effects unchanged; only soften peaks which can
          // outrun the compressor. An always-curved transfer adds harmonics even
          // to quiet music and sounds like distortion on small phone speakers.
          if (c.createWaveShaper) {
            this.ceiling = c.createWaveShaper();
            const curve = new Float32Array(4097);
            for (let i = 0; i < curve.length; i++) {
              const sample = i * 2 / (curve.length - 1) - 1;
              const amplitude = Math.abs(sample), peak = Math.max(0, (amplitude - 0.8) / 0.2);
              curve[i] = amplitude <= 0.8 ? sample :
                Math.sign(sample) * (0.8 + 0.2 * peak - 0.04 * peak * peak - 0.04 * peak * peak * peak);
            }
            this.ceiling.curve = curve;
            this.limiter.connect(this.ceiling);
            this.ceiling.connect(c.destination);
          } else this.limiter.connect(c.destination);
          this.noiseBuffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
          const samples = this.noiseBuffer.getChannelData(0);
          for (let i = 0; i < samples.length; ++i) samples[i] = Math.random() * 2 - 1;
          this._makeAmbience();
          this.nextBeat = c.currentTime + 0.65;
        }
        // Initiate both resume and play in the gesture's synchronous turn. Waiting
        // for resume first can lose media playback permission on mobile browsers.
        const c = this.context;
        const resume = c.state !== 'running' && c.state !== 'closed' ? c.resume() : null;
        if (!this.unlocked || c.state !== 'running') this._primeOutput();
        this._ensureMusic();
        this._mixMusic(true);
        // Report actual context state, not the settlement order of old requests.
        const refresh = () => {
          this.available = c.state !== 'closed';
          this.unlocked = c.state === 'running';
          return this.unlocked;
        };
        refresh();
        if (resume) {
          try { await resume; }
          catch (error) { this.lastError = String(error && error.message || error); }
        }
        return refresh();
      } catch (error) {
        this.available = false;
        this.lastError = String(error && error.message || error);
        return false;
      }
  }
  _primeOutput() {
    // A one-sample silent buffer starts the output inside the same gesture.
    // Repeated blocked gestures replace this node instead of leaking sources.
    const c = this.context;
    if (!c || c.state === 'closed') return;
    if (this._unlockSource) {
      try { this._unlockSource.stop(); this._unlockSource.disconnect(); } catch (_) {}
    }
    const source = c.createBufferSource();
    source.buffer = c.createBuffer(1, 1, c.sampleRate);
    source.connect(this.master);
    source.onended = () => {
      source.disconnect();
      if (this._unlockSource === source) this._unlockSource = null;
    };
    this._unlockSource = source;
    source.start(0);
  }
  setVolume(value) {
    if (Number.isFinite(Number(value))) this.volume = Math.max(0, Math.min(1, Number(value)));
    this._applyVolume();
  }
  setMuted(value) { this.muted = !!value; this._applyVolume(); }
  _applyVolume() {
    if (!this.master || this.context.state === 'closed') return;
    this.master.gain.setTargetAtTime(this.muted || this.suspended ? 0 : this.volume, this.context.currentTime, 0.035);
  }
  setMusicVolume(value) {
    if (Number.isFinite(Number(value))) this.musicVolume = Math.max(0, Math.min(1, Number(value)));
    if (this.musicBus && this.context.state !== 'closed') {
      // Reserve mix headroom even at the maximum music setting. The master
      // slider still controls music, effects, and synthesized atmosphere together.
      this.musicBus.gain.setTargetAtTime(this.musicVolume * 0.52, this.context.currentTime, 0.06);
    }
  }
  setScene(scene) {
    if (scene !== 'ambient' && scene !== 'battle') return;
    if (scene === this.musicScene) return;
    this.musicScene = scene;
    this._mixMusic();
  }
  setSuspended(value) {
    value = !!value;
    if (this.suspended === value) return;
    this.suspended = value;
    this._applyVolume();
    if (value) {
      for (const track of this.musicTracks.values()) this._pauseMusicTrack(track);
    } else this._mixMusic();
  }
  _ensureMusic() {
    if (this.musicReady || !this.context || typeof document === 'undefined') return;
    const data = document.getElementById('rift-music-data');
    if (!data || typeof this.context.createMediaElementSource !== 'function') return;
    let assets;
    try { assets = JSON.parse(data.textContent); }
    catch (_) { this.musicError = 'invalid-embedded-music'; return; }
    const c = this.context;
    this.musicBus = c.createGain();
    this.musicBus.gain.value = this.musicVolume * 0.52;
    this.musicDuck = c.createGain();
    this.musicDuck.gain.value = 1;
    const presence = c.createBiquadFilter();
    presence.type = 'highshelf'; presence.frequency.value = 2200; presence.gain.value = -5;
    this.musicBus.connect(presence); presence.connect(this.musicDuck); this.musicDuck.connect(this.master);
    this.musicPresence = presence;
    for (const scene of ['ambient', 'battle']) {
      const sourceURL = assets && assets[scene];
      if (typeof sourceURL !== 'string' || !sourceURL.startsWith('data:audio/mpeg;base64,')) continue;
      let element, source, level;
      try {
        element = document.createElement('audio');
        element.preload = 'metadata';
        element.loop = true;
        element.volume = 1;
        element.playsInline = true;
        if (element.setAttribute) {
          element.setAttribute('playsinline', '');
          element.setAttribute('webkit-playsinline', '');
        }
        element.src = sourceURL;
        source = c.createMediaElementSource(element);
        level = c.createGain(); level.gain.value = 0;
        source.connect(level); level.connect(this.musicBus);
        const track = { scene, element, source, level, target: 0, pending: null,
          retryAfterPending: false, playAttempt: 0, pauseTimer: null, error: '' };
        element.addEventListener('error', () => {
          track.error = 'media-error-' + (element.error ? element.error.code : 'unknown');
        });
        this.musicTracks.set(scene, track);
      } catch (_) {
        if (element) element.pause();
        if (source) source.disconnect();
        if (level) level.disconnect();
        this.musicError = 'music-output-unavailable';
      }
    }
    // An invalid asset must not prevent synthesized effects or block gameplay.
    this.musicReady = true;
    if (!this.musicTracks.size) this.musicError ||= 'missing-embedded-music';
  }
  _holdParam(param, now) {
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
    else {
      if (typeof param.cancelScheduledValues === 'function') param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
    }
  }
  _clearMusicTimer(track) {
    if (track.pauseTimer !== null && typeof window.clearTimeout === 'function') window.clearTimeout(track.pauseTimer);
    track.pauseTimer = null;
  }
  _pauseMusicTrack(track) {
    this._clearMusicTimer(track);
    try { track.element.pause(); } catch (_) {}
    track.target = 0;
    if (this.context && this.context.state !== 'closed') {
      const now = this.context.currentTime;
      this._holdParam(track.level.gain, now);
      track.level.gain.setValueAtTime(0, now);
    }
  }
  _playMusicTrack(track, retryBlocked = false) {
    this._clearMusicTimer(track);
    if (track.pending && !retryBlocked) {
      if (track.element.paused) track.retryAfterPending = true;
      return;
    }
    if (!track.element.paused && !track.pending) return;
    const attempt = ++track.playAttempt;
    try {
      const result = track.element.play();
      if (result && typeof result.then === 'function') {
        track.pending = Promise.resolve(result).then(() => {
          if (attempt !== track.playAttempt) return;
          track.error = '';
          if (this.suspended || (track.scene !== this.musicScene && track.pauseTimer === null)) this._pauseMusicTrack(track);
        }, error => {
          if (attempt !== track.playAttempt) return;
          // Playback can be denied until another gesture, or cancelled by pause.
          // Keep the source reusable and never surface an unhandled rejection.
          track.error = error && error.name === 'AbortError' ? '' : (error && error.name || 'playback-blocked');
        }).finally(() => {
          if (attempt !== track.playAttempt) return;
          track.pending = null;
          const retry = track.retryAfterPending;
          track.retryAfterPending = false;
          if (retry && !this.suspended && track.scene === this.musicScene) this._playMusicTrack(track);
        });
      }
    } catch (error) { track.error = error && error.name || 'playback-blocked'; }
  }
  _mixMusic(retryBlocked = false) {
    if (!this.musicReady || !this.context || this.context.state === 'closed' || this.suspended) return;
    const now = this.context.currentTime;
    for (const [scene, track] of this.musicTracks) {
      const selected = scene === this.musicScene;
      const target = selected ? 1 : 0;
      if (track.target !== target) {
        this._holdParam(track.level.gain, now);
        track.level.gain.setTargetAtTime(target, now, selected ? 0.28 : 0.24);
        track.target = target;
      }
      if (selected) this._playMusicTrack(track, retryBlocked);
      else if (!track.element.paused && track.pauseTimer === null && typeof window.setTimeout === 'function') {
        // Let the tail crossfade, then stop decoding the inaudible track. A rapid
        // scene change cancels this timer and preserves the track's play position.
        track.pauseTimer = window.setTimeout(() => {
          track.pauseTimer = null;
          if (scene !== this.musicScene || this.suspended) this._pauseMusicTrack(track);
        }, 1600);
      }
    }
  }
  _duckMusic(level, hold, release = 0.3) {
    if (!this.musicDuck || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    this.duckLevel = now < this.duckUntil ? Math.min(this.duckLevel, level) : level;
    this.duckUntil = Math.max(this.duckUntil, now + hold);
    const gain = this.musicDuck.gain;
    this._holdParam(gain, now);
    gain.setTargetAtTime(this.duckLevel, now, 0.008);
    gain.setTargetAtTime(1, this.duckUntil, release);
  }
  getMusicStatus() {
    // Safe diagnostics: never expose the embedded data URLs or media elements.
    return {
      scene: this.musicScene, volume: this.musicVolume, ready: this.musicReady,
      suspended: this.suspended, unlocked: this.context?.state === 'running',
      contextState: this.context?.state || 'uninitialized', error: this.musicError,
      tracks: Object.fromEntries([...this.musicTracks].map(([scene, track]) => [scene, {
        playing: !track.element.paused, readyState: track.element.readyState,
        seconds: Number(track.element.currentTime) || 0, error: track.error
      }]))
    };
  }
  _makeAmbience() {
    const c = this.context;
    this.ambienceNodes = [];
    const layer = (type, frequency, q, gain) => {
      const source = c.createBufferSource();
      source.buffer = this.noiseBuffer;
      source.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = type; filter.frequency.value = frequency; filter.Q.value = q;
      const level = c.createGain(); level.gain.value = gain;
      source.connect(filter); filter.connect(level); level.connect(this.master);
      source.start(0, Math.random());
      this.ambienceNodes.push(source, filter, level);
      return { source, filter, level };
    };
    // Music already contains its own atmosphere. Start silent, including while
    // its media play() promise is pending; update enables fallback only if the
    // selected embedded track is absent or reports an error.
    this.wind = layer('bandpass', 320, 0.35, 0);
    this.rain = layer('highpass', 2400, 0.5, 0);
    this.river = layer('lowpass', 850, 0.3, 0);
    const sway = c.createOscillator(), depth = c.createGain();
    sway.frequency.value = 0.115; depth.gain.value = 115;
    sway.connect(depth); depth.connect(this.wind.filter.frequency); sway.start();
    this.ambienceNodes.push(sway, depth);
  }
  _voice(duration, x, strength) {
    const c = this.context, now = c.currentTime;
    if (this.voices.size >= 44) {
      const oldest = this.voices.values().next().value;
      this._dispose(oldest);
    }
    const output = c.createGain(); output.gain.value = Math.min(1.5, Math.max(0.15, strength || 1));
    const pan = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
    if (pan.pan) pan.pan.value = Math.max(-0.8, Math.min(0.8, Math.abs(x) > 1 ? (x - 2000) / 2300 : x));
    output.connect(pan); pan.connect(this.master);
    const voice = { now, end: now + duration + 0.04, nodes: [output, pan], sources: [], output, disposed: false, pending: 0 };
    this.voices.add(voice);
    return voice;
  }
  _dispose(voice) {
    if (!voice || voice.disposed) return;
    voice.disposed = true;
    for (const source of voice.sources) {
      source.onended = null;
      try { source.stop(); } catch (_) { /* A completed source is already stopped. */ }
    }
    for (const node of voice.nodes) { try { node.disconnect(); } catch (_) {} }
    this.voices.delete(voice);
  }
  _source(voice, source, delay, duration) {
    ++voice.pending;
    voice.sources.push(source); voice.nodes.push(source);
    source.onended = () => { if (--voice.pending <= 0) this._dispose(voice); };
    source.start(voice.now + delay);
    source.stop(voice.now + delay + duration + 0.015);
  }
  _envelope(voice, input, delay, duration, volume, attack = 0.003, filters = []) {
    const c = this.context;
    let node = input;
    for (const config of filters) {
      const filter = c.createBiquadFilter();
      filter.type = config.type;
      filter.frequency.value = config.frequency;
      filter.Q.value = config.Q || 0.5;
      node.connect(filter); node = filter; voice.nodes.push(filter);
    }
    const envelope = c.createGain(), t = voice.now + delay;
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + Math.min(attack, duration * 0.3));
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    node.connect(envelope); envelope.connect(voice.output); voice.nodes.push(envelope);
  }
  _tone(voice, frequency, endFrequency, delay, duration, volume, type = 'sine', filters = []) {
    const oscillator = this.context.createOscillator(), t = voice.now + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, t);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(18, endFrequency), t + duration);
    this._envelope(voice, oscillator, delay, duration, volume, 0.002, filters);
    this._source(voice, oscillator, delay, duration);
  }
  _noise(voice, delay, duration, volume, frequency, type = 'bandpass', q = 0.7, endFrequency) {
    const source = this.context.createBufferSource(); source.buffer = this.noiseBuffer;
    source.loop = true; source.playbackRate.value = 0.85 + Math.random() * 0.3;
    const filter = this.context.createBiquadFilter();
    filter.type = type; filter.Q.value = q;
    filter.frequency.setValueAtTime(frequency, voice.now + delay);
    if (endFrequency) filter.frequency.exponentialRampToValueAtTime(endFrequency, voice.now + delay + duration);
    source.connect(filter); voice.nodes.push(filter);
    this._envelope(voice, filter, delay, duration, volume, Math.min(0.014, duration * 0.15));
    this._source(voice, source, delay, duration);
  }
  _steel(voice, energy, delay = 0) {
    const filters = [{ type: 'highpass', frequency: 3600, Q: 0.7 }, { type: 'bandpass', frequency: 4950, Q: 0.7 }];
    this._tone(voice, 4210, 4080, delay, 0.66, 0.21 * energy, 'sine', filters);
    this._tone(voice, 5870, 5620, delay, 0.87, 0.14 * energy, 'triangle', filters);
    this._tone(voice, 2870, 2770, delay, 0.23, 0.025 * energy, 'sine');
    this._noise(voice, delay, 0.1, 0.34 * energy, 5800, 'highpass');
  }
  _parry(voice) {
    // A dry contact spike, two bright metal modes, and a short floor impact.
    // The ordinary guard below deliberately occupies a lower, duller register.
    this._noise(voice, 0, 0.026, 0.56, 5400, 'bandpass', 0.85);
    this._noise(voice, 0.002, 0.074, 0.21, 6000, 'highpass', 0.6);
    this._tone(voice, 4360, 4210, 0, 0.47, 0.31, 'sine');
    this._tone(voice, 5820, 5630, 0.003, 0.64, 0.23, 'sine');
    this._tone(voice, 2070, 2020, 0.012, 0.21, 0.055, 'triangle');
    this._tone(voice, 122, 42, 0, 0.19, 0.54, 'sine');
    this._tone(voice, 235, 92, 0.004, 0.075, 0.14, 'triangle');
    this._noise(voice, 0.028, 0.33, 0.055, 4550, 'bandpass', 1.8, 3900);
  }
  sfx(name, x = 0, strength = 1) {
    if (!this.context || this.context.state !== 'running' || this.muted || this.suspended) return;
    const now = this.context.currentTime;
    const minimumInterval = { deflect: 0.045, slash: 0.045, hit: 0.035, guard: 0.065, flame: 0.18, lightning: 0.12, pulse: 0.07, danger: 0.15, lowHealth: 4 }[name] || 0.055;
    if (now - (this.lastSound.get(name) ?? -10) < minimumInterval) return;
    this.lastSound.set(name, now);
    const duck = { deflect: [0.1, 0.18, 0.3], danger: [0.16, 0.42, 0.36],
      bladeCounter: [0.1, 0.38, 0.4], finisher: [0.06, 1, 0.65],
      lightning: [0.14, 0.4, 0.45], lowHealth: [0.12, 0.5, 0.45] }[name];
    if (duck) this._duckMusic(...duck);
    const gain = (Number(strength) || 1) * (name === 'deflect' ? 1.26 : 1);
    const v = this._voice(name === 'finisher' || name === 'revive' ? 2.5 : name === 'lightning' ? 1.8 : 1.2, Number(x) || 0, gain);
    switch (name) {
      case 'tonic':
        // Cork release, resonant liquid gulps, then a quiet restorative chime.
        this._noise(v, 0, 0.085, 0.18, 1400, 'bandpass', 1.1);
        this._tone(v, 360, 220, 0.025, 0.1, 0.07, 'sine');
        for (let i = 0; i < 4; ++i) {
          this._tone(v, 210 + i * 24, 95 + i * 10, 0.12 + i * 0.13, 0.12, 0.11, 'sine');
          this._noise(v, 0.13 + i * 0.13, 0.085, 0.075, 520 + i * 65, 'bandpass', 2.1);
        }
        this._tone(v, 880, 879, 0.68, 0.42, 0.035, 'sine');
        this._tone(v, 1320, 1318, 0.71, 0.38, 0.018, 'sine');
        break;
      case 'revive':
        // Rising furnace pressure and a struck crystal core, entirely synthesized.
        this._noise(v, 0, 1.1, 0.3, 230, 'bandpass', 0.7, 2900);
        this._tone(v, 90, 360, 0, 0.95, 0.19, 'sine');
        this._tone(v, 135, 540, 0.04, 0.95, 0.075, 'triangle');
        this._tone(v, 108, 34, 0.64, 0.83, 0.62, 'sine');
        this._tone(v, 220, 219, 0.68, 1.7, 0.13, 'sine');
        this._tone(v, 331, 330, 0.69, 1.5, 0.065, 'sine');
        this._tone(v, 447, 445, 0.7, 1.25, 0.045, 'sine');
        this._noise(v, 0.68, 0.26, 0.16, 1800, 'highpass');
        break;
      case 'danger':
        // Two urgent, dissonant pulses occupy the low-mid register; the 4–6 kHz
        // parry transient remains distinct. Music ducks before the first pulse.
        this._tone(v, 740, 610, 0, 0.2, 0.14, 'triangle');
        this._tone(v, 787, 660, 0.004, 0.22, 0.1, 'sine');
        this._tone(v, 930, 780, 0.14, 0.23, 0.11, 'triangle');
        this._tone(v, 145, 72, 0, 0.27, 0.3, 'sine');
        this._noise(v, 0.025, 0.2, 0.11, 2700, 'bandpass', 1.4);
        break;
      case 'lowHealth':
        // One restrained heartbeat pair per threshold crossing, never a loop.
        this._tone(v, 88, 42, 0, 0.2, 0.48, 'sine');
        this._tone(v, 82, 39, 0.23, 0.21, 0.36, 'sine');
        this._tone(v, 880, 440, 0.015, 0.43, 0.07, 'triangle');
        this._noise(v, 0, 0.09, 0.08, 650, 'lowpass');
        break;
      case 'slash':
        this._noise(v, 0, 0.2, 0.34, 1400, 'bandpass', 0.65, 5800);
        this._tone(v, 850, 260, 0.012, 0.15, 0.045, 'triangle'); break;
      case 'hit':
        this._tone(v, 130, 43, 0, 0.26, 0.65);
        this._noise(v, 0, 0.14, 0.42, 1500, 'lowpass');
        this._noise(v, 0.022, 0.22, 0.12, 3500, 'bandpass'); break;
      case 'deflect':
        this._parry(v); break;
      case 'guard':
        this._noise(v, 0, 0.075, 0.25, 1450, 'lowpass');
        this._tone(v, 1630, 1280, 0, 0.13, 0.11, 'triangle', [{ type: 'lowpass', frequency: 2400 }]);
        this._tone(v, 270, 85, 0, 0.14, 0.22); break;
      case 'break':
        this._steel(v, 0.85);
        for (let i = 0; i < 5; ++i) this._noise(v, i * 0.034, 0.15, 0.19, 1600 + i * 700, 'highpass');
        this._tone(v, 105, 28, 0, 0.72, 0.52); break;
      case 'bladeCounter':
        this._tone(v, 160, 32, 0, 0.52, 0.9);
        this._tone(v, 78, 28, 0.014, 0.69, 0.4);
        this._noise(v, 0, 0.35, 0.48, 780, 'lowpass');
        this._steel(v, 0.32, 0.022); break;
      case 'jump':
        this._noise(v, 0, 0.17, 0.2, 950, 'bandpass', 0.5, 2300); break;
      case 'grapple':
        this._tone(v, 1850, 540, 0, 0.16, 0.1, 'triangle');
        this._noise(v, 0.035, 0.48, 0.23, 2800, 'bandpass', 0.9, 550);
        this._steel(v, 0.14, 0.04); break;
      case 'disc':
        this._noise(v, 0, 0.13, 0.26, 6800, 'highpass');
        this._tone(v, 6700, 2500, 0, 0.17, 0.055, 'sine'); break;
      case 'flame':
        this._noise(v, 0, 0.75, 0.65, 1300, 'lowpass');
        this._noise(v, 0.06, 0.52, 0.24, 4500, 'highpass');
        this._tone(v, 95, 30, 0, 0.45, 0.38); break;
      case 'hammer':
        this._noise(v, 0, 0.25, 0.42, 750, 'lowpass');
        this._tone(v, 145, 25, 0.05, 0.65, 0.85);
        this._steel(v, 0.5, 0.05); break;
      case 'blink':
        this._noise(v, 0, 0.46, 0.38, 2300, 'bandpass', 1.6, 190);
        this._tone(v, 330, 880, 0.02, 0.37, 0.07, 'sine');
        this._noise(v, 0.22, 0.26, 0.22, 5700, 'highpass'); break;
      case 'lightning':
        this._noise(v, 0, 0.14, 0.68, 5500, 'highpass');
        this._noise(v, 0.025, 1.5, 0.8, 620, 'lowpass');
        this._tone(v, 68, 21, 0.035, 1.1, 0.55);
        for (let i = 0; i < 4; ++i) this._noise(v, 0.05 + i * 0.052, 0.09, 0.16, 3300, 'bandpass'); break;
      case 'finisher':
        this._noise(v, 0, 0.19, 0.72, 4200, 'bandpass', 1.2, 1100);
        this._steel(v, 0.78, 0.06);
        this._tone(v, 106, 23, 0.055, 1.25, 0.9);
        this._noise(v, 0.1, 1.55, 0.45, 550, 'lowpass');
        this._tone(v, 197, 185, 0.23, 1.9, 0.065, 'sine');
        this._tone(v, 295, 278, 0.24, 1.65, 0.034, 'sine'); break;
      case 'pulse':
        this._tone(v, 122, 49, 0, 0.52, 0.55);
        this._tone(v, 186, 126, 0, 0.17, 0.09);
        this._noise(v, 0, 0.06, 0.2, 1200, 'lowpass'); break;
      default: this._dispose(v);
    }
  }
  update(tension = 0, weather = 'dusk', dt = 1 / 60) {
    if (!this.context || this.context.state !== 'running' || this.suspended) return;
    const c = this.context, now = c.currentTime;
    dt = Math.min(0.1, Math.max(0, Number(dt) || 0));
    this.tension += (Math.max(0, Math.min(1, Number(tension) || 0)) - this.tension) * (1 - Math.exp(-dt * 2.5));
    const selectedMusic = this.musicTracks.get(this.musicScene);
    const synthFallback = this.musicVolume > 0 && (!selectedMusic || !!selectedMusic.error);
    // Do not mistake a muted/loading track for missing music: turning the music
    // slider to zero must not replace it with an unsolicited hiss/drum track.
    this.wind.level.gain.setTargetAtTime(synthFallback ? 0.035 + this.tension * 0.025 + (weather === 'storm' ? 0.025 : 0) : 0, now, 0.18);
    this.rain.level.gain.setTargetAtTime(synthFallback && weather === 'storm' ? 0.078 : 0, now, 0.18);
    this.river.level.gain.setTargetAtTime(synthFallback ? 0.024 : 0, now, 0.18);
    if (!this.muted && synthFallback && this.tension > 0.075 && now >= this.nextBeat) {
      const accent = this.beat++ % 4 === 0;
      this.sfx('pulse', accent ? -0.3 : 0.3, (accent ? 0.42 : 0.22) + this.tension * 0.18);
      this.nextBeat = now + 60 / (48 + this.tension * 80) * (this.tension > 0.8 && !accent ? 0.5 : 1);
    } else if (this.tension <= 0.075) this.nextBeat = now + 0.5;
    for (const voice of this.voices) if (voice.end < now) this._dispose(voice);
  }
};
