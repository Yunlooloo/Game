"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const FSM = require("../src/fsm.js");
const Vitals = require("../src/vitals.js");
const S = FSM.STATE;
const player = (extra = {}) => ({
  hp: 100, posture: 0, ground:true, state: S.IDLE, st: 0, lockFrames: 0,
  nodes: 2, phase: 1, tonics: 3, healPending: 0, peace: 12,
  aiControlled: false, dead: false, burn: 0, ...extra,
});

test("strict transitions require completed attacks or explicit reactions", () => {
  const p = player({attackId: "attack-1", move: {windup: 8, active: 4, recovery: 18}});
  assert.equal(FSM.enter(p, S.STARTUP), true);
  assert.equal(FSM.canAct(p), false);
  assert.equal(FSM.enter(p, S.GUARD), false);
  assert.equal(FSM.enter(p, S.ACTIVE), false);
  assert.equal(FSM.enter(p, S.ACTIVE, {complete: true}), true);
  assert.equal(FSM.enter(p, S.RECOVERY, {complete: true}), true);
  assert.equal(FSM.enter(p, S.STARTUP), false);
  assert.equal(FSM.enter(p, S.STARTUP, {complete: true}), true);
  assert.equal(FSM.enter(p, S.RECOIL, {interrupt: true, frames: 24}), true);
  assert.equal(p.lockFrames, 24);
  assert.equal(p.cancelledAttackId, "attack-1");
  assert.equal(p.attackId, null);
  assert.equal(p.move, null);
  assert.equal(FSM.enter(p, S.STARTUP), false);
  assert.equal(FSM.enter(p, S.IDLE, {complete: true}), true);
  assert.equal(FSM.enter(p, "Idle"), false);
});

test("deflect cannot cancel its 12 frame lock and guard flags follow states", () => {
  const p = player();
  assert.equal(FSM.enter(p, S.DEFLECT), true);
  assert.equal(p.guard, true);
  assert.equal(p.lockFrames, 12);
  assert.equal(FSM.canAct(p), false);
  assert.equal(FSM.enter(p, S.STARTUP), false);
  assert.equal(FSM.enter(p, S.DEFLECT), false);
  assert.equal(FSM.enter(p, S.GUARD, {complete: true}), true);
  p.aegis = true;
  assert.equal(FSM.enter(p, S.MOVE), true);
  assert.equal(p.guard, false);
  assert.equal(p.aegis, false);
  assert.deepEqual([0, 1, 2, 3, 4, 8].map(FSM.parryWindow), [12, 10, 8, 6, 4, 4]);
});

test("posture uses exact HP bands, distance threshold, delay, and AI-only phase multiplier", () => {
  const p = player({posture: 100});
  assert.equal(FSM.basePostureRate(100), 35);
  assert.equal(FSM.basePostureRate(75), 35);
  assert.equal(FSM.basePostureRate(74.999), 15);
  assert.equal(FSM.basePostureRate(50), 15);
  assert.equal(FSM.basePostureRate(49.999), 0);
  p.state = S.GUARD;
  assert.equal(FSM.postureRate(p, 350), 35);
  assert.equal(FSM.postureRate(p, 350.001), 87.5);
  p.phase = 2;
  assert.equal(FSM.postureRate(p, 351), 87.5);
  p.aiControlled = true;
  assert.equal(FSM.postureRate(p, 351), 105);
  p.burn = 12;
  assert.equal(FSM.postureRate(p, 351), 26.25);
  assert.equal(Vitals.tickPosture(p, 351), 26.25 / 60);
  p.hp = 49;
  assert.equal(FSM.postureRate(p, 351), 0);
  p.hp = 100;
  p.peace = 11;
  assert.equal(FSM.postureRate(p, 351), 0);
  p.peace = 12;
  for (const state of [S.STUNNED, S.REVIVING, S.DEAD, S.EXECUTING]) {
    p.state = state;
    assert.equal(FSM.postureRate(p, 351), 0);
  }
});

test("tonic consumes one use at start and heals only after 54 frames", () => {
  const p = player({hp: 25});
  assert.equal(Vitals.beginDrink(p), true);
  assert.equal(p.tonics, 2);
  assert.equal(p.healPending, 40);
  assert.equal(p.lockFrames, 54);
  for (let i = 0; i < 53; i++) assert.equal(Vitals.tickDrink(p), false);
  assert.equal(p.hp, 25);
  assert.equal(FSM.enter(p, S.STARTUP), false);
  assert.equal(Vitals.tickDrink(p), true);
  assert.equal(p.hp, 65);
  assert.equal(p.state, S.IDLE);
  assert.equal(p.healPending, 0);
  assert.equal(Vitals.tickDrink(p), false);
  assert.equal(Vitals.beginDrink(player()), false);
  assert.equal(Vitals.beginDrink(player({hp: 50, tonics: 0})), false);
});

test("hits interrupt drinking without healing or refund, including armoured move leftovers", () => {
  const p = player({hp: 60});
  Vitals.beginDrink(p);
  for (let i = 0; i < 53; i++) Vitals.tickDrink(p);
  p.move = {armor: true};
  const hit = Vitals.hurt(p, 5, {posture: 12, stun: 17});
  assert.deepEqual(hit, {damaged: 5, interrupted: true, broken: false});
  assert.equal(p.hp, 55);
  assert.equal(p.posture, 12);
  assert.equal(p.tonics, 2);
  assert.equal(p.healPending, 0);
  assert.equal(p.state, S.HIT_STUN);
  assert.equal(p.lockFrames, 17);
  for (let i = 0; i < 100; i++) Vitals.tickDrink(p);
  assert.equal(p.hp, 55);
});

test("startup armor resists hit-stun but does not prevent HP or posture break", () => {
  const p = player({state: S.STARTUP, move: {armor: true}, hp: 50});
  Vitals.hurt(p, 10, {posture: 15});
  assert.equal(p.hp, 40);
  assert.equal(p.posture, 15);
  assert.equal(p.state, S.STARTUP);
  assert.equal(Vitals.hurt(p, 40).broken, true);
  assert.equal(p.state, S.STUNNED);
  assert.equal(p.lockFrames, 240);
  assert.equal(p.nodes, 2);
});

test("zero HP only exposes a finisher; first node revives, second ends life", () => {
  const p = player({hp: 10, tonics: 1});
  assert.equal(Vitals.takeNode(p).taken, false);
  assert.equal(Vitals.hurt(p, 10).broken, true);
  assert.equal(p.hp, 0);
  assert.equal(p.nodes, 2);
  assert.equal(p.state, S.STUNNED);
  assert.equal(p.stun, 240);
  assert.equal(FSM.enter(p, S.IDLE, {complete: true}), false);
  assert.equal(Vitals.vulnerable(p), true);
  assert.deepEqual(Vitals.takeNode(p), {taken: true, dead: false, reviving: true, phase: 2});
  assert.equal(p.nodes, 1);
  assert.equal(p.hp, 100);
  assert.equal(p.posture, 0);
  assert.equal(p.phase, 2);
  assert.equal(p.state, S.REVIVING);
  assert.equal(p.lockFrames, 90);
  assert.equal(p.invuln, 90);
  assert.equal(p.tonics, 1);
  assert.equal(Vitals.vulnerable(p), false);
  assert.equal(Vitals.takeNode(p).taken, false);
  assert.equal(Vitals.hurt(p, 1000).damaged, 0);
  assert.equal(FSM.enter(p, S.IDLE, {complete: true}), true);
  Vitals.hurt(p, 100);
  assert.deepEqual(Vitals.takeNode(p), {taken: true, dead: true, reviving: false, phase: 2});
  assert.equal(p.nodes, 0);
  assert.equal(p.dead, true);
  assert.equal(p.state, S.DEAD);
  assert.equal(FSM.enter(p, S.IDLE, {complete: true}), false);
});

test("a full posture break also exposes a finisher without consuming nodes", () => {
  const p = player({posture: 95});
  Vitals.hurt(p, 0, {posture: 5});
  assert.equal(p.hp, 15);
  assert.equal(p.state, S.STUNNED);
  assert.equal(p.nodes, 2);
  assert.equal(Vitals.vulnerable(p), true);
  for (const state of [S.REVIVING, S.DEAD, S.EXECUTING])
    assert.equal(Vitals.vulnerable({...p, state, hp: 0}), false);
});

test("execution and bladeCounter locks complete without a deadlock",()=>{const p=player();assert.equal(FSM.enter(p,S.EXECUTING,{interrupt:true,frames:45}),true);assert.equal(FSM.enter(p,S.IDLE),false);assert.equal(FSM.enter(p,S.IDLE,{complete:true}),true);assert.equal(FSM.enter(p,S.BLADE_PINNED,{interrupt:true,frames:42}),true);assert.equal(FSM.enter(p,S.STARTUP),false);assert.equal(FSM.enter(p,S.IDLE,{complete:true}),true);});
