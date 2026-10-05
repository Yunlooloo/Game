'use strict';
const {SRC, REPORTS} = require('./helpers/paths.cjs');
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');

const results = [];
const check = (name, run) => { run(); results.push({ name, pass: true }); };
const flush = async () => { for (let i = 0; i < 8; ++i) await Promise.resolve(); };
function fixture(options = {}) {
  let clock = 0, nextTimer = 0;
  const timers = new Map(), elements = [], contexts = [];
  const param = (value = 0) => ({ value, calls: [],
    setValueAtTime(v, t) { this.value = v; this.calls.push(['value', v, t]); },
    setTargetAtTime(v, t, tau) { if (t <= clock / 1000) this.value = v; this.calls.push(['target', v, t, tau]); },
    exponentialRampToValueAtTime(v, t) { this.calls.push(['ramp', v, t]); },
    cancelAndHoldAtTime(t) { this.calls.push(['hold', t]); }
  });
  const node = () => ({ gain: param(), pan: param(), frequency: param(), Q: param(), playbackRate: param(),
    threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), connections: [],
    connect(n) { this.connections.push(n); }, disconnect() {}, start() {}, stop() {} });
  class Context {
    constructor() { this.state = 'suspended'; this.sampleRate = 8000; this.destination = node(); this.mediaSources = []; contexts.push(this); }
    get currentTime() { return clock / 1000; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    createGain() { return node(); } createDynamicsCompressor() { return node(); }
    createBiquadFilter() { return node(); } createBufferSource() { return node(); }
    createOscillator() { return node(); } createStereoPanner() { return node(); }
    createWaveShaper() { return node(); }
    createBuffer() { return { getChannelData() { return new Float32Array(16000); } }; }
    createMediaElementSource(media) { const source = node(); source.media = media; this.mediaSources.push(source); return source; }
  }
  class Media {
    constructor() { this.paused = true; this.readyState = 4; this.currentTime = 0; this.srcWrites = 0;
      this.plays = 0; this.pauses = 0; this.mode = options.playMode || 'resolve'; this.pending = []; this.events = new Map(); }
    set src(value) { this._src = value; ++this.srcWrites; }
    get src() { return this._src; }
    addEventListener(name, fn) { this.events.set(name, fn); }
    play() {
      ++this.plays;
      if (this.mode === 'reject') { this.paused = true; const e = Error('denied'); e.name = 'NotAllowedError'; return Promise.reject(e); }
      this.paused = false;
      if (this.mode === 'defer') return new Promise((resolve, reject) => this.pending.push({ resolve, reject }));
      return Promise.resolve();
    }
    pause() { ++this.pauses; this.paused = true; }
  }
  const music = { ambient: 'data:audio/mpeg;base64,QU1CSUVOVA==', battle: 'data:audio/mpeg;base64,QkFUVExF' };
  const scope = { window: {
    AudioContext: options.noContext ? undefined : Context,
    setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, at: clock + ms }); return id; },
    clearTimeout(id) { timers.delete(id); }
  } };
  if (!options.noDocument) scope.document = {
    getElementById(id) { return id === 'rift-music-data' && !options.noAssets ? { textContent: options.invalidJSON ? '{bad' : JSON.stringify(music) } : null; },
    createElement(type) { assert.equal(type, 'audio'); const element = new Media(); elements.push(element); return element; }
  };
  vm.createContext(scope);
  vm.runInContext(fs.readFileSync(path.join(SRC, 'audio.js'), 'utf8'), scope);
  const audio = new scope.window.RiftAudio();
  const advance = ms => {
    clock += ms;
    for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.fn(); }
  };
  return { audio, elements, contexts, timers, advance };
}
async function main() {
  const f = fixture(), a = f.audio;
  a.setScene('ambient'); a.sfx('deflect');
  check('No audio or media construction before gesture', () => { assert.equal(a.context, null); assert.equal(f.elements.length, 0); });
  assert(await a.start()); await flush();
  const ambient = a.musicTracks.get('ambient'), battle = a.musicTracks.get('battle');
  check('Gesture unlock initializes one context and two streamed sources', () => { assert.equal(f.contexts.length, 1); assert.equal(a.context.mediaSources.length, 2); assert.equal(a.getMusicStatus().unlocked, true); });
  check('Ambient begins while battle waits silently', () => { assert.equal(ambient.element.paused, false); assert.equal(battle.element.paused, true); });
  check('Both embedded tracks loop and preload metadata only', () => { for (const m of f.elements) { assert.equal(m.loop, true); assert.equal(m.preload, 'metadata'); assert.equal(m.srcWrites, 1); } });
  check('Default music mix leaves headroom and space for bright parries', () => { assert.equal(a.musicVolume, 0.3); assert.equal(a.musicBus.gain.value, 0.156); assert.equal(a.musicPresence.type, 'highshelf'); assert.equal(a.musicPresence.gain.value, -5); });
  check('Music and synth share the master limiter', () => { assert.equal(a.musicDuck.connections[0], a.master); assert.equal(a.master.connections[0], a.limiter); assert.equal(a.limiter.connections[0], a.ceiling); });
  a.setScene('battle'); await flush();
  check('Battle scene crossfades using gain automation', () => { assert.equal(battle.element.paused, false); assert.equal(battle.target, 1); assert.equal(ambient.target, 0); assert.equal(f.timers.size, 1); assert(ambient.level.gain.calls.some(c => c[0] === 'target' && c[1] === 0 && c[3] === 0.24)); });
  const timerId = ambient.pauseTimer, playCount = battle.element.plays;
  for (let i = 0; i < 240; ++i) { a.setScene('battle'); a.setSuspended(false); }
  for (let i = 0; i < 20; ++i) await a.start();
  await flush();
  check('Per-frame state sync and frequent gestures neither reload nor restart media', () => { assert.equal(a.context.mediaSources.length, 2); for (const m of f.elements) assert.equal(m.srcWrites, 1); assert.equal(battle.element.plays, playCount); assert.equal(ambient.pauseTimer, timerId); });
  f.advance(1600);
  check('Faded-out track stops decoding after 1.6 seconds', () => { assert.equal(ambient.element.paused, true); assert.equal(battle.element.paused, false); });
  a.setScene('ambient'); await flush(); a.setScene('battle'); await flush(); f.advance(1800);
  check('Rapid scene changes retire only the outdated track', () => { assert.equal(ambient.element.paused, true); assert.equal(battle.element.paused, false); assert.equal(battle.target, 1); });
  a.setSuspended(true);
  check('Hidden or paused state stops music and silences all outputs', () => { assert(f.elements.every(m => m.paused)); assert.equal(a.master.gain.value, 0); const count = a.voices.size; a.sfx('deflect'); assert.equal(a.voices.size, count); });
  a.setSuspended(false); await flush();
  check('Resuming restores only the selected scene', () => { assert.equal(battle.element.paused, false); assert.equal(ambient.element.paused, true); assert.equal(a.master.gain.value, 0.65); });
  a.setMusicVolume(0.75);
  check('Music volume is independent of master volume', () => { assert.equal(a.musicBus.gain.value, 0.39); assert.equal(a.master.gain.value, 0.65); });
  a.setVolume(0.2); a.setMuted(true);
  check('Master mute also mutes embedded music', () => { assert.equal(a.master.gain.value, 0); assert.equal(a.musicVolume, 0.75); });
  a.setMuted(false); a.setMusicVolume(9);
  check('Music volume clamps safely and restores master setting', () => { assert.equal(a.musicVolume, 1); assert.equal(a.musicBus.gain.value, 0.52); assert.equal(a.master.gain.value, 0.2); });
  a.setMusicVolume(-1); assert.equal(a.musicVolume, 0); a.setMusicVolume(0.3);
  a.sfx('deflect');
  check('Perfect parry receives a 2 dB boost and 90% music duck', () => { assert.equal([...a.voices].at(-1).output.gain.value, 1.26); assert.equal(a.duckLevel, 0.1); assert.equal(a.duckUntil, a.context.currentTime + 0.18); });
  check('Music recovers smoothly after the parry transient', () => { assert(a.musicDuck.gain.calls.some(c => c[0] === 'target' && c[1] === 1 && c[2] === a.duckUntil && c[3] === 0.3)); });
  f.advance(250); a.sfx('danger');
  check('Danger warning contains two distinguishable pulses and ducks music', () => { assert.equal(a.duckLevel, 0.16); assert([...a.voices].at(-1).sources.length >= 5); assert.equal(a.duckUntil, a.context.currentTime + 0.42); });
  f.advance(500); a.sfx('lowHealth'); const voices = a.voices.size; a.sfx('lowHealth'); f.advance(1500); a.sfx('lowHealth');
  check('Low-health cue has a four-second anti-spam interval', () => { assert.equal(a.voices.size, voices); });
  f.advance(4500);
  const names = ['slash', 'hit', 'deflect', 'guard', 'break', 'bladeCounter', 'jump', 'grapple', 'disc', 'flame', 'hammer', 'blink', 'lightning', 'finisher', 'pulse', 'tonic', 'revive', 'danger', 'lowHealth'];
  for (let pass = 0; pass < 5; ++pass) for (const name of names) { f.advance(200); a.sfx(name, 2000); assert(a.voices.size <= 44); }
  check('All 19 synthesized effects remain bounded at 44 simultaneous voices', () => assert.equal(a.voices.size, 44));
  f.advance(4000); a.update(0.9, 'storm');
  check('Effects clean up without adding an unrelated drum track over BGM', () => { assert.equal(a.voices.size, 0); });
  check('Debug metadata excludes audio payloads and source objects', () => { const status = JSON.stringify(a.getMusicStatus()); assert(!status.includes('base64')); assert(!status.includes('data:')); assert(!status.includes('source')); });

  const denied = fixture({ playMode: 'reject' });
  await denied.audio.start(); await flush();
  check('Autoplay rejection is caught without disabling synthesized sound', () => { assert.equal(denied.audio.available, true); assert.equal(denied.audio.getMusicStatus().tracks.ambient.error, 'NotAllowedError'); denied.audio.sfx('deflect'); assert.equal(denied.audio.voices.size, 1); });
  denied.elements[0].mode = 'resolve'; await denied.audio.start(); await flush();
  check('A later gesture retries a blocked track without reconstructing it', () => { assert.equal(denied.elements[0].plays, 2); assert.equal(denied.elements[0].srcWrites, 1); assert.equal(denied.audio.getMusicStatus().tracks.ambient.error, ''); });

  const slow = fixture({ playMode: 'defer' }); await slow.audio.start();
  const old = slow.audio.musicTracks.get('ambient').element;
  slow.audio.setScene('battle'); slow.advance(2000);
  old.paused = false; old.pending.shift().resolve(); await flush();
  check('A late play promise cannot revive a scene that already faded out', () => assert.equal(old.paused, true));
  const live = slow.audio.musicTracks.get('battle').element;
  slow.audio.setSuspended(true); live.paused = false; live.pending.shift().resolve(); await flush();
  check('A late play promise cannot revive music while hidden', () => assert.equal(live.paused, true));
  slow.audio.setSuspended(false);
  check('Music can retry after a hidden pending playback settles', () => assert.equal(live.plays, 2));
  live.pending.shift().resolve(); await flush();

  const abort = fixture({ playMode: 'defer' }); await abort.audio.start();
  const abortMedia = abort.elements[0]; abort.audio.setSuspended(true); abort.audio.setSuspended(false);
  const abortError = Error('paused'); abortError.name = 'AbortError'; abortMedia.mode = 'resolve'; abortMedia.pending.shift().reject(abortError); await flush();
  check('Resume during an aborted play safely retries once after settlement', () => { assert.equal(abortMedia.plays, 2); assert.equal(abortMedia.paused, false); });

  const bad = fixture({ invalidJSON: true }); await bad.audio.start(); bad.audio.sfx('danger');
  check('Corrupt optional music cannot prevent combat audio', () => { assert.equal(bad.audio.musicError, 'invalid-embedded-music'); assert.equal(bad.audio.voices.size, 1); });
  const absent = fixture({ noDocument: true }); await absent.audio.start(); absent.audio.sfx('deflect');
  check('Existing headless environments and absent music remain supported', () => { assert.equal(absent.audio.voices.size, 1); assert.equal(absent.audio.musicTracks.size, 0); });
  const unsupported = fixture({ noContext: true });
  const supported = await unsupported.audio.start();
  check('Missing Web Audio fails gracefully', () => { assert.equal(supported, false); assert.equal(unsupported.audio.available, false); });

  console.log(JSON.stringify({ pass: results.length, failed: 0, tests: results }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
