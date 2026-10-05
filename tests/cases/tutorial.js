() => {
const game=window.game,t=game.tutorial,B=game.debug.bits,results=[];
game.audio.setMuted(true);t.start();
const snap=()=>({id:t.lesson.id,count:t.count,flags:t.flags,wait:t.wait,ticks:t.ticks,done:t.completedCurrent,players:game.world.players.map(p=>({state:p.state,move:p.moveName,st:p.st,x:p.x,y:p.y,hp:p.hp,posture:p.posture,deflect:p.deflect,ground:p.ground,dash:p.dash,chase:p.chase,charged:p.charged,prev:p.prevBits,tonics:p.tonics}))});
for(let index=0;index<t.lessons.length;index++){
 t.select(index);const id=t.lesson.id,flags={},events=[];let frames=0;
 const observed=t.onEvent;t.onEvent=function(name,d){events.push({frame:frames,name,...d});return observed.call(this,name,d);};
 for(;frames<1100&&!t.completedCurrent;frames++){
  const [p,e]=game.world.players;let bits=0;const free=['IDLE','MOVE','GUARD'].includes(p.state),clock=game.world.effects.hitstop<=0;
  const once=(flag,b)=>{if(!flags[flag]&&clock){flags[flag]=true;bits|=b;}};
  if(id==='move')bits=frames<23?B.LEFT:B.RIGHT;
  if(id==='jump')once('jump',B.JUMP);
  if(id==='dash')once('dash',B.DASH|B.RIGHT);
  if(id==='grapple')once('grapple',B.GRAPPLE);
  if(id==='light')once('light',B.ATTACK);
  if(id==='charged'){if(frames<40)bits=B.ATTACK;}
  if(id==='combo'){once('first',B.ATTACK);if(p.state==='RECOVERY'&&p.moveName==='light'&&p.confirm>0)once('second',B.ATTACK);}
  if(id==='guard'||id==='posture')bits=B.GUARD;
  if(id==='parry'&&e.state==='STARTUP'&&e.st===12&&free)bits=B.GUARD;
  if(id==='bladePin'&&e.state==='STARTUP'&&e.st===24&&free)bits=B.DASH|(p.x<e.x?B.RIGHT:B.LEFT);
  if(id==='stomp'&&e.moveName==='sweep'&&e.state==='STARTUP'){
   if(e.st===5&&p.ground)bits=B.JUMP;
   if(!p.ground&&p.y<e.y-35&&p.y>e.y-215&&!(p.prevBits&B.JUMP))bits=B.JUMP;
  }
  if(id==='reversal'){
   if(e.moveName==='lightning'&&e.state==='STARTUP'&&e.st===28&&p.ground)bits=B.JUMP;
   if(p.charged>0&&!p.ground&&free)bits=B.ATTACK;
  }
  if(id==='heal')once('heal',B.HEAL);
  if(id==='disc'){once('disc',B.TOOL1);if(t.flags.discHit&&free&&p.chase>0)once('chase',B.ATTACK);}
  if(id==='flame'){once('flame',B.TOOL1);if(t.flags.flameHit&&free)once('fire',B.ATTACK);}
  if(id==='aegis'){once('shield',B.TOOL1);if(t.flags.shield&&free)once('hit',B.ATTACK);}
  if(id==='hammer')once('hammer',B.TOOL1);
  if(id==='blink'&&e.moveName==='light'&&e.state==='STARTUP'&&e.st===13&&free)bits=B.TOOL1;
  if(id==='cleave'||id==='rift')once('art',B.ART);
  if(id==='finisher'){once('first',B.ATTACK);if(e.state==='STUNNED'&&free)once('finish',B.ATTACK);}
  game.step([bits,0]);
 }
 t.onEvent=observed;results.push({lesson:id,passed:t.completedCurrent,frames,events,...(!t.completedCurrent?{snapshot:snap(),agentFlags:flags}:{})});
}
const beforeScores=[...game.scores],target=game.world.players[1];game.execute(game.world.players[0],target);
results.push({lesson:'completed lesson cannot end round or consume second core',passed:game.world.phase==='fighting'&&target.nodes===1&&game.scores.every((n,i)=>n===beforeScores[i])});
t.stop();game.start('local');results.push({lesson:'leaving lesson restores configured loadout',passed:game.world.players[0].loadout.join(',')===game.loadout.join(',')&&!t.active});
return results;
}
