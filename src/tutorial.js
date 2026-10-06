"use strict";
/** Interactive lessons use the normal 60 Hz combat engine and defender resolution.
 * Training-only conveniences (refills, lesson positioning, patient partner) are
 * deliberately explicit. No key press or elapsed attack animation grants a hit.
 */
((root) => {
  const LESSONS = [
    {id:'move', title:'01 · 與距離交朋友', group:'起步', goal:'向左、向右各移動至少 100 像素。', keys:'A / D 移動', tip:'你是青衣的渡影；紫衣的是陪練。面向對手按滑鼠攻防即可，無須鎖定鏡頭。', distance:380, total:2},
    {id:'jump', title:'02 · 高低差與落腳點', group:'起步', goal:'從橋面起跳，再安全落回平台。', keys:'空白鍵跳躍 · S ＋ 空白鍵向下穿過平台', tip:'空中仍能攻擊或用道具；跳躍不是無敵。完成一次起跳與著地便可繼續。', distance:330},
    {id:'dash', title:'03 · 墊步取位', group:'起步', goal:'朝一個方向墊步，實際移動至少 80 像素。', keys:'A / D ＋ Shift 墊步', tip:'墊步消耗的是出手時機，不消耗共鳴。能閃普通斬擊，但危險招式需要相應反制。', distance:350},
    {id:'grapple', title:'04 · 掛索飛躍', group:'起步', goal:'抓住上方亮色錨點，沿掛索上升至少 80 像素。', keys:'F 掛索 · 空中左鍵可接跳斬', tip:'掛索自動挑選面前可達的高處錨點。飛到高台後，也能 S ＋ 空白鍵回到下層。', distance:330},
    {id:'light', title:'05 · 第一刀', group:'刀刃', goal:'用一次輕斬實際命中陪練。', keys:'點按滑鼠左鍵', tip:'靠近到一把劍的距離。18 幀起手 → 5 幀判定 → 14 幀收招；揮空也要付出收招時間。', distance:90},
    {id:'charged', title:'06 · 延遲出刀', group:'刀刃', goal:'蓄力後釋放蓄斬，命中或擊破陪練的普通防禦。', keys:'按住左鍵至少 0.6 秒，再放開', tip:'陪練會一直普通防禦。雙重蓄斬能崩解普通格擋，但完美招架仍可化解；不要在蓄力中嘗試防禦。', distance:110, behavior:'guard'},
    {id:'combo', title:'07 · 命中才有追擊', group:'刀刃', goal:'輕斬命中後，在收招時再點左鍵，讓「追斬」命中。', keys:'左鍵 → 放開 → 命中後再點左鍵', tip:'第一刀命中或被格擋，才開放追斬／墊步取消。太早按第二次、一直按住或揮空，都不算連段。', distance:90},
    {id:'guard', title:'08 · 普通格擋的代價', group:'防守', goal:'提早按住右鍵，以普通格擋接下 2 刀。', keys:'持續按住滑鼠右鍵', tip:'陪練固定出輕斬。普通格擋不扣 HP，但累積自身架勢；不能永久靠擋來獲勝。', distance:90, behavior:'light', total:2},
    {id:'parry', title:'09 · 聽見完美招架', group:'防守', goal:'在刀鋒接觸前點右鍵，完成 2 次完美招架。', keys:'看到刀將落下時，點一下右鍵', tip:'窗口 16 幀。成功後放開再按，下一刀仍有完整窗口；只有快速空按會縮短至最低 12 幀。按住則繼續普通防禦。金色閃環與清亮刀鳴表示成功。', distance:90, behavior:'light', total:2},
    {id:'posture', title:'10 · HP 決定架勢恢復', group:'防守', goal:'先在安全距離按住右鍵，恢復 20 架勢；再觀察低血量時恢復停止。', keys:'按住右鍵，觀看上方架勢條', tip:'HP ≥ 75：35 / 秒；50–74：15 / 秒；低於 50：0。距離超過 350 時持續防禦，加速 2.5 倍，仍受 HP 限制。', distance:500, total:2},
    {id:'bladePin', title:'11 · 紅色「突」：踏刃', group:'反制', goal:'迎著突刺墊步，成功踏刃 2 次。', keys:'紅色「突」亮起後，接觸前朝對手按 Shift', tip:'突刺不能普通防禦。向後閃不算踏刃；反制成功會踩住刃身，重創敵方 35 架勢。', distance:130, behavior:'thrust', total:2},
    {id:'stomp', title:'12 · 琥珀色「掃」：蹬踏', group:'反制', goal:'跳過下段橫掃，再在對手頭上按一次跳躍，成功蹬踏。', keys:'空白鍵 → 靠近頭頂 → 再按空白鍵', tip:'橫掃不能擋，也不能踏刃。必須跳起、放開跳躍鍵，再按一次；保持在對手上方一個身位。', distance:70, behavior:'sweep'},
    {id:'reversal', title:'13 · 青色「電」：返雷', group:'反制', goal:'躍起接雷，落地前按攻擊，把電荷反擊命中陪練。', keys:'空白鍵接雷 → 空中點左鍵', tip:'等到青色「電」進入出手前再跳；太早跳可能已落地。接雷後身上會發亮；帶電落地會自傷。', distance:120, behavior:'lightning'},
    {id:'heal', title:'14 · 修復劑與安全距離', group:'資源', goal:'在安全距離完成一次修復劑治療，回復 40 HP。', keys:'R 使用修復劑', tip:'一般對局只有 3 次。喝藥鎖定 0.9 秒，受擊就中斷且不治療。先拉開超過 350 像素；訓練會免費補充藥劑。', distance:500},
    {id:'disc', title:'15 · 飛輪與疾斬', group:'裝備', goal:'飛輪實際命中，再用左鍵疾斬命中。', keys:'E 投飛輪 → 命中後左鍵', tip:'本課自動裝備飛輪。Q／滾輪可切換兩件裝備；投射物也能被招架。命中後的追斬有長距離突進。', distance:210, tool:'disc', total:2},
    {id:'flame', title:'16 · 熱流與附刃', group:'裝備', goal:'焰筒命中，再用附火輕斬命中。', keys:'E 噴射 → 放開 → 左鍵輕斬', tip:'本課自動裝備焰筒。火焰持續傷害並拖慢架勢恢復；噴射後銜接輕斬，可讓刀刃帶熱流 10 秒。', distance:95, tool:'flame', total:2},
    {id:'aegis', title:'17 · 輪盾的攻防轉換', group:'裝備', goal:'展盾接住陪練的飛輪，再用旋斬命中。', keys:'E 展盾 → 接到飛輪後點左鍵', tip:'本課自動裝備輪盾。可 360° 防禦投射物並減少架勢負擔，但持續耗共鳴。危險突刺、橫掃仍需對應反制。', distance:105, tool:'aegis', behavior:'disc', total:2},
    {id:'hammer', title:'18 · 重鎚與起手風險', group:'裝備', goal:'讓重鎚擊中普通防禦，造成崩解。', keys:'靠近後按 E', tip:'本課自動裝備重鎚。45 幀前搖與霸體不代表無敵；對手若完美招架，重鎚使用者會陷入長硬直。', distance:90, tool:'hammer', behavior:'guard'},
    {id:'blink', title:'19 · 影匣的受擊時機', group:'裝備', goal:'在受擊瞬間啟動影匣，觸發位移並讓背襲命中。', keys:'刀即將碰到身體時按 E', tip:'本課自動裝備影匣。有效窗口只有 12 幀；不是常駐無敵。成功後自動移至背後出刀，無需再按攻擊。', distance:90, tool:'blink', behavior:'light', total:2},
    {id:'cleave', title:'20 · 雙斷', group:'奧義', goal:'用雙斷命中，實際清除自己的架勢。', keys:'先按住右鍵，再點左鍵（鍵盤備用 O）', tip:'本課自動裝備雙斷。慢起手換取重架勢打擊；命中可清除 50 自身架勢。奧義耗 5 共鳴。', distance:100, art:'cleave'},
    {id:'rift', title:'21 · 裂斬', group:'奧義', goal:'用裂斬的遠距雙波命中陪練。', keys:'先按住右鍵，再點左鍵（鍵盤備用 O）', tip:'本課自動裝備裂斬。消耗 9 共鳴，雙波相隔 24 幀；對手可逐波格擋或招架。長起手與收招都留下反擊機會。', distance:260, art:'rift'},
    {id:'finisher', title:'22 · 倒地、斷決與雙核復燃', group:'結業', goal:'先一刀擊倒陪練，等收刀後靠近點左鍵斷決，見證第一核心復燃。', keys:'左鍵擊倒 → 等待收刀 → 貼近再點左鍵斷決', tip:'HP 歸零或架勢滿只會倒地。4 秒內貼近才能斷決；錯過會以 15 HP 起身。第一核被奪後滿血進入第二階段，第二核才結束對局。', distance:85},
  ];
  const $ = (id) => document.getElementById(id);
  const FREE = new Set(['IDLE','MOVE','GUARD']);
  class RiftTutorial {
    constructor(game) {
      this.game=game;this.active=false;this.index=0;this.completed=new Set();this.completedCurrent=false;
      this.lessons=LESSONS;this.lastDraw='';this.wait=0;this.ticks=0;this.count=0;this.flags={};
      try {const saved=JSON.parse(localStorage.getItem('riftblade-tutorial-v1')||'[]');for(const id of saved)if(LESSONS.some(l=>l.id===id))this.completed.add(id);} catch(_) {}
      this.observeCombat();this.bindUI();
    }
    bindUI() {
      $('start-tutorial')?.addEventListener('click',()=>this.start());
      $('training-retry')?.addEventListener('click',()=>this.select(this.index));
      $('training-next')?.addEventListener('click',()=>{if(!this.completedCurrent)return;if(this.index===LESSONS.length-1){this.stop();this.game.lobby();this.game.toast('陪練課程完成。可從任一課重練，或挑戰精英試煉。');}else this.select(this.index+1);});
      $('training-exit')?.addEventListener('click',()=>{this.stop();this.game.lobby();});
      $('training-fold')?.addEventListener('click',()=>{this.setCollapsed(!this.collapsed);this.game.focusArena();});
      const select=$('training-select');
      if(select){for(let i=0;i<LESSONS.length;i++){const option=document.createElement('option');option.value=String(i);option.textContent=LESSONS[i].title;select.appendChild(option);}select.addEventListener('change',()=>this.select(Number(select.value)));}
      $('training-expand')?.addEventListener('click',()=>{const detail=$('training-details'),button=$('training-expand');detail.hidden=!detail.hidden;button.setAttribute('aria-expanded',String(!detail.hidden));button.textContent=detail.hidden?'展開訣竅':'收起訣竅';this.game.focusArena();});
    }
    /** Read actual resolver returns; these wrappers never change combat results. */
    observeCombat() {
      const game=this.game;
      const hit=game.hit;
      game.hit=(a,t,m,opt={})=>{
        const info={attacker:a.id,defender:t.id,move:a.moveName,kind:m.kind,fire:a.fireBlade>0,aegis:!!t.aegis,targetHP:t.hp,attackerPosture:a.posture};
        const result=hit.call(game,a,t,m,opt);
        if(this.active){info.outcome=result;info.damage=info.targetHP-t.hp;info.postureRecovered=info.attackerPosture-a.posture;this.onEvent('hit',info);}
        return result;
      };
      const counter=game.counter;
      game.counter=(a,t,m,kind,...args)=>{const result=counter.call(game,a,t,m,kind,...args);if(this.active&&result)this.onEvent('counter',{attacker:a.id,defender:t.id,kind});return result;};
      const execute=game.execute;
      game.execute=(a,t)=>{if(this.active&&(this.lesson.id!=='finisher'||this.completedCurrent||a.id!==0||t.nodes!==2))return false;const nodes=t.nodes,result=execute.call(game,a,t);if(this.active&&result&&t.nodes<nodes)this.onEvent('finisher',{attacker:a.id,defender:t.id,nodes:t.nodes,phase:t.phase,hp:t.hp});return result;};
    }
    start() {
      this.stop();this.game.start('tutorial');this.active=true;
      this.game.world.weather='dusk';this.game.world.players[1].name='陪練・衡光';
      $('training-panel').hidden=false;this.select(0);
    }
    stop() {this.active=false;if($('training-panel'))$('training-panel').hidden=true;}
    setCollapsed(value) {
      if(!this.active)return;
      this.collapsed=!!value;
      $('training-body').hidden=this.collapsed;
      $('training-panel').classList.toggle('is-collapsed',this.collapsed);
      const button=$('training-fold');button.textContent=this.collapsed?'展開':'收合';
      button.setAttribute('aria-expanded',String(!this.collapsed));
      button.setAttribute('aria-label',this.collapsed?'展開教學說明':'收合教學，露出戰場');
    }
    select(index) {
      if(!this.active)return;
      this.setCollapsed(false);
      this.index=Math.max(0,Math.min(LESSONS.length-1,index));this.completedCurrent=false;this.count=0;this.ticks=0;this.wait=100;this.flags={};this.lastDraw='';
      const game=this.game,w=game.world,l=this.lesson,[p,e]=w.players;
      w.phase='fighting';w.weather='dusk';w.projectiles=[];w.lightning=[];w.effects.hitstop=0;w.effects.execution=0;w.effects.revival=0;
      const reset=(f,x,face)=>Object.assign(f,{x,y:810,vx:0,vy:0,ground:true,facing:face,hp:100,posture:0,spirit:20,nodes:2,phase:2,tonics:3,state:'IDLE',st:0,lockFrames:0,stun:0,move:null,moveName:'',attackId:null,cancelledAttackId:null,hits:[],wave:0,dead:false,guard:false,deflect:0,guardSpam:0,lastGuard:-999,lastParryTick:-999,guardBuffer:0,guardAge:0,aegis:false,aegisAge:0,prevBits:0,confirm:0,dash:0,dashDir:0,invuln:0,charged:0,burn:0,fireBlade:0,fireReady:0,blinkWindow:0,chase:0,grapple:null,drop:0,stomp:0,peace:0,healPending:0,attackReleased:true,holdCharged:false});
      reset(p,1850,1);reset(e,1850+l.distance,-1);e.aiControlled=false;e.name='陪練・衡光';
      // Lessons only override the live fighter loadout, never saved lobby choices.
      p.loadout=[l.tool||'disc',l.tool==='flame'?'disc':'flame'];p.art=l.art||'cleave';
      game.activeToolSlot=0;game.toolKeySlot=0;game.toolMouseSlot=0;
      if(l.id==='heal')p.hp=30;
      if(l.id==='posture'){p.posture=80;this.flags.initialPosture=80;}
      if(l.id==='cleave')p.posture=85;
      if(l.id==='finisher'){e.hp=1;e.posture=90;e.phase=1;}
      this.origin={x:p.x,y:p.y};this.lastPosition={x:p.x,y:p.y,ground:p.ground};
      this.flags.tonics=p.tonics;this.flags.hp=p.hp;
      game.clearInputs();game.paused=false;game.caption('陪練課程 · '+l.group,65);game.renderHUD();this.render();game.focusArena();
    }
    get lesson(){return LESSONS[this.index];}
    complete() {
      if(this.completedCurrent)return;this.completedCurrent=true;this.completed.add(this.lesson.id);this.count=this.lesson.total||1;
      this.setCollapsed(false);
      try{localStorage.setItem('riftblade-tutorial-v1',JSON.stringify([...this.completed]));}catch(_){}
      this.game.caption('完成 · '+this.lesson.title.slice(5),75);this.render();
    }
    award(flag) {
      if(this.completedCurrent||this.flags[flag])return;this.flags[flag]=true;this.count++;if(this.count>=(this.lesson.total||1))this.complete();else this.render();
    }
    onEvent(name,d) {
      if(!this.active||this.completedCurrent)return;
      const id=this.lesson.id,own=d.attacker===0,target=d.defender===0;
      if(name==='counter'&&target){
        if(id==='parry'&&d.kind==='PARRIED')this.award('parry'+this.count);
        if(id==='bladePin'&&d.kind==='BLADE_PIN')this.award('pin'+this.count);
        if(id==='stomp'&&d.kind==='STOMP')this.award('stomp');
      }
      if(name==='finisher'&&own&&id==='finisher'&&d.nodes===1&&d.phase===2&&d.hp===100)this.award('revived');
      if(name!=='hit')return;
      const connects=d.outcome==='hit',blocked=d.outcome==='guard';
      if(own){
        if(id==='light'&&d.move==='light'&&connects)this.award('light');
        if(id==='charged'&&d.move==='charged'&&(connects||blocked))this.award('charged');
        if(id==='combo'&&d.move==='combo'&&connects)this.award('combo');
        if(id==='reversal'&&d.move==='reversal'&&connects)this.award('reversal');
        if(id==='disc'&&d.kind==='projectile'&&connects)this.award('discHit');
        if(id==='disc'&&d.move==='chase'&&connects&&this.flags.discHit)this.award('chaseHit');
        if(id==='flame'&&d.move==='flame'&&connects)this.award('flameHit');
        if(id==='flame'&&d.move==='light'&&d.fire&&connects&&this.flags.flameHit)this.award('fireHit');
        if(id==='aegis'&&d.move==='aegis'&&connects&&this.flags.shield)this.award('shieldHit');
        if(id==='hammer'&&d.move==='hammer'&&blocked&&this.game.world.players[1].state==='STUNNED')this.award('hammer');
        if(id==='blink'&&d.move==='blink'&&connects&&this.flags.blinked)this.award('blinkHit');
        if(id==='cleave'&&d.move==='cleave'&&connects&&d.postureRecovered>0)this.award('cleave');
        if(id==='rift'&&d.move==='rift'&&connects&&d.damage>0)this.award('rift');
      }
      if(target){
        if(id==='guard'&&blocked)this.award('block'+this.count);
        if(id==='aegis'&&d.aegis&&d.kind==='projectile'&&['guard','deflect'].includes(d.outcome))this.award('shield');
        if(id==='blink'&&d.outcome==='blink')this.award('blinked');
        if(id==='reversal'&&d.outcome==='catch'){this.flags.caught=true;this.render();}
      }
    }
    beforeStep(inputs) {
      if(!this.active||this.game.mode!=='tutorial')return inputs;
      const out=[inputs[0]||0,0],w=this.game.world,[p,e]=w.players,l=this.lesson,B=this.game.debug.bits;
      // The engine owns hitstop and edge buffering; do not advance lesson clocks.
      if(w.effects.hitstop>0)return out;
      this.ticks++;p.spirit=20;e.spirit=20;p.tonics=Math.max(1,p.tonics);
      if(l.id!=='heal'&&l.id!=='posture')p.hp=Math.max(60,p.hp);
      if(l.id!=='finisher'&&!['STUNNED','REVIVING'].includes(e.state)){e.hp=Math.max(55,e.hp);e.posture=Math.min(70,e.posture);}
      if(this.completedCurrent)return out;
      // A missed exercise never spends a core or ends practice. Reset only after
      // the authentic hit reaction, so contact feedback remains visible.
      if(p.state==='STUNNED'&&p.lockFrames<160){this.select(this.index);return[0,0];}
      if(e.state==='STUNNED'&&l.id!=='finisher'&&e.lockFrames<160){this.select(this.index);return[0,0];}
      if(l.id==='posture'&&this.flags.highRecovery&&!this.flags.lowObserved){
        this.flags.lowTicks=(this.flags.lowTicks||0)+1;
        if(this.flags.lowTicks>=90&&p.hp<50&&Math.abs(p.posture-50)<.001)this.award('lowObserved');
      }
      if(this.wait>0)this.wait--;
      if(l.behavior==='guard'&&(FREE.has(e.state)||e.state==='DEFLECT')){out[1]=B.GUARD;return out;}
      if(!FREE.has(e.state)||e.lockFrames>0)return out;
      e.facing=p.x>=e.x?1:-1;
      if(!l.behavior)return out;
      const dx=p.x-e.x,dy=p.y-e.y,dist=Math.abs(dx);
      if(Math.abs(dy)>110){
        // A patient companion waits for a return to the lesson's bridge; retry
        // is always available. It never attacks an unseen floor through walls.
        return out;
      }
      const desired=l.behavior==='disc'?145:l.behavior==='lightning'?125:l.behavior==='thrust'?130:l.behavior==='sweep'?65:85;
      if(dist>desired+25){out[1]=dx>0?B.RIGHT:B.LEFT;return out;}
      if(dist<35){out[1]=dx>0?B.LEFT:B.RIGHT;return out;}
      if(this.wait===0){
        out[1]=l.behavior==='light'?B.ATTACK:l.behavior==='thrust'?B.THRUST:l.behavior==='sweep'?B.SWEEP:l.behavior==='lightning'?B.LIGHTNING:B.TOOL1;
        if(l.behavior==='disc')e.loadout=['disc','flame'];
        this.wait=l.behavior==='lightning'?190:140;
      }
      return out;
    }
    afterStep() {
      if(!this.active||this.game.mode!=='tutorial')return;
      const [p,e]=this.game.world.players,id=this.lesson.id,last=this.lastPosition;
      if(!this.completedCurrent){
        if(id==='move'){if(p.x<=this.origin.x-100)this.award('left');if(p.x>=this.origin.x+100)this.award('right');}
        if(id==='jump'){if(!p.ground&&p.y<this.origin.y-50)this.flags.airborne=true;if(this.flags.airborne&&p.ground&&!last.ground)this.award('landed');}
        if(id==='dash'){if(p.dash>0&&!this.flags.dashStart)this.flags.dashStart=p.x;if(this.flags.dashStart!=null&&Math.abs(p.x-this.flags.dashStart)>=80)this.award('dash');}
        if(id==='grapple'){if(p.state==='GRAPPLING')this.flags.hooked=true;if(this.flags.hooked&&p.y<=this.origin.y-80)this.award('grapple');}
        if(id==='posture'&&!this.flags.highRecovery&&p.guard&&p.posture<=60){this.award('highRecovery');p.hp=40;p.posture=50;this.flags.lowTicks=0;this.game.caption('HP 40%：自然架勢恢復停止',100);this.render();}
        if(id==='heal'&&p.hp>=70&&p.state!=='DRINKING'&&p.tonics<this.flags.tonics)this.award('healed');
      }
      this.lastPosition={x:p.x,y:p.y,ground:p.ground};
      if(this.ticks%20===0)this.render();
    }
    render() {
      if(!this.active)return;
      const l=this.lesson,total=l.total||1,stage=l.id==='posture'&&this.flags.highRecovery&&!this.completedCurrent?'現在 HP 40%；保持防禦，觀察架勢停在 50。':l.id==='reversal'&&this.flags.caught&&!this.completedCurrent?'已接到電荷！落地前點左鍵。':'';
      const status=this.completedCurrent?'課程完成，可以進入下一課。':stage||`${this.count} / ${total} · ${l.goal}`;
      const key=[this.index,this.count,this.completedCurrent,status,this.completed.size].join('|');if(key===this.lastDraw)return;this.lastDraw=key;
      $('training-title').textContent=l.title;$('training-group').textContent=`陪練 ${this.index+1} / ${LESSONS.length} · ${l.group}`;
      $('training-goal').textContent=l.goal;$('training-keys').textContent=l.keys;$('training-tip').textContent=l.tip;
      $('training-status').textContent=status;$('training-status').classList.toggle('is-complete',this.completedCurrent);
      $('training-progress').style.width=`${this.completed.size/LESSONS.length*100}%`;
      $('training-select').value=String(this.index);$('training-next').disabled=!this.completedCurrent;
      $('training-next').textContent=this.index===LESSONS.length-1?'完成訓練':'下一課 →';
      for(const option of $('training-select').options){const lesson=LESSONS[Number(option.value)];option.textContent=(this.completed.has(lesson.id)?'✓ ':'')+lesson.title;}
    }
  }
  root.RiftTutorial=RiftTutorial;
})(globalThis);
