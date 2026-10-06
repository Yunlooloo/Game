"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const FSM = require("../src/fsm.js");
const Vitals = require("../src/vitals.js");
const S = FSM.STATE;
const boss = (extra = {}) => ({
  hp: 240, maxHp: 240, posture: 0, maxPosture: 220, nodes: 3, maxNodes: 3,
  phase: 1, tonics: 3, ground: true, dead: false, state: S.IDLE,
  st: 0, lockFrames: 0, peace: 0, healPending: 0, aiControlled: true,
  ...extra,
});

test("three-core Boss revives at full capacity twice before the final defeat", () => {
  const p = boss({tonics: 1});
  for (const expectedNodes of [2, 1, 0]) {
    assert.equal(Vitals.takeNode(p).taken, false, "healthy Boss cannot lose a core");
    const damage = Vitals.hurt(p, 240);
    assert.equal(damage.damaged, 240, "HP is not truncated to the player's 100-point scale");
    assert.equal(damage.broken, true);
    assert.equal(p.nodes, expectedNodes + 1, "damage exposes a finisher without taking a core");
    assert.equal(p.state, S.STUNNED);
    assert.equal(p.lockFrames, 240);
    assert.equal(p.posture, 220);
    assert.equal(Vitals.vulnerable(p), true);

    p.burn = 60; p.charged = 180; p.dash = 8; p.vx = 11;
    const result = Vitals.takeNode(p);
    assert.equal(result.taken, true);
    assert.equal(p.nodes, expectedNodes);
    assert.equal(p.phase, Math.min(3, 4 - expectedNodes));
    assert.equal(p.tonics, 1, "new phases do not refill the shared tonic supply");
    assert.equal(p.burn, 0); assert.equal(p.charged, 0);
    assert.equal(p.dash, 0); assert.equal(p.vx, 0);
    assert.equal(Vitals.takeNode(p).taken, false, "the same finisher cannot take another core");

    if (expectedNodes > 0) {
      assert.equal(result.dead, false);
      assert.equal(result.reviving, true);
      assert.equal(p.state, S.REVIVING);
      assert.equal(p.hp, 240); assert.equal(p.posture, 0);
      assert.equal(p.lockFrames, 90); assert.equal(p.invuln, 90);
      assert.equal(Vitals.hurt(p, 999).damaged, 0);
      assert.equal(FSM.enter(p, S.IDLE, {complete: true}), true);
    } else {
      assert.equal(result.dead, true);
      assert.equal(result.reviving, false);
      assert.equal(p.state, S.DEAD);
      assert.equal(p.hp, 0); assert.equal(p.posture, 220);
      assert.equal(p.invuln, 0);
    }
  }
});

test("Boss posture breaks at its own capacity, remains still, and recovers proportionally", () => {
  const p = boss({posture: 99, vx: 12, dash: 9, dashDir: 1, invuln: 4});
  assert.equal(Vitals.hurt(p, 0, {posture: 1}).broken, false);
  assert.equal(p.posture, 100);
  assert.equal(Vitals.vulnerable(p), false);
  assert.equal(Vitals.hurt(p, 0, {posture: 120}).broken, true);
  assert.equal(p.hp, 36); assert.equal(p.posture, 220);
  assert.equal(p.vx, 0); assert.equal(p.dash, 0); assert.equal(p.invuln, 0);
  assert.equal(p.nodes, 3);
  assert.equal(Vitals.recoverDown(p), false);
  p.lockFrames = 80;
  Vitals.hurt(p, 5, {posture: 10});
  assert.equal(p.lockFrames, 80, "repeat hits must not extend the downed timer");
  assert.equal(p.hp, 31);
  p.lockFrames = 0;
  assert.equal(Vitals.recoverDown(p), true);
  assert.equal(p.hp, 36);
  assert.equal(p.posture, 77);
  assert.equal(p.state, S.IDLE);
  assert.equal(p.nodes, 3);
  assert.equal(Vitals.vulnerable(p), false);
});

test("Boss tonic heals 40 percent only at tick 54 and respects the higher cap", () => {
  assert.equal(Vitals.beginDrink(boss()), false);
  const p = boss({hp: 120});
  assert.equal(Vitals.beginDrink(p), true);
  assert.equal(p.tonics, 2);
  assert.equal(p.healPending, 96);
  for (let tick = 0; tick < 53; tick++) assert.equal(Vitals.tickDrink(p), false);
  assert.equal(p.hp, 120);
  assert.equal(Vitals.tickDrink(p), true);
  assert.equal(p.hp, 216);
  assert.equal(Vitals.beginDrink(p), true);
  for (let tick = 0; tick < 54; tick++) Vitals.tickDrink(p);
  assert.equal(p.hp, 240);
  assert.equal(p.tonics, 1);
  assert.equal(Vitals.beginDrink(p), false);
});

test("interrupting Boss healing loses the consumed tonic and grants no delayed heal", () => {
  const p = boss({hp: 120});
  assert.equal(Vitals.beginDrink(p), true);
  for (let tick = 0; tick < 53; tick++) Vitals.tickDrink(p);
  const result = Vitals.hurt(p, 15, {posture: 10});
  assert.equal(result.interrupted, true);
  assert.equal(p.hp, 105);
  assert.equal(p.tonics, 2);
  assert.equal(p.healPending, 0);
  for (let tick = 0; tick < 90; tick++) Vitals.tickDrink(p);
  assert.equal(p.hp, 105);
});

test("Boss posture recovery uses HP percentage and cannot regenerate below half health", () => {
  assert.equal(FSM.basePostureRate(boss({hp: 180})), 35);
  assert.equal(FSM.basePostureRate(boss({hp: 179.999})), 15);
  assert.equal(FSM.basePostureRate(boss({hp: 120})), 15);
  const p = boss({hp: 119.999, posture: 210, peace: 90, phase: 3, state: S.GUARD});
  assert.equal(FSM.basePostureRate(p), 0);
  for (let tick = 0; tick < 300; tick++) {
    assert.equal(Vitals.tickPosture(p, 500), 0);
  }
  assert.equal(p.posture, 210, "phase and distant guard multipliers cannot revive a zero rate");
});

test("capacity helpers normalize bars and preserve old player or replica defaults", () => {
  assert.equal(Vitals.hpRatio(boss({hp: 120})), 0.5);
  assert.equal(Vitals.postureRatio(boss({posture: 110})), 0.5);
  assert.equal(Vitals.hpRatio(boss({hp: 999})), 1);
  assert.equal(Vitals.postureRatio(boss({posture: -10})), 0);
  for (const p of [undefined, {}, {maxHp: NaN, maxPosture: -1, maxNodes: Infinity}]) {
    assert.equal(Vitals.maxHp(p), 100);
    assert.equal(Vitals.maxPosture(p), 100);
    assert.equal(Vitals.maxNodes(p), 2);
  }
  const p = boss({posture: 150, peace: 0});
  assert.equal(Vitals.tickPosture(p), 0);
  assert.equal(p.posture, 150, "waiting for recovery must not clip Boss posture to 100");
  delete p.maxHp; delete p.maxPosture; delete p.maxNodes;
  Object.assign(p, {hp: 20, posture: 0, nodes: 2});
  assert.equal(Vitals.beginDrink(p), true);
  for (let tick = 0; tick < 54; tick++) Vitals.tickDrink(p);
  assert.equal(p.hp, 60);
  Vitals.hurt(p, 60);
  assert.equal(p.posture, 100);
  assert.equal(Vitals.takeNode(p).reviving, true);
  assert.equal(p.hp, 100); assert.equal(p.nodes, 1); assert.equal(p.phase, 2);
});
