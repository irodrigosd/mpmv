(function(){
  'use strict';

  var GA_ID='G-CJHQRJY79Z';
  var META_PIXEL_ID='1327862439332530';
  var CONSENT_KEY='mpmv-cookie-consent-v3';
  var gaLoaded=false,metaLoaded=false,pageContextTracked=false;

  window.dataLayer=window.dataLayer||[];
  window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};
  window.gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});

  function getConsent(){try{return localStorage.getItem(CONSENT_KEY)||''}catch(_){return ''}}
  function saveConsent(value){try{localStorage.setItem(CONSENT_KEY,value)}catch(_){}}
  function hasConsent(){return getConsent()==='accepted'}
  function setDenied(){window.gtag('consent','update',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'})}

  function loadGA(){
    if(gaLoaded||!hasConsent())return;
    gaLoaded=true;
    window.gtag('consent','update',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});
    var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(GA_ID);document.head.appendChild(s);
    window.gtag('js',new Date());window.gtag('config',GA_ID,{send_page_view:true});
  }

  function loadMeta(){
    if(metaLoaded||!hasConsent())return;
    metaLoaded=true;
    if(!window.fbq){
      var fbq=function(){fbq.callMethod?fbq.callMethod.apply(fbq,arguments):fbq.queue.push(arguments)};
      fbq.push=fbq;fbq.loaded=true;fbq.version='2.0';fbq.queue=[];window.fbq=fbq;window._fbq=fbq;
      var s=document.createElement('script');s.async=true;s.src='https://connect.facebook.net/en_US/fbevents.js';
      var first=document.getElementsByTagName('script')[0];if(first&&first.parentNode)first.parentNode.insertBefore(s,first);else document.head.appendChild(s);
    }
    window.fbq('init',META_PIXEL_ID);window.fbq('track','PageView');
  }

  function trackPageContext(){
    if(pageContextTracked||!hasConsent())return;pageContextTracked=true;
    var path=String(location.pathname||'/').toLowerCase();
    if(path==='/curso'||path==='/curso/'){
      if(window.fbq)window.fbq('track','ViewContent',{content_name:'Como Criar Posts Virais com Persuasão no ChatGPT',content_category:'curso'});
      window.gtag('event','view_item',{item_name:'Como Criar Posts Virais com Persuasão no ChatGPT',item_category:'curso'});
    }else if(path==='/mentoria'||path==='/mentoria/'){
      if(window.fbq)window.fbq('track','ViewContent',{content_name:'Mentoria Individual de Persuasão e Vendas',content_category:'mentoria'});
      window.gtag('event','view_item',{item_name:'Mentoria Individual de Persuasão e Vendas',item_category:'mentoria'});
    }
  }

  function loadTracking(){if(!hasConsent())return;loadGA();loadMeta();trackPageContext()}
  function gaEvent(name,params){if(!hasConsent())return false;loadTracking();window.gtag('event',name,params||{});return true}
  function metaEvent(name,params,custom){if(!hasConsent())return false;loadTracking();if(!window.fbq)return false;window.fbq(custom?'trackCustom':'track',name,params||{});return true}
  function trackLead(params){var d=params||{};gaEvent('generate_lead',{lead_source:d.source||'guia-pratico',page_path:d.page||location.pathname});metaEvent('Lead',{content_name:'Guia Prático Persuasão pra Vender Todo Santo Dia',content_category:'lead_magnet'},false)}
  function trackCourseInterest(source){gaEvent('select_content',{content_type:'curso',item_id:'posts-virais-chatgpt',source:source||location.pathname});metaEvent('CourseInterest',{source:source||location.pathname},true)}
  function trackMentoriaInterest(source){gaEvent('select_content',{content_type:'mentoria',item_id:'mentoria-individual',source:source||location.pathname});metaEvent('MentoriaInterest',{source:source||location.pathname},true)}
  function trackWhatsAppClick(source){gaEvent('contact',{method:'whatsapp',source:source||location.pathname});metaEvent('WhatsAppClick',{source:source||location.pathname},true)}
  function trackCheckout(source){gaEvent('begin_checkout',{currency:'BRL',value:37,item_name:'Como Criar Posts Virais com Persuasão no ChatGPT',source:source||location.pathname});metaEvent('InitiateCheckout',{currency:'BRL',value:37,content_name:'Como Criar Posts Virais com Persuasão no ChatGPT'},false)}

  function hideBanner(){var b=document.getElementById('mpmv-cookie-banner');if(!b)return;if(b.classList&&b.classList.contains('mpmv-cookie-banner'))b.classList.add('mpmv-hidden');b.style.display='none'}
  function showExistingBanner(){var b=document.getElementById('mpmv-cookie-banner');if(!b)return false;if(b.classList)b.classList.remove('mpmv-hidden');b.style.display='';return true}
  function createBanner(){
    if(showExistingBanner())return;
    var b=document.createElement('aside');b.id='mpmv-cookie-banner';b.setAttribute('role','dialog');b.setAttribute('aria-label','Preferências de cookies');
    b.style.cssText='position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;max-width:980px;margin:auto;background:#111;color:#fff;border:1px solid #353535;border-radius:14px;padding:16px 18px;box-shadow:0 14px 44px rgba(0,0,0,.28);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap';
    b.innerHTML='<div style="flex:1 1 480px"><strong style="display:block;margin-bottom:4px">Cookies e medição</strong><span style="color:#d0d0d0;font-size:.92rem;line-height:1.45">Com sua autorização, usamos Google Analytics e Meta Pixel para entender visitas e ações no site. <a href="/politica-de-privacidade/" style="color:#fff;text-decoration:underline">Política de Privacidade</a>.</span></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" data-mpmv-cookie="declined" style="border:1px solid #555;background:transparent;color:#fff;border-radius:9px;padding:10px 14px;font-weight:700;cursor:pointer">Agora não</button><button type="button" data-mpmv-cookie="accepted" style="border:0;background:#c99a2e;color:#15110a;border-radius:9px;padding:10px 14px;font-weight:900;cursor:pointer">Aceitar cookies</button></div>';
    document.body.appendChild(b);
  }
  function handleChoice(value){if(value!=='accepted'&&value!=='declined')return;saveConsent(value);if(value==='accepted')loadTracking();else setDenied();hideBanner()}
  function handleTrackedLink(event){
    var a=event.target&&event.target.closest?event.target.closest('a[href]'):null;if(!a)return;var href=String(a.getAttribute('href')||'');if(!href)return;
    if(/pay\.hotmart\.com/i.test(href))trackCheckout(location.pathname);
    else if(/^\/curso\/?(?:$|[?#])/i.test(href))trackCourseInterest(location.pathname);
    else if(/^\/mentoria\/?(?:$|[?#])/i.test(href))trackMentoriaInterest(location.pathname);
    else if(/wa\.me|api\.whatsapp\.com/i.test(href))trackWhatsAppClick(location.pathname);
  }
  function init(){
    var current=getConsent();if(current==='accepted')loadTracking();else if(current==='declined')setDenied();else createBanner();
    document.addEventListener('click',function(event){var c=event.target&&event.target.closest?event.target.closest('[data-mpmv-cookie]'):null;if(c)handleChoice(c.getAttribute('data-mpmv-cookie'));handleTrackedLink(event)},true);
  }

  window.MPMVAnalytics={measurementId:GA_ID,metaPixelId:META_PIXEL_ID,getConsent:getConsent,accept:function(){handleChoice('accepted')},decline:function(){handleChoice('declined')},trackLead:trackLead,trackCourseInterest:trackCourseInterest,trackMentoriaInterest:trackMentoriaInterest,trackWhatsAppClick:trackWhatsAppClick,trackCheckout:trackCheckout,trackEvent:function(name,params){return gaEvent(name,params)},trackMetaCustom:function(name,params){return metaEvent(name,params,true)}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* MPMV Attribution Relay — no cookies and no browser storage. It only carries acquisition context in links the visitor intentionally follows. */
(function(){
  'use strict';
  function clean(v,max){return String(v==null?'':v).trim().slice(0,max||500)}
  function sameHost(url){return url.origin===location.origin}
  function currentPath(){return location.pathname+location.search}
  function refInfo(ref){
    if(!ref)return {source:'direct',medium:'none'};
    var host='';try{host=new URL(ref).hostname.toLowerCase()}catch(_){return {source:'referral',medium:'referral'}}
    if(host===location.hostname.toLowerCase())return {source:'internal',medium:'internal'};
    if(/(^|\.)google\./.test(host))return {source:'google',medium:'organic'};
    if(/(^|\.)bing\.com$/.test(host))return {source:'bing',medium:'organic'};
    if(/yahoo\./.test(host))return {source:'yahoo',medium:'organic'};
    if(/duckduckgo\./.test(host))return {source:'duckduckgo',medium:'organic'};
    if(/instagram\./.test(host))return {source:'instagram',medium:'organic_social'};
    if(/facebook\.|fb\.com/.test(host))return {source:'facebook',medium:'organic_social'};
    return {source:host||'referral',medium:'referral'};
  }
  function context(){
    var q=new URLSearchParams(location.search),ref=clean(q.get('mpmv_referrer')||document.referrer||'',1000);
    var source=clean(q.get('utm_source')||q.get('mpmv_source')||'',150);
    var medium=clean(q.get('utm_medium')||q.get('mpmv_medium')||'',150);
    var campaign=clean(q.get('utm_campaign')||q.get('mpmv_campaign')||'',250);
    var term=clean(q.get('utm_term')||q.get('mpmv_term')||'',250);
    var content=clean(q.get('utm_content')||q.get('mpmv_content')||'',250);
    var fbclid=clean(q.get('fbclid')||q.get('mpmv_fbclid')||'',500);
    var gclid=clean(q.get('gclid')||q.get('mpmv_gclid')||'',500);
    if(!source){if(fbclid){source='meta';medium=medium||'paid_social'}else if(gclid){source='google';medium=medium||'cpc'}else{var ri=refInfo(ref);source=ri.source;medium=medium||ri.medium}}
    var landing=clean(q.get('mpmv_landing')||currentPath(),1000);
    return {source:source||'direct',medium:medium||'none',campaign:campaign,term:term,content:content,fbclid:fbclid,gclid:gclid,referrer:ref,landingPage:landing};
  }
  function isFunnelInternal(url){
    if(!sameHost(url))return false;
    var p=url.pathname.toLowerCase();
    return p==='/'||/^\/blog(?:\/|$)/.test(p)||/^\/(curso|mentoria|obrigado)(?:\/|$)/.test(p);
  }
  function setIfMissing(sp,key,value){if(value&&!sp.has(key))sp.set(key,value)}
  function hotmartCode(c){
    var raw=[c.source,c.medium,c.campaign].filter(Boolean).join('-').toLowerCase();
    raw=raw.replace(/_/g,'-').replace(/[^a-z0-9|.-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
    return (raw||'mpmv').slice(0,30);
  }
  function decorate(href){
    var url;try{url=new URL(href,location.href)}catch(_){return href}
    var c=context();
    if(isFunnelInternal(url)){
      setIfMissing(url.searchParams,'mpmv_source',c.source);setIfMissing(url.searchParams,'mpmv_medium',c.medium);setIfMissing(url.searchParams,'mpmv_campaign',c.campaign);
      setIfMissing(url.searchParams,'mpmv_term',c.term);setIfMissing(url.searchParams,'mpmv_content',c.content);setIfMissing(url.searchParams,'mpmv_referrer',c.referrer);
      setIfMissing(url.searchParams,'mpmv_landing',c.landingPage);setIfMissing(url.searchParams,'mpmv_fbclid',c.fbclid);setIfMissing(url.searchParams,'mpmv_gclid',c.gclid);
      return url.pathname+url.search+url.hash;
    }
    if(/(^|\.)pay\.hotmart\.com$/i.test(url.hostname)){
      setIfMissing(url.searchParams,'utm_source',c.source);setIfMissing(url.searchParams,'utm_medium',c.medium);setIfMissing(url.searchParams,'utm_campaign',c.campaign||'mpmv');
      setIfMissing(url.searchParams,'utm_term',c.term);setIfMissing(url.searchParams,'utm_content',c.content);setIfMissing(url.searchParams,'sck',hotmartCode(c));
      return url.toString();
    }
    return href;
  }
  function relayClick(event){var a=event.target&&event.target.closest?event.target.closest('a[href]'):null;if(!a)return;var before=a.getAttribute('href')||'';var after=decorate(before);if(after&&after!==before)a.setAttribute('href',after)}
  window.MPMVAttribution={getContext:context,decorateUrl:decorate};
  document.addEventListener('click',relayClick,true);
})();

/* MPMV Native Traffic Tracking — first-party session tracking starts only after cookie consent. */
(function(){
  'use strict';
  var CONSENT_KEY='mpmv-cookie-consent-v3';
  var STORAGE_KEY='mpmv-native-tracking-v1';
  var state=null,started=false,starting=false,timer=null,lastTick=Date.now();

  function consent(){try{return localStorage.getItem(CONSENT_KEY)==='accepted'}catch(_){return false}}
  function now(){return new Date().toISOString()}
  function uuid(){try{return crypto.randomUUID()}catch(_){return 'mpmv-'+Date.now()+'-'+Math.random().toString(36).slice(2)}}
  function params(){
    var q=new URLSearchParams(location.search);
    return {source:q.get('utm_source')||q.get('mpmv_source')||'',medium:q.get('utm_medium')||q.get('mpmv_medium')||'',campaign:q.get('utm_campaign')||q.get('mpmv_campaign')||'',adset:q.get('utm_term')||q.get('mpmv_term')||'',ad:q.get('utm_content')||q.get('mpmv_content')||'',fbclid:q.get('fbclid')||q.get('mpmv_fbclid')||'',gclid:q.get('gclid')||q.get('mpmv_gclid')||'',referrer:q.get('mpmv_referrer')||document.referrer||'',landing:q.get('mpmv_landing')||''};
  }
  function sourceGuess(p){
    if(p.source)return p.source;if(p.fbclid)return 'meta';if(p.gclid)return 'google';
    var r=String(p.referrer||document.referrer||'').toLowerCase();if(!r)return 'direct';
    if(/instagram/.test(r))return 'instagram';if(/facebook|fb\.com/.test(r))return 'facebook';if(/google\./.test(r))return 'google';if(/bing\./.test(r))return 'bing';if(/yahoo\.|duckduckgo/.test(r))return 'organic-search';
    try{var u=new URL(r);if(u.hostname===location.hostname)return 'direct';return u.hostname}catch(_){return 'referral'}
  }
  function device(){var ua=navigator.userAgent||'';return /mobile|iphone|android/i.test(ua)?'Mobile':'Desktop'}
  function browser(){var ua=navigator.userAgent||'';if(/CriOS|Chrome/.test(ua))return 'Chrome';if(/FxiOS|Firefox/.test(ua))return 'Firefox';if(/Safari/.test(ua)&&!/Chrome|CriOS/.test(ua))return 'Safari';return 'Outro'}
  function load(){try{var x=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'null');return x&&x.sessionId?x:null}catch(_){return null}}
  function save(){if(!consent())return;try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch(_){}}
  function page(){return location.pathname+location.search}
  function freshContext(p,current){var t=now();return {sessionId:uuid(),noteId:'',startedAt:t,updatedAt:t,landingPage:p.landing||current,currentPage:current,referrer:p.referrer||'',source:sourceGuess(p),medium:p.medium,campaign:p.campaign,adset:p.adset,ad:p.ad,fbclid:p.fbclid,gclid:p.gclid,activeSeconds:0,elapsedSeconds:0,pageViews:1,device:device(),browser:browser(),converted:false,conversionType:'',convertedAt:'',name:'',email:'',phone:'',pages:[{path:current,at:t}]}}
  function ephemeral(){var p=params(),current=page();return freshContext(p,current)}
  function build(){
    var p=params(),existing=load(),current=page();
    if(existing){
      state=existing;state.currentPage=current;state.updatedAt=now();state.pageViews=(Number(state.pageViews)||1)+1;state.pages=Array.isArray(state.pages)?state.pages:[];
      if(!state.pages.length||state.pages[state.pages.length-1].path!==current)state.pages.push({path:current,at:now()});state.pages=state.pages.slice(-25);
      if((!state.source||state.source==='direct')&&p.source)state.source=p.source;if(!state.medium&&p.medium)state.medium=p.medium;if(!state.campaign&&p.campaign)state.campaign=p.campaign;if(!state.adset&&p.adset)state.adset=p.adset;if(!state.ad&&p.ad)state.ad=p.ad;if(!state.fbclid&&p.fbclid)state.fbclid=p.fbclid;if(!state.gclid&&p.gclid)state.gclid=p.gclid;if(!state.referrer&&p.referrer)state.referrer=p.referrer;if((!state.landingPage||state.landingPage==='/')&&p.landing)state.landingPage=p.landing;
      save();return;
    }
    state=freshContext(p,current);save();
  }
  function tick(){if(!state)return;var n=Date.now(),delta=Math.max(0,Math.min(5,(n-lastTick)/1000));lastTick=n;if(document.visibilityState==='visible'&&document.hasFocus())state.activeSeconds=(Number(state.activeSeconds)||0)+delta;state.elapsedSeconds=Math.max(0,(n-new Date(state.startedAt).getTime())/1000);state.updatedAt=now();save()}
  async function post(action,beacon){
    if(!state||!consent())return;tick();var payload=JSON.stringify({action:action,noteId:state.noteId||'',data:state});
    if(beacon&&navigator.sendBeacon){try{return navigator.sendBeacon('/api/rastreamento',new Blob([payload],{type:'application/json'}))}catch(_){}}
    var r=await fetch('/api/rastreamento',{method:'POST',headers:{'Content-Type':'application/json'},body:payload,keepalive:!!beacon});var j={};try{j=await r.json()}catch(_){}if(!r.ok)throw new Error(j.error||('HTTP '+r.status));if(j.noteId&&!state.noteId){state.noteId=j.noteId;save()}return j;
  }
  async function start(){if(started||starting||!consent())return;starting=true;build();lastTick=Date.now();try{if(state.noteId)await post('update');else await post('start');started=true;timer=setInterval(function(){post('update').catch(function(){})},15000)}catch(_){started=false}finally{starting=false}}
  function context(){if(!consent())return ephemeral();if(!state)build();tick();return state?JSON.parse(JSON.stringify(state)):null}
  function markLocalConversion(type,lead){if(!consent())return;if(!state)build();state.converted=true;state.conversionType=type||'lead';state.convertedAt=now();if(lead){state.name=lead.name||state.name;state.email=lead.email||state.email;state.phone=lead.phone||state.phone}save();post('update').catch(function(){})}

  window.MPMVTracking={getContext:context,start:start,markConversion:markLocalConversion};
  document.addEventListener('click',function(e){var b=e.target&&e.target.closest?e.target.closest('[data-mpmv-cookie="accepted"]'):null;if(b)setTimeout(start,30)},true);
  window.addEventListener('pagehide',function(){if(started)post('update',true)});document.addEventListener('visibilitychange',tick);window.addEventListener('focus',function(){lastTick=Date.now()});window.addEventListener('blur',tick);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
