
"use strict";
(() => {
  const TICK_RATE = 60, FIXED_DT = 1 / TICK_RATE, MAX_STEPS = 6;
  const B = {
    LEFT: 1,
    RIGHT: 2,
    DOWN: 4,
    JUMP: 8,
    ATTACK: 16,
    GUARD: 32,
    DASH: 64,
    TOOL1: 128,
    TOOL2: 256,
    ART: 512,
    THRUST: 1024,
    SWEEP: 2048,
    GRAPPLE: 4096,
    LIGHTNING: 8192, HEAL:16384, TRIPLE:32768,
  };
  const STATES = Object.values(RiftFSM.STATE);
  const MOVES = {
    light: {
      name: "輕斬",
      windup: 18,
      active: 5,
      recovery: 14,
      reach: 116,
      damage: 10,
      posture: 12,
      kind: "slash",
    },
    charged: {
      name: "蓄斬",
      windup: 36,
      active: 14,
      recovery: 27,
      reach: 226,
      damage: 13,
      posture: 26,
      kind: "slash",
      waves: [0, 8],
      breakGuard: true,
    },
    combo: {
      name: "追斬",
      windup: 11,
      active: 5,
      recovery: 19,
      reach: 137,
      damage: 11,
      posture: 15,
      kind: "slash",
    },
    chase: {
      name: "疾斬",
      windup: 10,
      active: 7,
      recovery: 20,
      reach: 149,
      damage: 12,
      posture: 17,
      kind: "slash",
      lunge: 13,
    },
    air: {
      name: "空斬",
      windup: 12,
      active: 7,
      recovery: 18,
      reach: 140,
      damage: 12,
      posture: 17,
      kind: "slash",
    },
    thrust: {
      name: "突刺",
      windup: 30,
      active: 7,
      recovery: 26,
      reach: 187,
      damage: 20,
      posture: 22,
      kind: "thrust",
      lunge: 7,
    },
    sweep: {
      name: "橫掃",
      windup: 32,
      active: 9,
      recovery: 26,
      reach: 164,
      damage: 17,
      posture: 25,
      kind: "sweep",
    },
    lightning: {
      name: "雷斬",
      windup: 34,
      active: 9,
      recovery: 28,
      reach: 242,
      damage: 19,
      posture: 23,
      kind: "lightning",
      cost: 4,
    },
    reversal: {
      name: "返雷",
      windup: 5,
      active: 12,
      recovery: 24,
      reach: 600,
      damage: 29,
      posture: 35,
      kind: "reversal",
    },
    aegis: {
      name: "旋斬",
      windup: 10,
      active: 7,
      recovery: 20,
      reach: 160,
      damage: 14,
      posture: 21,
      kind: "slash",
    },
    flame: {
      name: "焰筒",
      windup: 17,
      active: 10,
      recovery: 25,
      reach: 164,
      damage: 9,
      posture: 13,
      kind: "flame",
      cost: 3,
    },
    hammer: {
      name: "重鎚",
      windup: 45,
      active: 9,
      recovery: 36,
      reach: 150,
      damage: 23,
      posture: 42,
      kind: "hammer",
      cost: 4,
      breakGuard: true,
      armor: true,
    },
    blink: {
      name: "影襲",
      windup: 9,
      active: 5,
      recovery: 21,
      reach: 128,
      damage: 15,
      posture: 24,
      kind: "slash",
    },
    disc: {
      name: "飛輪",
      windup: 8,
      active: 2,
      recovery: 14,
      reach: 0,
      damage: 5,
      posture: 7,
      kind: "projectile",
      cost: 1,
    },
    cleave: {
      name: "雙斷",
      windup: 43,
      active: 20,
      recovery: 33,
      reach: 166,
      damage: 15,
      posture: 26,
      kind: "cleave",
      cost: 5,
      waves: [0, 12],
    },
    rift: {
      name: "裂斬",
      windup: 40,
      active: 24,
      recovery: 38,
      reach: 510,
      damage: 19,
      posture: 25,
      kind: "rift",
      cost: 9,
      waves: [0, 14],
      chip: 0.45,
    },
  };
  MOVES.punish={name:"疾刺",windup:10,active:8,recovery:30,reach:190,damage:24,posture:24,kind:"thrust",lunge:18};
  MOVES.triple={name:"連斬",windup:15,active:25,recovery:24,reach:150,damage:11,posture:15,kind:"slash",waves:[0,9,18],lunge:11,cost:6};
  const TOOL_NAMES = {
    disc: "飛輪",
    flame: "焰筒",
    hammer: "重鎚",
    blink: "影匣",
    aegis: "輪盾",
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const $ = (id) => document.getElementById(id);
  function fighter(id, x, loadout, art) {
    return {
      id,
      name: id ? "赤衡" : "渡影",
      x,
      y: 810,
      vx: 0,
      vy: 0,
      facing: id ? -1 : 1,
      ground: true,
      hp: 100,
      nodes:2, phase:1, tonics:3, healPending:0, lockFrames:0, aiControlled:false, wasParried:0, attackId:null,lastCounterTick:-999,
      posture: 0,
      spirit: 20,
      state: "IDLE",
      st: 0,
      move: null,
      moveName: "",
      charge: 0,
      deflect: 0,
      guard: false,
      aegis: false,
      hidden: false,
      burn: 0,
      fireBlade: 0,
      charged: 0,
      stun: 0,
      grapple: null,
      loadout: [...loadout],
      art,
      color: id ? "#a7473b" : "#deb784",
      dead: false,
      prevBits: 0,
      guardAge: 0,
      guardSpam: 0,
      lastGuard: -999,
      deflectWindow: 12,
      dash: 0,
      dashDir: 0,
      invuln: 0,
      blinkWindow: 0,
      confirm: 0,
      chase: 0,
      fireReady: 0,
      peace: 0,
      drop: 0,
      hits: [],
      wave: 0,
      moveSeq: 0,
      holdCharged: false,
      stomp: 0,
      attackReleased: false,
      aegisAge: 0,
      parries: 0,
      comboCount: 0,
    };
  }
  function makeWorld(loadout = ["disc", "flame"], art = "cleave") {
    return {
      tick: 0,
      time: 0,
      phase: "menu",
      mode: "ai",
      weather: "dusk",
      players: [
        fighter(0, 1810, loadout, art),
        fighter(1, 2150, ["aegis", "hammer"], "rift"),
      ],
      platforms: [
        { x: 0, y: 1080, w: 4000, type: "stone" },
        { x: 280, y: 870, w: 600, type: "bridge" },
        { x: 1130, y: 920, w: 420, type: "stone" },
        { x: 1570, y: 810, w: 890, type: "bridge" },
        { x: 2640, y: 905, w: 650, type: "bridge" },
        { x: 460, y: 600, w: 480, type: "gantry" },
        { x: 1160, y: 470, w: 450, type: "pylon" },
        { x: 1710, y: 465, w: 640, type: "gantry" },
        { x: 2750, y: 540, w: 610, type: "gantry" },
        { x: 2160, y: 220, w: 390, type: "pylon" },
      ],
      anchors: [
        { x: 420, y: 765 },
        { x: 730, y: 510 },
        { x: 1300, y: 382 },
        { x: 1680, y: 700 },
        { x: 1900, y: 373 },
        { x: 2390, y: 126 },
        { x: 2650, y: 785 },
        { x: 3010, y: 450 },
        { x: 3440, y: 780 },
      ],
      crystalReeds: Array.from({ length: 22 }, (_, i) => ({
        x: 240 + i * 167,
        y: 1080,
        h: 180 + ((i * 53) % 170),
        cut: false,
        angle: 0,
        fall: 0,
      })),
      doors: [
        { x: 1740, y: 627, w: 90, h: 183, torn: false },
        { x: 2270, y: 627, w: 100, h: 183, torn: false },
        { x: 2900, y: 735, w: 80, h: 170, torn: false },
      ],
      particles: [],
      decals: [],
      rings: [],
      slashes: [],
      projectiles: [],
      lightning: [],
      effects: {
        hitstop: 0,
        shake: 0,
        flash: 0,
        chromatic: 0,
        parry: 0, parryMax: 18, parryX: 0, parryY: 0,
        execution: 0, revival:0,revivalPlayer:null,
        bladeCounter: 0,
        caption: "",
        captionLife: 0,
      },
      camera: { x: 1980, y: 700, zoom: 0.86 },
      winner: null,
      round: 1,
      stormTimer: 360,
    };
  }
  /**
   * Fixed-frame combat controller. Renderer/audio/AI/transport are independent
   * adapters; neither rendering FPS nor network arrival rate sets move timing.
   *
   * Neutral: IDLE/MOVE/GUARD. Actions: STARTUP -> ACTIVE -> RECOVERY.
   * Timed reactions lock input; only completed locks or explicit hit reactions transition.
   * Vitals own HP/posture/nodes: zero HP exposes execution, never automatic death.
   * Hitstop freezes these clocks, while edge buffering keeps intentional inputs.
   * Each defender owns collision results. Remote intent clocks time-warp startup;
   * 20 Hz pose packets never overwrite the locally controlled actor.
   */
  class Game {
    constructor() {
      this.world = makeWorld();
      this.renderer = new RiftRenderer($("arena"));
      this.audio = new RiftAudio();
      this.ai = new RiftAI();
      this.keys = new Set();
      this.mouseButtons = new Set();
      this.mousePressed = new Set();
      this.touchHeld = new Map();
      this.touchPressed = new Map();
      this.touchTargets = new Map();
      this.mouseFaceTick = -1;
      this.mouseArtPending = null;
      this.mouseArtGesture = false;
      this.activeToolSlot = 0;
      this.toolKeySlot = 0;
      this.toolMouseSlot = 0;
      this.nextToolWheel = 0;
      this.net = null; this.authority=null;
      this.mode = "ai";
      this.paused = false;
      this.silent = false;
      this.buffered = [0, 0];
      this.rawPrev = [0, 0];
      this.inputSeq = 0;
      this.isHost = false;
      this.acc = 0;
      this.lastTime = performance.now();
      this.localId = 0;
      this.scores = [0, 0];
      this.stats = { hits: 0, deflects: 0, bladeCounter: 0, stomps: 0, reversals: 0 };
      this.loadout = ["disc", "flame"];
      this.art = "cleave";
      this.lastHud = 0;
      this.weather = "dusk";
      this.lowHealthWarned = false;
      this.running = true;
      this.bind();
      this.renderHUD();
      requestAnimationFrame((t) => this.frame(t));
      this.debug = {
        pause: (v) => {
          this.paused = v;
        },
        start: (mode = "local") => this.start(mode),
        step: (a = 0, b = 0, n = 1) => {
          for (let i = 0; i < n; i++) this.step([a, b]);
          this.renderHUD();
          return this.world;
        },
        move: (id, name) => this.begin(this.world.players[id], name),
        hit: (a, b, name, opts = {}) =>
          this.hit(
            this.world.players[a],
            this.world.players[b],
            MOVES[name],
            opts,
          ),
        setPlayers: (a, b) => {
          Object.assign(this.world.players[0], a);
          Object.assign(this.world.players[1], b);
        },
        bits: B,
        moves: MOVES,
        states: STATES,
        snapshot: () => this.snapshot(),
        reset: () => this.start("local"),
        version: "4.0.2", fsm:RiftFSM,vitals:RiftVitals,
      };
    }
    canReceiveInput() {
      return this.world.phase === "fighting" && !this.paused &&
        $("guide").hidden && $("pause-panel").hidden && $("result").hidden;
    }
    clearMouse() {
      this.mouseButtons.clear();
      this.mousePressed.clear();
      this.mouseFaceTick = -1;
      this.mouseArtPending = null;
      this.mouseArtGesture = false;
    }
    clearInputs() {
      this.keys.clear();
      this.clearMouse();
      this.touchHeld.clear();
      this.touchPressed.clear();
      for (const element of this.touchTargets.values()) element.classList.remove('is-held');
      this.touchTargets.clear();
      this.buffered = [0, 0];
      this.rawPrev = [0, 0];
    }
    syncAudioState() {
      const fighting=this.world.phase==='fighting';
      this.audio.setScene?.(fighting?'battle':'ambient');
      this.audio.setSuspended?.(document.hidden || (fighting && this.paused));
    }
    audioNeedsActivation() {
      const status = this.audio.getMusicStatus?.();
      return !status?.unlocked || ['NotAllowedError', 'playback-blocked'].includes(status.tracks?.[status.scene]?.error);
    }
    refreshSoundButton() {
      const button = $("sound-button");
      const needsActivation = this.audioNeedsActivation();
      const label = this.muted ? '聲音 關' : needsActivation ? '開啟聲音' : '聲音 開';
      if (button.textContent !== label) button.textContent = label;
      button.setAttribute('aria-pressed', String(!this.muted && !needsActivation));
    }
    focusArena() { $("arena").focus({preventScroll:true}); }
    cycleTool() {
      if (!this.canReceiveInput()) return;
      this.activeToolSlot = 1 - this.activeToolSlot;
      this.renderHUD();
    }
    bindMouse() {
      const arena = $("arena");
      arena.tabIndex = 0;
      const inArena = e => this.canReceiveInput() && e.target === arena;
      // mousedown fires for each mouse button; pointerdown alone misses button chords.
      arena.addEventListener("mousedown", e => {
        if (!inArena(e) || ![0,1,2].includes(e.button)) return;
        e.preventDefault();
        this.focusArena();
        this.audio.start();
        const p = this.world.players[this.localId];
        if (e.button === 0 && this.mouseButtons.has(2)) {
          // Right-first art input never cancels a sword startup. Buffer only the
          // short deflect lock; hitstop does not consume the fixed-tick budget.
          this.mouseArtGesture = true;
          if (RiftFSM.canAct(p) || ["DEFLECT","GRAPPLING"].includes(p.state))
            this.mouseArtPending = {expires:this.world.tick + 18};
        }
        if(e.button === 1) this.toolMouseSlot=this.activeToolSlot;
        this.mouseButtons.add(e.button);
        this.mousePressed.add(e.button);
        if(e.button === 0 || e.button === 2) this.mouseFaceTick=this.world.tick+1;
      });
      addEventListener("mouseup", e => {
        this.mouseButtons.delete(e.button);
        if (e.button === 0) this.mouseArtGesture = false;
      });
      // A release outside the browser may not deliver mouseup. Re-entry can
      // clear a stale hold, but never starts an action outside the arena.
      addEventListener("mousemove", e => {
        for(const [button,mask] of [[0,1],[1,4],[2,2]]) {
          if(this.mouseButtons.has(button) && !(e.buttons & mask)) {
            this.mouseButtons.delete(button);
            if(button === 0) this.mouseArtGesture=false;
          }
        }
      });
      document.addEventListener("mouseleave", () => this.clearMouse());
      addEventListener("pointercancel", () => this.clearMouse());
      arena.addEventListener("contextmenu", e => { if(inArena(e)) e.preventDefault(); });
      arena.addEventListener("auxclick", e => { if(inArena(e) && e.button === 1) e.preventDefault(); });
      arena.addEventListener("wheel", e => {
        if (!inArena(e) || e.ctrlKey || !e.deltaY) return;
        e.preventDefault();
        const now = performance.now();
        if (now < this.nextToolWheel) return;
        this.nextToolWheel = now + 140;
        this.cycleTool();
      }, {passive:false});
    }
    mouseInput() {
      if (!this.canReceiveInput()) return 0;
      const held = new Set([...this.mouseButtons,...this.mousePressed]);
      this.mousePressed.clear();
      let bits = 0;
      // Left-first remains an attack; release it before guarding. Right-first
      // plus a left click is the documented art gesture, with no stray slash.
      if (held.has(0) && !this.mouseArtGesture && !this.mouseArtPending) bits |= B.ATTACK;
      if (held.has(2) && (!held.has(0) || this.mouseArtGesture || this.mouseArtPending)) bits |= B.GUARD;
      if (held.has(1)) bits |= this.toolMouseSlot ? B.TOOL2 : B.TOOL1;
      return bits;
    }
    touchInput() {
      if (!this.canReceiveInput()) return 0;
      let bits = 0;
      for (const value of this.touchHeld.values()) bits |= value;
      for (const value of this.touchPressed.values()) bits |= value;
      // Consume at the fixed simulation tick, never at render or pointerup.
      // The combat input buffer then preserves action edges through hitstop.
      this.touchPressed.clear();
      return bits;
    }
    bind() {
      this.bindMouse();
      // Keep long presses and drags in the battlefield from becoming native
      // selection/callout gestures. Menus, forms and scrollable lessons keep
      // their normal browser behavior. Never stop touchend propagation: it is
      // also the trusted Safari audio-unlock gesture.
      const combatSurface = e => {
        const target = e.target?.nodeType === 3 ? e.target.parentElement : e.target;
        return this.canReceiveInput() && !target?.closest?.('input,textarea,select,[contenteditable="true"]') &&
          target?.closest?.('#arena,#touch-controls,#hud,#combat-footer');
      };
      const preventSurfaceDefault = e => {
        if (e.cancelable && combatSurface(e)) e.preventDefault();
      };
      for (const name of ['selectstart','contextmenu','dragstart']) {
        document.addEventListener(name, preventSurfaceDefault);
      }
      for (const name of ['touchstart','touchmove']) {
        $("arena").addEventListener(name, preventSurfaceDefault, {passive:false});
        $("touch-controls").addEventListener(name, e => {
          // Leave native clicks enabled for the separate Pause button.
          if (e.target.closest?.('[data-touch]')) preventSurfaceDefault(e);
        }, {passive:false});
      }
      const controls = new Set([
        "KeyC", "KeyV", "KeyZ", "KeyX", "KeyG", "ControlLeft", "ShiftRight", "Backslash", "Minus", "KeyA",
        "KeyD",
        "KeyS",
        "KeyW",
        "KeyJ",
        "KeyK",
        "KeyL",
        "KeyU",
        "KeyI",
        "KeyO",
        "KeyE",
        "KeyQ",
        "KeyR",
        "KeyF",
        "Space",
        "ShiftLeft",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Numpad1",
        "Numpad2",
        "Numpad3",
        "Numpad4",
        "Numpad5",
        "Numpad6",
        "Numpad7",
        "Numpad8",
        "Numpad9",
        "Numpad0",
        "Slash",
        "Period",
        "Comma",
        "KeyN",
        "KeyM",
        "Semicolon",
        "Quote",
        "BracketLeft",
        "BracketRight",
      ]);
      addEventListener("keydown", (e) => {
        if (e.target.closest?.("input,textarea,select,[contenteditable='true']")) return;
        if (!e.repeat && e.code === "Escape") { if(!$("guide").hidden)this.toggleGuide(false);else this.togglePause(); return; }
        if (!e.repeat && e.code === "KeyH") { this.toggleGuide(); return; }
        if (!e.repeat && e.code === "KeyT") { this.toggleWeather(); return; }
        if (e.target.closest?.("button,a") || !this.canReceiveInput() || !controls.has(e.code)) return;
        e.preventDefault();
        this.audio.start();
        if (e.code === "KeyQ") { if(!e.repeat) this.cycleTool(); return; }
        if(e.code === "KeyE" && !e.repeat) this.toolKeySlot=this.activeToolSlot;
        this.keys.add(e.code);
      });
      addEventListener("keyup", (e) => this.keys.delete(e.code));
      addEventListener("blur", () => {
        this.clearInputs();
        if (this.world.phase === "fighting" && this.mode !== "online") {
          this.paused = true;
          this.showPause();
        }
      });
      document.addEventListener("visibilitychange", () => {
        this.clearInputs();
        this.acc = 0;
        this.syncAudioState();
        if (!document.hidden && this.audio.context) this.audio.start();
      });
      addEventListener('pageshow', () => {
        this.syncAudioState();
        if (!document.hidden && this.audio.context) this.audio.start();
      });
      // A touch pointerdown may not authorize Safari audio; touchend still fires
      // when the touch controls suppress the compatibility click. Keep all calls
      // synchronous in these trusted events so resume/play retain activation.
      const unlockAudio = e => {
        if (!e.isTrusted || e.target.closest?.('#sound-button')) return;
        if (e.type === 'pointerdown' && e.pointerType !== 'mouse') return;
        this.syncAudioState(); this.audio.start();
      };
      for (const name of ['pointerdown','pointerup','touchend','click','keydown']) {
        document.addEventListener(name,unlockAudio,{passive:true});
      }
      $("start-ai").onclick = () => this.start("ai");
      $("start-local").onclick = () => this.start("local");
      $("online-tab").onclick = () => {
        $("network-panel").hidden = !$("network-panel").hidden;
      };
      $("host-room").onclick = () => this.host();
      $("join-room").onclick = () => this.join();
      $("copy-room").onclick = () => this.copyRoom();
      $("network-start").onclick = () => this.startOnline();
      $("cancel-network").onclick = () => this.disconnect();
      $("retry").onclick = () => {
        if (this.mode === "online") {
          if (this.isHost && this.net?.connected) this.startOnline();
          else this.toast("由房主發起下一場對決");
        } else this.start(this.mode);
      };
      $("result-lobby").onclick = () => this.lobby();
      $("pause-lobby").onclick = () => this.lobby();
      $("resume").onclick = () => {
        this.paused = false;
        $("pause-panel").hidden = true;
        this.audio.start();
        this.clearInputs();
        this.syncAudioState();
        this.focusArena();
      };
      $("help-open").onclick = () => this.toggleGuide();
      $("help-close").onclick = () => this.toggleGuide(false);
      if ($("touch-pause")) $("touch-pause").onclick = () => this.togglePause();
      $("sound-button").onclick = () => {
        // The initial "enable" tap must not toggle the still-locked game off.
        this.muted = this.audioNeedsActivation() ? false : !this.muted;
        this.audio.setMuted(this.muted);
        this.syncAudioState();
        this.audio.start();
        this.refreshSoundButton();
      };
      $("weather-button").onclick = () => this.toggleWeather();
      $("volume").oninput = (e) =>
        this.audio.setVolume(Number(e.target.value) / 100);
      $("music-volume").oninput = (e) =>
        this.audio.setMusicVolume?.(Number(e.target.value) / 100);
      document.querySelectorAll("[data-tool]").forEach(
        (el) =>
          (el.onclick = () => {
            const name = el.dataset.tool;
            if (this.loadout.includes(name)) {
              this.toast("選擇未裝備的裝備來替換最早選取的一款");
              return;
            }
            this.loadout.shift();
            this.loadout.push(name);
            this.updateLoadout();
          }),
      );
      document.querySelectorAll("[data-art]").forEach(
        (el) =>
          (el.onclick = () => {
            this.art = el.dataset.art;
            this.updateLoadout();
          }),
      );
      document.querySelectorAll("[data-weather]").forEach(
        (el) =>
          (el.onclick = () => {
            this.weather = el.dataset.weather;
            this.world.weather = this.weather;
            this.updateLoadout();
          }),
      );
      document.querySelectorAll("[data-touch]").forEach((el) => {
        const code = el.dataset.touch;
        const touchBits = {KeyA:B.LEFT,KeyD:B.RIGHT,Space:B.JUMP,KeyF:B.GRAPPLE,
          KeyR:B.HEAL,KeyO:B.ART,KeyL:B.DASH,KeyK:B.GUARD,KeyJ:B.ATTACK};
        el.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          if(!this.canReceiveInput()) return;
          window.getSelection?.()?.removeAllRanges();
          el.setPointerCapture(e.pointerId);
          this.touchTargets.set(e.pointerId, el);
          el.classList.add('is-held');
          if(e.pointerType !== 'mouse' && this.tutorial?.active)this.tutorial.setCollapsed(true);
          if(code === "KeyQ") this.cycleTool();
          else {
            const bits = code === "KeyE" ? (this.activeToolSlot ? B.TOOL2 : B.TOOL1) : touchBits[code];
            if (bits) {
              this.touchHeld.set(e.pointerId,bits);
              this.touchPressed.set(e.pointerId,bits);
            }
          }
          this.audio.start();
        });
        const releaseVisual = e => {
          this.touchTargets.delete(e.pointerId);
          el.classList.toggle('is-held', [...this.touchTargets.values()].includes(el));
        };
        el.addEventListener("pointerup", e => {
          this.touchHeld.delete(e.pointerId);
          releaseVisual(e);
        });
        const cancel = e => {
          this.touchHeld.delete(e.pointerId);
          this.touchPressed.delete(e.pointerId);
          releaseVisual(e);
        };
        el.addEventListener("pointercancel", cancel);
        // Normal pointerup releases capture too; retain its pending tap. An
        // unexpected capture loss cancels only that still-active finger.
        el.addEventListener("lostpointercapture", e => {
          if (this.touchTargets.has(e.pointerId)) cancel(e);
        });
      });
      this.updateLoadout();
      const room = new URL(location.href).searchParams.get("room");
      if (room) {
        $("room-code").value = room;
        $("network-panel").hidden = false;
        this.toast("邀請已就緒，點擊「加入對決」");
      }
    }
    updateLoadout() {
      document.querySelectorAll("[data-tool]").forEach((el) => {
        const n = this.loadout.indexOf(el.dataset.tool);
        el.classList.toggle("selected", n >= 0);
        el.setAttribute("aria-pressed", n >= 0 ? "true" : "false");
        el.querySelector(".slot").textContent =
          n >= 0 ? (n === 0 ? "壹 · 已裝備" : "貳 · 已裝備") : "＋";
      });
      document.querySelectorAll("[data-art]").forEach((el) => {
        el.classList.toggle("selected", el.dataset.art === this.art);
        el.setAttribute("aria-pressed", String(el.dataset.art === this.art));
      });
      document
        .querySelectorAll("[data-weather]")
        .forEach((el) =>
          el.classList.toggle("selected", el.dataset.weather === this.weather),
        );
    }
    input(id) {
      if(!this.canReceiveInput()) return 0;
      const k = this.keys;
      const has = (...s) => s.some((c) => k.has(c));
      if (id === 0) {
        let bits =
          (has("KeyA") ? B.LEFT : 0) |
          (has("KeyD") ? B.RIGHT : 0) |
          (has("KeyS", "ControlLeft") ? B.DOWN : 0) |
          (has("Space", "KeyW") ? B.JUMP : 0) |
          (has("KeyJ") ? B.ATTACK : 0) |
          (has("KeyK") ? B.GUARD : 0) |
          (has("KeyL", "ShiftLeft", "ShiftRight") ? B.DASH : 0) |
          (has("KeyU") ? B.TOOL1 : 0) |
          (has("KeyI") ? B.TOOL2 : 0) |
          (has("KeyE") ? (this.toolKeySlot ? B.TOOL2 : B.TOOL1) : 0) |
          (has("KeyO") ? B.ART : 0) |
          (has("KeyZ") ? B.THRUST : 0) |
          (has("KeyX") ? B.SWEEP : 0) |
          (has("KeyF") ? B.GRAPPLE : 0) |
          (has("KeyG") ? B.LIGHTNING : 0) |
          (has("KeyR", "KeyC") ? B.HEAL : 0) |
          (has("KeyV") ? B.TRIPLE : 0) | this.mouseInput() | this.touchInput();
        if (this.mouseArtPending) {
          const p = this.world.players[this.localId];
          if(this.world.tick > this.mouseArtPending.expires) this.mouseArtPending=null;
          else if(this.world.effects.hitstop <= 0 && (RiftFSM.canAct(p) || p.state === "GRAPPLING")) {
            this.buffered[this.localId] &= ~(B.ATTACK | B.GUARD);
            bits = (bits & ~(B.ATTACK | B.GUARD)) | B.ART;
            this.mouseArtPending=null;
          }
        }
        return bits;
      }
      return (
        (has("ArrowLeft") ? B.LEFT : 0) |
        (has("ArrowRight") ? B.RIGHT : 0) |
        (has("ArrowDown") ? B.DOWN : 0) |
        (has("ArrowUp") ? B.JUMP : 0) |
        (has("Numpad1", "Comma") ? B.ATTACK : 0) |
        (has("Numpad2", "Period") ? B.GUARD : 0) |
        (has("Numpad3", "Slash") ? B.DASH : 0) |
        (has("Numpad4", "KeyN") ? B.TOOL1 : 0) |
        (has("Numpad5", "KeyM") ? B.TOOL2 : 0) |
        (has("Numpad6", "Semicolon") ? B.ART : 0) |
        (has("Numpad7", "BracketLeft") ? B.THRUST : 0) |
        (has("Numpad8", "BracketRight") ? B.SWEEP : 0) |
        (has("Numpad0", "Quote") ? B.GRAPPLE : 0) |
        (has("Numpad9") ? B.LIGHTNING : 0) | (has("Backslash")?B.HEAL:0) | (has("Minus")?B.TRIPLE:0)
      );
    }
    start(mode, config = null) {
      if(mode!=='tutorial')this.tutorial?.stop();
      if (mode !== "online" && this.net) this.disconnect();
      this.audio.start();
      this.mode = mode;
      this.localId = mode === "online" && !this.isHost ? 1 : 0;
      const camera = this.world.camera;
      this.world = makeWorld(
        config?.loadouts?.[0] || this.loadout,
        config?.arts?.[0] || this.art,
      );
      this.world.mode = mode;
      this.world.phase = "fighting";
      this.world.weather = config?.weather || this.weather;
      this.world.camera = camera;
      this.world.round = this.scores[0] + this.scores[1] + 1;
      if (mode === "local") {
        this.world.players[1].loadout = [...this.loadout];
        this.world.players[1].art = this.art;
      }
      if (config?.loadouts) this.world.players[1].loadout = config.loadouts[1];
      if (config?.arts) this.world.players[1].art = config.arts[1];
      this.world.players[1].name =
        mode === "ai" ? "赤衡" : mode === "tutorial" ? "陪練・衡影" : mode === "local" ? "赤衡" : "同行者";
      this.world.players[0].name = "渡影";
      this.activeToolSlot = 0;
      this.toolKeySlot = 0;
      this.toolMouseSlot = 0;
      this.world.players[1].aiControlled=mode === "ai";
      if(config?.round)this.world.round=config.round;
      this.authority=mode === "online"?new RiftAuthority(this,this.net):null;
      this.deathRequests=new Set();this.deathSerial=0;this.remoteStorm=false;
      this.clearInputs();
      this.paused = false;
      this.ai.reset();
      this.acc = 0;
      this.buffered = [0, 0];
      this.rawPrev = [0, 0];
      $("pause-title").textContent = "刀歸鞘，心未息。";
      $("resume").disabled = false;
      this.stats = { hits: 0, deflects: 0, bladeCounter: 0, stomps: 0, reversals: 0 };
      this.lowHealthWarned = false;
      $("guide").hidden = true;
      $("lobby").hidden = true;
      $("result").hidden = true;
      $("pause-panel").hidden = true;
      $("hud").hidden = false;
      $("combat-footer").hidden = false;
      $("touch-controls").classList.add("playing");
      document.body.classList.add('combat-active');
      this.caption("共鳴接續・試刃開始", 130);
      this.renderHUD();
      this.focusArena();
      this.syncAudioState();
    }
    lobby() {
      this.tutorial?.stop();
      if (this.net) this.disconnect();
      this.world.phase = "menu";
      this.paused = false;
      this.clearInputs();
      $("lobby").hidden = false;
      $("result").hidden = true;
      $("pause-panel").hidden = true;
      $("hud").hidden = true;
      $("combat-footer").hidden = true;
      $("touch-controls").classList.remove("playing");
      document.body.classList.remove('combat-active');
      this.world.players.forEach((p) => {
        p.hp = 100;
        p.dead = false;
        p.state = "IDLE";
        p.move = null;
      });
      this.syncAudioState();
    }
    togglePause() {
      if (this.world.phase !== "fighting") return;
      if (this.mode === "online") {
        this.toast("連線對決持續進行；H 可開啟操作卷軸");
        return;
      }
      this.paused = !this.paused;
      this.clearInputs();
      this.showPause();
      if(!this.paused) this.focusArena();
    }
    showPause() {
      $("pause-panel").hidden = !this.paused;
      this.syncAudioState();
    }
    toggleGuide(force) {
      const open = typeof force === "boolean" ? force : $("guide").hidden;
      $("guide").hidden = !open;
      this.clearInputs();
      if (this.world.phase === "fighting" && this.mode !== "online") {
        this.paused = open;
        this.clearInputs();
      }
      if (!open) { $("pause-panel").hidden = true; if(this.world.phase === "fighting") this.focusArena(); }
      this.syncAudioState();
    }
    toggleWeather() {
      if (this.mode === "online" && this.world.phase === "fighting") {
        if (!this.isHost) {
          this.toast("天候由房主控制");
          return;
        }
        this.net.sendEvent({
          type: "weather",
          value: this.world.weather === "dusk" ? "storm" : "dusk",
        });
      }
      this.weather = this.world.weather =
        this.world.weather === "dusk" ? "storm" : "dusk";
      this.world.stormTimer = 180;
      this.updateLoadout();
      this.toast(
        this.weather === "storm"
          ? "暴雨雷夜 · 躍起接雷，揮刀返雷"
          : "薄暮鹽風 · 刀鳴穿過斷鑄場",
      );
    }
    toast(t) {
      $("toast").textContent = t;
      $("toast").classList.add("show");
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(
        () => $("toast").classList.remove("show"),
        3600,
      );
    }
    caption(t, n = 80) {
      if (this.silent) return;
      this.world.effects.caption = t;
      this.world.effects.captionLife = n;
    }
    fx(name, x, y, strength = 1) {
      if (this.silent) return;
      this.audio.sfx(name, (x - this.world.camera.x) / 650, strength);
    }
    sparks(x, y, color = "#ffc879", n = 20, force = 1, type = "spark") {
      if (this.silent) return;
      const a = this.world.particles;
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2,
          s = (3 + Math.random() * 9) * force;
        a.push({
          x,
          y,
          vx: Math.cos(ang) * s,
          vy: Math.sin(ang) * s - 2,
          life: 22 + Math.random() * 28,
          maxLife: 50,
          color,
          size: 1 + Math.random() * 3,
          type,
        });
      }
      if (a.length > 550) a.splice(0, a.length - 550);
    }
    ring(x, y, color = "#e8be7b", r = 5) {
      if (this.silent) return;
      this.world.rings.push({ x, y, r, life: 24, maxLife: 24, color });
    }
    impact(frames = 6, shake = 5) {
      if (this.silent) return;
      const e = this.world.effects;
      e.hitstop = Math.max(e.hitstop, frames);
      e.shake = Math.max(e.shake, shake);
      e.chromatic = Math.max(e.chromatic, shake * 0.8);
      e.flash = 0.1;
    }
    parryImpact(x,y) {
      if(this.silent)return;
      // Shared by the local defender and the attacker's confirmed network result.
      this.impact(8,12);
      Object.assign(this.world.effects,{parry:18,parryMax:18,parryX:x,parryY:y,flash:.18});
      this.sparks(x,y,'#ffcc71',44,1.65);
      this.sparks(x,y,'#e5fff6',18,1.2);
      this.ring(x,y,'#ffdc91');this.ring(x,y,'#8de7dc',20);
      this.fx('deflect',x,y);
    }
    owns(p) {return this.mode !== 'online' || p.id === this.localId;}
    transition(p,state,options={}) {return RiftFSM.enter(p,state,options);}
    begin(p,key,free=false,remote=false) {
      const m=MOVES[key],cancel=p.state==='RECOVERY'&&p.confirm>0;
      if(!m || (!remote&&['lightning','triple'].includes(key)&&p.phase<2))return false;
      if(!remote&&!(RiftFSM.canAct(p)||p.state==='GRAPPLING'||cancel))return false;
      if(!free&&(m.cost||0)>p.spirit){if(p.id===this.localId)this.toast('共鳴不足');return false;}
      if(!this.transition(p,'STARTUP',{complete:cancel||remote||p.state==='GRAPPLING'}))return false;
      if(!free)p.spirit-=m.cost||0;
      Object.assign(p,{move:{...m},moveName:key,charge:0,hits:[],wave:0,guard:false,aegis:false,grapple:null,confirm:0,attackReleased:key!=='light'||!(p.prevBits&B.ATTACK),holdCharged:false});
      p.moveSeq++;p.attackId=`${this.world.round}:${p.id}:${p.moveSeq}`;
      if(key==='hammer'&&p.ground){p.vy=-10;p.ground=false;}
      if(key==='flame')p.fireReady=180;
      if(key==='light'&&p.fireReady>0){p.fireBlade=600;p.fireReady=0;this.caption('熱流附刃');}
      if(['thrust','sweep','lightning'].includes(m.kind))this.fx('danger',p.x,p.y);
      if(this.authority&&!remote)this.authority.beginAttack(p,key,{held:!p.attackReleased});
      return true;
    }
    idle(p){return this.transition(p,'IDLE',{complete:true});}
    spend(p,n){if(p.spirit<n){if(p.id===this.localId)this.toast('共鳴不足');return false;}p.spirit-=n;return true;}
    tool(p,key){
      if(!RiftFSM.canAct(p)&&p.state!=='GRAPPLING')return;
      if(key==='aegis'){
        if(!this.spend(p,2))return;if(p.state==='GRAPPLING')this.idle(p);
        this.transition(p,'GUARD');Object.assign(p,{aegis:true,aegisAge:0,guard:true,guardAge:0,deflect:12});
        this.fx('guard',p.x,p.y);this.ring(p.x,p.y-45);return;
      }
      if(key==='blink'){
        if(!this.spend(p,3))return;p.blinkWindow=12;
        this.sparks(p.x,p.y-38,'#6c687c',25,.7,'smoke');this.fx('blink',p.x,p.y);return;
      }
      this.begin(p,key);
    }
    tickPlayer(p,bits,enemy){
      const w=this.world,pressed=bits&~p.prevBits,released=p.prevBits&~bits;
      p.prevBits=bits;p.peace++;
      const mouseFacing = p.id === this.localId && (this.mouseFaceTick >= w.tick || this.mouseButtons.has(0) || this.mouseButtons.has(2) || !!(bits&B.ART) && this.mouseArtGesture);
      if(mouseFacing && RiftFSM.canAct(p)) p.facing = enemy.x >= p.x ? 1 : -1;
      for(const key of ['deflect','dash','invuln','blinkWindow','confirm','chase','fireReady','fireBlade','drop'])if(p[key]>0)p[key]--;
      if(p.dead||p.state==='DEAD')return;
      if(p.burn>0){p.burn--;if(p.burn%45===0){RiftVitals.hurt(p,1.5,{posture:0,stun:0});this.sparks(p.x,p.y-35,'#d66c2e',6,.3);}}
      if(p.state==='DRINKING'){
        if(RiftVitals.tickDrink(p)){this.fx('tonic',p.x,p.y);this.ring(p.x,p.y-40,'#b7c997');}
        this.physics(p,0);return;
      }
      if(['STUNNED','HIT_STUN','RECOIL','BLADE_PINNED','REVIVING','EXECUTING'].includes(p.state)){
        // A hit gives a short impulse, not a constant slide throughout hit-stun.
        // This keeps ordinary confirmed follow-ups within their intended reach.
        if(p.state==='HIT_STUN')p.vx*=.75;
        p.st++;p.stun=Math.max(0,p.stun-1);p.lockFrames=Math.max(0,p.lockFrames-1);
        if(p.lockFrames<=0){
          if(p.state==='STUNNED'){
            if(RiftVitals.recoverDown(p))this.authority?.publishState(true);
            // Publish recovery before the next ATTACK_START, even inside the 50 ms
            // pose throttle, so the peer can safely leave its downed replica state.
          }else this.idle(p);
        }
        this.physics(p,0);return;
      }
      if(pressed&B.GUARD&&(RiftFSM.canAct(p)||p.state==='DEFLECT')){
        p.guardSpam=w.tick-p.lastGuard<=24?Math.min(4,p.guardSpam+1):0;p.lastGuard=w.tick;
        p.deflectWindow=RiftFSM.parryWindow(p.guardSpam);p.deflect=p.deflectWindow;p.guardAge=0;
        if(p.state!=='DEFLECT')this.transition(p,'DEFLECT',{frames:12});p.guard=true;
      }
      if(p.state==='DEFLECT'){
        if(p.lockFrames>0){p.st++;p.lockFrames--;p.vx=0;this.physics(p,0);return;}
        this.transition(p,bits&B.GUARD?'GUARD':'IDLE',{complete:true});
      }
      if(bits&B.GUARD&&RiftFSM.canAct(p)){
        this.transition(p,'GUARD');p.guard=true;p.guardAge++;
        if(p.loadout.includes('aegis')&&p.guardAge===24&&this.spend(p,2)){p.aegis=true;p.aegisAge=0;this.fx('guard',p.x,p.y);}
      }
      if(p.aegis){
        p.aegisAge++;p.guard=true;
        if(p.aegisAge>180||(released&B.GUARD&&p.guardAge>0))this.begin(p,'aegis',true);
        else if(p.aegisAge%60===0&&!this.spend(p,1))this.idle(p);
      }
      if(!(bits&B.GUARD)&&p.state==='GUARD'&&!p.aegis)this.idle(p);
      let free=RiftFSM.canAct(p)||p.state==='GRAPPLING';const canCancel=p.state==='RECOVERY'&&p.confirm>0;
      if(pressed&B.HEAL&&free&&RiftVitals.beginDrink(p)){
        RiftVitals.tickDrink(p);this.fx('tonic',p.x,p.y,.4);this.authority?.sendControl('HEAL_START',{playerId:p.id,tonics:p.tonics,timestamp:Date.now(),round:w.round});return;
      }
      // Punishment is an explicit chord chosen by the player or delayed AI observation.
      if(pressed&B.THRUST&&bits&B.DASH&&free){this.begin(p,'punish');free=false;}
      if(pressed&B.DASH&&(free||canCancel)){
        if(canCancel||p.state==='GRAPPLING')this.idle(p);p.dash=13;p.dashDir=bits&B.RIGHT?1:bits&B.LEFT?-1:p.facing;
        p.vx=p.dashDir*16;p.invuln=7;p.guard=false;p.aegis=false;this.fx('slash',p.x,p.y,.25);
      }
      if(pressed&B.JUMP&&(free||canCancel)){
        if(p.ground){if(bits&B.DOWN){p.drop=18;p.y+=5;p.ground=false;}else{p.vy=-15.3;p.ground=false;p.stomp=0;this.fx('jump',p.x,p.y);}}
        else if(Math.abs(p.x-enemy.x)<115&&p.y<enemy.y-25&&p.y>enemy.y-215&&!p.stomp&&enemy.move?.kind==='sweep'&&['STARTUP','ACTIVE'].includes(enemy.state)){
          p.stomp=1;p.vy=-13;p.y=enemy.y-90;this.counter(enemy,p,enemy.move,'STOMP',30,35,`${enemy.attackId}:stomp`);
          this.impact(8,9);this.ring(enemy.x,enemy.y-68);this.fx('bladeCounter',enemy.x,enemy.y);this.caption('蹬踏');this.stats.stomps++;
        }else if(p.grapple){this.idle(p);p.vy=-13;}
      }
      if(pressed&B.GRAPPLE&&(free||canCancel)){if(canCancel)this.idle(p);this.grapple(p);}
      if(pressed&B.ATTACK&&free&&RiftVitals.vulnerable(enemy)&&Math.abs(p.x-enemy.x)<135&&Math.abs(p.y-enemy.y)<115){this.execute(p,enemy);return;}
      if(pressed&B.ATTACK&&p.charged>0&&!p.ground&&(free||canCancel)){
        p.charged=0;this.begin(p,'reversal',true);this.caption('返雷',90);this.stats.reversals++;
      }else if(pressed&B.ATTACK&&(free||canCancel))this.begin(p,p.aegis?'aegis':p.chase>0?'chase':canCancel?'combo':!p.ground?'air':'light');
      else if(free){
        if(pressed&B.THRUST)this.begin(p,'thrust');else if(pressed&B.SWEEP)this.begin(p,'sweep');
        else if(pressed&B.LIGHTNING)this.begin(p,'lightning');else if(pressed&B.TRIPLE)this.begin(p,'triple');
        else if(pressed&B.ART)this.begin(p,p.art);else if(pressed&B.TOOL1)this.tool(p,p.loadout[0]);else if(pressed&B.TOOL2)this.tool(p,p.loadout[1]);
      }
      if(p.state==='STARTUP'&&p.move&&!(bits&B.ATTACK)&&!p.attackReleased){p.attackReleased=true;p.holdCharged=false;this.authority?.releaseAttack(p);}
      this.advanceAttack(p);
      if(p.state==='GRAPPLING'&&p.grapple){
        const dx=p.grapple.x-p.x,dy=p.grapple.y-p.y,d=Math.hypot(dx,dy);
        if(d<25){this.idle(p);p.vy=-7;p.ground=false;}else{p.vx=dx/d*23;p.vy=dy/d*23;p.x+=p.vx;p.y+=p.vy;p.ground=false;return;}
      }
      const moving=RiftFSM.canAct(p);
      if(p.dash>0)p.vx=p.dashDir*16;
      else if(moving){const dir=(bits&B.RIGHT?1:0)-(bits&B.LEFT?1:0);p.vx=dir*(p.guard?2.3:bits&B.DOWN?2.6:5.4);if(dir && !mouseFacing)p.facing=dir;
        if(p.state==='IDLE'&&dir)this.transition(p,'MOVE');else if(p.state==='MOVE'&&!dir)this.idle(p);
      }else{p.vx*=.83;if(p.move?.lunge&&p.state==='ACTIVE')p.vx=p.facing*p.move.lunge;}
      if(moving&&Math.abs(enemy.x-p.x)<400&&!(bits&(B.LEFT|B.RIGHT)))p.facing=enemy.x>=p.x?1:-1;
      p.hidden=!!(bits&B.DOWN)&&p.ground&&p.y>=1060&&(moving||p.state==='STARTUP');
      RiftVitals.tickPosture(p,Math.abs(enemy.x-p.x));
      if(w.tick%180===0&&p.spirit<20)p.spirit=Math.min(20,p.spirit+1);this.physics(p,bits);
    }
    advanceAttack(p){
      if(p.state==='STARTUP'&&p.move){
        p.st++;p.charge=p.st;
        if(p.moveName==='light'&&p.st>=18&&!p.attackReleased){p.moveName='charged';p.move={...MOVES.charged};p.holdCharged=true;}
        if(p.st>=p.move.windup&&!p.holdCharged){this.transition(p,'ACTIVE',{complete:true});p.hits=[];this.activate(p);}
      }else if(p.state==='ACTIVE'&&p.move){
        p.st++;if(p.move.waves?.includes(p.st)){p.wave++;p.hits=[];this.activate(p);}if(p.st>=p.move.active)this.transition(p,'RECOVERY',{complete:true});
      }else if(p.state==='RECOVERY'){p.st++;if(p.st>=(p.move?.recovery||20))this.idle(p);}
    }
    physics(p, bits) {
      // Horizontal immobilization also protects replicas from stale dash velocity.
      // Gravity remains active so a fighter downed in the air lands naturally.
      if(p.state==='STUNNED'){p.vx=0;p.dash=0;p.dashDir=0;p.blinkWindow=0;p.grapple=null;}
      const prev = p.y;
      p.x = clamp(p.x + p.vx, 24, 3976);
      p.vy = Math.min(22, p.vy + 0.68);
      p.y += p.vy;
      p.ground = false;
      if (p.vy >= 0)
        for (const pl of this.world.platforms) {
          if (
            p.x > pl.x - 12 &&
            p.x < pl.x + pl.w + 12 &&
            prev <= pl.y + 2 &&
            p.y >= pl.y &&
            (!p.drop || pl.y === 1080)
          ) {
            p.y = pl.y;
            p.vy = 0;
            p.ground = true;
            p.stomp = 0;
            break;
          }
        }
      if (p.y > 1080) {
        p.y = 1080;
        p.vy = 0;
        p.ground = true;
      }
      p.y = Math.max(72, p.y);
      if(p.ground && p.charged>0 && this.owns(p)) {
        p.charged=0;RiftVitals.hurt(p,26,{posture:25,stun:75});
        this.sparks(p.x,p.y-40,"#b6ddff",42,1.2);this.fx("lightning",p.x,p.y);
        this.impact(10,13);this.caption("電荷失控・未及釋放");
      }
    }
    grapple(p) {
      const target = this.world.anchors
        .filter((a) => a.y < p.y - 45 && Math.hypot(a.x - p.x, a.y - p.y) < 850)
        .sort((a, b) => {
          const score = (v) =>
            Math.hypot(v.x - p.x, v.y - p.y) +
            (Math.sign(v.x - p.x) !== p.facing ? 230 : 0);
          return score(a) - score(b);
        })[0];
      if (!target) {
        if (p.id === this.localId) this.toast("附近沒有可用的高處錨點");
        return;
      }
      if(!this.transition(p,"GRAPPLING"))return;
      p.grapple = { ...target };
      p.st = 0;
      p.ground = false;
      p.guard = false;
      this.fx("grapple", p.x, p.y);
    }
    activate(p) {
      const w = this.world,
        m = p.move;
      if (m.kind === "projectile") {
        w.projectiles.push({
          x: p.x + p.facing * 30,
          y: p.y - 45,
          vx: p.facing * 18,
          vy: 0,
          owner: p.id,
          life: 100,
          id: `${p.id}-${p.moveSeq}`,attackId:p.attackId,
          reflected: 0,
        });
        p.chase = 95;
        this.fx("disc", p.x, p.y);
        return;
      }
      const color =
        m.kind === "rift"
          ? "#9f2845"
          : m.kind === "lightning" || m.kind === "reversal"
            ? "#c5e2ff"
            : p.fireBlade || m.kind === "flame"
              ? "#ff9a41"
              : p.id
                ? "#e6a9a0"
                : "#f4d9ad";
      if (!this.silent)
        w.slashes.push({
          x: p.x,
          y: p.y - 43,
          facing: p.facing,
          reach: m.reach,
          life: 14,
          maxLife: 14,
          color,
          kind: m.kind,
        });
      this.fx(
        m.kind === "hammer"
          ? "hammer"
          : m.kind === "flame"
            ? "flame"
            : m.kind === "lightning" || m.kind === "reversal"
              ? "lightning"
              : "slash",
        p.x,
        p.y,
        m.kind === "rift" ? 1.5 : 1,
      );
      if (m.kind === "flame")
        this.sparks(p.x + p.facing * 80, p.y - 40, "#f68838", 36, 0.8, "spark");
      for (const b of w.crystalReeds)
        if (
          !b.cut &&
          Math.abs(b.x - p.x) < m.reach &&
          Math.abs(b.y - p.y) < 220
        ) {
          b.cut = true;
          b.angle = p.facing * 0.06;
          b.fall = p.facing;
          this.sparks(b.x, p.y - 50, "#8a9d69", 13, 0.6, "leaf");
        }
      for (const d of w.doors)
        if (
          !d.torn &&
          Math.abs(d.x + d.w / 2 - p.x) < m.reach &&
          p.y > d.y &&
          p.y < d.y + d.h + 100
        ) {
          d.torn = true;
          this.sparks(d.x + d.w / 2, d.y + d.h / 2, "#e1ccb0", 18, 0.6, "leaf");
        }
      for (const v of w.particles)
        if (v.type === "leaf" && Math.abs(v.x - p.x) < m.reach) {
          v.vx += p.facing * 4;
          v.vy -= 3;
        }
    }
    addPosture(p,n){p.posture=clamp(p.posture+n,0,100);p.peace=0;if(p.posture>=100&&p.state!=='STUNNED')this.breakPosture(p);}
    breakPosture(p){
      if(!RiftVitals.down(p))return;
      this.fx('break',p.x,p.y);this.ring(p.x,p.y-40,'#e34237');this.sparks(p.x,p.y-45,'#ed7565',32);this.caption('架勢崩解・可斷決',90);
    }
    recoil(a,kind,amount,frames){
      a.wasParried=(a.wasParried||0)+1;a.lastCounterTick=this.world.tick;this.addPosture(a,amount);
      if(a.state!=='STUNNED'){this.transition(a,kind==='BLADE_PIN'?'BLADE_PINNED':'RECOIL',{interrupt:true,frames});a.stun=frames;}a.vx=0;
    }
    counter(a,t,m,kind,amount,frames,contactId,originalAttackId=null){
      if(!this.owns(t))return false;
      const attackId=originalAttackId||a.attackId||a.cancelledAttackId;
      // The defender publishes a result; recoil on this remote copy is visual prediction only.
      this.authority?.confirmDefense({...a,attackId},t,m,kind,{postureDamageToAttacker:amount,targetHP:t.hp,targetPosture:t.posture,attackerState:kind==='BLADE_PIN'?'BLADE_PINNED':'RECOIL',attackerStun:frames,contactId});
      this.recoil(a,kind,amount,frames);return true;
    }
    hit(a,t,m,opt={}){
      if(!this.owns(t)||t.dead||['EXECUTING','REVIVING','DEAD'].includes(t.state))return 'none';
      const attackId=opt.attackId||a.attackId||a.cancelledAttackId,contactId=opt.contactId||`${attackId}:${a.wave||0}`;
      const oldHP=t.hp,oldPosture=t.posture;
      const report=(outcome,extra={})=>this.authority?.confirmHit({...a,attackId},t,m,outcome,{damage:Math.max(0,oldHP-t.hp),postureDamage:Math.max(0,t.posture-oldPosture),targetHP:t.hp,targetPosture:t.posture,contactId,...extra});
      t.peace=0;a.peace=0;
      const x=(a.x+t.x)/2,y=t.y-44,front=(a.x-t.x)*t.facing>=-16;
      const perfect=opt.perfect??(t.guard&&t.deflect>0&&(front||t.aegis));
      if(t.blinkWindow>0&&t.state!=='STUNNED'){
        t.blinkWindow=0;this.sparks(t.x,t.y-40,'#3e354d',35,.9,'smoke');t.x=clamp(a.x-a.facing*75,30,3970);t.y=a.y-35;t.facing=a.facing;
        t.vy=-4;t.ground=false;t.invuln=12;this.begin(t,'blink',true);this.fx('blink',t.x,t.y);this.caption('折光位移');report('BLINK');return 'blink';
      }
      if(m.kind==='thrust'&&t.dash>0&&t.dashDir===Math.sign(a.x-t.x)){
        t.x=a.x+a.facing*58;t.vx=0;t.dash=0;this.counter(a,t,m,'BLADE_PIN',35,42,contactId,attackId);
        this.impact(8,13);this.world.effects.bladeCounter=32;this.ring(x,y,'#f4d9a5');this.fx('bladeCounter',x,y);this.caption('踏刃');this.stats.bladeCounter++;return 'bladeCounter';
      }
      if(m.kind==='sweep'&&!t.ground&&t.y<a.y-28){report('DODGED');return 'jump';}
      if(m.kind==='lightning'&&!t.ground){
        t.charged=180;t.vy=Math.min(t.vy,-3);this.ring(t.x,t.y-44,'#b5dbff');this.sparks(t.x,t.y-40,'#d0eaff',25);this.fx('lightning',x,y);
        if(t.id===this.localId)this.caption('接雷！落地前按攻擊返雷',105);report('CAUGHT_LIGHTNING');return 'catch';
      }
      const peril=['thrust','sweep','lightning','reversal'].includes(m.kind);
      if(t.invuln>0&&!peril){report('DODGED');return 'evade';}
      if(perfect&&!peril){
        t.parries++;t.lastCounterTick=this.world.tick;this.stats.deflects++;
        this.counter(a,t,m,'PARRIED',m.posture*1.55+7,m.kind==='hammer'?64:18,contactId,attackId);
        this.parryImpact(x,y);this.caption('完美招架',48);return 'deflect';
      }
      if((opt.guard??t.guard)&&(front||t.aegis)&&!peril){
        this.impact(6,4);this.sparks(x,y,'#e8c597',16,.75);this.fx('guard',x,y);if(!this.authority)a.confirm=22;
        this.addPosture(t,t.aegis?m.posture*.2:m.breakGuard?100:m.posture*1.35);
        if(m.chip)RiftVitals.hurt(t,m.damage*m.chip,{posture:0,stun:0});
        if(t.hp<=0)RiftVitals.down(t);report('BLOCKED');return 'guard';
      }
      RiftVitals.hurt(t,m.damage,{posture:m.posture,stun:m.kind==='reversal'?110:m.kind==='lightning'?75:m.kind==='hammer'?32:18});
      if(!this.authority)a.confirm=28;this.stats.hits++;
      const attackerPostureDelta=m.kind==='cleave'?-50:0;
      if(!this.authority&&attackerPostureDelta)a.posture=Math.max(0,a.posture+attackerPostureDelta);
      if(m.kind==='flame'||a.fireBlade>0)t.burn=240;
      t.vx=t.state==='STUNNED'?0:a.facing*(m.kind==='hammer'?10:6);
      this.impact(['hammer','rift','cleave','reversal'].includes(m.kind)?10:6,['hammer','rift','reversal'].includes(m.kind)?12:6);
      this.sparks(t.x,y,'#a53e35',25,1,'blood');this.fx('hit',x,y,m.damage/12);
      if(m.kind==='reversal')this.sparks(t.x,y,'#c1e4ff',50,1.4);report('HIT',{attackerPostureDelta});return 'hit';
    }
    collisions(){
      const w=this.world,[p0,p1]=w.players;
      const blade=p=>p.state==='ACTIVE'&&p.move&&['slash','cleave'].includes(p.move.kind);
      // Decide simultaneous blade contact before either posture break clears an attack.
      const clash=blade(p0)&&blade(p1)&&!p0.hits.includes(1)&&!p1.hits.includes(0)&&
        Math.abs(p0.y-p1.y)<100&&Math.abs(p0.x-p1.x)<Math.min(p0.move.reach,p1.move.reach)&&
        (p1.x-p0.x)*p0.facing>0&&(p0.x-p1.x)*p1.facing>0;
      const contacts=clash?w.players.map(t=>({a:w.players[1-t.id],t,m:{...w.players[1-t.id].move},attackId:w.players[1-t.id].attackId,wave:w.players[1-t.id].wave})):[];
      if(clash){
        for(const c of contacts){if(!this.owns(c.t))continue;c.a.hits.push(c.t.id);}
        for(const {a,t,m,attackId,wave} of contacts){
          if(!this.owns(t))continue;
          this.addPosture(t,8);if(t.state!=='STUNNED')t.confirm=25;
          this.authority?.confirmHit({...a,attackId},t,m,'BLOCKED',{damage:0,postureDamage:8,targetHP:t.hp,targetPosture:t.posture,contactId:`${attackId}:${wave||0}`});
        }
        this.impact(6,5);this.sparks((p0.x+p1.x)/2,p0.y-48,'#f2d7a5',24);this.fx('deflect',p0.x,p0.y,.7);
      }
      // Each machine runs collision adjudication only for the fighter it owns.
      if(!clash)for(const t of w.players){
        if(!this.owns(t))continue;
        const a=w.players[1-t.id],m=a.move;
        if(a.state!=='ACTIVE'||!m||m.kind==='projectile'||a.hits.includes(t.id))continue;
        const dx=(t.x-a.x)*a.facing,vertical=Math.abs(t.y-a.y)<(m.kind==='reversal'?700:m.kind==='hammer'?150:100);
        if(dx>=-32&&dx<m.reach&&vertical){a.hits.push(t.id);this.hit(a,t,m);}
      }
      for(const q of w.projectiles){
        q.x+=q.vx;q.life--;const t=w.players[1-q.owner],a=w.players[q.owner];
        if(this.owns(t)&&Math.abs(q.x-t.x)<27&&Math.abs(q.y-(t.y-43))<43){
          this.hit(a,t,{...MOVES.disc,kind:'projectile'},{attackId:q.attackId,contactId:`${q.attackId}:projectile`});q.life=0;
        }
        if(q.x<0||q.x>4000)q.life=0;
      }
      w.projectiles=w.projectiles.filter(q=>q.life>0);
    }
    execute(a,t){
      if(this.world.phase!=='fighting'||!RiftVitals.vulnerable(t)||Math.abs(a.x-t.x)>135||Math.abs(a.y-t.y)>115)return false;
      if(this.authority){
        if(a.id!==this.localId)return false;
        const requestId=`${this.world.round}:death:${a.id}:${++this.deathSerial}`;
        this.authority.sendControl('FINISHER_REQUEST',{requestId,sourceId:a.id,targetId:t.id,timestamp:Date.now(),x:a.x,y:a.y});return true;
      }
      const result=RiftVitals.takeNode(t);if(!result.taken)return false;this.finisherScene(a,t,result.dead);return true;
    }
    finisherScene(a,t,final){
      this.transition(a,'EXECUTING',{interrupt:true,frames:45});a.x=t.x-a.facing*60;
      this.world.effects.execution=final?150:45;this.impact(25,18);this.sparks(t.x,t.y-45,'#b8332e',75,2,'blood');
      this.fx('finisher',t.x,t.y,1.3);this.caption(final?'斷 決':'復 燃・第二階段',final?150:100);
      if(final){
        if(this.world.phase==='ended')return;this.world.phase='ended';this.world.winner=a.id;this.scores[a.id]++;
        this.clearInputs();clearTimeout(this.resultTimer);this.resultTimer=setTimeout(()=>this.showResult(),1600);
      }else{
        this.world.effects.revival=90;this.world.effects.revivalPlayer=t.id;
        a.x=clamp(t.x-a.facing*220,24,3976);a.vx=-a.facing*9;this.ring(t.x,t.y-40,'#efcdc0');this.fx('revive',t.x,t.y);
      }
    }
    showResult() {
      if (this.world.phase !== "ended") return;
      const p = this.world.players[this.world.winner ?? 0];
      $("winner-name").textContent = p.name + " 勝利";
      $("result-detail").textContent =
        `第 ${String(this.world.round).padStart(2, "0")} 場 · ${this.world.weather === "storm" ? "暴雨雷夜" : "薄暮晴嵐"} · ${this.mode === "ai" ? "精英試煉" : this.mode === "online" ? "連線對決" : "同屏切磋"}`;
      $("stat-deflect").textContent = this.stats.deflects;
      $("stat-counter").textContent = this.stats.bladeCounter + this.stats.stomps;
      $("stat-hits").textContent = this.stats.hits;
      $("result").hidden = false;
    }
    effects() {
      const w = this.world,
        e = w.effects;
      for (const key of ["execution", "revival", "bladeCounter", "parry", "captionLife"])
        if (e[key] > 0) e[key]--;
      e.shake *= 0.88;
      e.chromatic *= 0.84;
      e.flash *= 0.83;
      for (const p of w.particles) {
        p.life--;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.97;
        p.vy += p.type === "smoke" ? -0.02 : 0.25;
        if (p.y >= 1078 && p.vy > 0) {
          p.y = 1078;
          if (p.type === "blood") {
            if (w.decals.length < 90)
              w.decals.push({ x: p.x, y: 1080, r: p.size * 2 });
            p.life = 0;
          } else {
            p.vy *= -0.4;
            p.vx *= 0.65;
          }
        }
      }
      w.particles = w.particles.filter((p) => p.life > 0);
      for (const r of w.rings) {
        r.life--;
        r.r += 7;
      }
      w.rings = w.rings.filter((p) => p.life > 0);
      for (const s of w.slashes) s.life--;
      w.slashes = w.slashes.filter((p) => p.life > 0);
      for (const b of w.crystalReeds)
        if (b.cut && Math.abs(b.angle) < 1.55) b.angle += b.fall * 0.016;
      for (const l of w.lightning) l.life--;
      w.lightning = w.lightning.filter((l) => l.life > 0);
    }
    weatherTick() {
      const w = this.world;
      if (w.weather !== "storm") return;
      if(this.mode === "online" && !this.isHost && !this.remoteStorm)return;
      w.stormTimer--;
      if (w.stormTimer === 70 && (this.mode !== "online" || this.isHost)) {
        const p = w.players[Math.random() < 0.5 ? 0 : 1];
        w.lightning.push({ x: p.x, y: p.y, life: 90, warning: true });
        if(this.mode === "online")this.net.sendEvent({type:"storm",x:p.x,y:p.y,timestamp:Date.now()});
        this.caption("天雷將至・留意落雷標記", 70);
      }
      if (w.stormTimer <= 0) {
        const l = w.lightning.find((l) => l.warning);
        if (l) {
          l.warning = false;
          l.life = 22;
          this.fx("lightning", l.x, l.y, 1.4);
          this.impact(4, 8);
          for (const p of w.players)
            if (this.owns(p) && Math.abs(p.x - l.x) < 125) {
              if (!p.ground) {
                p.charged = 180;
                this.caption("接雷！落地前揮刀", 80);
              } else if (!p.aegis) {
                RiftVitals.hurt(p,12,{posture:18,stun:18});
              }
            }
        }
        w.stormTimer = 360 + Math.floor(Math.random() * 300);
        this.remoteStorm=false;
      }
    }
    step(inputs = [0, 0], opts = {}) {
      inputs=this.tutorial?.beforeStep(inputs)||inputs;
      const w = this.world;
      if (w.phase !== "fighting") {
        this.effects();
        return;
      }
      for (let i = 0; i < 2; i++) {
        this.buffered[i] |= inputs[i] & ~this.rawPrev[i] & ~7;
        this.rawPrev[i] = inputs[i];
      }
      if (w.effects.hitstop > 0) {
        w.effects.hitstop--;
        this.effects();
        return;
      }
      inputs = inputs.map((b, i) => {
        w.players[i].prevBits &= ~this.buffered[i];
        return b | this.buffered[i];
      });
      this.buffered = [0, 0];
      w.tick++;
      w.time = w.tick / TICK_RATE;
      this.effects();
      for(const p of w.players){
        if(this.owns(p))this.tickPlayer(p,inputs[p.id],w.players[1-p.id]);
        else this.tickRemote(p);
      }
      this.collisions();
      this.weatherTick();
      this.tutorial?.afterStep();
      const local=w.players[this.localId];
      if(local.hp>35)this.lowHealthWarned=false;
      if(!this.lowHealthWarned && local.hp<=25 && !local.dead && w.phase==='fighting'){
        this.lowHealthWarned=true;this.fx('lowHealth',local.x,local.y);
      }
    }
    frame(t) {
      const elapsed = Math.max(0,(t-this.lastTime)/1000);
      this.droppedFrames=(this.droppedFrames||0)+Math.max(0,Math.floor(elapsed*TICK_RATE)-MAX_STEPS);
      const dt = Math.min(MAX_STEPS*FIXED_DT, elapsed);
      this.lastTime = t;
      if (!this.paused) {
        this.acc += dt;
        let n = 0;
        // Epsilon prevents a rounding residue losing the final tick at 60 Hz.
        // The catch-up cap prevents a long background stall from fast-forwarding combat.
        while (this.acc + 1e-9 >= FIXED_DT && n++ < MAX_STEPS) {
          if (this.world.phase === "fighting") {
            if(this.mode === "online") {
              if(this.net?.connected) {
                const bits=[0,0];bits[this.localId]=this.input(0);
                this.step(bits);this.authority?.publishState();
              }
            } else {
              const bits=[this.input(0),this.mode === "ai" ? this.ai.input(this.world,this.world.players[1],this.world.players[0]) : this.input(1)];
              this.step(bits);
            }
          } else this.effects();
          this.acc = Math.max(0,this.acc-FIXED_DT);
        }
      } else this.acc = 0;
      this.renderer.render(this.world, this.acc * TICK_RATE);
      this.syncAudioState();
      if (t - this.lastHud > 65) {
        this.renderHUD();
        this.lastHud = t;
      }
      this.audio.update(
        Math.max(...this.world.players.map((p) => p.posture / 100)),
        this.world.weather,
        dt,
      );
      requestAnimationFrame((v) => this.frame(v));
    }
    renderHUD() {
      this.refreshSoundButton();
      const w = this.world;
      for (let i = 0; i < 2; i++) {
        const p = w.players[i];
        $("hp-" + i).style.width = p.hp + "%";
        $("posture-" + i).style.width = p.posture + "%";
        $("posture-" + i).classList.toggle("critical", p.posture > 75);
        $("name-" + i).textContent = p.name;
        $("hp-value-" + i).textContent = Math.ceil(p.hp);
        $("spirit-" + i).textContent = String(Math.floor(p.spirit)).padStart(
          2,
          "0",
        );
        $("state-" + i).textContent =
          p.state === "STUNNED" && p.posture >= 99
            ? "架勢崩解 — 可斷決"
            : p.charged
              ? "接雷中 — 空中揮刀"
              : p.state === "GUARD"
                ? "防禦"
                : p.hidden
                  ? "隱於晶簇"
                  : "備戰";
        if (p.move && p.state !== "STUNNED" && !p.charged)
          $("state-" + i).textContent = p.move.name;
        if (p.aegis) $("state-" + i).textContent = "輪盾・展開";
        if(RiftVitals.vulnerable(p))$("state-"+i).textContent="失衡 — 貼身斷決";
        if(p.state==='DRINKING')$("state-"+i).textContent="修復中・無防備";
        if(p.state==='REVIVING')$("state-"+i).textContent="復燃・第二階段";
        if($("nodes-"+i)){$("nodes-"+i).dataset.remaining=String(p.nodes);$("nodes-"+i).setAttribute('aria-label',`共鳴雙核 ${p.nodes}/2`);}
        if($("phase-"+i))$("phase-"+i).textContent=`PHASE ${p.phase}`;
        if($("tonic-"+i))$("tonic-"+i).textContent=String(p.tonics);
        $("buff-" + i).textContent = [
          p.burn ? "燃燒" : "",
          p.fireBlade ? "熱刃" : "",
          p.charged ? "蓄電" : "",
          p.blinkWindow ? "影匣" : "",
        ]
          .filter(Boolean)
          .join(" · ");
      }
      const seconds = Math.floor(w.time);
      $("timer").textContent =
        `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
      $("round-label").textContent =
        "第 " + String(w.round).padStart(2, "0") + " 場";
      $("mode-label").textContent =
        this.mode === "ai"
          ? "精英試煉"
          : this.mode === "tutorial" ? "陪練教學"
          : this.mode === "online"
            ? "跨界對決"
            : "同屏切磋";
      $("weather-label").textContent =
        w.weather === "storm" ? "雷雨 / TEMPEST" : "薄暮 / DUSK";
      $("ping").textContent =
        this.mode === "online"
          ? this.net?.connected
            ? `${Math.round(this.net.pingMs || 0)} ms`
            : "連線中"
          : "60 HZ";
      if($("net-health")){
        const m=this.net?.getMetrics?.();
        $("net-health").textContent=this.mode==='online'&&m?`序號缺口 ${m.sequenceGaps||0} · 延遲訊息 ${m.lateMessages||0} · 畫格略過 ${this.droppedFrames||0}`:'本機同步 · 60 Hz';
      }
      const p = w.players[this.localId];
      $("equipped-1").textContent = TOOL_NAMES[p.loadout[0]];
      if($("active-tool-name"))$("active-tool-name").textContent=TOOL_NAMES[p.loadout[this.activeToolSlot]];
      if($("active-tool-slot"))$("active-tool-slot").textContent=`${this.activeToolSlot+1} / 2`;
      for(let i=0;i<2;i++) {
        const slot=$("tool-slot-"+i);
        if(slot){slot.classList.toggle("is-active",i===this.activeToolSlot);slot.setAttribute("aria-current",String(i===this.activeToolSlot));}
      }
      $("equipped-2").textContent = TOOL_NAMES[p.loadout[1]];
      $("equipped-art").textContent =
        p.art === "rift" ? "裂斬" : "雙斷";
      $("combat-caption").textContent =
        w.effects.captionLife > 0 ? w.effects.caption : "";
    }
    snapshot() {
      const w = this.world;
      return {
        players: clone(w.players),
        weather: w.weather,
        stormTimer: w.stormTimer,
        phase: w.phase,
        winner: w.winner,
        time: w.time,
        projectiles: clone(w.projectiles),
        crystalReeds: w.crystalReeds.map((b) => (b.cut ? b.angle : 0)),
        doors: w.doors.map((d) => d.torn),
        lightning: clone(w.lightning),
        hostBits: w.players[0].prevBits,
        stats: { ...this.stats },
        round: w.round,
        hitstop: w.effects.hitstop,
      };
    }
    receiveAttack(packet,elapsedFrames=0){
      if(this.mode!=='online'||packet.playerId===this.localId)return;
      const p=this.world.players[packet.playerId];
      if(!p||p.dead||['REVIVING','STUNNED'].includes(p.state)||packet.timestamp<(p.lastPoseTimestamp||0))return;
      // This adapter owns only the remote visual replica; no local vitals are imported.
      Object.assign(p,{state:'IDLE',lockFrames:0,dead:false,x:packet.x,y:packet.y,facing:packet.facing,prevBits:packet.held?B.ATTACK:0});
      if(!this.begin(p,packet.attackType,true,true))return;
      p.attackId=packet.attackId;p.intentTimestamp=packet.timestamp;p.remoteStartTick=packet.startTick;p.remoteOriginalMove=packet.attackType;p.attackReleased=!packet.held;
      p.remoteAttackAge=0;
      for(let i=0;i<elapsedFrames;i++){this.advanceAttack(p);p.remoteAttackAge++;}
    }
    receiveAttackRelease(packet,elapsedFrames=0){
      const p=this.world.players[packet.playerId];
      if(!p||p.id===this.localId||p.attackId!==packet.attackId)return;
      p.attackReleased=true;p.holdCharged=false;
      // A delayed key-up may arrive after the replica guessed a charged charged.
      // The sender's release tick establishes whether its 18-frame charge threshold was reached.
      if(p.remoteOriginalMove==='light' && packet.startTick-p.remoteStartTick<18 && p.state==='STARTUP'){
        p.moveName='light';p.move={...MOVES.light};
      }
      if(p.state==='STARTUP'&&p.move&&p.st>=p.move.windup){
        this.transition(p,'ACTIVE',{complete:true});this.activate(p);
        // Display at least one active contact frame even for a delayed release.
        p.st=Math.min(Math.max(0,elapsedFrames),Math.max(0,p.move.active-2));
      }
    }
    receivePlayerState(packet){
      if(this.mode!=='online'||packet.playerId===this.localId)return;
      const p=this.world.players[packet.playerId],s=packet.state;
      if(!p||packet.timestamp<(p.lastPoseTimestamp||0))return;
      p.lastPoseTimestamp=packet.timestamp;
      const age=clamp((Date.now()+(this.net?.clockOffsetMs||0)-packet.timestamp)*60/1000,0,12);
      const downed=s.state==='STUNNED';
      const nx=clamp(s.x+(downed?0:(s.vx||0)*age),24,3976),ny=clamp(s.y+(s.ground?0:(s.vy||0)*age),72,1080);
      p.x=downed||Math.abs(p.x-nx)>170?nx:p.x+(nx-p.x)*.65;
      p.y=Math.abs(p.y-ny)>170?ny:p.y+(ny-p.y)*.65;
      const fields=['vx','vy','facing','ground','hp','posture','spirit','nodes','phase','tonics','charged','burn','fireBlade','guard','deflect','aegis','hidden','invuln','dash','dashDir','grapple','blinkWindow','dead'];
      for(const key of fields)if(s[key]!==undefined)p[key]=s[key];
      if(downed){p.vx=0;p.dash=0;p.dashDir=0;p.blinkWindow=0;p.grapple=null;p.guard=false;p.deflect=0;p.aegis=false;}
      // Attack clocks advance locally from ATTACK_START. State packets cannot replay hits or rewind startup.
      const action=['STARTUP','ACTIVE','RECOVERY'].includes(p.state)&&p.move;
      const interrupted=['HIT_STUN','STUNNED','RECOIL','BLADE_PINNED','DRINKING','REVIVING','EXECUTING','DEAD'].includes(s.state) && packet.timestamp >= (p.intentTimestamp||0);
      if((!action || interrupted) && !['STARTUP','ACTIVE','RECOVERY'].includes(s.state)){
        p.state=s.state;p.st=s.st||0;p.lockFrames=s.lockFrames||0;p.stun=s.stun||0;p.healPending=s.healPending||0;
        p.move=null;p.moveName='';p.attackId=null;
      }
    }
    tickRemote(p){
      this.advanceAttack(p);
      if(['STUNNED','RECOIL','BLADE_PINNED','HIT_STUN','DEFLECT','REVIVING','EXECUTING'].includes(p.state)){
        if(p.state==='HIT_STUN')p.vx*=.75;
        p.st++;p.lockFrames=Math.max(0,p.lockFrames-1);
        // A replica never heals itself; only its owner's next pose can end a down.
        if(!p.lockFrames&&!['REVIVING','STUNNED'].includes(p.state))this.idle(p);
      }
      if(p.state==='DRINKING')p.st=Math.min(54,p.st+1);
      if(p.state==='ACTIVE'&&p.move?.lunge)p.vx=p.facing*p.move.lunge;
      this.physics(p,0);
    }
    receiveCombatResult(packet){
      if(this.mode!=='online'||packet.sourceId!==this.localId||packet.targetId===this.localId)return;
      const a=this.world.players[this.localId],t=this.world.players[packet.targetId];
      // Receiver-owned results may update its displayed vitals, never this actor's HP.
      if(Number.isFinite(packet.targetHP))t.hp=packet.targetHP;
      if(Number.isFinite(packet.targetPosture))t.posture=packet.targetPosture;
      if(packet.type==='DEFENSE_SUCCESS'){
        this.recoil(a,packet.counterType,packet.postureDamageToAttacker,packet.attackerStun||18);
        if(packet.counterType==='PARRIED')this.parryImpact((a.x+t.x)/2,t.y-44);
        else {this.impact(8,13);this.fx('bladeCounter',a.x,a.y);this.sparks((a.x+t.x)/2,t.y-44,'#ffd897',34,1.2);this.ring(t.x,t.y-44);}
        if(packet.counterType==='BLADE_PIN')this.world.effects.bladeCounter=32;
      }else{
        if(['HIT','BLOCKED'].includes(packet.outcome))a.confirm=28;
        if(packet.attackerPostureDelta)a.posture=Math.max(0,a.posture+packet.attackerPostureDelta);
        if(packet.outcome==='HIT'){
          this.impact(6,6);this.sparks(t.x,t.y-44,'#a53e35',25,1,'blood');this.fx('hit',t.x,t.y);
        }else if(packet.outcome==='BLOCKED'){this.impact(6,4);this.fx('guard',t.x,t.y);}
        if(packet.cancelAttack&&a.state!=='STUNNED')this.transition(a,'RECOIL',{interrupt:true,frames:18});
      }
    }
    receiveHeal(packet){
      if(packet.playerId===this.localId)return;
      const p=this.world.players[packet.playerId];if(!p)return;
      const age=clamp(Math.floor((Date.now()+(this.net?.clockOffsetMs||0)-packet.timestamp)*60/1000),0,53);
      Object.assign(p,{state:'DRINKING',st:age,lockFrames:54-age,tonics:packet.tonics,healPending:40,move:null,moveName:'',attackId:null,vx:0,guard:false});
      this.fx('tonic',p.x,p.y,.4);
    }
    onRoundPacket(packet){
      if(packet.type==='ROUND_RESET')return;
      const a=this.world.players[packet.sourceId],t=this.world.players[packet.targetId];if(!a||!t)return;
      if(packet.type==='FINISHER_REQUEST'){
        if(t.id!==this.localId||!RiftVitals.vulnerable(t)||Math.abs(packet.x-t.x)>160||Math.abs(packet.y-t.y)>120)return;
        const result=RiftVitals.takeNode(t);if(!result.taken)return;
        this.authority.sendControl('FINISHER_CONFIRMED',{requestId:packet.requestId,sourceId:a.id,targetId:t.id,nodes:t.nodes,phase:t.phase,hp:t.hp,posture:t.posture});
        this.finisherScene(a,t,result.dead);this.authority.publishState(true);
      }else if(packet.type==='FINISHER_CONFIRMED'){
        if(a.id!==this.localId||this.deathRequests.has(packet.requestId))return;
        this.deathRequests.add(packet.requestId);
        Object.assign(t,{nodes:packet.nodes,phase:packet.phase,hp:packet.hp,posture:packet.posture,state:packet.nodes?'REVIVING':'DEAD',dead:packet.nodes===0,lockFrames:packet.nodes?90:0,invuln:packet.nodes?90:0,move:null,moveName:'',attackId:null});
        this.finisherScene(a,t,packet.nodes===0);
      }
    }
    createNet() {
      if (this.net) this.net.disconnect();
      this.net = new RiftNet({
        onStatus: (t) => {
          $("network-status").textContent = t;
        },
        onRole: (r) => {
          this.isHost = r === "host";
        },
        onCombat: packet => this.authority?.onPacket(packet),
        onStart: (c) => {
          this.start("online", c);
        },
        onEvent: (e) => {
          if (e.type === "loadout" && this.isHost) {
            const validTools =
              Array.isArray(e.tools) &&
              e.tools.length === 2 &&
              e.tools.every((t) => TOOL_NAMES[t]) &&
              e.tools[0] !== e.tools[1];
            if (validTools) this.guestLoadout = e.tools;
            if (["cleave", "rift"].includes(e.art)) this.guestArt = e.art;
          }
          if(e.type === "weather" && !this.isHost)this.world.weather=e.value === "storm"?"storm":"dusk";
          if(e.type === "storm" && !this.isHost && Number.isFinite(e.x) && e.x>=0 && e.x<=4000 && Number.isFinite(e.y) && e.y>=0 && e.y<=1200 && Number.isFinite(e.timestamp)){
            const latency=clamp((Date.now()+(this.net?.clockOffsetMs||0)-e.timestamp)*60/1000,0,30);
            this.world.lightning.push({x:e.x,y:e.y,life:90,warning:true});
            this.world.stormTimer=Math.max(1,70-Math.floor(latency));this.remoteStorm=true;
            this.caption("天雷將至・留意落雷標記",70);
          }

        },
        onDisconnect: (r) => {
          this.toast(r || "對手已離線");
          $("network-start").disabled = true;
          if (this.world.phase === "fighting" && this.mode === "online") {
            this.paused = true;
            $("resume").disabled = true;
            $("pause-title").textContent = "連線中斷";
            $("pause-panel").hidden = false;
          }
        },
      });
      return this.net;
    }
    async host() {
      try {
        $("host-room").disabled = true;
        const net = this.createNet(),
          code = await net.host();
        $("room-code").value = code;
        $("copy-room").disabled = false;
        $("network-start").hidden = false;
        $("network-start").disabled = true;
        this.roomCode = code;
        this.pollConnection();
      } catch (e) {
        this.toast(e.message || "無法建立房間");
      } finally {
        $("host-room").disabled = false;
      }
    }
    async join() {
      const code = $("room-code").value.trim();
      if (!code) {
        this.toast("請輸入房間碼");
        return;
      }
      try {
        $("join-room").disabled = true;
        const net = this.createNet();
        await net.join(code);
        this.roomCode = code;
        net.sendEvent({ type: "loadout", tools: this.loadout, art: this.art });
        this.toast("已連線，等待房主拔刀");
        $("network-start").hidden = true;
      } catch (e) {
        this.toast(e.message || "房間連線失敗");
      } finally {
        $("join-room").disabled = false;
      }
    }
    pollConnection() {
      clearInterval(this.connectionPoll);
      this.connectionPoll = setInterval(() => {
        if (!this.net) return;
        if (this.net.connected) {
          $("network-start").disabled = false;
          clearInterval(this.connectionPoll);
          this.toast("同行者已赴約，房主可開始對決");
        }
      }, 200);
    }
    startOnline() {
      if (!this.net?.connected || !this.isHost) {
        this.toast("等待對手加入");
        return;
      }
      const c = {
        loadouts: [this.loadout, this.guestLoadout || ["disc", "flame"]],
        arts: [this.art, this.guestArt || "cleave"],
        weather: this.weather, round:this.scores[0]+this.scores[1]+1,
      };
      this.net.sendStart(c);
      this.start("online", c);
      this.authority.publishState();
    }
    disconnect() {
      clearInterval(this.connectionPoll);
      this.net?.disconnect();
      this.net = null;
      $("network-status").textContent = "建立房間，或輸入朋友的房間碼";
      $("network-start").hidden = true;
      $("copy-room").disabled = true;
      this.guestLoadout = null;
      this.guestArt = null;
    }
    async copyRoom() {
      const url = new URL(location.href);
      url.searchParams.set("room", this.roomCode);
      try {
        await navigator.clipboard.writeText(url.href);
        this.toast("邀請連結已複製");
      } catch {
        const el = $("room-code");
        el.select();
        this.toast("瀏覽器未允許剪貼簿，請複製已選取的房間碼");
      }
    }
  }
  function present(m, kind) {
    return m.kind === kind;
  }
  window.game = new Game();
  window.RIFT = { MOVES, B, STATES };
  if(window.RiftTutorial)window.game.tutorial=new RiftTutorial(window.game);
})();
