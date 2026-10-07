'use strict';
// Input goes through the production fixed-step simulation and collision resolver.
// Initial actor poses isolate timing, range and action-lock regressions.
const test = require('node:test');
const assert = require('node:assert/strict');
const make = require('./helpers/engine.cjs');

function setup(mode = 'local') {
  const h = make({tutorial:false}), g = h.game;
  g.start(mode); g.world.weather = 'dusk'; g.paused = true;
  const [p, enemy] = g.world.players;
  Object.assign(p, {x:1800,y:1080,ground:true,facing:1,loadout:['disc','flame']});
  Object.assign(enemy, {x:1890,y:1080,ground:true,facing:-1,loadout:['disc','flame']});
  return {...h,g,p,enemy,B:g.debug.bits};
}
function until(g, condition, inputs = [0,0], max = 300) {
  for (let n = 0; n < max && !condition(); n++) g.step(inputs);
  assert.ok(condition(), 'simulation did not reach the expected state');
}
function steps(g, count, inputs = [0,0]) {
  for (let n = 0; n < count; n++) g.step(inputs);
}
function watchContacts(g, attackerId = 0) {
  const contacts = [], hit = g.hit.bind(g);
  g.hit = (a,t,m,options) => {
    const beforePosture = a.posture;
    const outcome = hit(a,t,m,options);
    if (a.id === attackerId) contacts.push({outcome,kind:m.kind,tick:g.world.tick,
      postureRelief:beforePosture-a.posture});
    return outcome;
  };
  return contacts;
}
function airborne(p, enemy, dx = 150, height = 110) {
  Object.assign(p, {x:enemy.x-dx,y:enemy.y-height,ground:false,vx:0,vy:0});
}

test('holding and releasing attack produces one ordinary charged thrust contact', () => {
  const {g,p,enemy,B} = setup(), contacts = watchContacts(g);
  steps(g,48,[B.ATTACK,0]);
  assert.equal(p.moveName,'charged'); assert.equal(p.state,'STARTUP');
  assert.equal(contacts.length,0, 'holding must not release a hidden first strike');
  assert.equal(p.move.kind,'pierce'); assert.equal(p.move.breakGuard,undefined);
  g.step([0,0]);
  until(g,()=>p.state==='IDLE');
  assert.deepEqual(contacts.map(c=>c.outcome),['hit']);
  assert.equal(enemy.hp,82); assert.equal(p.wave,0);
});

test('an early held guard blocks the charged thrust without breaking posture', () => {
  const {g,p,enemy,B} = setup(), contacts = watchContacts(g);
  steps(g,48,[B.ATTACK,B.GUARD]); g.step([0,B.GUARD]);
  until(g,()=>p.state==='IDLE',[0,B.GUARD]);
  assert.deepEqual(contacts.map(c=>c.outcome),['guard']);
  assert.equal(enemy.hp,100);
  assert.ok(enemy.posture>0 && enemy.posture<enemy.maxPosture);
  assert.notEqual(enemy.state,'STUNNED');
});

test('a fresh guard press deflects the charged thrust as a normal attack', () => {
  const {g,p,enemy,B} = setup(), contacts = watchContacts(g);
  steps(g,48,[B.ATTACK,0]); g.step([0,B.GUARD]);
  assert.deepEqual(contacts.map(c=>c.outcome),['deflect']);
  assert.equal(enemy.hp,100); assert.equal(p.state,'RECOIL');
  assert.equal(g.stats.deflects,1); assert.equal(g.stats.bladeCounter,0);
});

test('tapping attack still performs an ordinary light slash', () => {
  const {g,p,enemy,B} = setup(), contacts = watchContacts(g);
  g.step([B.ATTACK,0]); g.step([0,0]);
  assert.equal(p.moveName,'light');
  until(g,()=>p.state==='IDLE');
  assert.deepEqual(contacts.map(c=>c.outcome),['hit']); assert.equal(enemy.hp,90);
});

test('the explicit thrust and sweep remain perilous against a fresh guard', () => {
  for (const key of ['thrust','sweep']) {
    const {g,p,enemy,B} = setup(), contacts = watchContacts(g);
    assert.equal(g.begin(p,key),true);
    until(g,()=>p.state==='STARTUP' && p.move.windup-p.st===6);
    g.step([0,B.GUARD]); until(g,()=>contacts.length>0,[0,B.GUARD]);
    assert.equal(contacts[0].outcome,'hit',key+' must not become ordinarily parryable');
    assert.ok(enemy.hp<100); assert.equal(g.stats.deflects,0);
  }
});

test('the explicit perilous thrust still allows a forward dash blade counter', () => {
  const {g,p,enemy,B} = setup(), contacts = watchContacts(g);
  assert.equal(g.begin(p,'thrust'),true);
  until(g,()=>p.state==='STARTUP' && p.move.windup-p.st===4);
  g.step([0,B.DASH|B.LEFT]); until(g,()=>contacts.length>0);
  assert.equal(contacts[0].outcome,'bladeCounter');
  assert.equal(enemy.hp,100); assert.equal(g.stats.bladeCounter,1);
});

test('the separate double-slash art keeps both hits and posture recovery per hit', () => {
  const {g,p,enemy,B} = setup(), contacts = watchContacts(g);
  p.art='cleave'; p.hp=40; p.posture=90;
  g.step([B.ART,0]); until(g,()=>p.state==='IDLE');
  assert.deepEqual(contacts.map(c=>c.outcome),['hit','hit']);
  assert.deepEqual(contacts.map(c=>c.postureRelief),[50,40]);
  assert.equal(enemy.hp,70); assert.equal(p.posture,0);
});

test('airborne jump counters a sweep beyond the former narrow horizontal range', () => {
  const {g,p,enemy,B} = setup(); airborne(p,enemy,160);
  assert.equal(g.begin(enemy,'sweep'),true); g.step([B.JUMP,0]);
  assert.equal(g.stats.stomps,1); assert.equal(enemy.state,'RECOIL');
  assert.equal(enemy.posture,30); assert.equal(p.hp,100); assert.ok(p.vy<0);
  assert.ok(Math.abs(p.x-enemy.x)<80, 'the visible bounce should reach the opponent');
});

test('a stomp applies the Boss posture percentage through the shared counter path', () => {
  const {g,p,enemy,B} = setup('ai'); airborne(p,enemy,160);
  assert.equal(g.begin(enemy,'sweep'),true); g.step([B.JUMP,0]);
  assert.equal(g.stats.stomps,1); assert.equal(enemy.posture,66);
  assert.equal(enemy.state,'RECOIL'); assert.equal(enemy.nodes,3);
});

test('a fresh airborne jump can counter the end of the sweep recovery grace window', () => {
  const {g,p,enemy,B} = setup(); p.x=3000;
  assert.equal(g.begin(enemy,'sweep'),true);
  until(g,()=>enemy.state==='RECOVERY' && enemy.st===18);
  airborne(p,enemy,150); g.step([B.JUMP,0]);
  assert.equal(g.stats.stomps,1); assert.equal(enemy.state,'RECOIL');
});

test('a sweep no longer accepts a stomp after the recovery grace window', () => {
  const {g,p,enemy,B} = setup(); p.x=3000;
  assert.equal(g.begin(enemy,'sweep'),true);
  until(g,()=>enemy.state==='RECOVERY' && enemy.st===19);
  airborne(p,enemy,150); g.step([B.JUMP,0]);
  assert.equal(g.stats.stomps,0); assert.equal(enemy.posture,0);
});

test('a slightly early airborne press buffers until movement brings the sweep in range', () => {
  const {g,p,enemy,B} = setup(); airborne(p,enemy,194,130);
  assert.equal(g.begin(enemy,'sweep'),true); g.step([B.JUMP|B.RIGHT,0]);
  assert.equal(g.stats.stomps,0);
  until(g,()=>g.stats.stomps===1,[B.RIGHT,0],10);
  assert.equal(enemy.state,'RECOIL'); assert.equal(p.hp,100);
});

test('an early second jump buffers while rising into the valid height', () => {
  const {g,p,enemy,B} = setup(); airborne(p,enemy,150,10); p.vy=-7;
  assert.equal(g.begin(enemy,'sweep'),true); g.step([B.JUMP,0]);
  assert.equal(g.stats.stomps,0);
  until(g,()=>g.stats.stomps===1,[0,0],8);
  assert.equal(enemy.state,'RECOIL'); assert.ok(p.vy<0);
});

test('an expired airborne press does not become a later automatic stomp', () => {
  const {g,p,enemy,B} = setup(); airborne(p,enemy,250,150);
  assert.equal(g.begin(enemy,'sweep'),true); g.step([B.JUMP|B.RIGHT,0]);
  steps(g,15,[B.RIGHT,0]);
  assert.ok(Math.abs(p.x-enemy.x)<170); assert.equal(g.stats.stomps,0);
  g.step([B.JUMP,0]); assert.equal(g.stats.stomps,1);
});

test('hitstop preserves an airborne stomp buffer without advancing its combat timer', () => {
  const {g,p,enemy,B} = setup(); airborne(p,enemy,185,130);
  assert.equal(g.begin(enemy,'sweep'),true); g.step([B.JUMP|B.RIGHT,0]);
  const tick=g.world.tick; g.world.effects.hitstop=20;
  steps(g,20,[B.RIGHT,0]); assert.equal(g.world.tick,tick);
  assert.equal(g.stats.stomps,0);
  until(g,()=>g.stats.stomps===1,[B.RIGHT,0],8);
  assert.equal(enemy.state,'RECOIL');
});

test('stomp assistance does not reach distant opponents or non-sweep attacks', () => {
  for (const {key,dx,height} of [
    {key:'sweep',dx:171,height:110},
    {key:'sweep',dx:150,height:245},
    {key:'light',dx:100,height:110},
    {key:'thrust',dx:100,height:110},
  ]) {
    const {g,p,enemy,B}=setup(); airborne(p,enemy,dx,height);
    assert.equal(g.begin(enemy,key),true); g.step([B.JUMP,0]);
    assert.equal(g.stats.stomps,0,JSON.stringify({key,dx,height}));
    assert.equal(enemy.posture,0);
  }
});

test('jump cannot turn an attack commitment or drinking into a stomp cancel', () => {
  for (const state of ['STARTUP','ACTIVE','RECOVERY','DRINKING']) {
    const {g,p,enemy,B}=setup(); enemy.x=3000;
    if (state==='DRINKING') {p.hp=50; g.step([B.HEAL,0]);}
    else {
      g.step([B.ATTACK,0]); g.step([0,0]);
      until(g,()=>p.state===state);
    }
    enemy.x=1890; airborne(p,enemy,150);
    assert.equal(g.begin(enemy,'sweep'),true); g.step([B.JUMP,0]);
    assert.equal(g.stats.stomps,0,state+' must keep its action lock');
    assert.equal(p.state,state); assert.notEqual(enemy.state,'RECOIL');
  }
});

test('a fresh attack cancels a pending airborne stomp request', () => {
  const {g,p,enemy,B}=setup(); airborne(p,enemy,195,130);
  assert.equal(g.begin(enemy,'sweep'),true); g.step([B.JUMP,0]);
  g.step([B.ATTACK,0]); assert.equal(p.state,'STARTUP');
  p.x=enemy.x-150; steps(g,5);
  assert.equal(g.stats.stomps,0); assert.equal(p.moveName,'air');
});

test('repeated airborne jump presses cannot counter the same sweep twice', () => {
  const {g,p,enemy,B}=setup(); airborne(p,enemy,150);
  assert.equal(g.begin(enemy,'sweep'),true); g.step([B.JUMP,0]);
  assert.equal(g.stats.stomps,1);
  for (let n=0;n<8;n++) {g.step([0,0]);g.step([B.JUMP,0]);}
  assert.equal(g.stats.stomps,1); assert.equal(enemy.posture,30);
});

test('a normal first jump followed by another press counters an approaching sweep', () => {
  const {g,p,enemy,B}=setup(); p.x=enemy.x-160;
  assert.equal(g.begin(enemy,'sweep'),true);
  g.step([B.JUMP,0]); assert.equal(p.ground,false); assert.equal(g.stats.stomps,0);
  g.step([0,0]); g.step([B.JUMP,0]);
  assert.equal(g.stats.stomps,1); assert.equal(enemy.state,'RECOIL');
});

test('a confirmed recovery keeps its existing jump-cancel route into a stomp', () => {
  const {g,p,enemy,B}=setup(); enemy.x=3000;
  g.step([B.ATTACK,0]); g.step([0,0]); until(g,()=>p.state==='RECOVERY');
  p.confirm=20; enemy.x=1890; airborne(p,enemy,150);
  assert.equal(g.begin(enemy,'sweep'),true); g.step([B.JUMP,0]);
  assert.equal(g.stats.stomps,1); assert.equal(p.move,null);
  assert.equal(enemy.state,'RECOIL');
});

test('jump exits a fresh guard window before performing the airborne counter', () => {
  const {g,p,enemy,B}=setup(); airborne(p,enemy,150);
  assert.equal(g.begin(enemy,'sweep'),true); g.step([B.GUARD,0]);
  assert.equal(p.state,'DEFLECT'); assert.ok(p.deflect>0);
  g.step([B.JUMP,0]);
  assert.equal(g.stats.stomps,1); assert.equal(p.deflect,0); assert.equal(p.guard,false);
});

test('the stomp input remains valid on its twelfth combat tick and expires on the thirteenth', () => {
  for (const {tick,expected} of [{tick:12,expected:1},{tick:13,expected:0}]) {
    const {g,p,enemy,B}=setup(); airborne(p,enemy,250,150);
    assert.equal(g.begin(enemy,'sweep'),true); g.step([B.JUMP,0]);
    steps(g,tick-2); p.x=enemy.x-150; g.step([0,0]);
    assert.equal(g.stats.stomps,expected,'buffer age '+tick);
  }
});

test('stomp assistance cannot cross a platform separating the two fighters', () => {
  const {g,p,enemy,B}=setup();
  // The real platform spans x1130..1550 at y920, between both feet.
  enemy.x=1400; airborne(p,enemy,100,220);
  assert.equal(g.begin(enemy,'sweep'),true); g.step([B.JUMP,0]);
  assert.equal(g.stats.stomps,0); assert.equal(enemy.posture,0);
  assert.ok(p.x<enemy.x-90, 'a blocked assistance must not move through the floor');
});

test('landing does not permit a replayed sweep attack ID to award another counter', () => {
  const {g,p,enemy,B}=setup(); airborne(p,enemy,150);
  assert.equal(g.begin(enemy,'sweep'),true); const attackId=enemy.attackId;
  g.step([B.JUMP,0]); assert.equal(g.stats.stomps,1);
  until(g,()=>p.ground && enemy.state==='IDLE');
  assert.equal(g.begin(enemy,'sweep'),true);
  enemy.attackId=attackId; // Model a late replay of the already countered intent.
  airborne(p,enemy,150); g.step([B.JUMP,0]);
  assert.equal(g.stats.stomps,1); assert.equal(enemy.state,'STARTUP');
});

test('after landing a new sweep can be countered normally', () => {
  const {g,p,enemy,B}=setup(); airborne(p,enemy,150);
  assert.equal(g.begin(enemy,'sweep'),true); const attackId=enemy.attackId;
  g.step([B.JUMP,0]); assert.equal(g.stats.stomps,1);
  until(g,()=>p.ground && enemy.state==='IDLE');
  assert.equal(g.begin(enemy,'sweep'),true); assert.notEqual(enemy.attackId,attackId);
  airborne(p,enemy,150); g.step([B.JUMP,0]); assert.equal(g.stats.stomps,2);
});

test('only the owning online defender awards an assisted stomp and its result applies once', () => {
  // Two production simulations exchange queued authority packets; this exercises
  // ownership and replay safety without claiming a real WebRTC connection.
  for (const defenderId of [0,1]) {
    const attackerId=1-defenderId;
    function endpoint(localId) {
      const h=setup(),{g,scope}=h,sent=[];
      g.mode='online'; g.localId=localId;
      g.net={role:localId?'guest':'host',connected:true,clockOffsetMs:0,
        sendCombat(packet) {sent.push(structuredClone(packet)); return true;}};
      g.authority=new scope.RiftAuthority(g,g.net);
      Object.assign(g.world.players[attackerId],{x:1800,y:1080,ground:true,facing:-1});
      Object.assign(g.world.players[defenderId],{x:1640,y:970,ground:false,vy:0,facing:1});
      return {g,sent};
    }
    const attackEnd=endpoint(attackerId),defenseEnd=endpoint(defenderId);
    const attacker=attackEnd.g.world.players[attackerId];
    assert.equal(attackEnd.g.begin(attacker,'sweep'),true);
    const intent=attackEnd.sent.find(p=>p.type==='ATTACK_START');
    assert.ok(intent); assert.equal(defenseEnd.g.authority.onPacket(intent),true);

    const inputs=[0,0]; inputs[defenderId]=attackEnd.g.debug.bits.JUMP;
    attackEnd.g.step(inputs);
    assert.equal(attacker.posture,0,'attacker must not adjudicate the remote jump');
    assert.equal(attackEnd.g.stats.stomps,0);
    assert.equal(attackEnd.sent.filter(p=>p.type==='DEFENSE_SUCCESS').length,0);

    defenseEnd.g.step(inputs);
    assert.equal(defenseEnd.g.stats.stomps,1);
    const results=defenseEnd.sent.filter(p=>p.type==='DEFENSE_SUCCESS');
    assert.equal(results.length,1);
    const result=results[0];
    assert.equal(result.counterType,'STOMP');
    assert.equal(result.sourceId,attackerId); assert.equal(result.targetId,defenderId);
    assert.equal(result.contactId,intent.attackId+':stomp');
    assert.equal(result.postureDamageToAttacker,30);
    assert.equal(attacker.posture,0,'remote confirmation has not arrived yet');
    assert.equal(attackEnd.g.authority.onPacket(result),true);
    assert.equal(attacker.posture,30); assert.equal(attacker.state,'RECOIL');
    assert.equal(attacker.lockFrames,35);
    assert.equal(attackEnd.g.authority.onPacket(result),false);
    assert.equal(attackEnd.g.authority.onPacket({...result,resultId:'replayed-stomp'}),false);
    assert.equal(attacker.posture,30,'result and contact replay must not award more posture');
    assert.equal(defenseEnd.g.world.players[defenderId].hp,100);
  }
});
