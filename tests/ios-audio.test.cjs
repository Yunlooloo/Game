'use strict';
const {SRC, REPORTS} = require('./helpers/paths.cjs');
/** iOS audio regressions against the actual audio.js. Browser APIs are mocked;
 * this suite proves retry/race behavior, not sound output on a physical iPhone. */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const audioFile = process.argv[2] || path.join(SRC, 'audio.js');
const results = [];
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const deadline = promise => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('start remained blocked by an earlier attempt')), 300);
  promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
});
async function test(name, fn) {
  try { await fn(); results.push({ name, pass: true }); }
  catch (error) { results.push({ name, pass: false, error: String(error.message || error) }); }
}
function fixture(options = {}) {
  const contexts = [], elements = [], sessions = [], timers = new Map();
  let timerId = 0;
  const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; },
    exponentialRampToValueAtTime() {}, cancelAndHoldAtTime() {}, cancelScheduledValues() {} });
  const node = () => ({ gain: param(), frequency: param(), Q: param(), pan: param(), playbackRate: param(),
    threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(),
    connect() {}, disconnect() {}, start() {}, stop() {} });
  class Context {
    constructor() { this.state = 'suspended'; this.sampleRate = 8000; this.currentTime = 0;
      this.destination = node(); this.resumeCalls = 0; this.resumePending = []; this.listeners = {}; contexts.push(this); }
    resume() {
      this.resumeCalls++;
      if (options.deferResume) return new Promise((resolve, reject) => this.resumePending.push({ resolve, reject }));
      this.state = 'running'; return Promise.resolve();
    }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    createGain() { return node(); } createDynamicsCompressor() { return node(); }
    createBiquadFilter() { return node(); } createBufferSource() { return node(); }
    createOscillator() { return node(); } createStereoPanner() { return node(); }
    createWaveShaper() { return node(); } createMediaElementSource() { return node(); }
    createBuffer() { return { getChannelData() { return new Float32Array(16000); } }; }
  }
  class Media {
    constructor() { this.paused = true; this.readyState = 4; this.currentTime = 0; this.pending = []; this.plays = 0;
      this.pauses = 0; this.srcWrites = 0; this.listeners = {}; }
    set src(value) { this._src = value; this.srcWrites++; } get src() { return this._src; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    setAttribute() {}
    play() {
      this.plays++;
      if (options.deferMedia) return new Promise((resolve, reject) => this.pending.push({ resolve, reject }));
      this.paused = false; return Promise.resolve();
    }
    pause() { this.paused = true; this.pauses++; }
  }
  const navigator = {};
  if (options.session !== 'absent') {
    const session = {};
    Object.defineProperty(session, 'type', { set(value) {
      if (options.session === 'throw') throw new Error('Audio session selection unsupported');
      sessions.push(value);
    }});
    Object.defineProperty(navigator, 'audioSession', { get() {
      if (options.session === 'get-throw') throw new Error('Audio session unavailable');
      return session;
    }});
  }
  const window = { AudioContext: Context, navigator,
    setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); } };
  const scope = { window, navigator, document: {
    getElementById(id) { return id === 'rift-music-data' ? { textContent: JSON.stringify({
      ambient: 'data:audio/mpeg;base64,QU1CSUVOVA==', battle: 'data:audio/mpeg;base64,QkFUVExF' }) } : null; },
    createElement() { const element = new Media(); elements.push(element); return element; }
  }};
  vm.createContext(scope);
  vm.runInContext(fs.readFileSync(audioFile, 'utf8'), scope);
  return { audio: new window.RiftAudio(), contexts, elements, sessions, timers };
}
(async () => {
  await test('Interrupted context resumes synchronously on the next start', async () => {
    const f = fixture(); await f.audio.start();
    const c = f.audio.context; c.state = 'interrupted';
    const calls = c.resumeCalls; const resumed = f.audio.start();
    assert.equal(c.resumeCalls, calls + 1);
    assert.equal(await deadline(resumed), true);
    assert.equal(c.state, 'running');
  });
  await test('New gesture retries resume without waiting for an unresolved attempt', async () => {
    const f = fixture({ deferResume: true });
    const first = f.audio.start(), c = f.audio.context, second = f.audio.start();
    assert.equal(c.resumeCalls, 2);
    c.state = 'running'; c.resumePending[1].resolve();
    assert.equal(await deadline(second), true);
    c.resumePending[0].resolve(); await deadline(first);
    assert.equal(f.contexts.length, 1);
  });
  await test('A late earlier resume reads the current interrupted state, not stale success', async () => {
    const f = fixture({ deferResume: true });
    const first = f.audio.start(), c = f.audio.context, second = f.audio.start();
    assert.equal(c.resumeCalls, 2);
    c.state = 'running'; c.resumePending[1].resolve(); await deadline(second);
    c.state = 'interrupted'; c.resumePending[0].resolve(); await deadline(first);
    assert.equal(f.audio.getMusicStatus().contextState, 'interrupted');
    assert.equal(f.audio.getMusicStatus().unlocked, false);
  });
  await test('Diagnostics reflect interruption immediately without another start', async () => {
    const f = fixture(); await f.audio.start();
    f.audio.context.state = 'interrupted';
    assert.equal(f.audio.getMusicStatus().contextState, 'interrupted');
    assert.equal(f.audio.getMusicStatus().unlocked, false);
  });
  await test('A new start retries an unresolved paused media play in its synchronous turn', async () => {
    const f = fixture({ deferMedia: true }); await f.audio.start();
    const track = f.audio.musicTracks.get('ambient');
    assert.equal(track.element.plays, 1);
    const second = f.audio.start();
    assert.equal(track.element.plays, 2);
    assert.equal(track.element.srcWrites, 1);
    await deadline(second);
    track.element.pending.forEach(p => p.resolve()); await flush();
  });
  await test('Older play settlement cannot clear the latest pending attempt', async () => {
    const f = fixture({ deferMedia: true }); await f.audio.start();
    const track = f.audio.musicTracks.get('ambient');
    await f.audio.start(); assert.equal(track.element.plays, 2);
    const latest = track.pending;
    track.element.pending[0].resolve(); await flush();
    assert.equal(track.pending, latest);
    assert.notEqual(track.pending, null);
    track.element.paused = false; track.element.pending[1].resolve(); await flush();
    assert.equal(track.pending, null); assert.equal(track.error, '');
  });
  await test('Older rejected play cannot overwrite a newer successful playback', async () => {
    const f = fixture({ deferMedia: true }); await f.audio.start();
    const track = f.audio.musicTracks.get('ambient');
    await f.audio.start(); assert.equal(track.element.plays, 2);
    track.element.paused = false; track.element.pending[1].resolve(); await flush();
    const error = new Error('Earlier gesture was denied'); error.name = 'NotAllowedError';
    track.element.pending[0].reject(error); await flush();
    assert.equal(track.error, ''); assert.equal(track.pending, null); assert.equal(track.element.paused, false);
  });
  await test('Hiding the page prevents a late successful play from reviving audio', async () => {
    const f = fixture({ deferMedia: true }); await f.audio.start();
    const track = f.audio.musicTracks.get('ambient');
    f.audio.setSuspended(true);
    track.element.paused = false; track.element.pending[0].resolve(); await flush();
    assert.equal(track.element.paused, true);
    assert.equal(f.audio.master.gain.value, 0);
  });
  await test('Repeated starts do not replay an already playing track or allocate contexts', async () => {
    const f = fixture(); await f.audio.start(); await flush();
    const media = f.audio.musicTracks.get('ambient').element, calls = media.plays;
    for (let i = 0; i < 10; i++) await f.audio.start();
    await flush(); assert.equal(media.plays, calls); assert.equal(media.srcWrites, 1); assert.equal(f.contexts.length, 1);
  });
  await test('Supported audio session requests playback mode', async () => {
    const f = fixture(); assert.equal(await f.audio.start(), true); assert(f.sessions.includes('playback'));
  });
  for (const session of ['absent', 'throw', 'get-throw']) {
    await test('Audio session ' + session + ' does not prevent audio startup', async () => {
      const f = fixture({ session }); assert.equal(await f.audio.start(), true);
      assert.equal(f.audio.context.state, 'running');
      assert.equal(f.audio.musicTracks.get('ambient').element.paused, false);
    });
  }
  const report = { scope: 'Mocked browser states; no physical iOS audio output claim',
    pass: results.filter(x => x.pass).length, failed: results.filter(x => !x.pass).length, tests: results };
  if (!process.argv[2]) fs.writeFileSync(path.join(REPORTS, 'ios-audio.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (report.failed) process.exitCode = 1;
})();
