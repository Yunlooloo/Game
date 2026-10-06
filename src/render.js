
/* 斬境殘響 · Riftblade Echoes — original procedural artwork. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = seed => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
  const C = {
    dusk: { sky: ['#7896a5', '#b9c7c3', '#e9d8b0'], sun: '#f4ead0', mountain: ['#8eaaaf', '#698893', '#425f70'], fog: '#d2dbca', ink: '#213a49', pale: '#e4e6cf', wood: '#4d6370', red: '#b95057', water: '#517b7d' },
    storm: { sky: ['#101c35', '#2b435f', '#687f8c'], sun: '#c7d9dc', mountain: ['#3e566e', '#29445a', '#1b3447'], fog: '#9bbcc1', ink: '#102635', pale: '#cedfdb', wood: '#344d63', red: '#a44a61', water: '#204958' }
  };
  class RiftRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.buffer = document.createElement('canvas');
      this.bufferCtx = this.buffer.getContext('2d', { alpha: false });
      this.c = this.ctx;
      this.camera = { x: 2000, y: 800, zoom: 1 };
      this.initialized = false;
      this.last = performance.now();
      this.seed = rand(7019);
      this.reeds = Array.from({ length: 420 }, () => ({ x: this.seed() * 4140 - 70, h: 25 + this.seed() * 68, phase: this.seed() * TAU, seed: this.seed(), depth: this.seed() }));
      this.rocks = Array.from({ length: 130 }, () => ({ x: this.seed() * 4000, r: 8 + this.seed() * 26, y: 1082 + this.seed() * 110, k: this.seed() }));
      this.motes = Array.from({ length: 68 }, () => ({ x: this.seed(), y: this.seed(), size: 1 + this.seed() * 3, phase: this.seed() * TAU, speed: .25 + this.seed() }));
      this.rain = Array.from({ length: 200 }, () => ({ x: this.seed(), y: this.seed(), z: this.seed() }));
      this.grainTexture = document.createElement('canvas');
      this.grainTexture.width = this.grainTexture.height = 256;
      const grainContext = this.grainTexture.getContext('2d');
      grainContext.fillStyle = 'rgba(39,47,39,.05)';
      for (let i = 0; i < 32; i++) grainContext.fillRect(this.seed() * 256, this.seed() * 256, this.seed() + .25, this.seed() + .25);
      this.grainPattern = this.c.createPattern(this.grainTexture, 'repeat');
      this.resize();
    }
    resize() {
      const r = this.canvas.getBoundingClientRect();
      this.w = Math.max(320, Math.round(r.width || innerWidth));
      this.h = Math.max(240, Math.round(r.height || innerHeight));
      this.dpr = Math.min(devicePixelRatio || 1, 2);
      for (const cv of [this.canvas, this.buffer]) {
        cv.width = Math.round(this.w * this.dpr);
        cv.height = Math.round(this.h * this.dpr);
      }
    }
    path(points, fill, stroke, width = 1) {
      const c = this.c;
      c.beginPath();
      points.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
      if (fill) { c.closePath(); c.fillStyle = fill; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
    }
    line(x1, y1, x2, y2, color, width = 1) {
      const c = this.c; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = color; c.lineWidth = width; c.stroke();
    }
    ellipse(x, y, rx, ry, color) {
      const c = this.c; c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, TAU); c.fillStyle = color; c.fill();
    }
    visible(x, width = 100) { return x + width > this.left && x - width < this.right; }
    updateCamera(world, dt) {
      const p = world.players || [];
      if (!p.length) return;
      const a = p[0], b = p[1] || a;
      let tx = (a.x + b.x) / 2;
      let ty = (a.y + b.y) / 2 - 94;
      const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
      let zoom = clamp(Math.min(this.w * .78 / (dx + 430), this.h * .74 / (dy + 370)), .65, 1.2);
      if (world.effects && world.effects.execution > 0) { zoom = Math.min(1.2, zoom + .12); ty -= 14; }
      if (world.effects && world.effects.bladeCounter > 0) { zoom = 1.2; ty = (a.y + b.y) / 2 - 60; }
      const halfW = this.w / (2 * zoom), halfH = this.h / (2 * zoom);
      tx = clamp(tx, Math.min(halfW, 2000), Math.max(4000 - halfW, 2000));
      ty = clamp(ty, Math.min(halfH - 80, 600), Math.max(1135 - halfH, 600));
      if (!this.initialized) { this.camera = { x: tx, y: ty, zoom }; this.initialized = true; }
      const k = 1 - Math.exp(-dt * 4.2);
      this.camera.x = lerp(this.camera.x, tx, k);
      this.camera.y = lerp(this.camera.y, ty, k);
      this.camera.zoom = lerp(this.camera.zoom, zoom, 1 - Math.exp(-dt * 3));
      if (world.camera) Object.assign(world.camera, this.camera);
    }
    render(world, alpha = 0) {
      const now = performance.now(), dt = clamp((now - this.last) / 1000, .001, .05);
      this.last = now; this.t = now / 1000;
      this.world = world; this.pal = C[world.weather === 'storm' ? 'storm' : 'dusk'];
      this.storm = world.weather === 'storm';
      this.updateCamera(world, dt);
      const c = this.c, cam = this.camera, fx = world.effects || {};
      this.left = cam.x - this.w / (2 * cam.zoom) - 180;
      this.right = cam.x + this.w / (2 * cam.zoom) + 180;
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.lineCap = 'round'; c.lineJoin = 'round';
      this.sky();
      const shake = Math.min(16, Math.max(0, fx.shake || 0));
      const sx = Math.sin(this.t * 131) * shake * .45, sy = Math.cos(this.t * 167) * shake * .3;
      c.save();
      c.translate(this.w / 2 + sx, this.h / 2 + sy);
      c.scale(cam.zoom, cam.zoom); c.translate(-cam.x, -cam.y);
      this.distantWorld();
      this.ground();
      for (const p of world.platforms || []) this.platform(p);
      for (const d of world.doors || []) this.door(d);
      for (const b of world.crystalReeds || []) this.crystalReed(b);
      this.reedLayer(false);
      this.anchors(world.anchors || []);
      this.decals(world.decals || []);
      this.effectRings(world.rings || []);
      for (const p of world.players || []) this.player(p, alpha);
      this.projectiles(world.projectiles || []);
      this.slashes(world.slashes || []);
      this.particles(world.particles || []);
      this.lightning(world.lightning || []);
      this.reedLayer(true);
      if (fx.parry > 0) this.parry(fx);
      c.restore();
      this.atmosphere();
      this.edgeIndicators(world.players || []);
      this.vignette();
      const out = this.ctx;
      out.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      out.globalCompositeOperation = 'source-over'; out.globalAlpha = 1;
      // Avoid an offscreen-to-screen copy during ordinary frames. Snapshot only
      // when a combat effect needs the actual scene for its optical treatment.
      if (fx.execution > 0 || (fx.chromatic > .12 && !fx.parry)) {
        this.bufferCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.bufferCtx.drawImage(this.canvas, 0, 0);
      }
      if (fx.execution > 0) {
        out.filter = 'grayscale(1) contrast(1.65)';
        out.drawImage(this.buffer, 0, 0, this.w, this.h);
        out.filter = 'none';
      }
      if (fx.chromatic > .12 && !fx.parry) this.impactPost(fx);
      if (fx.flash > .05 && !fx.parry) { out.globalAlpha = clamp(fx.flash / 16, 0, .38); out.fillStyle = '#fff3ce'; out.fillRect(0, 0, this.w, this.h); out.globalAlpha = 1; }
      if (fx.execution > 0) this.execution(fx);
      else if (fx.revival > 0) this.revival(fx);
      if (fx.bladeCounter > 0) this.bladeCounter(fx);
      if (world.phase === 'menu') this.drawLobbyPortraits(document.getElementById('lobby-art'));
    }
    sky() {
      const c = this.c, w = this.w, h = this.h, p = this.pal;
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, p.sky[0]); g.addColorStop(.57, p.sky[1]); g.addColorStop(1, p.sky[2]);
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      const sunX = w * .67 - (this.camera.x - 2000) * .045, sunY = h * .25, radius = Math.min(w, h) * .09;
      const glow = c.createRadialGradient(sunX, sunY, radius * .5, sunX, sunY, radius * 4);
      glow.addColorStop(0, this.storm ? 'rgba(132,210,220,.12)' : 'rgba(255,239,191,.45)'); glow.addColorStop(1, 'rgba(233,230,190,0)');
      c.fillStyle = glow; c.fillRect(0, 0, w, h);
      c.globalAlpha = this.storm ? .38 : .84; this.ellipse(sunX, sunY, radius, radius, p.sun);
      this.line(sunX - radius * 1.4, sunY + radius * .45, sunX + radius * 1.4, sunY - radius * .45, p.sky[0], 5);
      c.globalAlpha = 1;
      // A fractured horizon of basalt columns and suspended foundry remnants.
      for (let layer = 0; layer < 3; layer++) {
        const base = h * (.52 + layer * .14), size = 95 - layer * 13, offset = this.camera.x * (.045 + layer * .05);
        c.beginPath(); c.moveTo(-size, h);
        for (let i = -2; i < Math.ceil(w / size) + 3; i++) {
          const x = i * size - offset % size;
          const lift = (Math.sin(i * 7.1 + layer * 8.2) * .5 + .5) * h * .18;
          c.lineTo(x, base - lift); c.lineTo(x + size * .28, base - lift - 22);
          c.lineTo(x + size * .63, base - lift - 16); c.lineTo(x + size * .8, base + 18);
        }
        c.lineTo(w + size, h); c.closePath(); c.fillStyle = p.mountain[layer]; c.fill();
        c.globalAlpha = .18;
        for (let i = 0; i < 15; i++) {
          const x = i * w / 12 - offset * .3 % 90, y = base - 20 - (i % 3) * 24;
          this.path([[x, y], [x + 15, y - 77], [x + 35, y - 85], [x + 37, y + 43]], p.ink);
          this.line(x + 16, y - 72, x + 18, y + 30, p.pale, 1);
        }
        c.globalAlpha = 1;
      }
      c.save(); c.translate(w * .8 - (this.camera.x - 2000) * .14, h * .49); c.globalAlpha = .52;
      this.path([[-118, 15], [-95, -9], [87, -9], [111, 15], [89, 30], [-99, 30]], p.ink);
      this.path([[-25, 145], [-17, -97], [4, -115], [25, -90], [35, 145]], p.mountain[2]);
      this.line(-103, 14, -26, -66, p.ink, 3); this.line(98, 14, 12, -64, p.ink, 3);
      for (const x of [-69, 68]) {
        c.save(); c.translate(x, 8); c.rotate(this.t * .09 + x);
        c.beginPath(); c.arc(0, 0, 29, 0, TAU); c.strokeStyle = p.ink; c.lineWidth = 5; c.stroke();
        for (let j = 0; j < 4; j++) { c.rotate(Math.PI / 2); this.path([[0, -5], [8, -22], [23, -17], [10, 2]], p.ink); }
        c.restore();
      }
      c.restore();
      c.globalAlpha = this.storm ? .18 : .15;
      for (let i = 0; i < 7; i++) {
        const y = h * (.14 + i * .055), x = (i * 281 + this.t * .8 - this.camera.x * .02) % (w + 440) - 220;
        this.path([[x - 220, y], [x + 130, y - 10], [x + 235, y + 4], [x - 100, y + 11]], p.pale);
      }
      c.globalAlpha = 1;
    }
    distantWorld() {
      const c = this.c, p = this.pal;
      c.globalAlpha = this.storm ? .56 : .46;
      for (let i = 0; i < 24; i++) {
        const x = i * 184 - 80, h = 120 + (Math.sin(i * 7.29) + 1) * 83;
        if (!this.visible(x, 180)) continue;
        this.path([[x - 26, 1084], [x - 19, 1080 - h], [x + 6, 1062 - h], [x + 30, 1079 - h], [x + 42, 1084]], p.ink);
        this.line(x + 5, 1070 - h, x + 12, 1072, '#88aeb0', 1.2);
        if (i % 3 === 0) {
          this.path([[x - 53, 1040 - h], [x - 43, 1028 - h], [x + 123, 1028 - h], [x + 141, 1041 - h], [x + 117, 1054 - h], [x - 48, 1054 - h]], p.ink);
          this.line(x + 4, 1080 - h, x + 119, 1030 - h, p.ink, 3);
        }
      }
      c.globalAlpha = 1;
      const haze = c.createLinearGradient(0, 790, 0, 1110);
      haze.addColorStop(0, 'rgba(185,210,209,0)'); haze.addColorStop(1, this.storm ? 'rgba(130,176,192,.15)' : 'rgba(220,226,201,.45)');
      c.fillStyle = haze; c.fillRect(this.left - 100, 790, this.right - this.left + 200, 320);
      for (const x of [390, 1620, 2910, 3660]) {
        if (!this.visible(x)) continue;
        this.path([[x - 19, 1080], [x - 12, 917], [x + 2, 899], [x + 14, 917], [x + 22, 1080]], p.ink);
        this.line(x - 5, 952, x + 5, 1050, '#659a9d', 2);
        this.beacon(x + 2, 899, 1.25);
        this.line(x - 19, 1060, x + 22, 1060, '#95b6b3', 2);
      }
    }
    ground() {
      const c = this.c, p = this.pal;
      const g = c.createLinearGradient(0, 1080, 0, 1300); g.addColorStop(0, p.water); g.addColorStop(1, this.storm ? '#102c40' : '#233e51');
      c.fillStyle = g; c.fillRect(-100, 1081, 4200, 240);
      c.globalAlpha = .18;
      for (let i = 0; i < 62; i++) {
        const x = (i * 83 + Math.sin(this.t * .7 + i) * 20) % 4000, y = 1087 + (i * 31) % 98;
        if (this.visible(x)) this.line(x, y, x + 18 + (i % 9) * 12, y, p.pale, .8);
      }
      c.globalAlpha = 1;
      this.path([[-80, 1080], [300, 1080], [540, 1080], [900, 1080], [1440, 1080], [1980, 1080], [2400, 1080], [2800, 1080], [3300, 1080], [4100, 1080], [4100, 1104], [-80, 1104]], p.ink);
      this.line(0, 1080, 4000, 1080, this.storm ? '#bed8d0' : '#e8dfbb', 3);
      for (const r of this.rocks) {
        if (!this.visible(r.x)) continue;
        this.path([[r.x - r.r, r.y], [r.x - r.r * .6, r.y - r.r * .58], [r.x + r.r * .25, r.y - r.r * .7], [r.x + r.r * .9, r.y - r.r * .2], [r.x + r.r, r.y]], r.k > .5 ? p.ink : p.wood);
        this.line(r.x - r.r * .6, r.y - r.r * .58, r.x + r.r * .25, r.y - r.r * .7, '#afc5b6', 1.3);
      }
      for (const x of [8, 3966]) {
        this.path([[x - 15, 1080], [x - 7, 920], [x + 12, 901], [x + 31, 925], [x + 31, 1080]], p.ink);
        this.line(x + 9, 938, x + 14, 1048, '#5dc9c6', 2);
        this.path([[x + 3, 940], [x + 10, 929], [x + 17, 940], [x + 10, 951]], '#baf4e7');
      }
    }
    platform(p) {
      const c = this.c, pal = this.pal, x = p.x, y = p.y, w = p.w;
      if (!this.visible(x + w / 2, w / 2 + 100)) return;
      if (p.type === 'gantry') { this.gantry(x, y, w); return; }
      if (p.type === 'pylon') { this.pylon(x, y, w); return; }
      if (p.type === 'stone') {
        this.path([[x - 8, y + 8], [x, y], [x + w, y], [x + w + 9, y + 10], [x + w - 13, y + 38], [x + 14, y + 31]], pal.ink, pal.wood, 1);
        this.line(x + 1, y, x + w - 1, y, '#b2d0c5', 2.5);
        for (let i = 20; i < w; i += 37) this.line(x + i, y + 6, x + i - 8, y + 26, '#557e89', 1);
        return;
      }
      // Flat steel tread and angular underhung chains retain the collision surface.
      this.path([[x - 7, y + 1], [x + w + 7, y + 1], [x + w + 1, y + 23], [x, y + 23]], pal.ink);
      c.fillStyle = pal.wood; c.fillRect(x, y + 2, w, 9);
      this.line(x, y, x + w, y, '#b9d8cc', 3);
      for (let xx = x + 9; xx < x + w; xx += 26) {
        this.line(xx, y + 3, xx + 10, y + 10, '#9caeac', 1);
        this.ellipse(xx, y + 17, 1.5, 1.5, '#a1b9b8');
      }
      for (const xx of [x + 15, x + w - 15]) {
        this.line(xx, y + 23, xx, Math.min(1090, y + 85), pal.wood, 5);
        this.line(xx, y + 75, x + w / 2, y + 124, pal.ink, 7);
        this.line(xx, y + 75, x + w / 2, y + 124, '#779499', 1.5);
      }
      for (let xx = x + 24; xx < x + w - 10; xx += 40) {
        const yy = y + 34 + Math.min(xx - x, x + w - xx) * .19;
        c.save(); c.translate(xx, yy); c.rotate(xx < x + w / 2 ? .22 : -.22);
        c.strokeStyle = '#4c6975'; c.lineWidth = 3; c.strokeRect(-10, -3, 23, 7); c.restore();
      }
      if (w > 350) { this.beacon(x + 22, y + 38, .65); this.beacon(x + w - 22, y + 38, .65); }
    }
    gantry(x, y, w) {
      const c = this.c, p = this.pal;
      const lowerPlatforms = (this.world.platforms || []).filter(q => q.y > y + 80 && q.x < x + w - 40 && q.x + q.w > x + 40);
      const supportY = Math.min(1080, ...lowerPlatforms.map(q => q.y));
      const beamY = Math.min(y + 132, supportY - 30);
      // A suspended turbine gantry: rectilinear trusses, exposed rotors and basalt feet.
      for (const xx of [x + 35, x + w - 49]) {
        this.path([[xx, y + 25], [xx + 13, y + 25], [xx + 20, supportY], [xx - 7, supportY]], p.ink);
        this.line(xx + 5, y + 33, xx + 8, supportY - 4, '#607f8d', 2);
        this.line(xx + 7, beamY, xx + (xx < x + w / 2 ? 67 : -59), y + 30, '#516c7b', 5);
      }
      c.fillStyle = '#213745'; c.fillRect(x + 25, y + 35, w - 50, 15); c.fillRect(x + 28, beamY, w - 56, 12);
      for (let xx = x + 45; xx < x + w - 45; xx += 78) {
        this.line(xx, y + 50, xx + 59, beamY, '#3e586c', 5); this.line(xx, beamY, xx + 59, y + 50, '#3e586c', 5);
      }
      const rotorCount = Math.max(1, Math.floor(w / 180));
      for (let i = 0; i < rotorCount; i++) {
        const xx = x + (i + .5) * w / rotorCount, yy = y + 89, rr = Math.min(32, Math.max(21, (beamY - y - 47) * .42));
        c.save(); c.translate(xx, yy);
        c.beginPath(); c.arc(0, 0, rr + 6, 0, TAU); c.strokeStyle = '#526e79'; c.lineWidth = 6; c.stroke();
        c.rotate(this.t * .32 + i);
        for (let j = 0; j < 5; j++) { c.rotate(TAU / 5); this.path([[0, -4], [8, -rr + 3], [rr * .7, -rr * .51], [10, 4]], '#5f7880', '#293f51', 1); }
        this.ellipse(0, 0, 6, 6, '#a9cac2'); c.restore();
      }
      this.path([[x - 12, y + 9], [x, y], [x + w, y], [x + w + 12, y + 9], [x + w + 5, y + 27], [x - 5, y + 27]], p.ink);
      c.fillStyle = '#597680'; c.fillRect(x, y + 2, w, 8);
      this.line(x, y, x + w, y, '#cce1cd', 3);
      for (let xx = x + 9; xx < x + w; xx += 27) { this.line(xx, y + 4, xx + 8, y + 10, '#92b2b3', 1); this.ellipse(xx, y + 20, 1.8, 1.8, '#96b8b8'); }
      this.line(x + 13, y + 29, x + w - 13, y + 29, '#3ab9b4', 2);
      this.beacon(x + 21, y + 46, .65); this.beacon(x + w - 21, y + 46, .65);
    }
    pylon(x, y, w) {
      const c = this.c, p = this.pal, height = Math.min(340, Math.max(140, 1080 - y));
      // One cantilevered basalt engine pylon, rather than a paired gateway.
      const center = x + w * .54;
      this.path([[center - 18, y + 27], [center + 15, y + 27], [center + 37, y + height], [center - 38, y + height], [center - 30, y + 118]], p.ink);
      this.path([[center + 2, y + 32], [center + 15, y + 32], [center + 31, y + height], [center + 12, y + height]], '#425c6e');
      this.line(center - 5, y + 67, center + 5, y + height - 24, '#55b8b7', 2);
      this.line(center - 10, y + 110, x + 17, y + 27, '#506c78', 8);
      this.line(center + 15, y + 93, x + w - 15, y + 28, '#506c78', 8);
      this.path([[x - 9, y + 10], [x, y], [x + w, y], [x + w + 10, y + 10], [x + w - 5, y + 31], [x + 6, y + 31]], p.ink);
      this.line(x, y, x + w, y, '#c4dbcb', 3);
      this.line(x + 8, y + 10, x + w - 8, y + 10, '#637d88', 4);
      for (let xx = x + 13; xx < x + w; xx += 28) this.line(xx, y + 15, xx + 12, y + 25, '#849d9e', 1);
      this.beacon(center, y + 54, 1);
    }
    beacon(x, y, scale = 1) {
      const c = this.c;
      c.save(); c.translate(x, y); c.scale(scale, scale);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 51);
      g.addColorStop(0, this.storm ? 'rgba(78,238,214,.3)' : 'rgba(92,223,199,.17)'); g.addColorStop(1, 'rgba(57,214,203,0)');
      c.fillStyle = g; c.fillRect(-53, -53, 106, 106);
      this.path([[-11, -14], [0, -22], [11, -14], [11, 13], [0, 22], [-11, 13]], '#203f51', '#8eaeb5', 1.5);
      this.path([[0, -17], [6, -10], [5, 10], [0, 17], [-5, 10], [-6, -10]], '#9be7d2');
      this.line(0, -14, 0, 13, '#efffe8', 1.3);
      this.line(-14, -11, -14, 11, '#405e72', 3); this.line(14, -11, 14, 11, '#405e72', 3);
      c.restore();
    }
    door(d) {
      if (!this.visible(d.x + d.w / 2, d.w)) return;
      const c = this.c, x = d.x, y = d.y, w = d.w || 90, h = d.h || 140;
      c.fillStyle = this.storm ? '#38566a' : '#6e8892'; c.fillRect(x, y, w, h);
      c.strokeStyle = '#233e50'; c.lineWidth = 5; c.strokeRect(x, y, w, h);
      for (let yy = y + 14; yy < y + h; yy += 18) {
        this.line(x + 5, yy, x + w - 5, yy, '#2c4a60', 3);
        this.line(x + 5, yy + 3, x + w - 5, yy + 3, '#97b7b4', 1);
      }
      this.line(x + w * .22, y + 7, x + w * .78, y + h - 7, '#b0b799', 5);
      for (const yy of [y + 7, y + h - 7]) for (const xx of [x + 7, x + w - 7]) this.ellipse(xx, yy, 2, 2, '#ccd4bc');
      if (d.torn) {
        this.path([[x + 4, y + h * .66], [x + w * .3, y + h * .35], [x + w * .22, y + h * .49], [x + w * .84, y + h * .17], [x + w * .66, y + h * .36], [x + w - 4, y + h * .32], [x + w * .75, y + h * .66], [x + w * .79, y + h * .51], [x + w * .2, y + h * .84], [x + w * .35, y + h * .67]], '#172e41');
        this.line(x + w * .25, y + h * .49, x + w * .82, y + h * .18, '#c0e6d5', 2);
      }
    }
    crystalReed(b) {
      if (!this.visible(b.x, b.h || 240)) return;
      const c = this.c, h = b.h || 240, y = b.y || 1080, cutH = 52;
      c.save(); c.translate(b.x, y);
      if (b.cut) {
        this.crystalReedStem(0, 0, cutH, b.x, false);
        c.translate(0, -cutH);
        const angle = b.angle || b.fall || .35;
        c.rotate(clamp(angle, -1.7, 1.7));
        this.crystalReedStem(0, 0, h - cutH, b.x, true);
        this.ellipse(0, 0, 5, 2.3, '#b4f0de');
      } else this.crystalReedStem(0, 0, h, b.x, true);
      c.restore();
    }
    crystalReedStem(x, y, h, seed, leaves) {
      const c = this.c;
      this.path([[x - 5, y], [x - 7, y - h * .78], [x + 1, y - h - 9], [x + 7, y - h * .73], [x + 5, y]], this.storm ? '#376e7b' : '#5a9a9e', '#2a5365', 1);
      this.path([[x + 1, y - h - 8], [x + 3, y], [x - 1, y]], '#addacb');
      if (leaves) for (let yy = y - 46; yy > y - h + 28; yy -= 56) {
        const side = Math.sin(yy + seed) > 0 ? 1 : -1, tip = x + side * (21 + Math.sin(seed) * 5);
        this.path([[x, yy], [tip, yy - 42], [tip + side * 5, yy - 27], [x + side * 5, yy + 7]], this.storm ? '#4c8b95' : '#87b8ae', '#467b89', 1);
        this.line(x + side * 2, yy - 1, tip, yy - 39, '#c5e5ce', .8);
      }
    }
    reedLayer(front) {
      const c = this.c, reeds = [];
      for (const r of this.reeds) {
        if ((r.depth > .58) !== front || !this.visible(r.x, 50)) continue;
        const y = 1080 + (front ? 16 : -2) + r.seed * 14;
        const sway = Math.sin(this.t * 1.55 + r.phase) * (5 + r.h * .07) + Math.sin(this.t * .41) * 5;
        reeds.push({ r, y, sway });
      }
      const color = front ? (this.storm ? '#264958' : '#466b6c') : (this.storm ? '#709ca1' : '#9aad94');
      c.globalAlpha = front ? .86 : .7;
      c.strokeStyle = color; c.lineWidth = front ? 1.3 : 1;
      c.beginPath();
      for (const { r, y, sway } of reeds) {
        c.moveTo(r.x, y); c.quadraticCurveTo(r.x + sway * .4, y - r.h * .6, r.x + sway, y - r.h);
      }
      c.stroke(); c.fillStyle = color; c.beginPath();
      for (const { r, y, sway } of reeds) {
        c.moveTo(r.x, y - r.h * .27); c.lineTo(r.x - 14 + sway * .2, y - r.h * .7); c.lineTo(r.x - 3, y - r.h * .42); c.closePath();
        c.moveTo(r.x + 1, y - r.h * .42); c.lineTo(r.x + 16 + sway, y - r.h * .85); c.lineTo(r.x + 3, y - r.h * .6); c.closePath();
      }
      c.fill();
      c.fillStyle = front ? (this.storm ? '#aaa57c' : '#c7b783') : '#c7be95'; c.beginPath();
      for (const { r, y, sway } of reeds) {
        c.moveTo(r.x + sway + 2.2, y - r.h);
        c.ellipse(r.x + sway, y - r.h, 2.2, 10 + r.seed * 5, .16 + sway * .026, 0, TAU);
      }
      c.fill(); c.globalAlpha = 1;
    }
    anchors(anchors) {
      const c = this.c;
      for (const a of anchors) {
        if (!this.visible(a.x)) continue;
        const pulse = .55 + Math.sin(this.t * 3 + a.x) * .2;
        this.line(a.x, a.y - 17, a.x, a.y - 8, '#576f4d', 2);
        c.globalAlpha = pulse;
        c.beginPath(); c.arc(a.x, a.y, 11, 0, TAU); c.strokeStyle = '#b9d093'; c.lineWidth = 1; c.stroke();
        c.save(); c.translate(a.x, a.y); c.rotate(Math.PI / 4); c.strokeStyle = '#deebb3'; c.lineWidth = 2; c.strokeRect(-3.2, -3.2, 6.4, 6.4); c.restore();
        c.globalAlpha = 1;
      }
    }
    decals(decals) {
      const c = this.c; c.globalAlpha = .6;
      for (const d of decals) if (this.visible(d.x)) this.ellipse(d.x, d.y || 1080, d.r || 7, (d.r || 7) * .2, '#632b27');
      c.globalAlpha = 1;
    }
    // Ink portraits use the same original faces and cloth palette as the arena.
    // Coordinates are local art units; these helpers never move a game entity.
    humanHead(x, y, elder, size = 1, tilt = 0) {
      const c = this.c, ink = '#292b2b', skin = elder ? '#c9ad95' : '#dcc1a0';
      c.save(); c.translate(x, y); c.rotate(tilt); c.scale(size, size);
      if (elder) {
        this.path([[-15, -10], [-15, -23], [-6, -28], [4, -26], [13, -20], [17, -7], [15, 13], [8, 22], [4, 7], [-11, 11]], '#969994', ink, 1.15);
        this.line(-13, -10, -11, 14, '#d9d9ca', 1.4);
      } else {
        c.beginPath(); c.moveTo(-12, -14); c.bezierCurveTo(-31, -32, -28, 0, -29, 10); c.bezierCurveTo(-28, 21, -37, 26, -39, 29); c.bezierCurveTo(-25, 31, -19, 19, -20, 6); c.bezierCurveTo(-16, -2, -19, -9, -12, -14); c.fillStyle = '#2c3234'; c.fill(); c.strokeStyle = ink; c.lineWidth = 1.15; c.stroke();
        this.line(-24, -7, -27, 18, '#5d6260', 1);
        this.path([[-22, -15], [-16, -17], [-14, -11], [-22, -10]], '#718b80', ink, .9);
      }
      this.path([[-5, 10], [6, 11], [7, 26], [-9, 26]], skin, ink, 1.05);
      this.path([[-4, 15], [5, 17], [4, 22], [-7, 24]], elder ? '#a58c7a' : '#b7977d');
      c.beginPath(); c.moveTo(-12, -11); c.bezierCurveTo(-11, -23, 10, -22, 14, -10); c.lineTo(14, 2); c.quadraticCurveTo(12, 13, 4, 17); c.quadraticCurveTo(-4, 18, -10, 10); c.lineTo(-13, -2); c.closePath(); c.fillStyle = skin; c.fill(); c.strokeStyle = ink; c.lineWidth = 1.15; c.stroke();
      this.path([[-10, 2], [-6, 10], [3, 14], [10, 10], [4, 18], [-3, 16], [-10, 10]], elder ? '#b0937e' : '#c4a387');
      this.ellipse(-12, 1, 3.2, 5.1, skin); this.line(-13, -.3, -11, 3, '#a08470', .8);
      // Brows and two readable eyes, rather than a mask or glowing visor.
      c.beginPath(); c.moveTo(-8, -6); c.quadraticCurveTo(-4, -8.2, -.5, -5.8); c.moveTo(5, -6.3); c.quadraticCurveTo(9, -7.9, 12, -5.4); c.strokeStyle = elder ? '#65645e' : ink; c.lineWidth = elder ? 1.25 : 1.5; c.stroke();
      this.line(-7.5, -2.8, -1.5, -2.2, ink, 1); this.line(5.7, -2.6, 11.2, -3.2, ink, 1);
      this.ellipse(-3.5, -1.8, .85, 1.25, '#1d2728'); this.ellipse(8, -2.2, .8, 1.15, '#1d2728');
      c.beginPath(); c.moveTo(3, -3); c.lineTo(2, 3.8); c.lineTo(5.2, 4.6); c.strokeStyle = '#977967'; c.lineWidth = .75; c.stroke();
      c.beginPath(); c.moveTo(-.8, 9.2); c.quadraticCurveTo(3.5, 7.9, 7.1, 8.8); c.strokeStyle = '#775c51'; c.lineWidth = .8; c.stroke();
      this.line(.7, 11.4, 5.3, 11.5, '#ae8c75', .6);
      if (elder) {
        c.beginPath(); c.moveTo(-13, -6); c.bezierCurveTo(-11, -17, -3, -14, 3, -18); c.bezierCurveTo(11, -13, 13, -10, 14, -3); c.bezierCurveTo(20, -13, 9, -32, -2, -25); c.bezierCurveTo(-15, -28, -19, -16, -13, -6); c.fillStyle = '#d0d1c6'; c.fill(); c.strokeStyle = ink; c.lineWidth = 1.2; c.stroke();
        for (const xx of [-9, -4, 2, 7]) { c.beginPath(); c.moveTo(xx - 1, -21); c.quadraticCurveTo(xx + 6, -16, xx + 4, -12); c.strokeStyle = '#909990'; c.lineWidth = .75; c.stroke(); }
        this.line(-8, -11, -1, -10, '#a78d78', .7); this.line(1, -12, 8, -11, '#a78d78', .7);
        this.line(-9, 3, -4, 4, '#9b806c', .7); this.line(8, 2, 12, 1, '#9b806c', .7);
        this.line(-5, 7, -3, 10, '#9b806c', .7); this.line(9, 6, 10, 10, '#9b806c', .7);
        this.path([[-6, 14], [-3, 16], [4, 17], [8, 14], [5, 20], [0, 21]], '#a8aaa0', ink, .55);
      } else {
        c.beginPath(); c.moveTo(-13, 7); c.bezierCurveTo(-20, -7, -15, -25, -2, -23); c.bezierCurveTo(8, -31, 19, -18, 17, -9); c.bezierCurveTo(10, -16, 8, -14, 4, -8); c.lineTo(-2, -1); c.lineTo(0, -14); c.bezierCurveTo(-7, -11, -9, -4, -13, 7); c.fillStyle = '#2d3335'; c.fill(); c.strokeStyle = ink; c.lineWidth = 1.2; c.stroke();
        c.beginPath(); c.moveTo(-11, -13); c.quadraticCurveTo(-4, -22, 3, -21); c.moveTo(4, -17); c.quadraticCurveTo(9, -22, 13, -16); c.strokeStyle = '#626863'; c.lineWidth = .8; c.stroke();
        this.line(-13, 7, -13, 11, '#9d8260', 1); this.ellipse(-13, 12, 1.4, 2.2, '#6d9b92');
      }
      c.restore();
    }
    portraitFigure(id, x, y, scale) {
      const c = this.c, elder = id === 1, ink = '#343536', cloth = elder ? '#7d707e' : '#354d59', pale = elder ? '#b0aaa6' : '#637e7c', dark = elder ? '#514d58' : '#273b46', skin = elder ? '#c9ad95' : '#dcc1a0';
      c.save(); c.translate(x, y); c.scale(scale, scale); c.lineJoin = 'round'; c.lineCap = 'round';
      c.globalAlpha = .13; this.ellipse(3, 2, 47, 5, '#514e44'); c.globalAlpha = 1;
      // Scabbard, rear sleeve, and layered cloth create an asymmetric silhouette.
      this.path([[-28, -142], [-38, -128], [-61, -48], [-57, -42], [-52, -44], [-27, -123]], '#434b4d', ink, 1.4);
      this.line(-56, -48, -31, -127, '#8d8c7f', 1.2);
      this.path([[-33, -224], [-49, -207], [-58, -159], [-35, -140], [-21, -169], [-20, -207]], dark, ink, 1.5);
      this.path([[-43, -207], [-49, -166], [-37, -157], [-31, -178]], pale);
      this.line(-43, -202, -45, -172, '#a2aba0', .85);
      this.path([[-41, -150], [-33, -146], [-30, -133], [-36, -126], [-43, -130], [-45, -140]], skin, ink, 1.1);
      this.line(-40, -139, -34, -135, '#a78c75', .8);
      this.line(-41, -135, -36, -132, '#a78c75', .7);
      // Boots and soft trousers follow a seven-head figure proportion.
      this.path([[-31, -128], [0, -126], [5, -71], [-10, -26], [-32, -26], [-28, -69], [-40, -103]], dark, ink, 1.5);
      this.path([[0, -129], [32, -129], [33, -75], [29, -28], [10, -27], [1, -69], [-6, -95]], elder ? '#817f7d' : '#425863', ink, 1.5);
      this.path([[-31, -83], [-19, -54], [-25, -28], [-11, -27], [-5, -73], [-12, -100]], elder ? '#605f61' : '#30434e');
      this.path([[10, -106], [20, -74], [17, -34], [26, -30], [30, -77], [26, -113]], elder ? '#95918a' : '#526973');
      this.line(-29, -95, -22, -56, '#839089', 1); this.line(6, -90, 15, -56, '#a5aba0', .9);
      for (const xx of [-23, 20]) {
        this.path([[xx - 11, -33], [xx + 10, -33], [xx + 10, -9], [xx + 19, -3], [xx + 20, 2], [xx - 12, 3], [xx - 15, -3]], elder ? '#484b4f' : '#304448', ink, 1.4);
        this.path([[xx - 8, -29], [xx + 7, -28], [xx + 5, -10], [xx - 8, -11]], elder ? '#a1a29b' : '#657d78');
        this.line(xx - 9, -22, xx + 7, -20, '#c4c2ac', 1); this.line(xx - 9, -15, xx + 6, -13, '#c4c2ac', 1);
        this.line(xx - 9, -2, xx + 14, 0, '#909990', 1.1);
      }
      if (elder) {
        this.path([[-32, -192], [30, -194], [50, -80], [23, -76], [10, -87], [-3, -70], [-39, -79], [-46, -98]], cloth, ink, 1.5);
        this.path([[-6, -176], [5, -164], [2, -85], [-9, -75], [-30, -81]], '#aaa5a0');
        this.path([[21, -171], [28, -170], [41, -87], [26, -85]], '#938895');
        this.line(-35, -137, -35, -92, '#b3a5ac', 1.1); this.line(25, -130, 33, -93, '#514a56', 1.1);
      } else {
        this.path([[-29, -162], [22, -160], [35, -98], [8, -105], [-3, -119], [-14, -99], [-41, -113]], cloth, ink, 1.5);
        this.path([[-25, -156], [-5, -149], [-18, -107], [-35, -115]], '#607c79');
        this.path([[0, -145], [21, -154], [29, -108], [13, -113]], '#425f69');
        this.line(-23, -137, -29, -116, '#95a299', 1.1); this.line(17, -137, 21, -116, '#91a194', 1);
        this.path([[-32, -219], [-13, -222], [-9, -176], [-42, -130], [-63, -145], [-44, -169]], '#273d47', ink, 1.5);
        this.path([[-40, -204], [-23, -213], [-26, -178], [-48, -150]], '#405b64');
        this.line(-42, -194, -48, -161, '#9baba0', .9);
      }
      // Torso wraps are fabric, outlined by quiet, irregular seam work.
      this.path([[-29, -224], [-10, -235], [14, -233], [33, -217], [27, -167], [17, -146], [-26, -148], [-35, -185]], cloth, ink, 1.65);
      this.path([[-8, -232], [4, -222], [14, -233], [22, -217], [-6, -161], [-23, -170]], elder ? '#c0b8aa' : '#75877a', ink, .9);
      this.path([[-7, -231], [3, -220], [-4, -204], [-17, -223]], '#d4c9af', ink, .8);
      this.path([[16, -231], [28, -220], [10, -182], [-18, -161], [-25, -169], [-4, -191]], elder ? '#5b535f' : '#253f48', ink, .9);
      this.line(19, -218, -11, -171, elder ? '#ac9ba6' : '#99aaa0', 1.2);
      this.path([[-30, -166], [27, -171], [29, -145], [-28, -141]], elder ? '#555356' : '#4b6661', ink, 1.6);
      this.line(-27, -160, 25, -164, '#afb39d', 1); this.line(-26, -153, 26, -156, '#283936', 1.5); this.line(-25, -146, 22, -150, '#9eaa98', 1);
      this.path([[8, -158], [22, -164], [29, -154], [18, -145]], dark, ink, 1.1);
      this.path([[18, -149], [28, -151], [41, -99], [34, -100]], elder ? '#62596a' : '#587570', ink, 1);
      this.line(24, -143, 36, -106, '#b1b49b', .8);
      this.humanHead(0, -252, elder, 1, elder ? -.045 : .02);
      // Front cloth sleeve, a normal bare hand, and one long straight sword.
      this.path([[27, -219], [39, -211], [48, -163], [33, -151], [21, -174], [19, -196]], cloth, ink, 1.6);
      this.path([[32, -207], [39, -175], [33, -165], [28, -185]], elder ? '#a49aa2' : '#657f83');
      this.line(31, -209, 36, -182, '#c1b9a5', 1);
      this.path([[32, -162], [45, -163], [43, -144], [35, -137], [28, -141]], dark, ink, 1.2);
      this.line(31, -153, 42, -153, elder ? '#c4bca9' : '#b7b49a', 1.2);
      this.path([[32, -145], [41, -146], [44, -136], [39, -129], [31, -130], [28, -135]], skin, ink, 1.2);
      this.line(33, -136, 40, -134, '#ac8e76', .75);
      c.save(); c.translate(36, -136); c.rotate(elder ? .99 : .68);
      this.path([[-17, -3.5], [1, -3.5], [1, 3.5], [-17, 3.5]], '#414744', ink, 1);
      for (let a = -14; a < -1; a += 4) this.line(a, -3, a + 3, 3, '#bbb397', .8);
      this.path([[0, -10], [5, -11], [7, -7], [6, 9], [1, 10], [-1, 5]], '#968567', ink, 1.2);
      this.path([[6, -3.4], [100, -3], [120, 0], [104, 3.5], [6, 3.5]], '#b6c5bf', ink, 1);
      this.path([[8, .4], [113, 0], [103, 2.4], [8, 2.6]], '#eeedda');
      this.line(11, -1.8, 101, -1.5, '#788f91', .65); c.restore();
      // A small original split-circle emblem, no borrowed crests or markings.
      c.save(); c.translate(elder ? 33 : -24, -195); c.rotate(.18);
      c.strokeStyle = '#c8bba1'; c.lineWidth = 1.1; c.beginPath(); c.arc(0, 0, 5, -.1, 2.3); c.stroke(); c.beginPath(); c.arc(0, 0, 5, 3.05, 5.5); c.stroke(); this.line(-4, 6, 4, -6, '#c8bba1', .9); c.restore();
      c.restore();
    }
    drawLobbyPortraits(canvas) {
      if (!canvas) return;
      const box = canvas.getBoundingClientRect(), w = Math.round(box.width), h = Math.round(box.height), dpr = Math.min(devicePixelRatio || 1, 2);
      if (w < 2 || h < 2) return;
      const key = `${w}:${h}:${dpr}`;
      if (this.lobbyPortraitCanvas === canvas && this.lobbyPortraitKey === key) return;
      this.lobbyPortraitCanvas = canvas; this.lobbyPortraitKey = key;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      const previous = this.c, c = canvas.getContext('2d'); this.c = c;
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h); c.lineCap = 'round'; c.lineJoin = 'round';
      const s = Math.min(w / 286, h / 335), cx = w / 2 - 8 * s, base = h / 2 + 137 * s;
      c.save(); c.translate(cx, base - 165 * s); c.scale(s, s);
      c.globalAlpha = .09;
      for (let i = 0; i < 7; i++) {
        c.beginPath(); c.ellipse(Math.sin(i * 3) * 3, 0, 117 + i * .7, 116 - i * 1.1, -.12, .14 + i * .03, TAU - .14); c.strokeStyle = '#75776b'; c.lineWidth = 1.1; c.stroke();
      }
      c.globalAlpha = .14;
      for (let i = 0; i < 9; i++) {
        const yy = -82 + i * 25, xx = Math.sin(i * 5) * 28;
        c.beginPath(); c.moveTo(-127, yy); c.bezierCurveTo(-65, yy - 5, -64 + xx, yy + 14, 10 + xx, yy + 4); c.bezierCurveTo(66, yy - 2, 97, yy + 7, 131, yy + 3); c.strokeStyle = '#9b9a89'; c.lineWidth = .7; c.stroke();
      }
      c.restore();
      this.portraitFigure(1, cx + 49 * s, base - 8 * s, s * 1.035);
      this.portraitFigure(0, cx - 49 * s, base + 5 * s, s);
      c.save(); c.translate(cx, base - 170 * s); c.scale(s, s); c.globalAlpha = .65;
      for (const [x, y, r] of [[-95, -114, .6], [86, -135, -.4], [-113, 31, 1.3], [110, -30, .3], [-81, 120, -.2], [40, -151, .7]]) {
        c.save(); c.translate(x, y); c.rotate(r); c.beginPath(); c.moveTo(-4, 0); c.quadraticCurveTo(0, -5, 6, -2); c.quadraticCurveTo(3, 3, -4, 0); c.fillStyle = '#c89b98'; c.fill(); c.strokeStyle = '#a7807b'; c.lineWidth = .65; c.stroke(); c.restore();
      }
      c.restore(); this.c = previous;
    }
    attackBeat(p) {
      const move = p.move;
      if (!move || !['STARTUP', 'ACTIVE'].includes(p.state)) return null;
      const st = p.st || 0, waves = move.waves || [0];
      if (p.state === 'STARTUP') return {
        index: 0, total: waves.length, preparing: true,
        progress: clamp(st / Math.max(1, move.windup * .65), 0, 1),
        until: p.holdCharged || (p.moveName === 'light' && !p.attackReleased) ? Infinity : Math.max(0, move.windup - st)
      };
      let index = 0;
      while (index + 1 < waves.length && st >= waves[index + 1]) index++;
      const elapsed = st - waves[index], next = waves[index + 1];
      const strikeTicks = Math.min(6, (next ?? move.active) - waves[index]);
      const preparing = next !== undefined && elapsed >= strikeTicks;
      return {
        index, total: waves.length, preparing,
        progress: preparing ? clamp((elapsed - strikeTicks) / Math.max(1, next - waves[index] - strikeTicks - 5), 0, 1) : clamp(elapsed / Math.max(1, strikeTicks), 0, 1),
        until: preparing ? next - st : Infinity
      };
    }
    attackCue(p, x, y, beat) {
      if (!beat || p.move.kind !== 'rift' || p.hidden) return;
      const c = this.c, ready = beat.until <= 8;
      c.save(); c.translate(x, y);
      this.path([[-64, -12], [64, -12], [68, 0], [64, 12], [-64, 12], [-68, 0]], '#243047', ready ? '#f4e6ff' : '#b795d7', 1.2);
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 12px "Noto Sans TC", sans-serif';
      c.fillStyle = '#f3e6ff'; c.fillText('裂斬 · 可招架', 0, 0);
      for (let i = 0; i < beat.total; i++) {
        const x = (i - (beat.total - 1) / 2) * 21;
        const pending = p.state === 'STARTUP' || i > beat.index;
        this.line(x - 6, 19, x + 6, 19, pending ? '#e1c4ff' : '#62647e', pending ? 3 : 2);
      }
      c.restore();
    }
    player(p, alpha) {
      const c = this.c, facing = p.facing || 1, state = p.state || 'IDLE';
      const downed = state === 'STUNNED', dead = p.dead || state === 'DEAD';
      const px = p.x + (downed ? 0 : (p.vx || 0) * alpha), py = p.y + (downed ? 0 : (p.vy || 0) * alpha);
      if (!this.visible(px)) return;
      const kind = p.move && p.move.kind || 'slash', drinking = state === 'DRINKING', reviving = state === 'REVIVING';
      const recoiling = ['HIT_STUN', 'RECOIL', 'BLADE_PINNED'].includes(state), attacking = state === 'ACTIVE', windup = state === 'STARTUP';
      const bladeCounter = (this.world.effects?.bladeCounter || 0) > 0;
      const opponent = (this.world.players || []).find(other => other.id !== p.id);
      const counterPose = bladeCounter && opponent?.move?.kind === 'thrust';
      const pinnedPose = state === 'BLADE_PINNED' || (bladeCounter && kind === 'thrust');
      const beat = this.attackBeat(p);
      const st = p.st || 0, speed = Math.abs(p.vx || 0) * 60, walking = !downed && !dead && !reviving && speed > 25 && p.ground;
      const rhythm = this.t * Math.min(17, speed * .045 + 5) + p.id;
      const bob = downed || dead ? 0 : p.ground ? walking ? Math.sin(rhythm * 2) * 1.8 : Math.sin(this.t * 2.1 + p.id) * .8 : 0;
      const main = p.id === 0 ? '#405c69' : '#817484', light = p.id === 0 ? '#7c9990' : '#b7aaae';
      const accent = p.id === 0 ? '#86bcac' : '#d3a2a2', shadow = '#243139', dark = p.id === 0 ? '#293f49' : '#56515e';
      if (p.ground) { c.globalAlpha = .28; this.ellipse(px, py + 3, downed ? 33 : 27, 5, '#091d2e'); c.globalAlpha = 1; }
      if (p.grapple) {
        this.line(px + facing * 12, py - 66, p.grapple.x, p.grapple.y, '#96e3d5', 1.7);
        this.line(px + facing * 13, py - 65, p.grapple.x + 1, p.grapple.y + 1, '#2a6578', .7);
        c.beginPath(); c.arc(p.grapple.x, p.grapple.y, 8, 0, TAU); c.strokeStyle = '#c8fff0'; c.lineWidth = 1.5; c.stroke();
      }
      if (p.charged) this.chargeArcs(px, py - 46, 53, p.id);
      if (reviving) this.revivalAura(px, py, st, p.id);
      if (p.blinkWindow > 0 || (kind === 'blink' && (attacking || windup))) {
        c.save(); c.globalCompositeOperation = 'screen';
        for (let i = 0; i < 9; i++) {
          const a = this.t * 2.3 + i * 2.4, rr = 26 + i * 3, xx = px + Math.cos(a) * rr, yy = py - 48 + Math.sin(a * 1.3) * 40;
          c.globalAlpha = .3 + i % 3 * .16;
          this.path([[xx - 7, yy + 4], [xx - 4, yy - 10], [xx + 8, yy - 5], [xx + 4, yy + 9]], i % 2 ? '#83dce7' : '#9a9fff', '#cdfcff', .8);
        }
        c.restore();
      }
      if (p.phase >= 2 && !dead && !reviving) {
        c.save(); c.globalAlpha = .14 + Math.sin(this.t * 2.6 + p.id) * .035;
        const aura = c.createRadialGradient(px, py - 43, 10, px, py - 43, 66);
        aura.addColorStop(0, accent); aura.addColorStop(1, 'rgba(79,167,185,0)');
        c.fillStyle = aura; c.fillRect(px - 70, py - 113, 140, 140); c.restore();
      }
      if (p.burn > 0) {
        c.globalAlpha = .6;
        for (let i = 0; i < 7; i++) {
          const yy = py - 4 - ((this.t * 53 + i * 21) % 78), xx = px + Math.sin(this.t * 9 + i * 4) * 15;
          this.path([[xx - 5, yy + 7], [xx - 2, yy - 5], [xx + 4, yy - 18], [xx + 4, yy + 9]], i % 2 ? '#ffd585' : '#dd662c');
        }
        c.globalAlpha = 1;
      }
      c.save(); c.translate(px, py); c.scale(facing, 1);
      if (p.hidden && !downed) { c.globalAlpha = .42; c.scale(1, .74); }
      if (dead) { c.rotate(-1.45); c.translate(23, 25); }
      if (recoiling && !downed) c.rotate(-.2 + Math.sin(st * .7) * .018);
      if (reviving) { const form = clamp(st / 60, 0, 1); c.globalAlpha = .2 + form * .8; c.rotate(-.35 * (1 - form)); }
      const lean = downed ? .14 : attacking ? .15 : windup ? -.08 : walking ? .1 : 0;
      const leg = walking ? Math.sin(rhythm) * 12 : p.ground ? 0 : 9;
      // Cloth trousers and wrapped boots keep foot contact clear in every pose.
      if (downed) {
        this.path([[-10, -30], [4, -29], [-15, -10], [-30, -8], [-29, -17]], dark, shadow, 1.5);
        this.path([[-29, -13], [-20, -10], [-8, -6], [-7, 1], [-34, 1], [-37, -4]], main, shadow, 1.5);
        this.path([[1, -29], [13, -30], [31, -20], [27, -7], [18, -8], [16, -15]], main, shadow, 1.5);
        this.path([[18, -16], [29, -16], [29, -3], [38, -1], [38, 3], [17, 3]], shadow);
        this.line(19, -14, 27, -14, light, 2);
      } else {
        this.path([[-12, -44], [2, -44], [6 + leg, -24], [-1 + leg, -9], [-11 + leg, -11], [-14 + leg * .45, -26]], dark, shadow, 1.5);
        this.path(counterPose ? [[2, -44], [16, -42], [29, -25], [35, -7], [25, -7], [15, -22]] : [[2, -44], [17, -42], [18 - leg, -25], [13 - leg, -8], [2 - leg, -9], [3 - leg, -26]], main, shadow, 1.5);
        for (const xx of [-4 + leg, counterPose ? 30 : 8 - leg]) {
          this.path([[xx - 6, -23], [xx + 6, -23], [xx + 5, -8], [xx - 4, -7]], main, shadow, 1);
          this.line(xx - 3, -20, xx + 3, -20, light, 1.5);
          this.path([[xx - 6, -8], [xx + 6, -8], [xx + 11, -2], [xx + 11, 2], [xx - 7, 2]], shadow);
          this.line(xx - 4, -3, xx + 8, -3, '#667f89', 1.5);
        }
      }
      c.save(); c.translate(lean * 30, downed ? 23 : bob);
      const tail = downed ? 0 : Math.sin(this.t * 4 + p.id) * 3 + (walking ? 5 : 0);
      if (p.id === 0) {
        // A loose shoulder mantle: fabric, a visible human face, and tied hair.
        this.path([[-12, -74], [1, -70], [-7, -42], [-24 - tail, -32], [-35 - tail, -44], [-26, -69]], '#293e49', shadow, 1.2);
        this.path([[-21, -65], [-10, -68], [-16 - tail, -43], [-28 - tail, -42]], '#49636b');
        this.line(-23, -60, -27 - tail, -43, '#8da298', .8);
      } else {
        this.path([[-16, -58], [13, -56], [26 + tail * .35, -15], [12, -17], [1, -29], [-5, -14], [-24, -19]], main, shadow, 1.4);
        this.path([[-13, -55], [-4, -50], [-8, -19], [-20, -23]], '#a39da1');
        this.path([[5, -50], [14, -54], [22, -20], [11, -23]], '#968895');
        this.line(12, -43, 17, -23, '#c0b4b5', .8);
      }
      this.path([[-14, -74], [0, -77], [17, -65], [12, -44], [-12, -44], [-18, -59]], main, shadow, 1.5);
      this.path([[-6, -76], [1, -70], [8, -73], [12, -66], [-3, -49], [-11, -53]], light, shadow, .7);
      this.path([[-5, -74], [0, -69], [-1, -63], [-9, -70]], '#d3c4a9');
      this.path([[8, -74], [13, -68], [-7, -45], [-12, -49]], dark, shadow, .65);
      this.line(10, -68, -7, -49, '#a3b1a4', .8);
      this.path([[-14, -50], [12, -52], [13, -41], [-13, -41]], p.id === 0 ? '#56766c' : '#635d64', shadow, 1);
      this.line(-11, -48, 10, -49, '#c1c0a1', .7);
      this.line(-11, -44, 11, -46, shadow, 1);
      this.path([[5, -46], [11, -48], [19 + tail, -26], [13 + tail, -28]], dark, shadow, .7);
      this.path([[-17, -70], [-9, -73], [-7, -64], [-19, -57], [-23, -62]], main, shadow, 1);
      this.line(-16, -68, -19, -61, light, 1);
      this.humanHead(0, -88, p.id === 1, .65, downed ? .17 : recoiling ? -.13 : .02);
      let handX = 23, handY = -48, swordAngle = -.48;
      if (windup || beat?.preparing) {
        const prog = beat?.progress ?? clamp(st / 18, 0, 1);
        if (kind === 'thrust') { handX = -9; handY = -56; swordAngle = -.04; }
        else if (kind === 'sweep') { handX = -16; handY = -31; swordAngle = -2.78; }
        else { handX = lerp(18, -8, prog); handY = lerp(-49, -89, prog); swordAngle = lerp(-.5, -2.25, prog); }
      } else if (attacking) {
        // Each collision wave needs its own release pose; one long animation hid
        // the second and third contacts even though the simulation emitted them.
        const prog = beat?.progress ?? clamp(st / 5, 0, 1);
        handX = 27; handY = -58 + prog * 25; swordAngle = -.8 + prog * 1.65;
        if (kind === 'thrust') { handX = 43; handY = -55; swordAngle = -.02; }
        if (kind === 'sweep') { handX = 30; handY = -19; swordAngle = .04; }
      } else if (state === 'RECOVERY') { handX = 25; handY = -31; swordAngle = .7; }
      else if (state === 'GUARD' || state === 'DEFLECT' || p.guard) { handX = 19; handY = -51; swordAngle = -1.27; }
      else if (reviving) { handX = 12; handY = -30; swordAngle = .43; }
      else if (recoiling) { handX = 5; handY = -39; swordAngle = -1.8; }
      else if (state === 'GRAPPLING') { handX = 16; handY = -80; swordAngle = -2.2; }
      else if (!p.ground) { handX = 22; handY = -61; swordAngle = -.7; }
      if (pinnedPose) { handX = 25; handY = -9; swordAngle = -.025; }
      if (drinking) { const lift = clamp(st / 14, 0, 1); handX = lerp(18, 21, lift); handY = lerp(-44, -68, lift); }
      if (downed) { handX = 22; handY = -46; swordAngle = .32; }
      // Two ordinary hands remain visible beneath loose cloth sleeves.
      this.line(-8, -66, handX * .5 - 9, handY + 6, shadow, 11);
      this.line(-8, -66, handX * .5 - 9, handY + 6, dark, 8);
      this.line(handX * .5 - 9, handY + 6, handX - 7, handY + 2, main, 6);
      this.line(10, -65, handX * .53 + 8, handY + 12, shadow, 12);
      this.line(10, -65, handX * .53 + 8, handY + 12, main, 9.5);
      this.line(11, -64, handX * .5 + 7, handY + 10, light, 1.2);
      this.line(handX * .53 + 8, handY + 12, handX + 1, handY, dark, 7);
      this.line(handX * .53 + 8, handY + 10, handX + 1, handY + 1, light, 1);
      this.ellipse(handX, handY, 4, 4, shadow);
      this.ellipse(handX + .4, handY - .4, 3.1, 3.1, p.id === 0 ? '#dcc1a0' : '#c9ad95');
      if (drinking) this.tonic(handX + 6, handY - 7, clamp(st / 14, 0, 1));
      else if (kind === 'hammer' && (windup || attacking || state === 'RECOVERY')) this.hammer(handX, handY, swordAngle);
      else this.sword(handX, handY, swordAngle, p.fireBlade > 0, p.charged, kind === 'rift' && (windup || attacking));
      if (beat?.until <= 8 && !p.hidden && ['slash', 'cleave', 'rift', 'hammer'].includes(kind)) {
        // Read the combat clock, never wall time: hitstop must freeze this cue
        // along with the approaching strike, including gaps between combo hits.
        const x = handX + Math.cos(swordAngle) * 65, y = handY + Math.sin(swordAngle) * 65;
        const size = 4 + (8 - beat.until) * .8;
        c.save(); c.globalAlpha = .55 + (8 - beat.until) * .055;
        this.path([[x - size, y], [x - 2, y - 2], [x, y - size], [x + 2, y - 2], [x + size, y], [x + 2, y + 2], [x, y + size], [x - 2, y + 2]], '#fff8dc');
        c.restore();
      }
      if (p.aegis && !drinking && !dead && !reviving && !downed) this.aegis(26, -61, state === 'DEFLECT');
      if (p.charge > 15 && !downed) {
        const r = 8 + Math.min(16, p.charge * .3);
        c.globalAlpha = .7; const g = c.createRadialGradient(handX, handY, 0, handX, handY, r * 2);
        g.addColorStop(0, '#fff9d8'); g.addColorStop(.14, '#c5f4df'); g.addColorStop(1, 'rgba(93,217,210,0)');
        c.fillStyle = g; c.fillRect(handX - r * 2, handY - r * 2, r * 4, r * 4); c.globalAlpha = 1;
      }
      c.restore(); c.restore();
      if (windup && ['thrust', 'sweep', 'lightning'].includes(kind)) this.danger(px, py - (p.hidden ? 96 : 135), kind, st);
      this.attackCue(p, px, py - 151, beat);
      if (p.posture >= (p.maxPosture || 100) * .86 && !dead && !downed) {
        c.globalAlpha = .6 + Math.sin(this.t * 15) * .2; this.line(px - 16, py - 119, px + 16, py - 119, '#df647b', 2); c.globalAlpha = 1;
      }
      if (downed && !dead) {
        c.save(); c.translate(px, py - 101); c.globalAlpha = .8 + Math.sin(this.t * 7) * .2;
        this.path([[-43, -14], [34, -14], [44, 0], [34, 14], [-34, 14], [-44, 0]], '#132c40', '#e58e91', 1.2);
        c.fillStyle = '#ffe8d1'; c.font = 'bold 15px "Noto Sans TC", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('可斷決', 0, 0);
        this.path([[-4, 20], [4, 20], [0, 26]], '#f4b8a9'); c.restore();
      }
    }
    tonic(x, y, lift) {
      const c = this.c;
      c.save(); c.translate(x, y); c.rotate(-lift * .75);
      this.path([[-6, -11], [5, -11], [7, -7], [7, 11], [4, 14], [-5, 14], [-7, 10], [-7, -7]], '#263f51', '#86b6b8', 1.2);
      c.fillStyle = '#79ddbb'; c.fillRect(-4, -6, 8, 15);
      c.fillStyle = '#b6fbe1'; c.fillRect(-3, -5, 2, 12);
      this.line(-6, -11, 5, -11, '#d5ded0', 3); this.line(-5, 12, 5, 12, '#8ea9ac', 3);
      this.line(-1, -15, 2, -15, '#b4c9c6', 3); c.restore();
    }
    revivalAura(x, y, st, seed) {
      const c = this.c, form = clamp(st / 90, 0, 1);
      c.save();
      const g = c.createRadialGradient(x, y - 40, 5, x, y - 40, 115);
      g.addColorStop(0, `rgba(100,229,214,${.1 + form * .15})`); g.addColorStop(1, 'rgba(34,80,100,0)');
      c.fillStyle = g; c.fillRect(x - 120, y - 160, 240, 240);
      c.strokeStyle = '#94e8d7'; c.lineWidth = 1.3; c.globalAlpha = .65;
      c.beginPath(); c.ellipse(x, y + 1, 34 + Math.sin(this.t * 4) * 5, 6, 0, 0, TAU); c.stroke();
      for (let i = 0; i < 18; i++) {
        const a = i * 2.39 + this.t * .7 + seed, radius = 16 + ((i * 17 + (1 - form) * 100) % 65);
        const px = x + Math.cos(a) * radius, py = y - ((i * 23 + this.t * 34) % 150), size = 2 + i % 4;
        c.globalAlpha = .2 + i % 4 * .14;
        this.path([[px - size, py + size], [px - size * .6, py - size], [px + size, py - size], [px + size * .6, py + size]], i % 3 ? '#7ad0cc' : '#dcffee');
      }
      c.restore();
    }
    sword(x, y, angle, fire, charged, rift) {
      const c = this.c;
      c.save(); c.translate(x, y); c.rotate(angle);
      this.line(-15, 0, 0, 0, '#203a4b', 6);
      this.line(-13, -2, -2, -2, '#8ea7ad', 1.4);
      this.path([[-2, -8], [3, -9], [6, -5], [5, 8], [1, 9], [-2, 5]], '#948268', '#28343c', 1);
      if (fire || charged || rift) {
        c.shadowBlur = 17; c.shadowColor = rift ? '#ba75e8' : charged ? '#81f1f4' : '#ffb05b';
        this.line(7, 0, 66, 0, rift ? '#cf87ff' : charged ? '#c3ffff' : '#ffe08c', 7); c.shadowBlur = 0;
      }
      this.path([[5, -3], [61, -2.7], [73, 0], [60, 3], [5, 3]], rift ? '#2d2444' : '#bbc9c5', '#283b46', .85);
      this.path([[8, 0], [69, 0], [60, 2.1], [8, 2.1]], rift ? '#b87fed' : '#eff3db');
      this.line(10, -2, 55, -2, charged ? '#76e6ed' : '#4c8d9c', 1.2);
      for (const xx of [-12, -8, -4]) this.line(xx, -2.5, xx + 2, 2.5, '#b8ad94', .8);
      if (fire) {
        c.globalAlpha = .85;
        for (let i = 0; i < 6; i++) {
          const xx = 6 + i * 10, wav = Math.sin(this.t * 18 + i * 3) * 5;
          this.path([[xx, -4], [xx + 3, -13 - wav], [xx + 9, -19 - wav], [xx + 8, -6]], i % 2 ? '#ffe598' : '#e99449');
        }
        c.globalAlpha = 1;
      }
      c.restore();
    }
    hammer(x, y, angle) {
      const c = this.c; c.save(); c.translate(x, y); c.rotate(angle);
      this.line(-15, 0, 61, 0, '#253c50', 7); this.line(-10, -2, 60, -2, '#a9c3c5', 2);
      this.path([[48, -22], [75, -22], [83, -15], [83, 18], [76, 25], [48, 25], [43, 18], [43, -16]], '#506d7e', '#152c40', 2);
      this.path([[73, -22], [83, -15], [83, 18], [75, 25], [72, 15], [72, -13]], '#ced7cc');
      this.path([[49, -15], [65, -15], [65, 17], [49, 17]], '#2a455b');
      this.line(52, -9, 61, -9, '#83ecd4', 3); this.line(52, 1, 61, 1, '#83ecd4', 3); this.line(52, 11, 61, 11, '#83ecd4', 3);
      c.restore();
    }
    aegis(x, y, active) {
      const c = this.c; c.save(); c.translate(x, y); c.rotate(this.t * (active ? 7 : 1.5));
      this.ellipse(0, 0, 39, 39, '#173b51');
      c.beginPath(); c.arc(0, 0, 40, 0, TAU); c.strokeStyle = active ? '#bfffee' : '#629dba'; c.lineWidth = active ? 4 : 2.5; c.stroke();
      for (let i = 0; i < 6; i++) {
        c.save(); c.rotate(i * TAU / 6);
        this.path([[17, -9], [31, -15], [40, -8], [39, 6], [30, 12], [21, 6]], '#637d91', '#b4d3ce', 1.2);
        this.line(27, -5, 35, -5, '#79e0d1', 2.5); c.restore();
      }
      this.ellipse(0, 0, 15, 15, '#263f58');
      this.path([[-5, -9], [7, -7], [10, 4], [0, 10], [-9, 2]], '#b8eada');
      this.ellipse(0, 0, 5, 5, '#397082');
      c.restore();
    }
    danger(x, y, kind, st) {
      const c = this.c, color = kind === 'thrust' ? '#ef7a89' : kind === 'sweep' ? '#edbc75' : '#89e5e6';
      c.save(); c.translate(x, y); const scale = 1 + Math.max(0, 8 - st) * .025; c.scale(scale, scale);
      this.path([[0, -22], [22, 12], [13, 19], [-13, 19], [-22, 12]], '#173145', color, 2);
      if (kind === 'thrust') { this.path([[-3, 11], [-3, -2], [-9, -2], [0, -12], [9, -2], [3, -2], [3, 11]], color); }
      else if (kind === 'sweep') { this.line(-11, 8, 11, 8, color, 4); this.path([[7, 1], [15, 8], [7, 15]], color); }
      else this.path([[2, -14], [-8, 1], [-1, 1], [-5, 13], [9, -4], [2, -4]], color);
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = color; c.font = 'bold 10px "Noto Sans TC", sans-serif';
      c.fillText(kind === 'thrust' ? '突' : kind === 'sweep' ? '掃' : '電', 0, 31); c.restore();
    }
    chargeArcs(x, y, radius, seed) {
      const c = this.c;
      c.save(); c.globalCompositeOperation = 'screen'; c.strokeStyle = '#d4f5eb'; c.lineWidth = 1.4; c.shadowBlur = 10; c.shadowColor = '#8ee3ed';
      for (let j = 0; j < 3; j++) {
        c.beginPath();
        for (let i = 0; i < 7; i++) {
          const a = i * .33 + this.t * 8 + j * 2.1 + seed;
          const r = radius * (.64 + Math.sin(i * 32 + this.t * 35) * .2);
          const xx = x + Math.cos(a) * r, yy = y + Math.sin(a) * r;
          i ? c.lineTo(xx, yy) : c.moveTo(xx, yy);
        }
        c.stroke();
      }
      c.restore();
    }
    slashes(slashes) {
      const c = this.c;
      for (const s of slashes) {
        if (!this.visible(s.x, s.reach || 160)) continue;
        const life = clamp((s.life || 0) / (s.maxLife || 12), 0, 1), r = s.reach || 100;
        const kind = s.kind || 'slash';
        c.save(); c.translate(s.x, s.y); c.scale(s.facing || 1, 1); c.globalAlpha = life;
        if (kind === 'disc') {
          c.rotate(this.t * 28); this.discShape(11, false); c.restore(); continue;
        }
        if (kind === 'flame') {
          const g = c.createLinearGradient(0, 0, r, 0); g.addColorStop(0, '#fff4bb'); g.addColorStop(.4, '#ed963e'); g.addColorStop(1, 'rgba(148,39,20,0)');
          c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(r * .5, -53, r, -29); c.lineTo(r * .8, 0); c.lineTo(r, 35); c.quadraticCurveTo(r * .4, 43, 0, 0); c.fill(); c.restore(); continue;
        }
        if (kind === 'lightning') { this.chargeArcs(r * .45, 0, r * .5, 1); }
        if (kind === 'rift') {
          // Leave both silhouettes visible; successive waves cross in opposite
          // directions instead of accumulating an opaque wall over the defender.
          const tilt = (s.wave || 0) % 2 ? .17 : -.17;
          c.globalAlpha = life * .27; c.strokeStyle = '#8561b8'; c.lineWidth = 19;
          c.beginPath(); c.ellipse(r * .33, -5, r * .68, 34, tilt, -.9, 1.1); c.stroke();
          c.globalAlpha = life * .8; c.strokeStyle = '#b994e4'; c.lineWidth = 5;
          c.beginPath(); c.ellipse(r * .33, -5, r * .7, 35, tilt, -.9, 1.1); c.stroke();
          c.globalAlpha = life; c.strokeStyle = '#f0e2ff'; c.lineWidth = 1.8;
          c.beginPath(); c.ellipse(r * .33, -5, r * .7, 36, tilt, -.9, 1.1); c.stroke();
        } else {
          const color = s.color || '#fff3c7';
          const start = kind === 'sweep' ? -.17 : kind === 'thrust' ? -.12 : -1.08;
          const end = kind === 'sweep' ? .85 : kind === 'thrust' ? .12 : .83;
          if (kind === 'thrust') {
            this.path([[0, -4], [r + 8, 0], [0, 4]], color);
            this.line(r * .22, 0, r, 0, '#fff8db', 2);
          } else {
            c.globalAlpha = life * .17; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, start, end); c.closePath(); c.fillStyle = color; c.fill();
            for (let j = 0; j < 3; j++) {
              c.globalAlpha = life * (j ? .24 : .9); c.strokeStyle = color; c.lineWidth = j ? 2 : 5;
              c.beginPath(); c.ellipse(0, 0, r - j * 11, (r - j * 11) * .72, -.13, start + j * .08, end - j * .09); c.stroke();
            }
            c.globalAlpha = life; c.strokeStyle = '#fffbe3'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(0, 0, r + 1, r * .72, -.13, start + .1, end - .1); c.stroke();
          }
        }
        c.restore();
      }
    }
    projectiles(projectiles) {
      const c = this.c;
      for (const p of projectiles) {
        if (!this.visible(p.x, 30)) continue;
        c.save(); c.translate(p.x, p.y); c.globalAlpha = .34;
        this.line(0, 0, -(p.vx || 0) * 3, 0, p.reflected ? '#ffe2a0' : '#83e8db', 2);
        c.globalAlpha = 1; c.rotate(this.t * 31 * Math.sign(p.vx || 1));
        this.discShape(12, p.reflected); c.restore();
      }
    }
    discShape(radius, reflected) {
      const c = this.c;
      c.beginPath(); c.arc(0, 0, radius * .66, 0, TAU); c.strokeStyle = reflected ? '#ffd07e' : '#82d9d1'; c.lineWidth = 3; c.stroke();
      for (let i = 0; i < 4; i++) {
        c.save(); c.rotate(i * Math.PI / 2);
        this.path([[radius * .45, -radius * .35], [radius * .95, -radius * .25], [radius, radius * .18], [radius * .7, radius * .51], [radius * .39, radius * .26]], '#ccdfd4', '#345771', .8);
        c.restore();
      }
      this.ellipse(0, 0, radius * .23, radius * .23, '#1c425b');
    }
    parry(fx) {
      const c = this.c, life = clamp(fx.parry / (fx.parryMax || 18), 0, 1), age = 1 - life;
      const players = this.world.players || [], a = players[0], b = players[1] || a;
      const x = Number.isFinite(fx.parryX) ? fx.parryX : a ? (a.x + b.x) / 2 : 2000;
      const y = Number.isFinite(fx.parryY) ? fx.parryY : a ? (a.y + b.y) / 2 - 55 : 700;
      const punch = Math.pow(life, 1.65), radius = 30 + age * 116;
      c.save(); c.translate(x, y);
      // The impact darkens only the contact region, framing a brilliant white core.
      const contrast = c.createRadialGradient(0, 0, 13, 0, 0, 156);
      contrast.addColorStop(0, `rgba(8,21,38,${punch * .38})`);
      contrast.addColorStop(.42, `rgba(7,26,43,${punch * .23})`); contrast.addColorStop(1, 'rgba(7,26,43,0)');
      c.fillStyle = contrast; c.fillRect(-160, -160, 320, 320);
      c.globalCompositeOperation = 'screen';
      const halo = c.createRadialGradient(0, 0, 0, 0, 0, 90 + age * 30);
      halo.addColorStop(0, `rgba(255,255,235,${punch * .95})`); halo.addColorStop(.18, `rgba(255,206,98,${punch * .62})`);
      halo.addColorStop(.55, `rgba(63,221,214,${punch * .16})`); halo.addColorStop(1, 'rgba(68,220,210,0)');
      c.fillStyle = halo; c.fillRect(-130, -130, 260, 260);
      c.globalAlpha = life * .88; c.strokeStyle = '#f7c66e'; c.lineWidth = 2 + punch * 6;
      c.beginPath(); c.arc(0, 0, radius, 0, TAU); c.stroke();
      c.globalAlpha = life * .7; c.strokeStyle = '#78ece0'; c.lineWidth = 1.5 + punch * 2;
      c.beginPath(); c.arc(0, 0, radius * 1.24 + 10, -.34, Math.PI * 1.3); c.stroke();
      c.beginPath(); c.arc(0, 0, radius * .72, Math.PI * .55, Math.PI * 1.96); c.stroke();
      for (let i = 0; i < 18; i++) {
        const angle = i * TAU / 18 + .14 + Math.sin(i * 9) * .09;
        const near = radius * (.55 + i % 3 * .13), far = near + (31 + i % 5 * 9) * life;
        c.globalAlpha = life * (.5 + (i % 3) * .16);
        this.line(Math.cos(angle) * near, Math.sin(angle) * near, Math.cos(angle) * far, Math.sin(angle) * far, i % 3 ? '#f8d78a' : '#90ffec', 1 + punch * (i % 2 ? 2 : 1));
      }
      c.globalAlpha = punch;
      c.rotate(-.23);
      const span = 54 + punch * 91, stem = 7 + punch * 7;
      this.path([[-span, 0], [-stem, -4], [0, -span * .72], [stem, -4], [span, 0], [stem, 4], [0, span * .72], [-stem, 4]], '#ffd287');
      this.path([[-span * .8, 0], [-5, -2], [0, -span * .56], [5, -2], [span * .8, 0], [5, 2], [0, span * .56], [-5, 2]], '#ffffff');
      c.rotate(.79); c.globalAlpha = punch * .8;
      this.path([[-span * .46, 0], [-4, -2], [0, -span * .33], [4, -2], [span * .46, 0], [4, 2], [0, span * .33], [-4, 2]], '#a3fff0');
      this.ellipse(0, 0, 6 + punch * 7, 6 + punch * 7, '#ffffff');
      c.restore();
    }
    effectRings(rings) {
      const c = this.c;
      for (const r of rings) {
        const a = clamp((r.life || 0) / (r.maxLife || 20), 0, 1);
        c.globalAlpha = a;
        c.strokeStyle = r.color || '#f4d194'; c.lineWidth = 1 + a * 3;
        c.beginPath(); c.arc(r.x, r.y, r.r || 25, 0, TAU); c.stroke();
        c.globalAlpha = a * .3; c.lineWidth = 1; c.beginPath(); c.arc(r.x, r.y, (r.r || 25) * 1.13, 0, TAU); c.stroke();
      }
      c.globalAlpha = 1;
    }
    particles(particles) {
      const c = this.c;
      for (const p of particles) {
        if (!this.visible(p.x)) continue;
        const a = clamp((p.life || 0) / (p.maxLife || 25), 0, 1), r = p.size || 2;
        c.globalAlpha = a;
        if (p.type === 'spark') {
          c.globalCompositeOperation = 'screen';
          this.line(p.x, p.y, p.x - (p.vx || 0) * 1.2, p.y - (p.vy || 0) * 1.2, p.color || '#ffe3a0', r);
          this.ellipse(p.x, p.y, r * .5, r * .5, '#fff5d9');
          c.globalCompositeOperation = 'source-over';
        } else if (p.type === 'smoke') {
          c.globalAlpha = a * .58;
          if (['#6c687c', '#3e354d', '#77dbea', '#8bcde9'].includes(p.color)) {
            c.save(); c.translate(p.x, p.y); c.rotate(p.x * .1 + this.t);
            this.path([[-r, r], [-r * .5, -r * 1.6], [r, -r], [r * .6, r]], '#8ddbea', '#c9fcf1', .6); c.restore();
          } else this.ellipse(p.x, p.y, r * (2 - a), r * (1.3 - a * .3), p.color || '#2a4255');
        } else if (p.type === 'leaf') {
          c.save(); c.translate(p.x, p.y); c.rotate(this.t * 5 + p.x); this.path([[-r, 0], [0, -r * .6], [r * 1.5, 0], [0, r * .6]], p.color || '#b76543'); c.restore();
        } else this.ellipse(p.x, p.y, r, r * .7, p.color || '#a34839');
      }
      c.globalAlpha = 1;
    }
    lightning(entries) {
      const c = this.c;
      for (const l of entries) {
        const y = l.y == null ? 1080 : l.y, life = l.life || 1;
        if (l.warning) {
          c.save(); c.globalAlpha = .5 + Math.sin(this.t * 11) * .18;
          c.strokeStyle = '#d5e7b8'; c.lineWidth = 1.5;
          c.beginPath(); c.ellipse(l.x, y, 82, 13, 0, 0, TAU); c.stroke();
          c.beginPath(); c.ellipse(l.x, y, 52, 8, 0, 0, TAU); c.stroke();
          const glow = c.createLinearGradient(l.x, y - 180, l.x, y);
          glow.addColorStop(0, 'rgba(201,230,197,0)'); glow.addColorStop(1, 'rgba(201,230,197,.1)');
          c.fillStyle = glow; c.fillRect(l.x - 80, y - 180, 160, 180);
          c.fillStyle = '#e4ebc6'; c.font = '15px serif'; c.textAlign = 'center'; c.fillText('電', l.x, y - 150);
          c.restore(); continue;
        }
        c.save(); c.globalAlpha = clamp(life / 15, 0, 1); c.globalCompositeOperation = 'screen';
        const rng = rand(Math.floor(l.x * 37) + Math.floor(this.t * 10));
        const points = [];
        for (let yy = y - 900; yy < y; yy += 43) points.push([l.x + (rng() - .5) * 62, yy]);
        points.push([l.x, y]);
        c.shadowBlur = 25; c.shadowColor = '#a8dde9'; this.path(points, null, '#a0d5e5', 8);
        c.shadowBlur = 0; this.path(points, null, '#f0fbdf', 2.5);
        this.ellipse(l.x, y, 55, 6, '#bdebd8');
        c.restore();
      }
    }
    atmosphere() {
      const c = this.c, w = this.w, h = this.h;
      if (this.storm) {
        c.strokeStyle = '#c9ded2'; c.lineWidth = .8;
        for (const r of this.rain) {
          const x = ((r.x * w - this.t * (180 + r.z * 80)) % (w + 80) + w + 80) % (w + 80) - 40;
          const y = (r.y * h + this.t * (480 + r.z * 400)) % (h + 90) - 45;
          c.globalAlpha = .1 + r.z * .18; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 10 - r.z * 8, y + 20 + r.z * 15); c.stroke();
        }
        c.globalAlpha = 1;
      } else {
        for (const m of this.motes) {
          const x = ((m.x * w + this.t * 14 * m.speed) % (w + 60)) - 30;
          const y = ((m.y * h + this.t * (3 + m.speed * 5)) % (h + 40)) - 20;
          c.save(); c.translate(x + Math.sin(this.t * .7 + m.phase) * 17, y); c.rotate(this.t * m.speed + m.phase); c.globalAlpha = .35 + m.speed * .18;
          this.path([[-m.size * 2, 0], [0, -m.size], [m.size * 2, 0], [0, m.size]], m.phase > 3 ? '#67b7bc' : '#d9e1c2'); c.restore();
        }
      }
      // Fine stationary atmospheric grain softens the mineral haze.
      c.fillStyle = this.grainPattern; c.fillRect(0, 0, w, h);
      c.globalAlpha = 1;
    }
    vignette() {
      const c = this.c, w = this.w, h = this.h;
      const g = c.createRadialGradient(w * .5, h * .47, Math.min(w, h) * .24, w * .5, h * .48, Math.max(w, h) * .68);
      g.addColorStop(0, 'rgba(14,29,26,0)'); g.addColorStop(.65, 'rgba(14,29,26,.03)'); g.addColorStop(1, this.storm ? 'rgba(5,17,23,.58)' : 'rgba(33,38,27,.26)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    }
    edgeIndicators(players) {
      const c = this.c, cam = this.camera;
      for (const p of players) {
        const xx = (p.x - cam.x) * cam.zoom + this.w / 2;
        if (xx > 24 && xx < this.w - 24) continue;
        const x = xx < 24 ? 21 : this.w - 21, direction = xx < 24 ? -1 : 1;
        const y = clamp((p.y - cam.y - 55) * cam.zoom + this.h / 2, 120, this.h - 85);
        c.save(); c.translate(x, y); c.scale(direction, 1);
        this.path([[7, 0], [-4, -8], [-4, 8]], p.id === 0 ? '#7ad9d2' : '#edbdc1'); c.restore();
        c.fillStyle = '#e4debd'; c.font = '10px sans-serif'; c.textAlign = 'center'; c.fillText(`P${p.id + 1}`, x, y + 23);
      }
    }
    impactPost(fx) {
      const c = this.ctx, strength = clamp((fx.chromatic || 0) / 12, 0, 1), w = this.w, h = this.h;
      c.save();
      // Reprojecting the scene about its center creates a short radial shutter blur.
      c.globalAlpha = strength * .08;
      for (let i = 1; i < 4; i++) {
        const s = 1 + i * .009 * strength; c.drawImage(this.buffer, -w * (s - 1) / 2, -h * (s - 1) / 2, w * s, h * s);
      }
      c.globalCompositeOperation = 'screen'; c.globalAlpha = strength * .09;
      c.filter = 'sepia(1) saturate(8) hue-rotate(315deg)'; c.drawImage(this.buffer, 3 * strength, 0, w, h);
      c.filter = 'sepia(1) saturate(5) hue-rotate(125deg)'; c.drawImage(this.buffer, -3 * strength, 0, w, h);
      c.restore();
    }
    execution(fx) {
      const c = this.ctx, w = this.w, h = this.h, r = Math.min(w * .22, h * .24);
      c.save(); c.fillStyle = 'rgba(7,18,31,.86)'; c.fillRect(0, 0, w, h * .09); c.fillRect(0, h * .91, w, h * .09);
      c.translate(w * .5, h * .43);
      const opacity = clamp(fx.execution / 18, 0, 1); c.globalAlpha = opacity;
      this.path([[-r * 1.38, -r * .36], [-r * .92, -r * .66], [r * 1.14, -r * .66], [r * 1.38, -r * .36], [r * 1.14, r * .56], [-r * 1.14, r * .56]], '#102d44', '#92d9cd', 1);
      c.rotate(-.34);
      this.path([[-r * 1.55, -4], [-r * .24, -12], [r * 1.52, -3], [r * .19, 12], [-r * 1.55, 5]], '#f2d3ab');
      this.line(-r * 1.45, 0, r * 1.45, 0, '#ffffff', 2); c.rotate(.34);
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = '#061c30'; c.shadowBlur = 12;
      c.font = `800 ${Math.min(96, r * .64)}px "Noto Sans TC", sans-serif`; c.fillStyle = '#e2f0df'; c.fillText('斷 決', 0, -2);
      c.shadowBlur = 0; c.font = '11px sans-serif'; c.fillStyle = '#80d8cd'; c.fillText('R I F T   S E V E R E D', 0, r * .82);
      c.restore();
    }
    revival(fx) {
      const c = this.ctx, w = this.w, h = this.h, opacity = clamp(fx.revival / 24, 0, 1), size = Math.min(69, w * .13, h * .13);
      c.save(); c.globalAlpha = opacity; c.translate(w * .5, h * .37);
      this.path([[-size * 1.55, -size * .53], [-size * 1.3, -size * .78], [size * 1.3, -size * .78], [size * 1.55, -size * .53], [size * 1.3, size * .65], [-size * 1.3, size * .65]], '#17344b', '#77cfc6', 1);
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${size}px "Noto Sans TC", sans-serif`;
      c.shadowBlur = 18; c.shadowColor = '#4ea9b2'; c.fillStyle = '#ddfff0'; c.fillText('復 燃', 0, 0); c.shadowBlur = 0;
      c.fillStyle = '#92d8d1'; c.font = '10px sans-serif'; c.fillText('E C H O   R E S T O R E D', 0, size * 1.03);
      c.restore();
    }
    bladeCounter(fx) {
      const c = this.ctx, w = this.w, h = this.h;
      c.save(); c.globalAlpha = clamp(fx.bladeCounter / 20, 0, .9); c.translate(w * .5, h * .25);
      this.path([[-69, -24], [59, -24], [73, 0], [59, 18], [-59, 18], [-73, 0]], '#173247', '#78d5d0', 1.3);
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 24px "Noto Sans TC", sans-serif'; c.fillStyle = '#d6eee0'; c.fillText('踏刃', 0, -2); c.restore();
    }
  }
  window.RiftRenderer = RiftRenderer;
})();
