() => {
  const rows=[];
  const check=(name,passed,actual)=>rows.push({name,passed:!!passed,actual});
  const V=window.RiftVitals;
  const F=window.RiftFSM;
  const API=window.RIFT;
  const B=API.B, M=API.MOVES;
  const blinkKey='blinkWindow';
  const snap=p=>({x:p.x,y:p.y,vx:p.vx,hp:p.hp,posture:p.posture,state:p.state,lock:p.lockFrames,nodes:p.nodes,phase:p.phase,dash:p.dash,blink:p[blinkKey],st:p.st,move:p.moveName});
  const reset=(a={},b={})=>{
    game.net=null;game.authority=null;game.start('local');game.audio.setMuted(true);
    game.world.weather='dusk';game.renderer.render=()=>{};game.audio.update=()=>{};
    Object.assign(game.world.players[0],{x:800,y:1080,vx:0,vy:0,ground:true,facing:1},a);
    Object.assign(game.world.players[1],{x:890,y:1080,vx:0,vy:0,ground:true,facing:-1},b);
    return game.world.players;
  };
  const ticks=n=>{for(let i=0;i<n;i++)game.step([0,0]);};
  let [a,b]=reset({}, {hp:5,vx:9,dash:10,dashDir:1});
  game.hit(a,b,M.light);
  check('Lethal real hit enters four-second down with no inherited knockback',b.state==='STUNNED'&&b.lockFrames===240&&b.hp===0&&b.vx===0&&b.dash===0,snap(b));
  game.world.effects.hitstop=0;
  ticks(239);
  check('Zero-HP target remains still and executable through tick 239',b.x===890&&b.state==='STUNNED'&&b.lockFrames===1&&V.vulnerable(b)&&b.nodes===2,snap(b));
  ticks(1);
  check('Tick 240 recovers 15 HP and 35 posture without consuming life node',b.state==='IDLE'&&b.hp===15&&b.posture===35&&b.nodes===2&&b.x===890,snap(b));
  ticks(60);
  check('Near-death recovery does not naturally regenerate posture',b.hp===15&&b.posture===35&&b.x===890,snap(b));

  [a,b]=reset({}, {hp:95,posture:99,vx:-15,dash:10,dashDir:-1});
  b[blinkKey]=30;game.addPosture(b,2);
  check('Posture break lowers healthy fighter to near-death and clears mobility',b.state==='STUNNED'&&b.hp===15&&b.posture===100&&b.lockFrames===240&&b.vx===0&&b.dash===0&&b[blinkKey]===0,snap(b));
  const pinnedX=b.x;game.hit(a,b,M.light);game.world.effects.hitstop=0;
  check('Downed fighter cannot teleport from previously armed reactive tool',b.x===pinnedX&&b.state==='STUNNED'&&b[blinkKey]===0,snap(b));
  a.x=3000; b.burn=450;
  for(let i=0;i<239;i++){
    if(i%30===0)V.hurt(b,2,{posture:3,stun:18});
    game.step([B.RIGHT|B.JUMP|B.DASH|B.ATTACK|B.GUARD,B.LEFT|B.JUMP|B.DASH|B.ATTACK|B.GUARD]);
    // The other fighter is distant for the uninterrupted down timer; do not change clocks.
  }
  check('Repeated damage and burning never restart the down timer',b.state==='STUNNED'&&b.lockFrames===1&&b.nodes===2,snap(b));
  check('Downed fighter ignores escape/attack/guard input throughout lock',b.x===pinnedX&&b.vx===0&&b.dash===0&&b[blinkKey]===0,snap(b));
  ticks(1);
  check('Repeated hits and burn still permit recovery at original tick 240',b.state==='IDLE'&&b.hp===15&&b.posture===35&&b.nodes===2,snap(b));

  [a,b]=reset({}, {hp:1});V.hurt(b,2);ticks(180);const vulnerableAt180=V.vulnerable(b);
  const executed=game.execute(a,b);
  check('Finisher remains available late in the four-second down window',vulnerableAt180&&executed,{executed,target:snap(b)});
  check('First finisher restores full HP and unlocks phase two instead of ending match',b.state==='REVIVING'&&b.hp===100&&b.posture===0&&b.nodes===1&&b.phase===2&&game.world.phase==='fighting',snap(b));

  [a,b]=reset({x:1180,hp:0,posture:100,state:'STUNNED',lockFrames:240}, {x:1000});
  const AI=window.RiftAI;
  let ai=new AI();ai.retreatUntil=999;ai.disengageUntil=999;let aiBits=0;const unseen=[];
  for(let i=0;i<13;i++){aiBits=ai.input(game.world,b,a);if(i<12)unseen.push(aiBits);}
  check('AI retains twelve-frame observation latency for new downed state',unseen.every(bits=>bits===0),unseen);
  check('Visually confirmed downed target overrides old retreat and is approached',!!(aiBits&B.RIGHT)&&!(aiBits&B.LEFT)&&!(aiBits&B.ATTACK)&&ai.retreatUntil===0&&ai.disengageUntil===0,{bits:aiBits,retreat:ai.retreatUntil,disengage:ai.disengageUntil});
  a.x=1080;ai=new AI();ai.retreatUntil=999;ai.disengageUntil=999;
  for(let i=0;i<13;i++)aiBits=ai.input(game.world,b,a);
  check('AI commits nearby finisher instead of retreating after visible down',!!(aiBits&B.ATTACK)&&!!(aiBits&B.RIGHT)&&!(aiBits&B.LEFT)&&ai.retreatUntil===0&&ai.disengageUntil===0,{bits:aiBits,retreat:ai.retreatUntil,disengage:ai.disengageUntil});

  // Stale velocity is rejected centrally, including while falling to a platform.
  [a,b]=reset({}, {hp:5,y:1000,ground:false,vy:0});V.hurt(b,10);b.vx=17;b.dash=8;b.dashDir=1;
  ticks(30);
  check('Downed airborne fighter lands vertically without horizontal drift',b.x===890&&b.y===1080&&b.vx===0&&b.dash===0&&b.state==='STUNNED',snap(b));

  // Remote replicas wait for the owner's recovery state and never run own recovery.
  [a,b]=reset({hp:55},{x:890});game.mode='online';game.localId=0;
  const poseAt=Date.now()-100;
  game.receivePlayerState({playerId:1,timestamp:poseAt,state:{...b,state:'STUNNED',hp:0,posture:100,x:950,vx:20,dash:12,dashDir:1,[blinkKey]:8,guard:true,deflect:8,lockFrames:200,stun:200}});
  check('Remote downed pose snaps to owned position without velocity extrapolation',b.x===950&&b.vx===0&&b.dash===0&&b[blinkKey]===0&&b.state==='STUNNED',snap(b));
  for(let i=0;i<300;i++)game.tickRemote(b);
  check('Remote downed replica stays still and waits for authoritative recovery',b.x===950&&b.state==='STUNNED'&&b.hp===0&&b.nodes===2&&b.lockFrames===0,snap(b));
  game.receiveAttack({playerId:1,timestamp:Date.now(),startTick:0,attackType:'light',attackId:'late-down-attack',x:500,y:1080,facing:1,held:false},0);
  check('Queued attack cannot revive or move a downed remote replica',b.x===950&&b.state==='STUNNED'&&b.move==null,snap(b));
  const recoveredAt=Date.now()+1;
  game.receivePlayerState({playerId:1,timestamp:recoveredAt,state:{...b,state:'IDLE',hp:15,posture:35,x:950,vx:0,dash:0,lockFrames:0}});
  check('Only owner recovery pose returns remote fighter to 15-HP idle',b.state==='IDLE'&&b.hp===15&&b.posture===35&&a.hp===55,snap(b));
  game.receiveAttack({playerId:1,timestamp:recoveredAt-1,startTick:0,attackType:'light',attackId:'stale-intent',x:500,y:1080,facing:1,held:false},0);
  check('Outdated intent remains rejected after authoritative recovery',b.state==='IDLE'&&b.x===950&&b.move==null,snap(b));
  game.receiveAttack({playerId:1,timestamp:recoveredAt+1,startTick:0,attackType:'light',attackId:'fresh-intent',x:950,y:1080,facing:-1,held:false},0);
  check('Fresh intent works normally after owner recovery',b.state==='STARTUP'&&b.moveName==='light'&&b.attackId==='fresh-intent',snap(b));

  [a,b]=reset({hp:0,posture:100,state:'STUNNED',lockFrames:1},{x:3000});
  game.mode='online';game.localId=0;
  const ordered=[];
  game.authority={publishState:force=>ordered.push({type:'pose',force,state:a.state,hp:a.hp,posture:a.posture}),beginAttack:()=>ordered.push({type:'attack',state:a.state}),releaseAttack:()=>{}};
  game.step([0,0]);game.step([B.ATTACK,0]);
  check('Owner publishes recovered pose before first new attack regardless of pose throttle',ordered.length===2&&ordered[0].type==='pose'&&ordered[0].force===true&&ordered[0].state==='IDLE'&&ordered[0].hp===15&&ordered[0].posture===35&&ordered[1].type==='attack',ordered);

  // Use the actual production requestAnimationFrame handler, only renderer/audio adapters mocked.
  const timing=[];
  for(const hz of [60,144,240]){
    [a,b]=reset({}, {x:3500});game.lastTime=1000;game.acc=0;game.lastHud=0;
    for(let frame=1;frame<=hz*10;frame++){
      game.keys.clear();if(game.world.tick<120)game.keys.add('KeyD');if(game.world.tick===580)game.keys.add('KeyJ');
      game.frame(1000+frame*1000/hz);
    }
    const result={hz,tick:game.world.tick,time:game.world.time,x:a.x,y:a.y,state:a.state,move:a.moveName,st:a.st,acc:game.acc};timing.push(result);
    check(hz+' Hz render produces exactly 600 fixed ticks in ten seconds',result.tick===600&&result.time===10,result);
  }
  const comparable=({hz,acc,...rest})=>rest;
  check('60/144/240 Hz preserve identical movement and attack state',timing.every(v=>JSON.stringify(comparable(v))===JSON.stringify(comparable(timing[0]))),timing);
  [a,b]=reset({}, {x:3500});game.lastTime=1000;game.acc=0;game.droppedFrames=0;game.frame(11000);
  check('Long render stall is bounded to six logic steps',game.world.tick===6&&game.acc<1/60&&game.droppedFrames>=594,{tick:game.world.tick,acc:game.acc,dropped:game.droppedFrames});
  game.paused=true;game.frame(12000);game.paused=false;game.frame(12000+1000/60);
  check('Resuming from pause does not replay elapsed wall time',game.world.tick===7,{tick:game.world.tick,acc:game.acc});

  [a,b]=reset();game.transition(b,'DEFLECT',{frames:12});b.deflect=12;b.guard=true;
  const result=game.hit(a,b,M.light);
  check('Perfect parry triggers eight-tick hitstop and dedicated contact flash',result==='deflect'&&game.world.effects.hitstop===8&&game.world.effects.parry===18&&Number.isFinite(game.world.effects.parryX)&&Number.isFinite(game.world.effects.parryY),{result,effects:{...game.world.effects}});
  check('Perfect parry leaves defender HP/posture intact and recoils attacker',b.hp===100&&b.posture===0&&a.state==='RECOIL'&&a.posture>0,{attacker:snap(a),defender:snap(b)});
  ticks(8);
  check('Parry hitstop freezes combat clocks for exactly eight fixed steps',game.world.tick===0&&game.world.effects.hitstop===0&&game.world.effects.parry===10,{tick:game.world.tick,effects:{...game.world.effects}});
  ticks(1);
  check('Parry resumes combat on following fixed step',game.world.tick===1,{tick:game.world.tick,state:a.state,st:a.st});
  [a,b]=reset();game.mode='online';game.localId=0;
  game.receiveCombatResult({type:'DEFENSE_SUCCESS',sourceId:0,targetId:1,counterType:'PARRIED',postureDamageToAttacker:25,attackerStun:18,targetHP:100,targetPosture:0});
  check('Attacker receives the same dedicated parry impact from defense authority',game.world.effects.hitstop===8&&game.world.effects.parry===18&&a.state==='RECOIL',{effects:{...game.world.effects},attacker:snap(a)});

  game.net=null;game.authority=null;game.mode='local';game.lobby();
  return rows;
}
