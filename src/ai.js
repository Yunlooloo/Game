/* Expert opponent: 12-frame visual latency, 800px sight, no raw input access. */
window.RiftAI = class RiftAI {
  constructor() { this.reset(); }
  reset() {
    this.frame = 0;
    this.history = [];
    this.lastSight = null;
    this.previous = 0;
    this.seed = 0x75ad121f;
    this.pending = null;
    this.lastThreat = '';
    this.parries = 0;
    this.wasParried = 0;
    this.counterUntil = 0;
    this.retreatUntil = 0;
    this.disengageUntil = 0;
    this.guardUntil = 0;
    this.chargeUntil = 0;
    this.nextAttack = 30;
    this.nextTool = 65;
    this.nextArt = 210;
    this.nextHeal = 90;
    this.nextPunish = 0;
    this.nextJump = 0;
    this.nextDash = 0;
    this.nextGrapple = 45;
    this.nextStomp = 0;
    this.chaseUntil = 0;
    this.ambushUntil = 0;
    this.nextAmbush = 360;
    this.patrolIndex = 2;
    this.nav = null;
    this.navStill = 0;
    this.navPosition = null;
    this.healPlan = null;
  }
  _random() {
    let n = this.seed;
    n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
    this.seed = n >>> 0;
    return this.seed / 4294967296;
  }
  _observe(self, enemy) {
    if (Math.hypot(enemy.x - self.x, enemy.y - self.y) > 800) {
      return { frame: this.frame, visible: false };
    }
    const move = enemy.move;
    return {
      frame: this.frame, visible: true, x: enemy.x, y: enemy.y,
      vx: enemy.vx || 0, vy: enemy.vy || 0, ground: !!enemy.ground,
      state: enemy.state, st: enemy.st || 0, hp: enemy.hp,
      posture: enemy.posture, guard: !!enemy.guard, aegis: !!enemy.aegis,
      guardSpam: enemy.guardSpam || 0, hidden: !!enemy.hidden,
      charged: enemy.charged || 0, stun: enemy.stun || 0, dead: !!enemy.dead,
      move: move ? {
        name: move.name, kind: move.kind, windup: move.windup,
        active: move.active, reach: move.reach
      } : null
    };
  }
  // Navigation uses public level geometry and the same anchor score as Game.grapple.
  // It never chooses a destination from the opponent's live position.
  _selectedAnchor(world, x, y, facing) {
    let selected = null, best = Infinity;
    for (const a of world.anchors || []) {
      const range = Math.hypot(a.x - x, a.y - y);
      if (a.y >= y - 45 || range >= 850) continue;
      const score = range + (Math.sign(a.x - x) !== facing ? 230 : 0);
      if (score < best) { selected = a; best = score; }
    }
    return selected;
  }
  _landingPlatform(platforms, x, y) {
    let found = -1, top = Infinity;
    platforms.forEach((p, i) => {
      if (x > p.x - 10 && x < p.x + p.w + 10 && p.y >= y - 2 && p.y < top) {
        found = i; top = p.y;
      }
    });
    return found;
  }
  _route(world, self, targetX, targetY) {
    const platforms = world.platforms || [];
    const from = platforms.findIndex(p => Math.abs(p.y - self.y) < 3 &&
      self.x > p.x - 12 && self.x < p.x + p.w + 12);
    const to = this._landingPlatform(platforms, targetX, targetY);
    if (from < 0 || to < 0 || from === to) return null;
    const clamp = (x, p) => Math.max(p.x + 26, Math.min(p.x + p.w - 26, x));
    const nodes = platforms.map(() => []);
    platforms.forEach((p, i) => {
      const xs = [clamp(self.x, p), clamp(targetX, p)];
      for (let x = p.x + 26; x <= p.x + p.w - 26; x += 64) xs.push(x);
      xs.push(p.x + p.w - 26);
      for (const x of xs) {
        const below = this._landingPlatform(platforms, x, p.y + 5);
        if (below >= 0 && below !== i) nodes[i].push({ type: 'drop', to: below, x,
          landX: clamp(targetX, platforms[below]), cost: 35 });
        for (const facing of [-1, 1]) {
          const anchor = this._selectedAnchor(world, x, p.y, facing);
          if (!anchor || this._selectedAnchor(world, x - 20, p.y, facing) !== anchor ||
              this._selectedAnchor(world, x + 20, p.y, facing) !== anchor) continue;
          const dest = this._landingPlatform(platforms, anchor.x, anchor.y);
          if (dest < 0 || dest === i) continue;
          nodes[i].push({ type: 'grapple', to: dest, x, facing, anchor,
            landX: clamp(anchor.x, platforms[dest]),
            cost: Math.hypot(anchor.x - x, anchor.y - p.y) / 23 + 30 });
        }
        platforms.forEach((q, j) => {
          const rise = p.y - q.y, landX = clamp(x, q);
          if (j !== i && rise > 2 && rise <= 155 && Math.abs(landX - x) <= 125) {
            nodes[i].push({ type: 'jump', to: j, x, landX, cost: 45 });
          }
        });
      }
    });
    // A tiny Dijkstra search finds the first legal transition, including an
    // intermediate bridge when a single cable cannot reach the upper gantry.
    const costs = platforms.map(() => Infinity), first = [], visited = new Set();
    costs[from] = 0;
    for (let n = 0; n < platforms.length; n++) {
      let at = -1;
      for (let i = 0; i < platforms.length; i++)
        if (!visited.has(i) && (at < 0 || costs[i] < costs[at])) at = i;
      if (at < 0 || !Number.isFinite(costs[at])) break;
      if (at === to) return { ...first[at], from, destination: to, started: this.frame,
        progress: { x: self.x, y: self.y, at: this.frame } };
      visited.add(at);
      for (const edge of nodes[at]) {
        const startX = at === from ? self.x : (platforms[at].x + platforms[at].w / 2);
        const cost = costs[at] + edge.cost + Math.abs(edge.x - startX) / 5.4;
        if (cost < costs[edge.to]) {
          costs[edge.to] = cost;
          first[edge.to] = at === from ? edge : first[at];
        }
      }
    }
    return null;
  }
  _navigate(world, self, targetX, targetY, ready) {
    const f = this.frame, platforms = world.platforms || [];
    const B = { L: 1, R: 2, DOWN: 4, JUMP: 8, GRAPPLE: 4096 };
    if (!platforms.length) return null;
    const direction = x => x > self.x + 8 ? B.R : x < self.x - 8 ? B.L : 0;
    if (this.nav && this.nav.launched) {
      const landing = platforms[this.nav.to];
      if (!landing || (self.ground && self.state !== 'GRAPPLING')) {
        this.nav = null;
      } else {
        if (self.state === 'GRAPPLING') return 0;
        if (f - this.nav.started > 160) this.nav = null;
        else return direction(this.nav.landX);
      }
    }
    if (Math.abs(targetY - self.y) <= 105) { this.nav = null; return null; }
    if (!ready || !self.ground) return null;
    if (this.navPosition && Math.hypot(self.x - this.navPosition.x,
      self.y - this.navPosition.y) < 0.2) this.navStill++;
    else this.navStill = 0;
    this.navPosition = { x: self.x, y: self.y };
    // Net progress, not just velocity, also detects short left/right loops.
    if (this.nav && f - this.nav.progress.at >= 60) {
      if (Math.hypot(self.x - this.nav.progress.x, self.y - this.nav.progress.y) < 16) this.nav = null;
      else this.nav.progress = { x: self.x, y: self.y, at: f };
    }
    if (this.navStill > 75 || (this.nav && f - this.nav.started > 240)) {
      this.nav = null; this.navStill = 0; this.nextGrapple = Math.min(this.nextGrapple, f);
    }
    const destination = this._landingPlatform(platforms, targetX, targetY);
    if (this.nav && destination !== this.nav.destination) this.nav = null;
    if (!this.nav) this.nav = this._route(world, self, targetX, targetY);
    const plan = this.nav;
    if (!plan) return direction(targetX);
    const launchTolerance = plan.type === 'grapple' && self.facing === plan.facing ? 20 : 8;
    if (Math.abs(self.x - plan.x) > launchTolerance) return direction(plan.x);
    if (plan.type === 'grapple') {
      if (f < this.nextGrapple || (this.previous & B.GRAPPLE)) return 0;
      // Facing changes at the END of tickPlayer. Preface one frame before the
      // keypress; then verify the exact anchor that the engine will select.
      if (self.facing !== plan.facing) return plan.facing > 0 ? B.R : B.L;
      const actual = this._selectedAnchor(world, self.x, self.y, self.facing);
      if (actual !== plan.anchor) { this.nav = null; return direction(targetX); }
      plan.launched = true; plan.started = f; this.nextGrapple = f + 55;
      return B.GRAPPLE;
    }
    if (this.previous & B.JUMP) return 0;
    plan.launched = true; plan.started = f; this.nextJump = f + 24;
    return plan.type === 'drop' ? B.DOWN | B.JUMP : direction(plan.landX) | B.JUMP;
  }
  input(world, self, enemy) {
    const B = {
      L: 1, R: 2, DOWN: 4, JUMP: 8, ATTACK: 16, GUARD: 32, DASH: 64,
      T1: 128, T2: 256, ART: 512, THRUST: 1024, SWEEP: 2048,
      GRAPPLE: 4096, LIGHTNING: 8192, HEAL: 16384, TRIPLE: 32768
    };
    const done = bits => { this.previous = bits; return bits; };
    if (!self || !enemy || world.phase !== 'fighting') return done(0);
    ++this.frame;
    const f = this.frame;
    this.history.push(this._observe(self, enemy));
    const packet = this.history.length > 12 ? this.history.shift() : null;
    if (packet && packet.visible) this.lastSight = packet;
    const visible = !!(packet && packet.visible);
    const seen = visible ? packet :
      (this.lastSight && f - this.lastSight.frame < 180 ? this.lastSight : null);

    // Own tactile feedback is immediate; the chosen response waits through animation locks.
    const parries = self.parries || 0, wasParried = self.wasParried || 0;
    if (parries > this.parries) this.counterUntil = f + 120;
    if (wasParried > this.wasParried) {
      this.retreatUntil = f + 120;
      this.counterUntil = 0;
      this.chargeUntil = 0;
    }
    this.parries = parries;
    this.wasParried = wasParried;
    const state = self.state || 'IDLE';
    const ready = state === 'IDLE' || state === 'MOVE' || state === 'GUARD';
    if (['DEAD', 'REVIVING', 'EXECUTING', 'DRINKING', 'STUNNED',
      'HIT_STUN', 'RECOIL', 'BLADE_PINNED', 'DEFLECT'].includes(state)) {
      this.pending = null;
      this.chargeUntil = 0;
      this.guardUntil = 0;
      if (state === 'DEAD' || state === 'REVIVING') {
        this.counterUntil = 0;
        this.retreatUntil = 0;
        this.disengageUntil = 0;
        this.healPlan = null;
        this.nav = null;
      }
      return done(0);
    }
    if (!packet) return done(0);

    let bits = 0;
    const tap = bit => {
      if (this.previous & bit) return false;
      bits |= bit; return true;
    };
    const toolBit = name => {
      const index = (self.loadout || []).indexOf(name);
      return index === 0 ? B.T1 : index === 1 ? B.T2 : 0;
    };
    const cast = name => {
      const bit = toolBit(name);
      if (!bit || (self.spirit || 0) < (name === 'disc' ? 1 : 3)) return false;
      return tap(bit);
    };
    const age = seen ? Math.min(18, f - seen.frame) : 12;
    const knownTarget = !!seen;
    const patrol = [650, 1250, 2000, 2750, 3350];
    if (!knownTarget && Math.abs(self.x - patrol[this.patrolIndex]) < 75) {
      this.patrolIndex = (this.patrolIndex + (self.id === 1 ? 4 : 1)) % patrol.length;
    }
    const targetX = seen
      ? seen.x + Math.max(-50, Math.min(50, seen.vx * age)) * (seen.hidden ? 0.3 : 1)
      : patrol[this.patrolIndex];
    const targetY = seen
      ? seen.y + Math.max(-40, Math.min(70, seen.vy * age))
      : self.y;
    const dx = targetX - self.x, dy = targetY - self.y, distance = Math.abs(dx);
    const toward = dx >= 0 ? B.R : B.L, away = dx >= 0 ? B.L : B.R;
    const face = direction => { bits = (bits & ~3) | direction; };
    const finishFacing = direction => done((bits & ~3) | direction);

    // A visually confirmed down takes priority over a previously planned retreat.
    if (visible && (seen.state === 'STUNNED' || seen.posture >= 100) &&
        distance < 500 && Math.abs(dy) < 85) {
      this.chargeUntil = 0; this.retreatUntil = 0; this.disengageUntil = 0;
      this.guardUntil = 0; this.pending = null; this.healPlan = null; this.nav = null;
      if (distance < 125 && ready) tap(B.ATTACK);
      return finishFacing(toward);
    }

    // The lightning charge is sensed locally and does not depend on visual latency.
    if (self.charged && !self.ground) {
      this.chargeUntil = 0; this.guardUntil = 0;
      tap(B.ATTACK);
      this.nextAttack = f + 34;
      return finishFacing(toward);
    }
    if (this.retreatUntil >= f && ready) {
      this.retreatUntil = 0;
      this.disengageUntil = f + 27;
      this.nextAttack = Math.max(this.nextAttack, f + 32);
      if (self.ground) tap(B.JUMP);
      else if (f >= this.nextDash && tap(B.DASH)) this.nextDash = f + 45;
      return finishFacing(away);
    }
    if (this.disengageUntil > f) return finishFacing(away);
    if (this.counterUntil >= f && ready) {
      this.counterUntil = 0;
      this.guardUntil = 0;
      if (knownTarget && distance < 190 && Math.abs(dy) < 110) {
        if (tap(B.ATTACK)) this.nextAttack = f + 37;
        return finishFacing(toward);
      }
    }
    if (visible && seen.state === 'DRINKING' && ready && f >= this.nextPunish &&
        distance <= 300 && Math.abs(dy) < 110) {
      // Explicit chord selects punish. Engine must not infer it from current enemy state.
      if (tap(B.THRUST | B.DASH)) {
        this.nextPunish = f + 44;
        this.nextAttack = f + 43;
        this.nextDash = f + 44;
        this.chargeUntil = 0;
      }
      return finishFacing(toward);
    }

    const move = visible ? seen.move : null;
    if (move && (seen.state === 'STARTUP' || seen.state === 'ACTIVE')) {
      const windup = move.windup || 18;
      const eta = seen.state === 'STARTUP' ? windup - seen.st - age : -seen.st - age;
      const start = seen.frame - seen.st - (seen.state === 'ACTIVE' ? windup : 0);
      const key = (move.name || move.kind) + ':' + start;
      if (key !== this.lastThreat && eta >= -3 && eta <= 18 &&
          distance < (move.reach || 125) + 45 && Math.abs(dy) < 130) {
        this.lastThreat = key;
        const awareness = seen.hidden ? 0.44 : self.posture > 78 ? 0.92 : 0.86;
        if (this._random() < awareness) {
          let kind = 'deflect', lead = 5;
          if (move.kind === 'thrust') { kind = 'bladeCounter'; lead = 2; }
          else if (move.kind === 'sweep') { kind = 'jump'; lead = 10; }
          else if (move.kind === 'lightning') { kind = 'jump'; lead = 8; }
          else if (toolBit('blink') && self.spirit >= 3 && this.nextTool <= f &&
                   (self.posture > 72 || this._random() < 0.18)) {
            kind = 'blink'; lead = 5;
          }
          const at = f + Math.max(0, eta - lead + Math.floor(this._random() * 5) - 2);
          this.pending = { kind, at, expires: at + 7 };
        } else if (this._random() < 0.55) {
          this.pending = { kind: 'retreat', at: f, expires: f + 5 };
        }
      }
    }
    if (this.pending && this.pending.expires < f) this.pending = null;
    if (this.pending && f >= this.pending.at && ready) {
      const kind = this.pending.kind;
      this.chargeUntil = 0; this.ambushUntil = 0;
      if (kind === 'deflect') {
        if (!(this.previous & B.GUARD)) {
          tap(B.GUARD); this.guardUntil = f + 9; this.pending = null;
        } else this.guardUntil = 0;
        return finishFacing(toward);
      }
      if (kind === 'bladeCounter') {
        if (f >= this.nextDash && tap(B.DASH)) {
          this.nextDash = f + 30; this.pending = null;
        }
        return finishFacing(toward);
      }
      if (kind === 'jump') {
        face(toward);
        if (self.ground && tap(B.JUMP)) {
          this.nextJump = f + 24; this.nextStomp = f + 9; this.pending = null;
        } else if (!self.ground) this.pending = null;
      } else if (kind === 'blink') {
        if (cast('blink')) { this.nextTool = f + 105; this.pending = null; }
        return done(bits);
      } else if (kind === 'retreat') {
        if (f >= this.nextDash && tap(B.DASH)) this.nextDash = f + 35;
        this.pending = null;
        return finishFacing(away);
      }
    }
    if (this.guardUntil > f && ready) return done(B.GUARD | toward);
    if (this.chargeUntil > f) {
      if (state === 'STARTUP' || ready) return done(B.ATTACK);
      this.chargeUntil = 0;
    }
    // Healing is a deliberate, punishable action: create separation, then press
    // the same 54-frame tonic input as a player. Never mutate HP or inventory.
    if (self.hp > 55 || !(self.tonics > 0)) this.healPlan = null;
    if (ready && self.hp <= 55 && self.tonics > 0 && f >= this.nextHeal) {
      if (!this.healPlan) this.healPlan = { until: f + 180 };
      const safe = (!knownTarget || distance > 380) && self.ground;
      if (safe && tap(B.HEAL)) {
        this.nextHeal = f + 240; this.nextAttack = f + 90;
        this.healPlan = null; this.nav = null; this.ambushUntil = 0;
        return done(bits);
      }
      if (this.healPlan.until > f) {
        let escape = away;
        const room = away === B.L ? self.x - 24 : 3976 - self.x;
        if (this.healPlan.cornerDir && this.healPlan.cornerDir * (self.x - targetX) > 140)
          this.healPlan.cornerDir = 0;
        if (room < 90 && !this.healPlan.cornerDir) {
          // Commit across the opponent before turning away again. Recomputing
          // "away" at the corner threshold every frame would oscillate in place.
          this.healPlan.cornerDir = toward === B.R ? 1 : -1;
          if (self.ground && !(this.previous & B.JUMP))
            bits |= B.JUMP | (self.y < 1060 ? B.DOWN : 0);
        }
        if (this.healPlan.cornerDir) escape = this.healPlan.cornerDir > 0 ? B.R : B.L;
        if (f >= this.nextDash && distance < 365 && tap(B.DASH)) this.nextDash = f + 65;
        return finishFacing(escape);
      }
      this.healPlan = null; this.nextHeal = f + 120;
    }

    // Graph routes are derived only from the delayed visual target. A descent
    // uses the real drop-through input instead of repeatedly running in place.
    if (knownTarget) {
      const navigation = this._navigate(world, self, targetX, targetY, ready);
      if (navigation !== null) return done(navigation);
    } else this.nav = null;
    if (state === 'GRAPPLING') {
      if (visible && distance < 150 && Math.abs(dy) < 120 && f >= this.nextAttack) {
        if (tap(B.ATTACK)) this.nextAttack = f + 38;
      } else if (visible && distance > 240 && distance < 650 && f >= this.nextTool) {
        if (cast('disc')) this.nextTool = f + 100;
      }
      return finishFacing(toward);
    }
    if (!self.ground && visible && ready && f >= this.nextStomp &&
        self.y < targetY - 35 && self.y > targetY - 160 && distance < 80) {
      if (tap(B.JUMP)) {
        this.nextStomp = f + 32;
        this.nextAttack = Math.min(this.nextAttack, f + 9);
        return finishFacing(toward);
      }
    }
    if (ready && self.ground && knownTarget && dy < -65 && Math.abs(dy) < 170 &&
        f >= this.nextJump && distance < 300) {
      if (tap(B.JUMP)) { this.nextJump = f + 48; this.nextStomp = f + 11; }
    }
    if (!visible) {
      if (distance > 60) face(toward);
      else if (seen) this.lastSight = null;
      return done(bits);
    }
    if (self.posture > 66 && distance > 200 && Math.abs(dy) < 120 &&
        ready && !this.pending) {
      if (self.posture < 90 && this._random() < 0.012) {
        this.guardUntil = f + (toolBit('aegis') && self.spirit >= 2 ? 35 : 16);
        return done(bits | B.GUARD);
      }
      face(distance < 360 ? away : 0);
      if (distance < 300 && f >= this.nextDash && tap(B.DASH)) this.nextDash = f + 80;
      return done(bits);
    }
    if (self.ground && self.y > 995 && distance > 250 && distance < 540 &&
        f >= this.nextAmbush && ready) {
      this.nextAmbush = f + 470 + Math.floor(this._random() * 220);
      if (this._random() < 0.4) this.ambushUntil = f + 30;
    }
    if (this.ambushUntil > f && distance > 140) return done(bits | B.DOWN);
    const idealRange = self.hp < 35 ? 128 : 104;
    if (distance > idealRange || Math.abs(dy) > 110) face(toward);
    else if (distance < 52 && ready && this._random() < 0.28) face(away);
    if (distance > 500 && Math.abs(dy) < 90 && self.ground &&
        f >= this.nextDash && ready) {
      if (tap(B.DASH)) this.nextDash = f + 100;
    }
    if (!ready && state !== 'RECOVERY') return done(bits);

    if (ready && f >= this.nextTool) {
      if (distance > 215 && distance < 720 && Math.abs(dy) < 95 && cast('disc')) {
        this.nextTool = f + 105; this.chaseUntil = f + 80;
        this.nextAttack = Math.max(this.nextAttack, f + 18);
        return finishFacing(toward);
      }
      if (distance < 155 && Math.abs(dy) < 85 &&
          this._random() < 0.045 && cast('flame')) {
        this.nextTool = f + 170; this.nextAttack = f + 40;
        return finishFacing(toward);
      }
      if (distance < 160 && Math.abs(dy) < 110 &&
          (seen.guard || seen.aegis || seen.state === 'RECOVERY') &&
          this._random() < 0.055 && cast('hammer')) {
        this.nextTool = f + 200; this.nextAttack = f + 82;
        return finishFacing(toward);
      }
      if (toolBit('aegis') && distance < 210 && move &&
          move.kind === 'flame' && self.spirit >= 2) {
        this.guardUntil = f + 37; this.nextTool = f + 110;
        return done(bits | B.GUARD);
      }
    }
    if (ready && f >= this.nextArt &&
        distance < (self.art === 'rift' ? 380 : 145) &&
        Math.abs(dy) < 100 && self.spirit >= (self.art === 'rift' ? 7 : 4)) {
      const opportunity = seen.state === 'RECOVERY' || seen.posture > 68 || self.posture > 55;
      if (opportunity && this._random() < 0.035 && tap(B.ART)) {
        this.nextArt = f + 280; this.nextAttack = f + 95;
        return finishFacing(toward);
      }
    }
    if (f < this.nextAttack || Math.abs(dy) > 100) return done(bits);
    if (this.chaseUntil > f && distance > 145 && distance < 400 &&
        ready && tap(B.ATTACK)) {
      this.chaseUntil = 0; this.nextAttack = f + 43;
      return finishFacing(toward);
    }
    if (distance > 175) return done(bits);
    if (state === 'RECOVERY') {
      if (self.st >= 5 && this._random() < 0.09 && tap(B.ATTACK)) this.nextAttack = f + 32;
      else if (self.posture > 70 && f >= this.nextDash &&
               this._random() < 0.045 && tap(B.DASH)) {
        face(away); this.nextDash = f + 55;
      }
      return done(bits);
    }
    if (seen.guardSpam >= 2) {
      if (tap(B.ATTACK)) {
        // Variable 45-65f hold breaks repeated short deflect-window rhythms.
        this.chargeUntil = f + 45 + Math.floor(this._random() * 21);
        this.nextAttack = this.chargeUntil + 32;
      }
      return finishFacing(toward);
    }
    const choice = this._random(), phaseTwo = self.phase === 2;
    if (phaseTwo && choice < 0.13 && self.spirit >= 4) {
      if (tap(B.LIGHTNING)) this.nextAttack = f + 62;
    } else if (phaseTwo && choice < 0.28 && self.spirit >= 6) {
      if (tap(B.TRIPLE)) this.nextAttack = f + 85;
    } else if (choice < 0.4 && distance > 85) {
      if (tap(B.THRUST)) this.nextAttack = f + 53;
    } else if (choice < 0.55 && distance < 145 && seen.ground) {
      if (tap(B.SWEEP)) this.nextAttack = f + 58;
    } else if (choice < 0.64 && seen.guard && distance < 150) {
      if (tap(B.ATTACK)) { this.chargeUntil = f + 40; this.nextAttack = f + 74; }
    } else if (tap(B.ATTACK)) this.nextAttack = f + 30 + Math.floor(this._random() * 15);
    return finishFacing(toward);
  }
};
