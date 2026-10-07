"use strict";
((root) => {
  const STATE = Object.freeze(Object.fromEntries([
    "IDLE", "MOVE", "STARTUP", "ACTIVE", "RECOVERY", "GUARD", "DEFLECT",
    "RECOIL", "BLADE_PINNED", "HIT_STUN", "STUNNED", "GRAPPLING", "DRINKING", "EXECUTING",
    "REVIVING", "DEAD",
  ].map((name) => [name, name])));
  const states = new Set(Object.values(STATE));
  const free = new Set([STATE.IDLE, STATE.MOVE, STATE.GUARD]);
  const attacks = new Set([STATE.STARTUP, STATE.ACTIVE, STATE.RECOVERY]);
  const reactions = new Set([
    STATE.RECOIL, STATE.BLADE_PINNED, STATE.HIT_STUN, STATE.STUNNED, STATE.EXECUTING,
    STATE.REVIVING, STATE.DEAD,
  ]);
  const passive = new Set([STATE.STUNNED, STATE.REVIVING, STATE.DEAD, STATE.EXECUTING]);
  const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

  function canAct(player) {
    return !!player && !player.dead && player.hp > 0 && free.has(player.state)
      && finite(player.lockFrames) <= 0;
  }

  function canTransition(player, next, options = {}) {
    if (!player || !states.has(next) || !states.has(player.state)) return false;
    if (player.state === STATE.DEAD || player.dead) return next === STATE.DEAD;
    if (options.interrupt && reactions.has(next)) {
      if (player.state === STATE.REVIVING) return next === STATE.DEAD;
      return true;
    }
    if (player.state === STATE.EXECUTING) return !!options.complete && next === STATE.IDLE;
    if (player.state === STATE.REVIVING)
      return !!options.complete && (next === STATE.IDLE || next === STATE.MOVE);
    if (player.state === STATE.STUNNED)
      return !!options.complete && player.hp > 0 && (next === STATE.IDLE || next === STATE.MOVE);
    if (player.state === STATE.STARTUP)
      return !!options.complete && next === STATE.ACTIVE;
    if (player.state === STATE.ACTIVE)
      return !!options.complete && next === STATE.RECOVERY;
    if (player.state === STATE.RECOVERY)
      return !!options.complete && (free.has(next) || next === STATE.STARTUP || next === STATE.DEFLECT || next === STATE.GRAPPLING);
    if (player.state === STATE.DRINKING)
      return !!options.complete && next === STATE.IDLE;
    if (player.state === STATE.RECOIL || player.state === STATE.BLADE_PINNED || player.state === STATE.HIT_STUN)
      return !!options.complete && free.has(next);
    if (player.state === STATE.DEFLECT) {
      if (finite(player.lockFrames) > 0 && !options.complete) return false;
      return free.has(next) || next === STATE.DEFLECT || next === STATE.STARTUP || next === STATE.GRAPPLING;
    }
    if (player.state === STATE.GRAPPLING)
      return !!options.complete && (free.has(next) || next === STATE.STARTUP);
    if (!canAct(player)) return false;
    return free.has(next) || next === STATE.STARTUP || next === STATE.DEFLECT
      || next === STATE.GRAPPLING || next === STATE.DRINKING;
  }

  function enter(player, next, options = {}) {
    if (!canTransition(player, next, options)) return false;
    if (player.state === next && !options.restart) return true;
    if (player.state === STATE.DRINKING && next !== STATE.DRINKING)
      player.healPending = 0;
    if (!attacks.has(next)) {
      if (player.attackId != null) player.cancelledAttackId = player.attackId;
      player.attackId = null;
      player.move = null;
      player.moveName = "";
      player.charge = 0;
      player.confirm = 0;
      player.hits = [];
    }
    const defaults = {
      STARTUP: finite(player.move?.windup, 1),
      ACTIVE: finite(player.move?.active, 1),
      RECOVERY: finite(player.move?.recovery, 20),
      DEFLECT: 12, RECOIL: 18, BLADE_PINNED: 42, HIT_STUN: 18, STUNNED: 240,
      DRINKING: 54, REVIVING: 90,
    };
    player.state = next;
    player.st = 0;
    player.lockFrames = Math.max(0, finite(options.lockFrames,
      finite(options.frames, defaults[next] ?? 0)));
    player.guard = next === STATE.GUARD || next === STATE.DEFLECT;
    if (!player.guard) {
      player.aegis = false;
      player.deflect = 0;
    }
    if (next !== STATE.GRAPPLING) player.grapple = null;
    if (next === STATE.STUNNED) {
      player.stun = player.lockFrames;
      player.vx = 0; player.dash = 0; player.dashDir = 0;
      player.blinkWindow = 0; player.invuln = 0; player.drop = 0;
      player.stompBuffer = 0;
    }
    if (next === STATE.REVIVING) player.revive = player.lockFrames;
    if (next === STATE.DEAD) {
      player.dead = true;
      player.hp = 0;
      player.lockFrames = 0;
    }
    return true;
  }

  function basePostureRate(playerOrHp) {
    const maximum = typeof playerOrHp === "object" && playerOrHp?.maxHp > 0 ? playerOrHp.maxHp : 100;
    const hp = typeof playerOrHp === "number" ? playerOrHp : playerOrHp?.hp / maximum * 100;
    if (!Number.isFinite(hp) || hp < 50) return 0;
    return hp >= 75 ? 35 : 15;
  }

  // Posture points per second; tickPosture converts this to the 60 Hz step.
  function postureRate(player, distance = Infinity) {
    if (!player || player.dead || passive.has(player.state) || finite(player.peace) < 12)
      return 0;
    let rate = basePostureRate(player);
    if (rate === 0) return 0;
    if (player.state === STATE.GUARD && distance > 350) rate *= 2.5;
    if (player.burn > 0) rate *= 0.25;
    if (player.aiControlled && player.phase >= 2) rate *= 1.2;
    return rate;
  }

  function parryWindow(spamOrPlayer = 0) {
    const spam = typeof spamOrPlayer === "object" ? spamOrPlayer?.guardSpam : spamOrPlayer;
    // Only unanswered rapid presses accrue debt; a confirmed parry clears it.
    // Keep a usable floor so a learned multi-hit rhythm never becomes a 4f lottery.
    return Math.max(12, 16 - 2 * Math.max(0, finite(spam)));
  }

  const api = Object.freeze({STATE, STATES: STATE, State: STATE, enum: STATE,
    canAct, canTransition, enter, basePostureRate, postureRate, parryWindow});
  root.RiftFSM = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
