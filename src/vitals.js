"use strict";
((root) => {
  const FSM = root.RiftFSM || (typeof require === "function" ? require("./fsm.js") : null);
  if (!FSM) throw new Error("RiftFSM must load before RiftVitals");
  const S = FSM.STATE;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const DOWN_TICKS = 240;

  // A down is a finite opportunity to finish, never an automatic loss of a core.
  // Repeated damage must not restart this timer or retain movement/evasion input.
  function down(player) {
    if (!player || player.dead || [S.REVIVING, S.DEAD, S.EXECUTING].includes(player.state)) return false;
    player.hp = Math.min(15, Math.max(0, finite(player.hp)));
    player.posture = 100;
    player.vx = 0; player.dash = 0; player.dashDir = 0;
    player.blinkWindow = 0; player.invuln = 0; player.drop = 0;
    player.guard = false; player.deflect = 0; player.aegis = false;
    player.grapple = null; player.healPending = 0;
    return FSM.enter(player, S.STUNNED, {interrupt: true, frames: DOWN_TICKS});
  }

  function recoverDown(player) {
    if (!player || player.state !== S.STUNNED || player.lockFrames > 0) return false;
    player.hp = 15; player.posture = 35; player.stun = 0;
    player.vx = 0; player.dash = 0; player.dashDir = 0;
    return FSM.enter(player, S.IDLE, {complete: true});
  }

  function vulnerable(player) {
    return !!player && !player.dead
      && ![S.REVIVING, S.DEAD, S.EXECUTING].includes(player.state)
      && (player.hp <= 0 || (player.state === S.STUNNED && player.posture >= 100));
  }

  function beginDrink(player) {
    if (!player || !player.ground || finite(player.tonics) <= 0 || player.hp >= 100 || !FSM.canAct(player))
      return false;
    if (!FSM.enter(player, S.DRINKING)) return false;
    player.tonics -= 1;
    player.healPending = 40;
    player.vx = 0; player.dash = 0; player.blinkWindow = 0;
    return true;
  }

  function tickDrink(player) {
    if (!player || player.state !== S.DRINKING) return false;
    player.st = finite(player.st) + 1;
    player.lockFrames = Math.max(0, finite(player.lockFrames, 54) - 1);
    if (player.lockFrames > 0) return false;
    const heal = Math.max(0, finite(player.healPending));
    player.hp = clamp(finite(player.hp) + heal, 0, 100);
    player.healPending = 0;
    FSM.enter(player, S.IDLE, {complete: true});
    return heal > 0;
  }

  function hurt(player, damage, options = {}) {
    const result = {damaged: 0, interrupted: false, broken: false};
    if (!player || player.dead || [S.REVIVING, S.DEAD, S.EXECUTING].includes(player.state))
      return result;
    const amount = Math.max(0, finite(damage));
    const posture = Math.max(0, finite(options.posture));
    if (amount === 0 && posture === 0) return result;
    const hp = clamp(finite(player.hp), 0, 100);
    player.hp = Math.max(0, hp - amount);
    result.damaged = hp - player.hp;
    player.posture = clamp(finite(player.posture) + posture, 0, 100);
    player.peace = 0;
    result.interrupted = player.state === S.DRINKING;
    if (result.interrupted) player.healPending = 0;
    if (player.hp <= 0 || player.posture >= 100) {
      down(player);
      result.broken = true;
    } else if (player.state !== S.STUNNED
      && !(player.state === S.STARTUP && player.move?.armor)) {
      FSM.enter(player, S.HIT_STUN, {
        interrupt: true, frames: Math.max(0, finite(options.stun, 18)),
      });
    }
    return result;
  }

  function takeNode(player) {
    const result = {taken: false, dead: !!player?.dead, reviving: false, phase: player?.phase};
    if (!vulnerable(player)) return result;
    player.nodes = Math.max(0, Math.floor(finite(player.nodes, 2)) - 1);
    result.taken = true;
    player.healPending = 0;
    player.guard = false;
    player.deflect = 0;
    player.aegis = false;
    player.vx = 0;
    player.vy = 0;
    player.burn = 0; player.charged = 0; player.fireBlade = 0; player.blinkWindow = 0; player.dash = 0; player.drop = 0;
    player.stun = 0;
    player.peace = 0;
    if (player.nodes > 0) {
      player.hp = 100;
      player.posture = 0;
      player.phase = 2;
      player.invuln = 90;
      player.dead = false;
      FSM.enter(player, S.REVIVING, {interrupt: true, frames: 90});
      result.reviving = true;
    } else {
      player.hp = 0;
      player.posture = 100;
      player.invuln = 0;
      FSM.enter(player, S.DEAD, {interrupt: true});
      result.dead = true;
    }
    result.phase = player.phase;
    return result;
  }

  function tickPosture(player, distance = Infinity) {
    if (!player) return 0;
    const old = clamp(finite(player.posture), 0, 100);
    const recovered = Math.min(old, FSM.postureRate(player, distance) / 60);
    player.posture = old - recovered;
    return recovered;
  }

  const api = Object.freeze({DOWN_TICKS, down, recoverDown, vulnerable, beginDrink, tickDrink, hurt, takeNode, tickPosture});
  root.RiftVitals = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
