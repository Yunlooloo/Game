'use strict';
// Exercise the real simulation and contact resolver: timings are measured in
// combat ticks, while hitstop still consumes calls to step(). No synthetic hits
// are used for the multi-beat defense or attack-to-guard scenarios.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const make = require('./helpers/engine.cjs');
const {REPORTS} = require('./helpers/paths.cjs');
const rows = [];
function test(name, fn) {
  try { fn(); rows.push({name, passed: true}); console.log('PASS ' + name); }
  catch (error) { rows.push({name, passed: false, error: error.message}); console.error('FAIL ' + name + ': ' + error.message); }
}
function setup(mode = 'ai') {
  const h = make({tutorial: false}), g = h.game;
  g.start(mode); g.world.weather = 'dusk'; g.paused = true;
  const [p, boss] = g.world.players;
  Object.assign(p, {x:1800, y:1080, ground:true, facing:1, loadout:['disc','flame']});
  Object.assign(boss, {x:1890, y:1080, ground:true, facing:-1, phase:3, loadout:['disc','flame']});
  return {...h, g, p, boss, B:g.debug.bits};
}
function until(g, condition, bits = 0, max = 300) {
  for (let n = 0; n < max; n++) {
    if (condition()) return;
    g.step([bits, 0]);
  }
  assert.ok(condition(), 'simulation did not reach the expected state');
}
function nextBeat(attacker) {
  if (attacker.state === 'STARTUP') return attacker.move.windup - attacker.st;
  if (attacker.state !== 'ACTIVE') return Infinity;
  const next = attacker.move.waves?.find(t => t > attacker.st);
  return next === undefined ? Infinity : next - attacker.st;
}
function defendSequence(key, {hold = false, early = false, mode = 'ai'} = {}) {
  const h = setup(mode), {g,p,boss,B} = h;
  assert.equal(g.begin(boss,key),true);
  const contacts = [], originalHit = g.hit.bind(g);
  g.hit = (a,t,m,options) => {
    const outcome = originalHit(a,t,m,options);
    if (t.id === p.id) contacts.push({outcome,tick:g.world.tick,hp:p.hp,spam:p.guardSpam,state:a.state});
    return outcome;
  };
  let holding = early;
  for (let n = 0; n < 240 && ['STARTUP','ACTIVE'].includes(boss.state); n++) {
    // A six-tick lead is deliberate: humans can learn the same cue each beat,
    // rather than needing a one-tick input or knowing the collision result.
    const tap = !g.world.effects.hitstop && nextBeat(boss) === 6;
    if (hold && tap) holding = true;
    g.step([(holding || tap) ? B.GUARD : 0, 0]);
  }
  return {...h,contacts};
}

test('Three Boss beats can all be deflected without a shrinking successful rhythm', () => {
  const {p,boss,contacts,g} = defendSequence('triple');
  assert.deepEqual(contacts.map(c=>c.outcome), ['deflect','deflect','deflect']);
  assert.ok(contacts.every(c=>c.hp===100 && c.spam===0));
  assert.deepEqual(contacts.slice(0,2).map(c=>c.state), ['ACTIVE','ACTIVE']);
  assert.equal(boss.state,'RECOIL');
  assert.equal(p.hp,100); assert.equal(p.posture,0); assert.equal(g.stats.deflects,3);
  assert.ok(boss.posture>60, 'successful defense should meaningfully pressure Boss posture');
});
test('Holding after the first deflect blocks the next beats instead of granting free perfects', () => {
  const {p,contacts} = defendSequence('triple',{hold:true});
  assert.deepEqual(contacts.map(c=>c.outcome), ['deflect','guard','guard']);
  assert.equal(p.hp,100); assert.ok(p.posture>0);
});
test('A player multi-wave attack is still interrupted by the first successful deflect', () => {
  const {boss,contacts}=defendSequence('triple',{mode:'local'});
  assert.deepEqual(contacts.map(c=>c.outcome),['deflect']);assert.equal(boss.state,'RECOIL');
});
test('A Boss chain stops immediately when an early deflect breaks its posture', () => {
  const {g,p,boss,B}=setup();boss.hp=100;boss.posture=215;
  assert.equal(g.begin(boss,'triple'),true);
  until(g,()=>nextBeat(boss)===6);g.step([B.GUARD,0]);
  until(g,()=>g.stats.deflects===1);
  assert.equal(boss.state,'STUNNED');assert.equal(boss.posture,220);assert.equal(boss.nodes,3);
  for(let n=0;n<60;n++)g.step([0,0]);
  assert.equal(p.hp,100);assert.equal(g.stats.deflects,1);
});
test('Purple double slash has two readable, separately deflectable beats', () => {
  const {p,contacts,boss} = defendSequence('rift');
  assert.deepEqual(contacts.map(c=>c.outcome), ['deflect','deflect']);
  assert.equal(contacts[1].tick-contacts[0].tick,24);
  assert.equal(p.hp,100); assert.equal(boss.state,'RECOIL');
});
test('An early held guard safely blocks both purple waves without hidden HP chip', () => {
  const {p,contacts} = defendSequence('rift',{hold:true,early:true});
  assert.deepEqual(contacts.map(c=>c.outcome), ['guard','guard']);
  assert.equal(p.hp,100); assert.ok(p.posture>0);
});
test('Repeated empty guard presses retain a twelve-tick floor', () => {
  const {g,p,boss,B} = setup('local'); boss.x=3000;
  const windows=[];
  for(let n=0;n<6;n++) {g.step([B.GUARD,0]);windows.push(p.deflectWindow);g.step([0,0]);}
  assert.deepEqual(windows,[16,14,12,12,12,12]);
});
test('A successful parry clears prior empty-press debt for the following beat', () => {
  const {g,p,boss,B} = setup();
  g.begin(boss,'triple');
  until(g,()=>nextBeat(boss)===8);
  for(let n=0;n<3;n++) {g.step([B.GUARD,0]);g.step([0,0]);}
  assert.equal(p.guardSpam,2);
  until(g,()=>g.stats.deflects===1);
  assert.equal(p.guardSpam,0); assert.equal(p.deflect,0);
  // A new press during hitstop must survive until the next simulation tick.
  const frozenTick=g.world.tick;
  g.step([0,0]);g.step([B.GUARD,0]);g.step([0,0]);
  assert.equal(g.world.tick,frozenTick);
  until(g,()=>g.world.tick>frozenTick);
  assert.equal(p.deflectWindow,16);assert.ok(p.deflect>0);assert.equal(p.guardSpam,0);
});
test('A light slash can transition to guard after six recovery ticks, without a confirmed hit', () => {
  const {g,p,boss,B}=setup('local');boss.x=3000;
  g.step([B.ATTACK,0]);until(g,()=>p.state==='RECOVERY');
  while(p.state==='RECOVERY'&&p.st<5)g.step([0,0]);
  g.step([B.GUARD,0]);
  assert.equal(p.state,'RECOVERY','guard must not interrupt the protected first six recovery ticks');
  g.step([B.GUARD,0]);
  assert.equal(p.state,'DEFLECT');assert.ok(p.deflect>0);assert.equal(p.move,null);
});
test('An early guard press cannot cancel attack startup, active frames or drinking', () => {
  const {g,p,boss,B}=setup('local');boss.x=3000;
  g.step([B.ATTACK,0]);g.step([B.GUARD,0]);
  assert.equal(p.state,'STARTUP');assert.equal(p.guard,false);
  until(g,()=>p.state==='ACTIVE');g.step([B.GUARD,0]);
  assert.equal(p.state,'ACTIVE');assert.equal(p.guard,false);
  until(g,()=>p.state==='IDLE');p.hp=50;g.step([B.HEAL,0]);g.step([B.GUARD,0]);
  assert.equal(p.state,'DRINKING');assert.equal(p.guard,false);assert.equal(p.hp,50);
});
test('A late hit-stun guard tap is applied on the first legal recovery tick', () => {
  const {g,p,boss,B}=setup('local');boss.x=3000;
  g.transition(p,'HIT_STUN',{interrupt:true,frames:10});
  for(let n=0;n<4;n++)g.step([0,0]);
  g.step([B.GUARD,0]);
  until(g,()=>p.state!=='HIT_STUN');
  assert.equal(p.state,'DEFLECT');assert.ok(p.deflect>0);
});
test('Holding guard through a long hit-stun blocks immediately when the lock ends', () => {
  const {g,p,boss,B}=setup('local');boss.x=3000;
  g.transition(p,'HIT_STUN',{interrupt:true,frames:18});
  g.step([B.GUARD,0]);
  until(g,()=>p.state!=='HIT_STUN',B.GUARD);
  assert.equal(p.guard,true);assert.equal(p.state,'GUARD');assert.equal(p.deflect,0);
});
test('The gap between purple waves has no invisible lingering hitbox', () => {
  const {g,p,boss}=setup();p.x=2600;
  assert.equal(g.begin(boss,'rift'),true);
  until(g,()=>boss.state==='ACTIVE'&&boss.st===8);
  p.x=boss.x-90;
  for(let n=0;n<10;n++)g.step([0,0]);
  assert.equal(p.hp,100,'entering reach between the six-frame contacts must be safe');
  until(g,()=>p.hp<100);
  assert.equal(p.hp,81,'the next visible wave still damages an undefended player');
});
test('Boss stats and normalized HUD do not leak into local two-player matches', () => {
  const {g,p,boss,elements}=setup();
  assert.equal(p.hp,100);assert.equal(p.maxHp,100);assert.equal(p.nodes,2);
  assert.equal(boss.hp,240);assert.equal(boss.maxHp,240);assert.equal(boss.maxPosture,220);assert.equal(boss.nodes,3);
  boss.hp=120;boss.posture=110;g.renderHUD();
  assert.equal(elements.get('hp-1').style.width,'50%');assert.equal(elements.get('posture-1').style.width,'50%');
  g.start('local');assert.ok(g.world.players.every(a=>a.hp===100&&a.maxHp===100&&a.maxPosture===100&&a.nodes===2));
});
test('Boss light attacks keep their readable startup across all phases while player speed stays intact', () => {
  for(const phase of [1,2,3]) {
    const {g,p,boss}=setup();boss.phase=phase;boss.x=3000;
    assert.equal(g.begin(p,'light'),true);assert.equal(g.begin(boss,'light'),true);
    assert.equal(p.move.windup,18);assert.ok(boss.move.windup>=26);
    const startup=boss.move.windup;
    for(let n=0;n<18;n++)g.step([0,0]);
    assert.equal(p.state,'ACTIVE');assert.equal(boss.state,'STARTUP');
    for(let n=18;n<startup;n++)g.step([0,0]);
    assert.equal(boss.state,'ACTIVE');
  }
});
test('Boss loses three distinct cores with full-capacity revivals before victory', () => {
  const {g,p,boss,B}=setup();
  for(let node=2;node>=0;node--) {
    Object.assign(p,{x:1800,y:1080,ground:true,facing:1});
    Object.assign(boss,{x:1880,y:1080,ground:true,facing:-1,invuln:0});
    g.debug.vitals.down(boss);g.world.effects.hitstop=0;
    g.step([B.ATTACK,0]);
    assert.equal(boss.nodes,node);
    if(node) {
      assert.equal(boss.hp,240);assert.equal(boss.posture,0);assert.equal(boss.phase,4-node);
      assert.equal(g.world.phase,'fighting');g.world.effects.hitstop=0;
      for(let n=0;n<90;n++)g.step([0,0]);
    } else {
      assert.equal(boss.state,'DEAD');assert.equal(g.world.phase,'ended');assert.equal(g.world.winner,0);
    }
  }
});
test('Real AI charged attacks expose a truthful cue before both parryable waves', () => {
  const h=setup(),{g,p,boss,B}=h;
  h.run(fs.readFileSync(path.join(__dirname,'../src/render.js'),'utf8'));
  const beatFor=h.scope.RiftRenderer.prototype.attackBeat;
  boss.loadout=[];boss.tonics=0;
  g.ai.patternPhase=3;g.ai.pattern={steps:['charged'],index:0};g.ai.nextAttack=0;
  const cues=[],contacts=[],original=g.hit.bind(g),seen=new Set();
  g.hit=(a,t,m,opt)=>{const result=original(a,t,m,opt);if(t.id===0)contacts.push(result);return result;};
  for(let i=0;i<260&&contacts.length<2;i++){
    const frozen=g.world.effects.hitstop>0;
    const bossBits=frozen?boss.prevBits:g.ai.input(g.world,boss,p);
    const beat=beatFor.call({},boss),key=`${boss.attackId}:${boss.state}:${beat?.index}`;
    const tap=!frozen&&beat?.until===8&&!seen.has(key);
    if(tap){seen.add(key);cues.push(boss.moveName);}
    g.step([tap?B.GUARD:0,bossBits]);
  }
  assert.deepEqual(cues,['charged','charged']);
  assert.deepEqual(contacts,['deflect','deflect']);assert.equal(p.hp,100);
});
test('Hitstop freezes AI decisions and world ticks together', () => {
  const {g}=setup();g.paused=false;g.lastTime=0;g.acc=0;
  let calls=0;const input=g.ai.input.bind(g.ai);g.ai.input=(...args)=>{calls++;return input(...args);};
  g.world.effects.hitstop=8;
  for(let n=1;n<=8;n++)g.frame(n*1000/60);
  assert.equal(calls,0);assert.equal(g.world.tick,0);
  g.frame(9*1000/60);assert.equal(calls,1);assert.equal(g.world.tick,1);
});
fs.writeFileSync(path.join(REPORTS,'combat-rhythm.json'),JSON.stringify({scope:'Production simulation; DOM/audio/render adapters only',checks:rows},null,2));
if(rows.some(row=>!row.passed))process.exitCode=1;
