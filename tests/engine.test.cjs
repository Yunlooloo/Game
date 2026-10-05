'use strict';
const fs=require('node:fs'),path=require('node:path');
const make=require('./helpers/engine.cjs');
const {REPORTS} = require('./helpers/paths.cjs');
const suites=['combat-basics.js','combat-mechanics.js','downed-timing.js','tutorial.js'];
const report={runtime:'Production Game/FSM/Vitals/AI/Authority/Tutorial in Node VM; DOM/audio/render mocked',suites:[]};
for(const suite of suites){
 const h=make(),rows=h.run('('+fs.readFileSync(path.join(__dirname,'cases',suite),'utf8')+')()');
 const entry={suite,passed:rows.filter(r=>r.passed).length,failed:rows.filter(r=>!r.passed),total:rows.length};
 report.suites.push(entry);console.log(suite,entry.passed+'/'+entry.total);for(const r of entry.failed)console.error(JSON.stringify(r));
}
// Real input sequence, no direct hit injection: the confirmed second slash must
// reach its target after a short physical knockback.
{
 const h=make(),g=h.game,B=g.debug.bits;g.start('local');g.silent=true;
 Object.assign(g.world.players[0],{x:1800,y:1080,facing:1,ground:true});
 Object.assign(g.world.players[1],{x:1890,y:1080,facing:-1,ground:true});
 g.step([B.ATTACK,0]);let followed=false;
 for(let i=0;i<100;i++){
  const a=g.world.players[0];const next=!followed&&a.state==='RECOVERY'&&a.confirm>0&&g.world.effects.hitstop===0;
  g.step([next?B.ATTACK:0,0]);if(next)followed=true;
 }
 const b=g.world.players[1];const row={suite:'Actual two-hit combo stays in reach',passed:b.hp===79&&b.x<1930?1:0,total:1,failed:[]};
 if(!row.passed)row.failed.push({hp:b.hp,x:b.x,followed});report.suites.push(row);console.log(row.suite,row.passed+'/1');
}
fs.writeFileSync(path.join(REPORTS,'engine.json'),JSON.stringify(report,null,2));
if(report.suites.some(s=>s.failed.length))process.exitCode=1;
