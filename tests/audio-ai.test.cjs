'use strict';
const {SRC, REPORTS} = require('./helpers/paths.cjs');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const scope = { window: {} };
vm.createContext(scope);
vm.runInContext(fs.readFileSync(path.join(SRC, 'ai.js'), 'utf8'), scope);
const AI = scope.window.RiftAI;
const base = { id: 1, x: 1000, y: 1080, vx: 0, vy: 0, ground: true, hp: 100,
  posture: 0, spirit: 20, state: 'IDLE', st: 0, move: null, loadout: [],
  art: 'cleave', phase: 1, tonics: 3, parries: 0, wasParried: 0 };
const opponent = { ...base, id: 0, x: 1120 };
const world = Object.freeze({ phase: 'fighting', weather: 'storm',
  anchors: Object.freeze([Object.freeze({ x: 1100, y: 700 })]) });
const tick = (ai, self = base, enemy = opponent) =>
  ai.input(world, Object.freeze({ ...self }), Object.freeze({ ...enemy }));
const warm = (ai, self = base, enemy = opponent) => {
  for (let i = 0; i < 12; i++) assert.equal(tick(ai, self, enemy), 0, '12f initial reaction');
};

function testAI() {
  let ai = new AI();
  warm(ai); tick(ai);
  for (const state of ['DRINKING', 'DEFLECT', 'HIT_STUN', 'RECOIL', 'BLADE_PINNED',
    'REVIVING', 'STUNNED', 'EXECUTING', 'DEAD']) {
    assert.equal(tick(ai, { ...base, state }), 0, 'input suppressed during ' + state);
  }
  ai = new AI(); warm(ai);
  for (let i = 0; i < 10; i++) assert.equal(tick(ai, { ...base, state: 'DEFLECT', parries: 1 }), 0);
  assert(tick(ai, { ...base, parries: 1 }) & 16, 'counter on first actionable frame');
  ai = new AI(); warm(ai);
  for (let i = 0; i < 9; i++) assert.equal(tick(ai, { ...base, state: 'RECOIL', wasParried: 1 }), 0);
  let bits;
  for (let i = 0; i < 18; i++) {
    bits = tick(ai, { ...base, wasParried: 1 });
    assert.equal(bits, 0, 'parried boss offers a stationary riposte opening');
  }

  ai = new AI(); warm(ai);
  for (let i = 0; i < 12; i++) assert.notEqual(tick(ai, base, { ...opponent, state: 'DRINKING' }) & 1088, 1088);
  assert.equal(tick(ai, base, { ...opponent, state: 'DRINKING' }) & 1088, 1088, 'delayed drinking punish');

  // A changed telegraph may not influence any decision during its first twelve frames.
  const calm = new AI(), threatened = new AI(); warm(calm); warm(threatened);
  for (let i = 0; i < 12; i++) {
    const telegraph = { ...opponent, state: 'STARTUP', st: i,
      move: { name: 'thrust', kind: 'thrust', windup: 30, active: 8, reach: 180 } };
    assert.equal(tick(calm), tick(threatened, base, telegraph), 'no early telegraph influence');
  }
  let laterDifference = false;
  for (let i = 12; i < 35; i++) {
    const telegraph = { ...opponent, state: 'STARTUP', st: i,
      move: { name: 'thrust', kind: 'thrust', windup: 30, active: 8, reach: 180 } };
    laterDifference ||= tick(calm) !== tick(threatened, base, telegraph);
  }
  assert(laterDifference, 'perceived threat eventually changes decisions');

  ai = new AI();
  const distant = { x: 3000, y: 1080,
    get state() { throw Error('state read beyond sight'); },
    get guardSpam() { throw Error('guardSpam read beyond sight'); } };
  for (let i = 0; i < 180; i++) assert(!(ai.input(world, base, distant) & (16 | 128 | 256 | 512 | 1024 | 2048 | 8192 | 32768)));
  ai = new AI(); warm(ai, base, { ...opponent, guardSpam: 2 }); ai.nextAttack = 0;
  assert(tick(ai, base, { ...opponent, guardSpam: 2 }) & 16, 'begin spam-punishing charge');
  const hold = ai.chargeUntil - ai.frame;
  assert.equal(hold, 30, 'repeatable hold releases before the charged tell');
  for (let i = 1; i < hold; i++) assert(tick(ai, { ...base, state: 'STARTUP' }, { ...opponent, guardSpam: 2 }) & 16);
  assert(!(tick(ai, { ...base, state: 'STARTUP' }, { ...opponent, guardSpam: 2 }) & 16), 'release charge');

  ai = new AI(); warm(ai);
  for (let i = 0; i < 7000; i++) assert(!(tick(ai) & (8192 | 32768)), 'phase-one locked moves');
  ai = new AI(); warm(ai, { ...base, phase: 2 });
  let phaseTwo = 0;
  for (let i = 0; i < 7000; i++) phaseTwo |= tick(ai, { ...base, phase: 2 }) & (8192 | 32768);
  assert.equal(phaseTwo, 8192 | 32768, 'phase-two unlocks');
  ai = new AI(); warm(ai, { ...base, hp: 50 }, { ...opponent, x: 1600 }); ai.nextHeal = 0;
  assert(tick(ai, { ...base, hp: 50 }, { ...opponent, x: 1600 }) & 16384, 'safe tonic');
  ai = new AI(); warm(ai, { ...base, hp: 50, tonics: 0 }, { ...opponent, x: 1600 }); ai.nextHeal = 0;
  assert(!(tick(ai, { ...base, hp: 50, tonics: 0 }, { ...opponent, x: 1600 }) & 16384), 'empty tonic inventory');

  ai = new AI();
  for (let i = 0; i < 8000; i++) {
    const self = { ...base, phase: i % 2 + 1, state: i % 70 < 40 ? 'IDLE' : 'RECOVERY',
      st: i % 20, ground: i % 90 < 50, posture: i % 100, loadout: ['disc', 'blink'], charged: i % 250 === 5 ? 20 : 0 };
    const enemy = { ...opponent, x: 900 + i % 1000, state: i % 75 < 30 ? 'STARTUP' : 'RECOVERY',
      st: i % 30, move: { name: 'thrust', kind: 'thrust', windup: 30, active: 5, reach: 150 } };
    bits = tick(ai, self, enemy);
    assert(Number.isInteger(bits) && bits >= 0 && bits < 65536);
    assert.notEqual(bits & 3, 3, 'consistent direction');
    assert(ai.history.length <= 12, 'bounded perception history');
  }
  console.log('AI PASS: 22,000 frames, telegraph/drinking delay, 800px sight, immutable inputs, locks/counters, charge, phase gates and tonics.');
}

const param = () => ({ value: 0, setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {} });
const node = () => ({ gain: param(), pan: param(), frequency: param(), Q: param(), playbackRate: param(),
  threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(),
  connect() {}, disconnect() {}, start() {}, stop() {} });
class MockAudioContext {
  constructor() { this.state = 'suspended'; this.currentTime = 0; this.sampleRate = 8000; this.destination = node(); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  createGain() { return node(); } createDynamicsCompressor() { return node(); }
  createBiquadFilter() { return node(); } createBufferSource() { return node(); }
  createOscillator() { return node(); } createStereoPanner() { return node(); }
  createBuffer() { return { getChannelData() { return new Float32Array(16000); } }; }
}
async function testAudio() {
  const audioScope = { window: { AudioContext: MockAudioContext } };
  vm.createContext(audioScope);
  vm.runInContext(fs.readFileSync(path.join(SRC, 'audio.js'), 'utf8'), audioScope);
  const audio = new audioScope.window.RiftAudio();
  audio.sfx('tonic'); assert(!audio.context, 'gesture-only construction'); assert(await audio.start()); audio.setVolume(0.8);
  const names = ['slash', 'hit', 'deflect', 'guard', 'break', 'bladeCounter', 'jump', 'grapple', 'disc',
    'flame', 'hammer', 'blink', 'lightning', 'finisher', 'pulse', 'tonic', 'revive', 'danger'];
  for (let n = 0; n < 8; n++) for (const name of names) {
    audio.context.currentTime += 0.2; audio.sfx(name, 2000); assert(audio.voices.size <= 44);
  }
  assert.equal(audio.voices.size, 44);
  audio.context.currentTime += 4; audio.update(0.9, 'storm', 1 / 60); assert(audio.voices.size < 3);
  audio.setMuted(true); const count = audio.voices.size; audio.sfx('revive'); assert.equal(audio.voices.size, count);
  audio.setMuted(false); audio.sfx('revive');
  const voice = [...audio.voices].at(-1);
  assert(voice.end - audio.context.currentTime >= 2.5, 'revive tail');
  for (const source of voice.sources) if (source.onended) source.onended();
  assert(!audio.voices.has(voice), 'onended cleanup');
  console.log('Audio PASS: 18 events, gesture/resume, voice cap, cleanup, mute and revive tail.');
}

testAI();
testAudio().catch(error => { console.error(error); process.exitCode = 1; });
