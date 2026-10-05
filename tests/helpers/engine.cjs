'use strict';
// Executes the production simulation without a browser or sockets. DOM, drawing
// and sound are adapters only; combat, input buffering, AI and training stay real.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {SRC} = require('./paths.cjs');
module.exports=function makeHarness({tutorial=true}={}){
 const elements=new Map(), storage=new Map();
 const element=id=>{
  if(elements.has(id))return elements.get(id);
  const classes=new Set(),e={id,style:{},dataset:{},hidden:true,disabled:false,value:'',textContent:'',options:[],children:[],
   classList:{add(...ns){ns.forEach(n=>classes.add(n));},remove(...ns){ns.forEach(n=>classes.delete(n));},toggle(n,value){if(value??!classes.has(n))classes.add(n);else classes.delete(n);},contains:n=>classes.has(n)},
   setAttribute(n,v){this[n]=String(v);},getAttribute(n){return this[n];},addEventListener(){},removeEventListener(){},
   appendChild(child){this.children.push(child);this.options.push(child);},focus(){scope.document.activeElement=this;},closest(){return null;},select(){},getBoundingClientRect(){return {x:0,y:0,width:1440,height:900};}};
  elements.set(id,e);return e;
 };
 const scope={console,Math,Date,URL,Map,Set,Promise,Float32Array,Uint8Array,
  performance:{now:()=>0},innerWidth:1440,innerHeight:900,devicePixelRatio:1,
  requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},setTimeout:()=>1,clearTimeout:()=>{},addEventListener:()=>{},
  location:{href:'https://example.test/Game/'},navigator:{},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  document:{body:{classList:{add(){},remove(){},contains(){return false;}}},hidden:false,activeElement:null,getElementById:element,querySelectorAll:()=>[],addEventListener:()=>{},createElement:tag=>element('created-'+tag+'-'+elements.size)},
  RiftRenderer:class{render(){}},RiftAudio:class{start(){return Promise.resolve(true);}setMuted(){}setVolume(){}setMusicVolume(){}setScene(){}setSuspended(){}sfx(){}update(){}}};
 scope.window=scope;vm.createContext(scope);
 for(const name of ['fsm.js','vitals.js','authority.js','ai.js',...(tutorial?['tutorial.js']:[]),'core.js'])vm.runInContext(fs.readFileSync(path.join(SRC,name),'utf8'),scope,{filename:name});
 return {scope,elements,run:source=>vm.runInContext(source,scope),game:scope.game};
};
