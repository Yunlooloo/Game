/* Defender-owned combat authority. This class never mutates remote fighter HP. */
(() => {
  'use strict';
  const STATES=new Set(['Idle','Windup','Active','Recovery','Deflecting','Guarding','Stunned','Grappling','Executing','Healing','Running','PhaseTransition','Dead','IDLE','MOVE','STARTUP','ACTIVE','RECOVERY','GUARD','DEFLECT','DEFLECTING','GUARDING','STUNNED','GRAPPLING','EXECUTING','HEALING','RUNNING','RECOIL','HIT_STUN','BLADE_PINNED','DRINKING','REVIVING','PHASE_TRANSITION','DEAD','DASH']);
  const COUNTERS=new Set(['PARRIED','BLADE_PIN','STOMP']);
  const OUTCOMES=new Set(['HIT','BLOCKED','DODGED','CAUGHT_LIGHTNING','BLINK']);
  const CONTROLS=new Set(['HEAL_START','FINISHER_REQUEST','FINISHER_CONFIRMED','ROUND_RESET']);
  const NUMBER_FIELDS={x:[-128,4128],y:[-500,1600],vx:[-160,160],vy:[-160,160],hp:[0,100],posture:[0,100],spirit:[0,20],st:[0,10000000],nodes:[0,10],tonics:[0,20],stun:[0,3600],charge:[0,3600],deflect:[0,60],guardAge:[0,1000000],burn:[0,36000],fireBlade:[0,36000],charged:[0,36000],invuln:[0,3600],dash:[0,3600],dashDir:[-1,1],healTimer:[0,3600],healCooldown:[0,36000],moveSeq:[0,2147483647],lockFrames:[0,3600],healPending:[0,100],revive:[0,3600],blinkWindow:[0,3600],wave:[0,8],confirm:[0,3600],chase:[0,3600],fireReady:[0,36000],wasParried:[0,3600],stomp:[0,3600],deflectWindow:[0,60]};
  const BOOL_FIELDS=['ground','guard','aegis','hidden','dead','running','sprinting','healing','holdCharged','attackReleased'];
  const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
  const integer=(v,min=0,max=2147483647)=>Number.isInteger(v)&&v>=min&&v<=max;
  const short=(v,max=96)=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\u0000-\u001f]/.test(v);
  const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const stamp=v=>finite(v,0,1e15);
  const bounded=(v,min,max,fallback=0)=>finite(v,min,max)?v:fallback;
  const call=(game,name,...args)=>{if(typeof game[name]==='function')game[name](...args);};

  window.RiftAuthority=class RiftAuthority {
    constructor(game,net){
      this.game=game;this.net=net;this.localId=net.role==='host'?0:1;this.remoteId=1-this.localId;
      this.attacks=new Map();this.remoteAttacks=new Map();this.results=new Set();this.controls=new Set();
      this.stateSeq=0;this.remoteStateSeq=-1;this.counter=0;this.lastPublishedAt=-Infinity;
      this.metrics={accepted:0,rejected:0,duplicates:0,lateIntents:0,maxWarpFrames:0};
      this._nonce=Math.random().toString(36).slice(2,10);
    }
    _round(){return integer(this.game.world?.round,1,1000000)?this.game.world.round:1;}
    _id(kind){return kind+'-'+this.localId+'-'+this._nonce+'-'+(++this.counter).toString(36);}
    _remember(collection,key,value=true,max=256){collection instanceof Map?collection.set(key,value):collection.add(key);while(collection.size>max)collection.delete(collection.keys().next().value);}
    _keyValid(key){if(!short(key,48))return false;const moves=window.RIFT?.MOVES||this.game.moves;return moves?Object.prototype.hasOwnProperty.call(moves,key):/^[a-z][a-zA-Z0-9_]{0,47}$/.test(key);}
    _reject(){this.metrics.rejected++;return false;}
    _duplicate(){this.metrics.duplicates++;return false;}
    _send(payload){return !!this.net.sendCombat(payload);}
    _elapsed(timestamp){const age=Date.now()+(this.net.clockOffsetMs||0)-timestamp;const frames=Math.max(0,Math.min(30,Math.floor(age*60/1000)));if(age>200)this.metrics.lateIntents++;this.metrics.maxWarpFrames=Math.max(this.metrics.maxWarpFrames,frames);return frames;}
    beginAttack(player,key,options={}){
      if(!player||player.id!==this.localId||!this._keyValid(key)||!this.net.connected)return null;
      const attackId=this._id('a');
      const packet={type:'ATTACK_START',attackType:key,attackId,moveName:key,playerId:this.localId,startTick:Math.max(0,Math.floor(this.game.world?.tick||0)),timestamp:Date.now(),round:this._round(),x:bounded(player.x,-128,4128),y:bounded(player.y,-500,1600),facing:player.facing===-1?-1:1,held:typeof options.held==='boolean'?options.held:(key==='light'&&!player.attackReleased&&!!((player.prevBits||0)&16))};
      player.attackId=attackId;this._remember(this.attacks,attackId,{packet,contacts:new Set(),createdAt:Date.now()});
      if(!this._send(packet)){this.attacks.delete(attackId);return null;}return attackId;
    }
    releaseAttack(player){if(!player||player.id!==this.localId||!this.attacks.has(player.attackId))return false;return this._send({type:'ATTACK_RELEASE',attackId:player.attackId,playerId:this.localId,round:this._round(),timestamp:Date.now(),startTick:Math.max(0,Math.floor(this.game.world?.tick||0))});}
    _attackFor(attacker,move,extra){const id=extra.attackId||move?.attackId||attacker?.attackId;return short(id)&&this.remoteAttacks.has(id)?id:null;}
    _contact(attackId,move,extra){const contact=extra.contactId||attackId+':'+String(integer(move?.wave,0,7)?move.wave:0);return short(contact,144)?contact:null;}
    confirmDefense(attacker,target,move,counterType,delta={}){
      if(typeof delta==='number')delta={postureDamageToAttacker:delta};
      if(!plain(delta)||!attacker||!target||target.id!==this.localId||attacker.id!==this.remoteId||!COUNTERS.has(counterType))return false;
      const attackId=this._attackFor(attacker,move,delta),contactId=attackId&&this._contact(attackId,move,delta);if(!attackId||!contactId)return false;
      const record=this.remoteAttacks.get(attackId);if(record.contacts.has(contactId)||record.contacts.size>=8)return false;
      const packet={type:'DEFENSE_SUCCESS',attackId,counterType,result:counterType,postureDamageToAttacker:bounded(delta.postureDamageToAttacker,0,100),sourceId:attacker.id,targetId:target.id,resultId:this._id('r'),contactId,timestamp:Date.now(),round:this._round(),targetHP:bounded(delta.targetHP??target.hp,0,100),targetPosture:bounded(delta.targetPosture??target.posture,0,100),cancelAttack:delta.cancelAttack!==false,attackerState:short(delta.attackerState,32)?delta.attackerState:'RECOIL',attackerStun:bounded(delta.attackerStun,0,300,18)};
      if(!this._send(packet))return false;record.contacts.add(contactId);return true;
    }
    confirmHit(attacker,target,move,outcome='HIT',delta={}){
      if(typeof outcome==='number'){delta={damage:outcome,postureDamage:typeof delta==='number'?delta:0};outcome='HIT';}
      if(typeof delta==='number')delta={damage:delta};
      if(!plain(delta)||!attacker||!target||target.id!==this.localId||attacker.id!==this.remoteId||!OUTCOMES.has(outcome))return false;
      const attackId=this._attackFor(attacker,move,delta),contactId=attackId&&this._contact(attackId,move,delta);if(!attackId||!contactId)return false;
      const record=this.remoteAttacks.get(attackId);if(record.contacts.has(contactId)||record.contacts.size>=8)return false;
      const packet={type:'HIT_CONFIRMED',attackId,result:outcome,outcome,damage:bounded(delta.damage,0,100),postureDamage:bounded(delta.postureDamage,0,100),sourceId:attacker.id,targetId:target.id,resultId:this._id('r'),contactId,timestamp:Date.now(),round:this._round(),targetHP:bounded(delta.targetHP??target.hp,0,100),targetPosture:bounded(delta.targetPosture??target.posture,0,100),attackerPostureDelta:bounded(delta.attackerPostureDelta,-100,0),cancelAttack:!!delta.cancelAttack};
      if(!this._send(packet))return false;record.contacts.add(contactId);return true;
    }
    _playerState(player){
      if(!plain(player)||player.id!==this.localId)return null;const state={id:this.localId,facing:player.facing===-1?-1:1};
      for(const [key,[min,max]]of Object.entries(NUMBER_FIELDS))if(finite(player[key],min,max))state[key]=player[key];
      for(const key of BOOL_FIELDS)if(typeof player[key]==='boolean')state[key]=player[key];
      if(short(player.state,32))state.state=player.state;
      for(const key of ['moveName','ownmove'])if(typeof player[key]==='string'&&player[key].length<=96)state[key]=player[key];
      state.attackId=short(player.attackId,96)?player.attackId:null;
      if(state.ownmove===undefined&&typeof state.moveName==='string')state.ownmove=state.moveName;
      if(integer(player.phase,0,20)||short(player.phase,32))state.phase=player.phase;
      if(plain(player.grapple)&&finite(player.grapple.x,-128,4128)&&finite(player.grapple.y,-500,1600))state.grapple={x:player.grapple.x,y:player.grapple.y};else state.grapple=null;
      return state;
    }
    publishState(force=false){const now=Date.now();if(!force&&now-this.lastPublishedAt<50)return false;const state=this._playerState(this.game.world?.players?.[this.localId]);if(!state||!this.net.connected)return false;const packet={type:'PLAYER_STATE',playerId:this.localId,state,seq:++this.stateSeq,timestamp:now,round:this._round(),tick:Math.max(0,Math.floor(this.game.world?.tick||0))};if(!this._send(packet))return false;this.lastPublishedAt=now;return true;}
    sendControl(type,data={}){
      if(!CONTROLS.has(type)||!plain(data))return false;const packet={...data,type,playerId:this.localId,round:this._round(),timestamp:Date.now()};
      if(type==='FINISHER_REQUEST'&&(packet.sourceId!==this.localId||packet.targetId!==this.remoteId))return false;
      if(type==='FINISHER_CONFIRMED'&&(packet.sourceId!==this.remoteId||packet.targetId!==this.localId))return false;
      if(type==='ROUND_RESET'&&this.localId!==0)return false;
      if(!packet.requestId&&type==='FINISHER_REQUEST')packet.requestId=this._id('d');
      if(type==='FINISHER_CONFIRMED'&&!short(packet.requestId))return false;return this._send(packet);
    }
    resetRound(){this.attacks.clear();this.remoteAttacks.clear();this.results.clear();this.controls.clear();this.remoteStateSeq=-1;this.lastPublishedAt=-Infinity;}
    onPacket(packet){
      if(!plain(packet)||!short(packet.type,32)||!stamp(packet.timestamp))return this._reject();
      if(packet.type!=='ROUND_RESET'&&(!integer(packet.round,1,1000000)||packet.round!==this._round()))return this._reject();
      if(packet.type==='ATTACK_START')return this.processRemoteIntent(packet);
      if(packet.type==='ATTACK_RELEASE'){if(packet.playerId!==this.remoteId||!short(packet.attackId)||!this.remoteAttacks.has(packet.attackId))return this._reject();const record=this.remoteAttacks.get(packet.attackId);if(record.released)return this._duplicate();record.released=true;this.metrics.accepted++;call(this.game,'receiveAttackRelease',{...packet},this._elapsed(packet.timestamp));return true;}
      if(packet.type==='PLAYER_STATE')return this._receiveState(packet);
      if(packet.type==='DEFENSE_SUCCESS'||packet.type==='HIT_CONFIRMED')return this._receiveResult(packet);
      if(CONTROLS.has(packet.type))return this._receiveControl(packet);return this._reject();
    }
    processRemoteIntent(packet){
      if(!plain(packet)||packet.type!=='ATTACK_START'||!stamp(packet.timestamp)||packet.round!==this._round())return this._reject();
      if(packet.playerId!==this.remoteId||!short(packet.attackId)||!this._keyValid(packet.attackType)||packet.moveName!==packet.attackType||!integer(packet.startTick)||!finite(packet.x,-128,4128)||!finite(packet.y,-500,1600)||![1,-1].includes(packet.facing)||(packet.held!==undefined&&typeof packet.held!=='boolean'))return this._reject();
      if(this.remoteAttacks.has(packet.attackId))return this._duplicate();
      const clean={type:packet.type,attackType:packet.attackType,attackId:packet.attackId,moveName:packet.moveName,playerId:this.remoteId,startTick:packet.startTick,timestamp:packet.timestamp,round:packet.round,x:packet.x,y:packet.y,facing:packet.facing,held:!!packet.held};
      this._remember(this.remoteAttacks,packet.attackId,{packet:clean,contacts:new Set(),createdAt:Date.now(),released:false});this.metrics.accepted++;call(this.game,'receiveAttack',clean,this._elapsed(packet.timestamp));return true;
    }
    _receiveState(packet){
      if(packet.playerId!==this.remoteId||!integer(packet.seq,1)||!plain(packet.state)||packet.state.id!==this.remoteId)return this._reject();if(packet.seq<=this.remoteStateSeq)return this._duplicate();
      const input=packet.state,clean={id:this.remoteId};
      for(const [key,[min,max]]of Object.entries(NUMBER_FIELDS))if(input[key]!==undefined){if(!finite(input[key],min,max))return this._reject();clean[key]=input[key];}
      if(!finite(clean.x,-128,4128)||!finite(clean.y,-500,1600)||!finite(clean.hp,0,100)||!finite(clean.posture,0,100))return this._reject();
      const states=window.RIFT?.STATES;if(!short(input.state,32)||!(Array.isArray(states)?states.includes(input.state):STATES.has(input.state)))return this._reject();clean.state=input.state;
      if(![1,-1].includes(input.facing))return this._reject();clean.facing=input.facing;
      for(const key of BOOL_FIELDS)if(input[key]!==undefined){if(typeof input[key]!=='boolean')return this._reject();clean[key]=input[key];}
      for(const key of ['moveName','ownmove'])if(input[key]!==undefined){if(typeof input[key]!=='string'||input[key].length>96||/[\u0000-\u001f]/.test(input[key]))return this._reject();clean[key]=input[key];}
      if(input.attackId!==undefined){if(input.attackId!==null&&!short(input.attackId,96))return this._reject();clean.attackId=input.attackId;}
      if(input.phase!==undefined){if(!(integer(input.phase,0,20)||short(input.phase,32)))return this._reject();clean.phase=input.phase;}
      if(input.grapple===null)clean.grapple=null;else if(input.grapple!==undefined){if(!plain(input.grapple)||!finite(input.grapple.x,-128,4128)||!finite(input.grapple.y,-500,1600))return this._reject();clean.grapple={x:input.grapple.x,y:input.grapple.y};}
      this.remoteStateSeq=packet.seq;this.metrics.accepted++;call(this.game,'receivePlayerState',{type:'PLAYER_STATE',playerId:this.remoteId,state:clean,seq:packet.seq,timestamp:packet.timestamp,round:packet.round,tick:integer(packet.tick)?packet.tick:0});return true;
    }
    _receiveResult(packet){
      if(packet.sourceId!==this.localId||packet.targetId!==this.remoteId||!short(packet.attackId)||!short(packet.resultId)||!short(packet.contactId,144))return this._reject();
      const record=this.attacks.get(packet.attackId);if(!record)return this._reject();
      if(this.results.has(packet.resultId)||record.contacts.has(packet.contactId))return this._duplicate();
      if(record.contacts.size>=8||!packet.contactId.startsWith(packet.attackId+':'))return this._reject();
      const clean={type:packet.type,attackId:packet.attackId,sourceId:this.localId,targetId:this.remoteId,resultId:packet.resultId,contactId:packet.contactId,timestamp:packet.timestamp,round:packet.round};
      for(const key of ['targetHP','targetPosture'])if(packet[key]!==undefined){if(!finite(packet[key],0,100))return this._reject();clean[key]=packet[key];}
      if(typeof packet.cancelAttack!=='boolean')return this._reject();clean.cancelAttack=packet.cancelAttack;
      if(packet.type==='DEFENSE_SUCCESS'){
        if(!COUNTERS.has(packet.counterType)||!finite(packet.postureDamageToAttacker,0,100))return this._reject();clean.counterType=clean.result=packet.counterType;clean.postureDamageToAttacker=packet.postureDamageToAttacker;
        if(packet.attackerState!==undefined){if(!['Stunned','Recovery','Idle','RECOIL','BLADE_PINNED','RECOVERY','STUNNED','IDLE'].includes(packet.attackerState))return this._reject();clean.attackerState=packet.attackerState;}
        if(packet.attackerStun!==undefined){if(!finite(packet.attackerStun,0,300))return this._reject();clean.attackerStun=packet.attackerStun;}
      }else{
        const outcome=packet.outcome||packet.result;if(!OUTCOMES.has(outcome)||!finite(packet.damage,0,100)||!finite(packet.postureDamage,0,100)||!finite(packet.attackerPostureDelta,-100,0))return this._reject();clean.result=clean.outcome=outcome;clean.damage=packet.damage;clean.postureDamage=packet.postureDamage;clean.attackerPostureDelta=packet.attackerPostureDelta;
      }
      record.contacts.add(packet.contactId);this._remember(this.results,packet.resultId,true,512);this.metrics.accepted++;call(this.game,'receiveCombatResult',clean);return true;
    }
    _receiveControl(packet){
      if(packet.playerId!==undefined&&packet.playerId!==this.remoteId)return this._reject();
      if(packet.type==='ROUND_RESET'){if(this.remoteId!==0||!integer(packet.round,1,1000000))return this._reject();const key='round:'+packet.round+':'+String(packet.requestId||packet.timestamp);if(this.controls.has(key))return this._duplicate();this._remember(this.controls,key);this.metrics.accepted++;call(this.game,'onRoundPacket',{...packet});return true;}
      if(packet.type==='HEAL_START'){if(packet.playerId!==this.remoteId||!integer(packet.tonics,0,20))return this._reject();const key='heal:'+String(packet.requestId||packet.timestamp);if(this.controls.has(key))return this._duplicate();this._remember(this.controls,key);this.metrics.accepted++;call(this.game,'receiveHeal',{...packet,playerId:this.remoteId});return true;}
      if(!short(packet.requestId)||![0,1].includes(packet.sourceId)||packet.targetId!==1-packet.sourceId)return this._reject();
      if(packet.type==='FINISHER_REQUEST'){if(packet.sourceId!==this.remoteId||packet.targetId!==this.localId||!finite(packet.x,-128,4128)||!finite(packet.y,-500,1600))return this._reject();}
      else{if(packet.sourceId!==this.localId||packet.targetId!==this.remoteId||!integer(packet.nodes,0,10)||!finite(packet.hp,0,100)||!finite(packet.posture,0,100)||!(integer(packet.phase,0,20)||short(packet.phase,32)))return this._reject();const requested=(this.net.combatHistory||[]).some(entry=>{const p=entry.payload||entry;return p.type==='FINISHER_REQUEST'&&p.requestId===packet.requestId&&p.sourceId===this.localId&&p.targetId===this.remoteId&&p.round===this._round();});if(!requested)return this._reject();}
      const key=packet.type+':'+packet.requestId;if(this.controls.has(key))return this._duplicate();this._remember(this.controls,key);this.metrics.accepted++;call(this.game,'onRoundPacket',{...packet});return true;
    }
  };
})();
