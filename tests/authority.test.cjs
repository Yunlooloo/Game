'use strict';
const {SRC, REPORTS} = require('./helpers/paths.cjs');
// Run through python3 scripts/test.py; transport clocks and connections are simulated.
// Actual authority and transport source in separate VMs, with deterministic clocks.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=SRC,checks=[],clone=x=>JSON.parse(JSON.stringify(x));
const source=fs.readFileSync(path.join(root,'authority.js'),'utf8');
function check(name,run){try{run();checks.push({name,passed:true});}catch(error){checks.push({name,passed:false,error:error.stack});}}
function h(role='host',options={}){
  let now=options.now??1000000;
  const calls={attack:[],release:[],result:[],state:[],heal:[],round:[]};
  const localId=role==='host'?0:1;
  const players=[0,1].map(id=>({id,x:300+id*100,y:500,hp:100,posture:0,facing:id?-1:1,
    state:'IDLE',prevBits:0,attackReleased:true,spirit:20,nodes:3,ground:true,tonics:5}));
  const game={world:{players,round:1,tick:123},moves:{light:{},thrust:{},sweep:{},charged:{}},
    receiveAttack:(p,f)=>calls.attack.push({packet:clone(p),frames:f}),
    receiveAttackRelease:(p,f)=>calls.release.push({packet:clone(p),frames:f}),
    receiveCombatResult:p=>calls.result.push(clone(p)),
    receivePlayerState:p=>calls.state.push(clone(p)),
    receiveHeal:p=>calls.heal.push(clone(p)),onRoundPacket:p=>calls.round.push(clone(p))};
  const net={role,connected:true,clockOffsetMs:0,combatHistory:[],sent:[],fail:false,
    sendCombat(p){if(this.fail)return false;const payload=clone(p);this.sent.push(payload);
      this.combatHistory.push({payload,seq:this.sent.length,time:now});return true;}};
  class Clock extends Date {static now(){return now;}}
  const context={Date:Clock,Math,console};context.window=context;
  if(options.states)context.RIFT={STATES:options.states};
  vm.runInNewContext(source,context,{filename:'authority.js'});
  return {authority:new context.RiftAuthority(game,net),game,net,calls,local:players[localId],
    remote:players[1-localId],now:()=>now,advance:ms=>{now+=ms;},last:()=>net.sent.at(-1)};
}
function intent(o,p={}){return {type:'ATTACK_START',attackType:'light',moveName:'light',attackId:'remote-attack',
  playerId:o.authority.remoteId,startTick:50,timestamp:o.now(),round:1,x:400,y:500,facing:-1,held:false,...p};}
function begin(o){const id=o.authority.beginAttack(o.local,'light');assert.equal(typeof id,'string');return id;}
function result(o,id,p={}){return {type:'HIT_CONFIRMED',attackId:id,sourceId:o.local.id,targetId:o.remote.id,
  resultId:'result-1',contactId:id+':0',timestamp:o.now(),round:1,outcome:'HIT',result:'HIT',damage:12,
  postureDamage:7,attackerPostureDelta:0,targetHP:88,targetPosture:7,cancelAttack:false,...p};}
function state(o,p={}){return {type:'PLAYER_STATE',playerId:o.remote.id,seq:1,timestamp:o.now(),round:1,tick:10,
  state:{id:o.remote.id,x:450,y:500,hp:90,posture:25,facing:-1,state:'IDLE'},...p};}
function control(o,type,p={}){return {type,playerId:o.remote.id,timestamp:o.now(),round:1,requestId:'death-1',
  sourceId:o.remote.id,targetId:o.local.id,x:400,y:500,...p};}
function remote(o){o.authority.onPacket(intent(o));o.remote.attackId='remote-attack';return o;}
check('local owner, IDs, disconnected and unknown moves',()=>{
  for(const role of ['host','guest']){
    const o=h(role),id=begin(o);assert.equal(o.local.attackId,id);assert.equal(o.last().playerId,o.local.id);
    assert.equal(o.authority.beginAttack(o.remote,'light'),null);
    assert.equal(o.authority.beginAttack(o.local,'unknown'),null);
    o.net.connected=false;assert.equal(o.authority.beginAttack(o.local,'light'),null);
  }
});
check('failed send leaves no attack record',()=>{const o=h();o.net.fail=true;assert.equal(o.authority.beginAttack(o.local,'light'),null);assert.equal(o.authority.attacks.size,0);});
check('held explicit and default light input semantics',()=>{
  const o=h();o.local.prevBits=16;o.local.attackReleased=false;begin(o);assert.equal(o.last().held,true);
  o.authority.beginAttack(o.local,'light',{held:false});assert.equal(o.last().held,false);
  o.local.attackReleased=true;o.authority.beginAttack(o.local,'light',{held:true});assert.equal(o.last().held,true);
  o.authority.beginAttack(o.local,'light');assert.equal(o.last().held,false);
  o.local.attackReleased=false;o.authority.beginAttack(o.local,'thrust');assert.equal(o.last().held,false);
});
check('release keeps existing ID and enforces owner',()=>{
  const o=h(),id=begin(o);assert.equal(o.authority.releaseAttack(o.local),true);assert.equal(o.last().attackId,id);
  assert.equal(o.authority.attacks.size,1);assert.equal(o.authority.releaseAttack(o.remote),false);
  o.local.attackId='missing';assert.equal(o.authority.releaseAttack(o.local),false);
});
check('remote intent sanitization and deduplication',()=>{
  const o=h(),p=intent(o,{held:true,forged:99});assert.equal(o.authority.onPacket(p),true);
  assert.equal(o.calls.attack[0].packet.held,true);assert.equal(o.calls.attack[0].packet.forged,undefined);
  assert.equal(o.authority.onPacket(p),false);assert.equal(o.calls.attack.length,1);assert.equal(o.authority.metrics.duplicates,1);
});
check('intent rejects spoofed ownership and malformed values',()=>{
  for(const p of [{playerId:0},{round:2},{attackId:''},{attackType:'unknown',moveName:'unknown'},
    {moveName:'thrust'},{held:1},{startTick:-1},{x:Infinity},{y:1601},{facing:0},{timestamp:NaN},{timestamp:-1}]){
    const o=h();assert.equal(o.authority.onPacket(intent(o,p)),false,JSON.stringify(p));assert.equal(o.calls.attack.length,0);
  }
});
for(const [age,offset,frames] of [[150,0,9],[200,0,12],[-100,0,0],[2000,0,30],[100,50,9],[200,-50,9]]){
  check('time warp '+age+'ms offset '+offset+'ms -> '+frames+' frames',()=>{
    const o=h();o.net.clockOffsetMs=offset;assert.equal(o.authority.onPacket(intent(o,{timestamp:o.now()-age})),true);
    assert.equal(o.calls.attack[0].frames,frames);assert.equal(o.authority.metrics.maxWarpFrames,frames);
    assert.equal(o.authority.metrics.lateIntents,age+offset>200?1:0);
  });
}
check('incoming release enforces owner, known ID, and idempotence',()=>{
  const o=remote(h()),p={type:'ATTACK_RELEASE',playerId:1,attackId:'remote-attack',round:1,timestamp:o.now()-150};
  assert.equal(o.authority.onPacket({...p,playerId:0}),false);assert.equal(o.authority.onPacket({...p,attackId:'unknown'}),false);
  assert.equal(o.authority.onPacket(p),true);assert.equal(o.calls.release[0].frames,9);
  assert.equal(o.authority.onPacket(p),false);assert.equal(o.calls.release.length,1);
});
check('only local defender can confirm owned remote attack',()=>{
  const o=remote(h());for(const method of ['confirmHit','confirmDefense']){
    const outcome=method==='confirmHit'?'HIT':'PARRIED';
    assert.equal(o.authority[method](o.local,o.remote,{},outcome,{}),false);
    assert.equal(o.authority[method](o.remote,o.remote,{},outcome,{}),false);
    assert.equal(o.authority[method](o.remote,o.local,{},'INVALID',{}),false);
    assert.equal(o.authority[method](o.remote,o.local,{attackId:'unknown'},outcome,{}),false);
  }assert.equal(o.net.sent.length,0);
});
check('all allowed hit outcomes preserve source and defender health',()=>{
  for(const outcome of ['HIT','BLOCKED','DODGED','CAUGHT_LIGHTNING','BLINK']){
    const o=remote(h());o.local.hp=82;o.local.posture=9;
    assert.equal(o.authority.confirmHit(o.remote,o.local,{wave:0},outcome,{damage:18,postureDamage:9}),true);
    const p=o.last();assert.equal(p.sourceId,1);assert.equal(p.targetId,0);assert.equal(p.outcome,outcome);
    assert.equal(p.targetHP,82);assert.equal(p.targetPosture,9);
  }
});
check('PARRIED/BLADE_PIN/STOMP default counter cancellation is RECOIL/18',()=>{
  for(const counter of ['PARRIED','BLADE_PIN','STOMP']){
    const o=remote(h());assert.equal(o.authority.confirmDefense(o.remote,o.local,{},counter,15),true);
    const p=o.last();assert.equal(p.counterType,counter);assert.equal(p.postureDamageToAttacker,15);
    assert.equal(p.cancelAttack,true);assert.equal(p.attackerState,'RECOIL');assert.equal(p.attackerStun,18);
  }
});
check('sender rejects conflicting hit after defense for same contact',()=>{
  const o=remote(h());assert.equal(o.authority.confirmDefense(o.remote,o.local,{wave:0},'PARRIED',10),true);
  assert.equal(o.authority.confirmHit(o.remote,o.local,{wave:0},'HIT',{damage:99}),false);assert.equal(o.net.sent.length,1);
});
check('sender bounds contacts to 8',()=>{
  const o=remote(h());for(let i=0;i<8;i++)assert.equal(o.authority.confirmHit(o.remote,o.local,{wave:i},'HIT',{damage:1}),true);
  assert.equal(o.authority.confirmHit(o.remote,o.local,{},'HIT',{contactId:'remote-attack:8',damage:1}),false);assert.equal(o.net.sent.length,8);
});
check('failed send permits retry for same contact',()=>{
  const o=remote(h());o.net.fail=true;assert.equal(o.authority.confirmHit(o.remote,o.local,{},'HIT',{damage:1}),false);
  o.net.fail=false;assert.equal(o.authority.confirmHit(o.remote,o.local,{},'HIT',{damage:1}),true);
});
check('result owner, known attack, contact and bounds validation',()=>{
  for(const p of [{sourceId:1},{targetId:0},{attackId:'unknown'},{round:2},{resultId:''},{contactId:'other:0'},
    {damage:101},{postureDamage:-1},{attackerPostureDelta:1},{targetHP:-1},{targetPosture:NaN},
    {cancelAttack:1},{outcome:'INVALID'},{timestamp:Infinity}]){
    const o=h(),id=begin(o);assert.equal(o.authority.onPacket(result(o,id,p)),false,JSON.stringify(p));assert.equal(o.calls.result.length,0);
  }
});
check('result ID and contact ID each prevent conflicting effects',()=>{
  const o=h(),id=begin(o),p=result(o,id);assert.equal(o.authority.onPacket(p),true);
  assert.equal(o.authority.onPacket({...p,contactId:id+':1'}),false);
  assert.equal(o.authority.onPacket({...p,resultId:'new',outcome:'DODGED'}),false);
  assert.equal(o.authority.onPacket({...p,type:'DEFENSE_SUCCESS',resultId:'parry',counterType:'PARRIED',postureDamageToAttacker:20,cancelAttack:true}),false);
  assert.equal(o.calls.result.length,1);assert.equal(o.authority.metrics.duplicates,3);
});
check('receiver bounds contacts to 8',()=>{
  const o=h(),id=begin(o);for(let i=0;i<8;i++)assert.equal(o.authority.onPacket(result(o,id,{contactId:id+':'+i,resultId:'r-'+i})),true);
  assert.equal(o.authority.onPacket(result(o,id,{contactId:id+':8',resultId:'r-8'})),false);assert.equal(o.calls.result.length,8);
});
check('counter result delivers cancel once and authority never changes player HP',()=>{
  const o=h(),id=begin(o),before=clone(o.game.world.players);
  const p=result(o,id,{type:'DEFENSE_SUCCESS',counterType:'BLADE_PIN',postureDamageToAttacker:35,cancelAttack:true,attackerState:'RECOIL',attackerStun:18});
  assert.equal(o.authority.onPacket(p),true);assert.equal(o.authority.onPacket(p),false);
  assert.equal(o.calls.result[0].cancelAttack,true);assert.equal(o.calls.result[0].attackerState,'RECOIL');
  assert.deepEqual(o.game.world.players,before);
});
check('counter result state, stun and posture bounds',()=>{
  for(const patch of [{counterType:'INVALID'},{postureDamageToAttacker:101},{attackerState:'DEAD'},{attackerStun:301}]){
    const o=h(),id=begin(o),p=result(o,id,{type:'DEFENSE_SUCCESS',counterType:'PARRIED',postureDamageToAttacker:15,cancelAttack:true,attackerState:'RECOIL',attackerStun:18,...patch});
    assert.equal(o.authority.onPacket(p),false);
  }
});
check('published state includes only own bounded data',()=>{
  const o=h();Object.assign(o.local,{hp:101,posture:Infinity,x:-129,y:500,stun:4000,guard:'yes',grapple:{x:5000,y:1},moveName:'light',secret:'drop'});
  assert.equal(o.authority.publishState(true),true);const p=o.last();assert.equal(p.playerId,0);assert.equal(p.state.id,0);
  for(const key of ['hp','posture','x','stun','guard','secret'])assert.equal(p.state[key],undefined);
  assert.equal(p.state.grapple,null);assert.equal(p.state.ownmove,'light');assert.equal(p.players,undefined);
  o.game.world.players[0]=o.remote;assert.equal(o.authority.publishState(true),false);
});
check('publication throttles at 50ms with force override',()=>{
  const o=h();assert.equal(o.authority.publishState(),true);o.advance(49);assert.equal(o.authority.publishState(),false);
  o.advance(1);assert.equal(o.authority.publishState(),true);assert.equal(o.authority.publishState(true),true);assert.equal(o.last().seq,3);
});
check('remote state cannot overwrite local HP/posture and drops unknown fields',()=>{
  const o=h();o.local.hp=61;o.local.posture=42;const p=state(o);p.state.secret=99;p.state.players=[{id:0,hp:0,posture:100}];
  assert.equal(o.authority.onPacket(p),true);assert.equal(o.calls.state[0].state.id,1);
  assert.equal(o.calls.state[0].state.secret,undefined);assert.equal(o.calls.state[0].state.players,undefined);
  assert.equal(o.authority.onPacket(state(o,{seq:2,playerId:0,state:{...p.state,id:0}})),false);
  assert.equal(o.local.hp,61);assert.equal(o.local.posture,42);
});
check('state monotonic sequence ignores duplicates and invalid update does not consume sequence',()=>{
  const o=h();assert.equal(o.authority.onPacket(state(o,{seq:3})),true);assert.equal(o.authority.onPacket(state(o,{seq:2})),false);
  assert.equal(o.authority.onPacket(state(o,{seq:3})),false);const bad=state(o,{seq:4});bad.state.hp=101;
  assert.equal(o.authority.onPacket(bad),false);assert.equal(o.authority.onPacket(state(o,{seq:4})),true);assert.equal(o.calls.state.length,2);
});
check('state owner, numeric, boolean, identifier and FSM validation',()=>{
  for(const patch of [{id:0},{x:-129},{x:4129},{y:NaN},{hp:101},{posture:-1},{stun:3601},{spirit:21},
    {nodes:11},{tonics:21},{vx:161},{ground:1},{facing:0},{state:'UNKNOWN'},{phase:21},{attackId:'bad\nname'},{grapple:{x:4129,y:2}}]){
    const o=h(),p=state(o);Object.assign(p.state,patch);assert.equal(o.authority.onPacket(p),false,JSON.stringify(patch));assert.equal(o.calls.state.length,0);
  }
});
check('configured FSM enum plus PascalCase/uppercase fallback',()=>{
  const o=h('host',{states:['CUSTOM','RECOIL']}),p=state(o);p.state.state='CUSTOM';assert.equal(o.authority.onPacket(p),true);
  assert.equal(o.authority.onPacket(state(o,{seq:2})),false);
  for(const accepted of ['Idle','Recovery','RECOIL','RECOVERY','IDLE']){const q=h(),s=state(q);s.state.state=accepted;assert.equal(q.authority.onPacket(s),true);}
});
check('death request validates ownership, request ID, round and position',()=>{
  const o=h(),p=control(o,'FINISHER_REQUEST');assert.equal(o.authority.onPacket(p),true);assert.equal(o.authority.onPacket(p),false);assert.equal(o.calls.round.length,1);
  for(const patch of [{requestId:''},{sourceId:0,targetId:1},{playerId:0},{round:2},{x:5000}]){
    const q=h();assert.equal(q.authority.onPacket(control(q,'FINISHER_REQUEST',patch)),false);
  }
});
function requested(o){assert.equal(o.authority.sendControl('FINISHER_REQUEST',{sourceId:o.local.id,targetId:o.remote.id,x:300,y:500}),true);
  return control(o,'FINISHER_CONFIRMED',{requestId:o.last().requestId,sourceId:o.local.id,targetId:o.remote.id,nodes:2,hp:100,posture:0,phase:1});}
check('death confirmation requires exact matching outgoing request history',()=>{
  const o=h(),p=requested(o);assert.equal(o.authority.onPacket({...p,requestId:'unsolicited'}),false);
  assert.equal(o.authority.onPacket(p),true);assert.equal(o.authority.onPacket(p),false);assert.equal(o.calls.round.length,1);
  for(const alter of [e=>e.payload.round=2,e=>e.payload.sourceId=1,e=>e.payload.targetId=0,e=>e.payload.type='HEAL_START']){
    const q=h(),s=requested(q);alter(q.net.combatHistory[0]);assert.equal(q.authority.onPacket(s),false);
  }const q=h(),s=requested(q);q.net.combatHistory=[];assert.equal(q.authority.onPacket(s),false);
});
check('death confirmation ownership, round and final-state ranges',()=>{
  for(const patch of [{round:2},{playerId:0},{sourceId:1,targetId:0},{nodes:11},{hp:101},{posture:-1},{phase:21}]){
    const o=h(),p=requested(o);assert.equal(o.authority.onPacket({...p,...patch}),false,JSON.stringify(patch));
  }
});
check('outgoing controls enforce ownership and host-only reset',()=>{
  const o=h();assert.equal(o.authority.sendControl('FINISHER_REQUEST',{sourceId:1,targetId:0}),false);
  assert.equal(o.authority.sendControl('FINISHER_CONFIRMED',{sourceId:0,targetId:1,requestId:'r'}),false);
  assert.equal(o.authority.sendControl('FINISHER_CONFIRMED',{sourceId:1,targetId:0}),false);
  assert.equal(o.authority.sendControl('FINISHER_CONFIRMED',{sourceId:1,targetId:0,requestId:'r'}),true);
  assert.equal(o.authority.sendControl('ROUND_RESET'),true);assert.equal(h('guest').authority.sendControl('ROUND_RESET'),false);
});
check('heal/reset owner and duplicate validation',()=>{
  const o=h(),p=control(o,'HEAL_START',{tonics:4});assert.equal(o.authority.onPacket(p),true);assert.equal(o.authority.onPacket(p),false);
  assert.equal(o.authority.onPacket({...p,requestId:'other',tonics:21}),false);
  assert.equal(o.authority.onPacket(control(o,'ROUND_RESET',{round:2})),false);
  const q=h('guest'),r=control(q,'ROUND_RESET',{round:2});assert.equal(q.authority.onPacket(r),true);assert.equal(q.authority.onPacket(r),false);
});
check('reset clears attacks, deduplication, controls and state ordering',()=>{
  const o=remote(h()),id=begin(o);o.authority.onPacket(result(o,id));o.authority.onPacket(state(o,{seq:99}));
  o.authority.onPacket(control(o,'HEAL_START',{tonics:4}));o.authority.resetRound();
  for(const key of ['attacks','remoteAttacks','results','controls'])assert.equal(o.authority[key].size,0);
  assert.equal(o.authority.remoteStateSeq,-1);assert.equal(o.authority.onPacket(state(o)),true);
  assert.equal(o.authority.onPacket(result(o,id,{resultId:'new'})),false);
});
check('two isolated peers with 200ms intent, parry, conflicting hit and own state',()=>{
  const host=h('host'),guest=h('guest'),id=begin(host);guest.advance(200);
  assert.equal(guest.authority.onPacket(host.last()),true);assert.equal(guest.calls.attack[0].frames,12);
  guest.remote.attackId=id;guest.local.hp=83;guest.local.posture=20;
  assert.equal(guest.authority.confirmDefense(guest.remote,guest.local,{wave:0},'PARRIED',19),true);
  assert.equal(host.authority.onPacket(guest.last()),true);assert.equal(host.calls.result[0].sourceId,0);
  assert.equal(host.calls.result[0].targetId,1);assert.equal(host.calls.result[0].cancelAttack,true);
  assert.equal(guest.authority.confirmHit(guest.remote,guest.local,{wave:0},'HIT',{damage:50}),false);
  assert.equal(host.authority.onPacket(guest.last()),false);assert.equal(host.calls.result.length,1);
  guest.authority.publishState(true);assert.equal(host.authority.onPacket(guest.last()),true);
  assert.equal(host.calls.state[0].state.hp,83);assert.equal(host.local.hp,100);
});
const netSource=fs.readFileSync(path.join(root,'net.js'),'utf8');
function transport(role='host'){
  let now=1000000;const received=[],inputs=[],sent=[],statuses=[];
  class Clock extends Date{static now(){return now;}}
  const context={Date:Clock,Math,console,setTimeout,clearTimeout,setInterval,clearInterval,
    Uint8Array,crypto:require('node:crypto').webcrypto,Peer:function(){},RTCPeerConnection:function(){}};
  context.window=context;vm.runInNewContext(netSource,context,{filename:'net.js'});
  const net=new context.RiftNet({onCombat:p=>received.push(clone(p)),onInput:p=>inputs.push(clone(p)),onStatus:s=>statuses.push(s)});
  net.role=role;net.connected=true;net.connection={open:true,dataChannel:{bufferedAmount:0},
    send:p=>sent.push(clone(p)),close(){}};
  return {net,received,inputs,sent,statuses,now:()=>now,advance:ms=>{now+=ms;}};
}
check('net sendCombat dispatches owned payload through both endpoint roles',()=>{
  for(const role of ['host','guest']){
    const a=transport(role),b=transport(role==='host'?'guest':'host');
    const payload={type:'ATTACK_START',playerId:role==='host'?0:1,attackId:'a-1'};
    assert.equal(a.net.sendCombat(payload),true);
    assert.deepEqual(a.sent[0],[5,'c',1,a.now(),payload]);
    b.net._receive(a.sent[0]);assert.deepEqual(b.received,[payload]);
    assert.equal(a.net.combatHistory[0].seq,1);assert.deepEqual(clone(a.net.combatHistory[0].payload),payload);
    payload.attackId='modified';assert.equal(a.net.combatHistory[0].payload.attackId,'a-1');
  }
});
check('net combat history is bounded and sequences stay monotonic',()=>{
  const a=transport();for(let i=0;i<130;i++)assert.equal(a.net.sendCombat({type:'HEAL_START',tonics:5}),true);
  assert.equal(a.net.combatHistory.length,128);assert.equal(a.net.combatHistory[0].seq,3);
  assert.equal(a.net.combatHistory.at(-1).seq,130);assert.equal(a.sent.at(-1)[2],130);
});
check('net failed send removes history and disconnected send fails',()=>{
  const a=transport();a.net.connection.open=false;
  assert.equal(a.net.sendCombat({type:'ATTACK_START'}),false);assert.equal(a.net.combatHistory.length,0);
  a.net.connected=false;assert.equal(a.net.sendCombat({type:'ATTACK_START'}),false);assert.equal(a.sent.length,0);
});
check('net combat validates payload shape, type, size and unsafe keys',()=>{
  for(const payload of [null,[],{},'text',{type:'lowercase'},{type:'BAD TYPE'},
    {type:'A'.repeat(33)},{type:'ATTACK_START',data:'x'.repeat(2049)},
    JSON.parse('{"type":"ATTACK_START","__proto__":{"polluted":true}}'),
    {type:'ATTACK_START',items:Array(10).fill('x'.repeat(2000))}]){
    const a=transport();assert.equal(a.net.sendCombat(payload),false);assert.equal(a.sent.length,0);assert.equal(a.net.combatHistory.length,0);
  }
});
check('net combat sequence gap, late and duplicate metrics',()=>{
  const a=transport(),p={type:'ATTACK_START'};
  a.net._receive([5,'c',1,a.now(),p]);a.net._receive([5,'c',3,a.now(),p]);
  a.net._receive([5,'c',2,a.now(),p]);a.net._receive([5,'c',3,a.now(),p]);
  const m=a.net.getMetrics();assert.equal(m.messagesReceived,2);assert.equal(m.sequenceGaps,1);
  assert.equal(m.lateMessages,2);assert.equal(a.received.length,2);
  assert.ok(Math.abs(m.estimatedMissingPercent-100/3)<1e-12);assert.equal(m.reliable,true);
  assert.match(m.estimateLabel,/非 UDP/);
  assert.throws(()=>a.net._receive([5,'c',4101,a.now(),p]));assert.equal(a.net.getMetrics().messagesReceived,2);
});
check('net delayed metric waits for synchronized clock and uses offset',()=>{
  const a=transport(),p={type:'PLAYER_STATE'};
  a.net._receive([5,'c',1,a.now()-10000,p]);assert.equal(a.net.getMetrics().delayedMessages,0);
  a.net._clockSamples=1;a.net.clockOffsetMs=100;
  a.net._receive([5,'c',2,a.now()-150,p]);assert.equal(a.net.getMetrics().delayedMessages,0);
  a.net._receive([5,'c',3,a.now()-151,p]);assert.equal(a.net.getMetrics().delayedMessages,1);
  a.advance(4000000);assert.equal(a.net.getMetrics().lastReceiveAgeMs,3600000);
});
check('net incoming combat rejects malformed packets and leaves callback untouched',()=>{
  const bad=[[5,'c',0,1000000,{type:'HIT_CONFIRMED'}],[5,'c',1,-1,{type:'HIT_CONFIRMED'}],
    [5,'c',1,1e15+1,{type:'HIT_CONFIRMED'}],[5,'c',1,1000000,[]],
    [5,'c',1,1000000,{type:'lower'}],[5,'c',1,1000000,{type:'HIT_CONFIRMED'},'extra'],
    [4,'c',1,1000000,{type:'HIT_CONFIRMED'}],[5,'c',1.5,1000000,{type:'HIT_CONFIRMED'}]];
  for(const p of bad){const a=transport();assert.throws(()=>a.net._receive(p));assert.equal(a.received.length,0);}
});
check('net accepts input mask 65535 and rejects 65536 at both ends',()=>{
  const guest=transport('guest'),host=transport('host');
  assert.equal(guest.net.sendInput(4,65535,3),true);host.net._receive(guest.sent[0]);
  assert.equal(host.inputs[0].bits,65535);assert.equal(guest.net.inputHistory[0].bits,65535);
  assert.equal(guest.net.sendInput(5,65536,4),false);assert.equal(guest.net.sendInput(5,-1,4),false);
  assert.throws(()=>host.net._receive([5,'i',5,65536,4,2,host.now(),0]));
  assert.equal(host.net.sendInput(5,0,4),false);assert.throws(()=>guest.net._receive([5,'i',5,0,4,2,guest.now(),0]));
});
check('net first clock offset sample applies directly; subsequent sample smooths',()=>{
  const a=transport(),n=a.now();
  a.net._pings.set(1,n-100);a.net._receive([5,'q',1,n-100,n-50+200]);
  assert.equal(a.net.clockOffsetMs,200);assert.equal(a.net._clockSamples,1);assert.equal(a.net.pingMs,100);
  a.net._pings.set(2,n-50);a.net._receive([5,'q',2,n-50,n-25+100]);
  assert.equal(a.net.clockOffsetMs,170);assert.equal(a.net._clockSamples,2);assert.equal(a.net.pingMs,88);
});
check('net zero first offset is still a clock sample and unknown pongs are ignored',()=>{
  const a=transport(),n=a.now();a.net._pings.set(1,n-100);
  a.net._receive([5,'q',1,n-100,n-50]);assert.equal(a.net._clockSamples,1);assert.equal(a.net.clockOffsetMs,0);
  a.net._pings.set(2,n-100);a.net._receive([5,'q',2,n-100,n-50+200]);assert.equal(a.net.clockOffsetMs,60);
  a.net._receive([5,'q',99,n-100,n-50+900]);assert.equal(a.net.clockOffsetMs,60);assert.equal(a.net._clockSamples,2);
});
check('net reconnect resets combat and clock histories and metrics',()=>{
  const a=transport();a.net.sendCombat({type:'HEAL_START'});
  a.net._receive([5,'c',3,a.now(),{type:'HEAL_START'}]);a.net._clockSamples=1;a.net.clockOffsetMs=250;
  a.net._begin('guest');assert.equal(a.net.combatHistory.length,0);assert.equal(a.net._combatSequence,0);
  assert.equal(a.net.getMetrics().messagesReceived,0);assert.equal(a.net.getMetrics().sequenceGaps,0);
  assert.equal(a.net._clockSamples,0);assert.equal(a.net.clockOffsetMs,0);assert.equal(a.net._combatLastReceived,0);
});
check('synchronous two-peer transport preserves death-request history before confirmation',()=>{
  const host=h('host'),guest=h('guest'),hn=transport('host'),gn=transport('guest');
  host.authority.net=hn.net;guest.authority.net=gn.net;
  hn.net.callbacks.onCombat=p=>host.authority.onPacket(p);gn.net.callbacks.onCombat=p=>guest.authority.onPacket(p);
  hn.net.connection.send=p=>gn.net._receive(p);gn.net.connection.send=p=>hn.net._receive(p);
  guest.game.onRoundPacket=p=>{
    if(p.type==='FINISHER_REQUEST'){
      guest.calls.round.push(clone(p));
      assert.equal(guest.authority.sendControl('FINISHER_CONFIRMED',{requestId:p.requestId,sourceId:0,targetId:1,nodes:2,hp:100,posture:0,phase:1}),true);
    }
  };
  assert.equal(host.authority.sendControl('FINISHER_REQUEST',{sourceId:0,targetId:1,x:300,y:500}),true);
  assert.equal(host.calls.round.length,1);assert.equal(host.calls.round[0].type,'FINISHER_CONFIRMED');
  assert.equal(guest.calls.round.length,1);assert.equal(host.authority.metrics.rejected,0);
});
const report={generatedAt:new Date().toISOString(),source:path.join(root,'authority.js'),
  passed:checks.filter(x=>x.passed).length,failed:checks.filter(x=>!x.passed).length,checks};
fs.writeFileSync(path.join(REPORTS,'authority.json'),JSON.stringify(report,null,2)+'\n');
for(const c of checks)console.log((c.passed?'PASS':'FAIL')+' '+c.name+(c.passed?'':'\n'+c.error));
console.log('Authority/transport checks: '+report.passed+' passed; '+report.failed+' failed.');
if(report.failed)process.exitCode=1;
