(function(){
'use strict';
if(!/^\/blog\//.test(location.pathname)||location.pathname==='/blog/')return;
var API='/api/rastreamento';
var KEY='mpmv_article_track_v1';
var nowIso=function(){return new Date().toISOString()};
var q=new URLSearchParams(location.search);
var ref=document.referrer||'';
var source=q.get('utm_source')||'';
if(!source){
  try{var h=ref?new URL(ref).hostname:'';if(/google\./i.test(h))source='google';else if(/bing\./i.test(h))source='bing';else if(/facebook|instagram/i.test(h))source='meta';else if(h)source=h;else source='direct';}catch(_){source='direct';}
}
function id(){return 'a_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10)}
function load(){try{return JSON.parse(sessionStorage.getItem(KEY)||'null')}catch(_){return null}}
function save(v){try{sessionStorage.setItem(KEY,JSON.stringify(v))}catch(_){}}
var state=load();
var path=location.pathname+location.search;
if(!state||!state.sessionId){state={sessionId:id(),noteId:'',startedAt:nowIso(),updatedAt:nowIso(),landingPage:path,currentPage:path,referrer:ref,source:source,medium:q.get('utm_medium')||'',campaign:q.get('utm_campaign')||'',adset:q.get('utm_content')||'',ad:q.get('ad')||'',term:q.get('utm_term')||'',fbclid:q.get('fbclid')||'',gclid:q.get('gclid')||'',activeSeconds:0,elapsedSeconds:0,pageViews:1,device:/Mobi|Android/i.test(navigator.userAgent)?'mobile':'desktop',browser:navigator.userAgent.slice(0,120),converted:false,conversionType:'',convertedAt:'',name:'',email:'',phone:'',pages:[{path:path,at:nowIso()}]};}
else{
  state.currentPage=path;state.pageViews=Math.min(100,Number(state.pageViews||1)+1);state.pages=Array.isArray(state.pages)?state.pages:[];state.pages.push({path:path,at:nowIso()});state.pages=state.pages.slice(-25);if(!state.referrer)state.referrer=ref;if(!state.source||state.source==='direct')state.source=source;
}
var visibleAt=document.visibilityState==='visible'?Date.now():0;
var startedMs=Date.parse(state.startedAt)||Date.now();
function tick(){if(visibleAt){var n=Date.now();state.activeSeconds=Math.min(86400,Number(state.activeSeconds||0)+(n-visibleAt)/1000);visibleAt=n;}state.elapsedSeconds=Math.min(86400,(Date.now()-startedMs)/1000);state.updatedAt=nowIso();save(state);}
async function send(action,keepalive){tick();var body={action:action,noteId:state.noteId||'',data:state};try{var r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:!!keepalive});var d={};try{d=await r.json()}catch(_){}if(r.ok&&d.noteId){state.noteId=String(d.noteId);save(state);}return r.ok;}catch(_){return false;}}
function start(){send(state.noteId?'update':'start',false)}
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'){visibleAt=Date.now();}else{send(state.noteId?'update':'start',true);visibleAt=0;}});
window.addEventListener('pagehide',function(){send(state.noteId?'update':'start',true)});
setInterval(function(){send(state.noteId?'update':'start',false)},15000);
setTimeout(start,120);
})();