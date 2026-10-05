'use strict';
const {SRC, REPORTS} = require('./helpers/paths.cjs');
// Production AI + Game.tickPlayer/physics/grapple/FSM/vitals in a deterministic
// VM. Only DOM/audio/render adapters are omitted; movement is never mocked.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const scope = { console, Math, Date, Set, Map, performance: { now: () => 0 }, document: {getElementById:()=>null} };
scope.window = scope;
vm.createContext(scope);
for (const name of ['fsm.js','vitals.js','ai.js']) vm.runInContext(fs.readFileSync(path.join(SRC,name),'utf8'),scope);
vm.runInContext(fs.readFileSync(path.join(SRC,'core.js'),'utf8').replace('window.game = new Game();','window.TestGame = Game; window.testWorld = makeWorld;'),scope);
const B=scope.RIFT.B, rows=[];
const check=(name,pass,actual)=>{rows.push({name,pass:!!pass,actual}); if(!pass) console.error('FAIL',name,actual);};
function gameAt(boss,player){
 const g=Object.create(scope.TestGame.prototype);
 Object.assign(g,{world:scope.testWorld(),mode:'local',localId:0,mouseButtons:new Set(),mouseFaceTick:-1,
  mouseArtGesture:false,buffered:[0,0],rawPrev:[0,0],silent:true,authority:null,
  stats:{hits:0,deflects:0,bladeCounter:0,stomps:0,reversals:0},scores:[0,0]});
 g.world.phase='fighting';g.world.weather='dusk';g.ai=new scope.RiftAI();
 Object.assign(g.world.players[0],{x:player[0],y:player[1],ground:true,loadout:[],invuln:100000});
 Object.assign(g.world.players[1],{x:boss[0],y:boss[1],ground:true,loadout:[],aiControlled:true});
 return g;
}
const routeCases=[
 ['central bridge → ground',[2100,810],[2100,1080]],
 ['ground → central bridge',[2100,1080],[2100,810]],
 ['upper gantry → central bridge',[2050,465],[2050,810]],
 ['central bridge → upper gantry',[2050,810],[2050,465]],
 ['lower west bridge → ground',[600,870],[600,1080]],
 ['ground → lower west bridge',[600,1080],[600,870]],
 ['west gantry → lower west bridge',[650,600],[650,870]],
 ['lower west bridge → west gantry',[650,870],[650,600]],
 ['upper pylon → central bridge',[2300,220],[2300,810]],
 ['central bridge → upper pylon',[2300,810],[2300,220]],
 ['east gantry → east bridge',[3000,540],[3000,905]],
 ['east bridge → east gantry',[3000,905],[3000,540]],
 ['west stone → west pylon',[1350,920],[1350,470]],
 ['west pylon → west stone',[1350,470],[1350,920]],
 ['central bridge left edge → upper gantry',[1610,810],[1800,465]],
 ['central bridge right edge → upper gantry',[2420,810],[2280,465]],
 ['ground west of central bridge → bridge',[1520,1080],[1700,810]],
 ['ground east of central bridge → bridge',[2550,1080],[2360,810]],
];
for(const [name,boss,player] of routeCases){
 const g=gameAt(boss,player), [p,b]=g.world.players, trace=[];
 let arrived=-1, used=0;
 for(let i=0;i<900;i++){
  const bits=g.ai.input(g.world,b,p);used|=bits;
  g.step([0,bits]);
  if(i%60===0)trace.push([i,Math.round(b.x),Math.round(b.y),b.state,g.ai.nav?.type]);
  if(Math.abs(b.x-p.x)<150 && Math.abs(b.y-p.y)<75 && b.ground){arrived=i+1;break;}
 }
 check(name,arrived>0&&arrived<=240,{frames:arrived,used,trace});
}
// Exhaustive nearby platform-center pairs exercise the static route graph rather
// than just the center of the initial arena. All require real landing/contact.
{
 const geometry=scope.testWorld().platforms;let tested=0;const failures=[];let slowest=0;
 for(let i=1;i<geometry.length;i++) for(let j=1;j<geometry.length;j++){
  const a=geometry[i],b=geometry[j],ax=a.x+a.w/2,bx=b.x+b.w/2;
  if(i===j||Math.abs(a.y-b.y)<=105||Math.hypot(ax-bx,a.y-b.y)>790)continue;
  const g=gameAt([ax,a.y],[bx,b.y]),[p,boss]=g.world.players;let arrived=false;
  for(let f=0;f<600;f++){
   g.step([0,g.ai.input(g.world,boss,p)]);
   if(Math.abs(boss.x-p.x)<150&&Math.abs(boss.y-p.y)<75&&boss.ground){arrived=true;slowest=Math.max(slowest,f+1);break;}
  }
  tested++;if(!arrived)failures.push({from:i,to:j,x:boss.x,y:boss.y,state:boss.state});
 }
 check('All nearby upper/lower platform-center routes converge',!failures.length,{tested,slowest,failures});
}
{
 const g=gameAt([2150,810],[2150,465]),[p,b]=g.world.players;let drops=0,rejoined=false;
 for(let i=0;i<480;i++){
  const playerBits=i>20&&p.ground&&p.y<1080&&!(p.prevBits&B.JUMP)?B.DOWN|B.JUMP:0;
  if(playerBits)drops++;
  g.step([playerBits,g.ai.input(g.world,b,p)]);
  if(p.y===1080&&b.ground&&b.y===1080&&Math.abs(p.x-b.x)<150){rejoined=true;break;}
 }
 check('Routing replans when the observed player descends during pursuit',rejoined&&drops===2,{drops,playerY:p.y,bossX:b.x,bossY:b.y});
}
// A new vertical position cannot influence navigation before the 12f observation delay.
{
 const g1=gameAt([2100,810],[2300,810]),g2=gameAt([2100,810],[2300,810]);
 for(let i=0;i<24;i++){g1.ai.input(g1.world,g1.world.players[1],g1.world.players[0]);g2.ai.input(g2.world,g2.world.players[1],g2.world.players[0]);}
 g2.world.players[0].y=465;
 let same=true;
 for(let i=0;i<12;i++)same&&=g1.ai.input(g1.world,...g1.world.players.slice().reverse())===g2.ai.input(g2.world,...g2.world.players.slice().reverse());
 check('Vertical routing retains full 12-frame visual latency',same);
}
{
 const g=gameAt([2100,1080],[2250,1080]),[p,b]=g.world.players;
 b.hp=35;let started=-1,healed=-1,healPosition=null,previousHP=b.hp;
 for(let i=0;i<500;i++){
  const bits=g.ai.input(g.world,b,p);g.step([0,bits]);
  if(started<0&&b.state==='DRINKING'){started=i+1;healPosition=b.x;check('Boss creates >350px space before drinking',Math.abs(b.x-p.x)>350,{distance:Math.abs(b.x-p.x)});}
  if(b.hp>previousHP){healed=i+1;break;}
 }
 check('Wounded boss retreats and completes shared tonic',started>0&&healed-started===53&&b.hp===75&&b.tonics===2,{started,healed,hp:b.hp,tonics:b.tonics,x:b.x,healPosition});
}
{
 const g=gameAt([1800,1080],[2300,1080]),[p,b]=g.world.players;b.hp=35;
 for(let i=0;i<200&&b.state!=='DRINKING';i++)g.step([0,g.ai.input(g.world,b,p)]);
 const hp=b.hp;scope.RiftVitals.hurt(b,10,{posture:4,stun:18});
 for(let i=0;i<80;i++)g.step([0,0]);
 check('Boss tonic remains interruptible with no delayed healing',b.hp===hp-10&&b.tonics===2&&b.healPending===0,{hp:b.hp,tonics:b.tonics,pending:b.healPending});
}
{
 const g=gameAt([1800,1080],[2300,1080]),[p,b]=g.world.players;b.hp=35;b.tonics=0;let healed=false;
 for(let i=0;i<200;i++){g.step([0,g.ai.input(g.world,b,p)]);healed ||= b.state==='DRINKING'||b.hp>35;}
 check('Boss cannot heal with an empty inventory',!healed,{hp:b.hp,tonics:b.tonics});
}
{
 const g=gameAt([80,1080],[220,1080]),[p,b]=g.world.players;b.hp=35;let drank=false;
 for(let i=0;i<600;i++){g.step([0,g.ai.input(g.world,b,p)]);drank ||= b.state==='DRINKING';if(b.hp>35)break;}
 check('Cornered boss escapes healing retreat instead of running into boundary',drank&&b.hp===75,{x:b.x,hp:b.hp,tonics:b.tonics});
}
fs.writeFileSync(path.join(REPORTS,'ai-navigation.json'),JSON.stringify(rows,null,2));
console.log(`${rows.filter(r=>r.pass).length}/${rows.length} actual-engine AI navigation/heal checks passed.`);
assert(rows.every(r=>r.pass),'AI navigation/heal failures');
