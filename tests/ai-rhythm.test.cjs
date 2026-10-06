'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { SRC, REPORTS } = require('./helpers/paths.cjs');
const makeHarness = require('./helpers/engine.cjs');
const rows = [];
const check = (name, actual, expected) => {
  assert.deepEqual(actual, expected, name);
  rows.push({ name, pass: true, actual });
};
const ATTACKS = 16 | 128 | 256 | 512 | 1024 | 2048 | 8192 | 32768;

// Real FSM/physics/cost execution: an invulnerable, stationary sparring target
// isolates phrase timing. Refill spirit only to cover every costly pattern.
function phraseTrace(phase, count) {
  const { game: g } = makeHarness({ tutorial: false });
  g.start('ai'); g.silent = true;
  const [player, boss] = g.world.players;
  Object.assign(boss, { phase, maxHp: 240, hp: 240, maxPosture: 220,
    loadout: [], tonics: 0 });
  Object.assign(player, { invuln: 100000, tonics: 0 });
  const trace = [], seen = new Set();
  let recoveryCancelled = false, shortestOpening = Infinity, currentOpening = 0;
  for (let frame = 0; frame < 3000 && trace.length < count; frame++) {
    Object.assign(boss, { x: 2050, y: 1080, ground: true, spirit: 20 });
    Object.assign(player, { x: 2150, y: 1080, ground: true });
    if (g.world.effects.hitstop > 0) { g.step([0, 0]); continue; }
    const state = boss.state;
    const bits = g.ai.input(g.world, boss, player);
    if (state === 'RECOVERY' && (bits & ATTACKS)) recoveryCancelled = true;
    if (g.ai.openingUntil > g.ai.frame && ['IDLE', 'MOVE', 'GUARD'].includes(state)) {
      assert.equal(bits, 0, 'end-of-phrase opening admits no movement, guard or attack');
      currentOpening++;
    } else if (currentOpening) {
      shortestOpening = Math.min(shortestOpening, currentOpening); currentOpening = 0;
    }
    g.step([0, bits]);
    if (boss.state === 'ACTIVE' && !seen.has(boss.attackId)) {
      seen.add(boss.attackId); trace.push(boss.moveName);
    }
  }
  assert(!recoveryCancelled, 'Boss must complete recovery before the next strike');
  assert(shortestOpening >= 30 && shortestOpening < Infinity, 'full phrase offers >=30 actionable ticks');
  return trace;
}

check('Phase one repeats readable basic phrases', phraseTrace(1, 7),
  ['light', 'light', 'thrust', 'light', 'sweep', 'charged', 'light']);
check('Phase two adds multi-hit and lightning phrases', phraseTrace(2, 8),
  ['light', 'light', 'thrust', 'triple', 'light', 'sweep', 'lightning', 'charged']);
check('Phase three adds rift and longer endings without replacing its controller', phraseTrace(3, 9),
  ['triple', 'light', 'thrust', 'sweep', 'rift', 'lightning', 'light', 'charged', 'sweep']);

const scope = { window: {} };
vm.createContext(scope);
vm.runInContext(fs.readFileSync(path.join(SRC, 'ai.js'), 'utf8'), scope);
const AI = scope.window.RiftAI;
const world = { phase: 'fighting' };
const boss = { id: 1, x: 1000, y: 1080, ground: true, hp: 240, maxHp: 240,
  posture: 0, maxPosture: 220, spirit: 20, state: 'IDLE', st: 0,
  loadout: [], art: 'rift', phase: 3, tonics: 3, parries: 0, wasParried: 0 };
const player = { ...boss, id: 0, x: 1120, hp: 100, maxHp: 100, maxPosture: 100 };
function warmed(self = boss, enemy = player) {
  const ai = new AI();
  for (let n = 0; n < 12; n++) ai.input(world, self, enemy);
  return ai;
}
{
  const wounded = { ...boss, hp: 120 }, distant = { ...player, x: 1600 };
  const ai = warmed(wounded, distant); ai.nextHeal = 0;
  check('Boss 50% HP uses shared healing input despite exceeding player max HP',
    !!(ai.input(world, Object.freeze(wounded), Object.freeze(distant)) & 16384), true);
}
{
  const full = { ...boss, hp: 160 }, distant = { ...player, x: 1600 };
  const ai = warmed(full, distant); ai.nextHeal = 0;
  check('Boss above 55% does not consume healing', !!(ai.input(world, full, distant) & 16384), false);
}
{
  const ai = warmed(); ai.nextAttack = 0;
  ai.input(world, boss, player);
  const active = { ...boss, state: 'ACTIVE', wasParried: 1 };
  ai.input(world, active, player);
  check('Intermediate multiwave parry keeps the active sequence', ai.openingPending, 0);
  ai.input(world, { ...active, state: 'RECOIL', wasParried: 2 }, player);
  for (let n = 0; n < 18; n++) {
    assert.equal(ai.input(world, { ...boss, wasParried: 2 }, player), 0,
      'final parry gives a stationary 18-tick riposte opening');
  }
  check('Final-wave parry opening does not backjump', true, true);
}
{
  // Cost comes from the actual shared definition when available; no stale 7/4
  // thresholds or AI-only free casts may be introduced by a balance change.
  scope.window.RIFT = { MOVES: { rift: { cost: 11 } } };
  const lowSpirit = { ...boss, spirit: 10 };
  const ai = warmed(lowSpirit); ai.nextAttack = 0; ai.nextArt = 0;
  ai.pattern = { steps: ['art'], index: 0 };
  const bits = ai.input(world, lowSpirit, player);
  check('Insufficient shared art cost falls back to an ordinary strike', bits & (512 | 16), 16);
  const enough = { ...boss, spirit: 11 };
  const ready = warmed(enough); ready.nextAttack = 0; ready.nextArt = 0;
  ready.pattern = { steps: ['art'], index: 0 };
  check('Exact shared art cost permits the art', ready.input(world, enough, player) & 512, 512);
}
fs.writeFileSync(path.join(REPORTS, 'ai-rhythm.json'), JSON.stringify(rows, null, 2));
console.log(`${rows.length}/${rows.length} Boss rhythm, resource and phase checks passed.`);
