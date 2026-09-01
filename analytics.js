(function(){
  'use strict';

  var GA_ID = 'G-CJHQRJY79Z';
  var META_PIXEL_ID = '1327862439332530';
  var CONSENT_KEY = 'mpmv-cookie-consent-v3';
  var gaLoaded = false;
  var metaLoaded = false;
  var pageContextTracked = false;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };

  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500
  });

  function getConsent(){
    try { return localStorage.getItem(CONSENT_KEY) || ''; }
    catch (e) { return ''; }
  }

  function saveConsent(value){
    try { localStorage.setItem(CONSENT_KEY, value); }
    catch (e) {}
  }

  function hasConsent(){
    return getConsent() === 'accepted';
  }

  function setDenied(){
    window.gtag('consent', 'update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied'
    });
  }

  function loadGA(){
    if (gaLoaded || !hasConsent()) return;
    gaLoaded = true;

    window.gtag('consent', 'update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted'
    });

    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(script);

    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { send_page_view: true });
  }

  function loadMeta(){
    if (metaLoaded || !hasConsent()) return;
    metaLoaded = true;

    if (!window.fbq) {
      var fbq = function(){
        fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
      };
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = '2.0';
      fbq.queue = [];
      window.fbq = fbq;
      window._fbq = fbq;

      var script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      var firstScript = document.getElementsByTagName('script')[0];
      if (firstScript && firstScript.parentNode) firstScript.parentNode.insertBefore(script, firstScript);
      else document.head.appendChild(script);
    }

    window.fbq('init', META_PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  function trackPageContext(){
    if (pageContextTracked || !hasConsent()) return;
    pageContextTracked = true;

    var path = String(location.pathname || '/').toLowerCase();
    if (path === '/curso' || path === '/curso/') {
      if (window.fbq) window.fbq('track', 'ViewContent', {
        content_name: 'Como Criar Posts Virais com Persuasão no ChatGPT',
        content_category: 'curso'
      });
      window.gtag('event', 'view_item', {
        item_name: 'Como Criar Posts Virais com Persuasão no ChatGPT',
        item_category: 'curso'
      });
    } else if (path === '/mentoria' || path === '/mentoria/') {
      if (window.fbq) window.fbq('track', 'ViewContent', {
        content_name: 'Mentoria Individual de Persuasão e Vendas',
        content_category: 'mentoria'
      });
      window.gtag('event', 'view_item', {
        item_name: 'Mentoria Individual de Persuasão e Vendas',
        item_category: 'mentoria'
      });
    }
  }

  function loadTracking(){
    if (!hasConsent()) return;
    loadGA();
    loadMeta();
    trackPageContext();
  }

  function gaEvent(name, params){
    if (!hasConsent()) return false;
    loadTracking();
    window.gtag('event', name, params || {});
    return true;
  }

  function metaEvent(name, params, custom){
    if (!hasConsent()) return false;
    loadTracking();
    if (!window.fbq) return false;
    window.fbq(custom ? 'trackCustom' : 'track', name, params || {});
    return true;
  }

  function trackLead(params){
    var data = params || {};
    gaEvent('generate_lead', {
      lead_source: data.source || 'guia-pratico',
      page_path: data.page || location.pathname
    });
    metaEvent('Lead', {
      content_name: 'Guia Prático Persuasão pra Vender Todo Santo Dia',
      content_category: 'lead_magnet'
    }, false);
  }

  function trackCourseInterest(source){
    gaEvent('select_content', { content_type: 'curso', item_id: 'posts-virais-chatgpt', source: source || location.pathname });
    metaEvent('CourseInterest', { source: source || location.pathname }, true);
  }

  function trackMentoriaInterest(source){
    gaEvent('select_content', { content_type: 'mentoria', item_id: 'mentoria-individual', source: source || location.pathname });
    metaEvent('MentoriaInterest', { source: source || location.pathname }, true);
  }

  function trackWhatsAppClick(source){
    gaEvent('contact', { method: 'whatsapp', source: source || location.pathname });
    metaEvent('WhatsAppClick', { source: source || location.pathname }, true);
  }

  function trackCheckout(source){
    gaEvent('begin_checkout', { currency: 'BRL', value: 37, item_name: 'Como Criar Posts Virais com Persuasão no ChatGPT', source: source || location.pathname });
    metaEvent('InitiateCheckout', { currency: 'BRL', value: 37, content_name: 'Como Criar Posts Virais com Persuasão no ChatGPT' }, false);
  }

  function hideBanner(){
    var banner = document.getElementById('mpmv-cookie-banner');
    if (!banner) return;
    if (banner.classList && banner.classList.contains('mpmv-cookie-banner')) banner.classList.add('mpmv-hidden');
    banner.style.display = 'none';
  }

  function showExistingBanner(){
    var banner = document.getElementById('mpmv-cookie-banner');
    if (!banner) return false;
    if (banner.classList) banner.classList.remove('mpmv-hidden');
    banner.style.display = '';
    return true;
  }

  function createBanner(){
    if (showExistingBanner()) return;
    var banner = document.createElement('aside');
    banner.id = 'mpmv-cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Preferências de cookies');
    banner.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;max-width:980px;margin:auto;background:#111;color:#fff;border:1px solid #353535;border-radius:14px;padding:16px 18px;box-shadow:0 14px 44px rgba(0,0,0,.28);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap';
    banner.innerHTML = '<div style="flex:1 1 480px"><strong style="display:block;margin-bottom:4px">Cookies e medição</strong><span style="color:#d0d0d0;font-size:.92rem;line-height:1.45">Com sua autorização, usamos Google Analytics e Meta Pixel para entender visitas e ações no site. <a href="/politica-de-privacidade/" style="color:#fff;text-decoration:underline">Política de Privacidade</a>.</span></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" data-mpmv-cookie="declined" style="border:1px solid #555;background:transparent;color:#fff;border-radius:9px;padding:10px 14px;font-weight:700;cursor:pointer">Agora não</button><button type="button" data-mpmv-cookie="accepted" style="border:0;background:#c99a2e;color:#15110a;border-radius:9px;padding:10px 14px;font-weight:900;cursor:pointer">Aceitar cookies</button></div>';
    document.body.appendChild(banner);
  }

  function handleChoice(value){
    if (value !== 'accepted' && value !== 'declined') return;
    saveConsent(value);
    if (value === 'accepted') loadTracking();
    else setDenied();
    hideBanner();
  }

  function handleTrackedLink(event){
    var target = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!target) return;
    var href = String(target.getAttribute('href') || '');
    if (!href) return;

    if (/pay\.hotmart\.com/i.test(href)) trackCheckout(location.pathname);
    else if (/^\/curso\/?(?:$|[?#])/i.test(href)) trackCourseInterest(location.pathname);
    else if (/^\/mentoria\/?(?:$|[?#])/i.test(href)) trackMentoriaInterest(location.pathname);
    else if (/wa\.me|api\.whatsapp\.com/i.test(href)) trackWhatsAppClick(location.pathname);
  }

  function init(){
    var current = getConsent();
    if (current === 'accepted') loadTracking();
    else if (current === 'declined') setDenied();
    else createBanner();

    document.addEventListener('click', function(event){
      var choice = event.target && event.target.closest ? event.target.closest('[data-mpmv-cookie]') : null;
      if (choice) handleChoice(choice.getAttribute('data-mpmv-cookie'));
      handleTrackedLink(event);
    }, true);
  }

  window.MPMVAnalytics = {
    measurementId: GA_ID,
    metaPixelId: META_PIXEL_ID,
    getConsent: getConsent,
    accept: function(){ handleChoice('accepted'); },
    decline: function(){ handleChoice('declined'); },
    trackLead: trackLead,
    trackCourseInterest: trackCourseInterest,
    trackMentoriaInterest: trackMentoriaInterest,
    trackWhatsAppClick: trackWhatsAppClick,
    trackCheckout: trackCheckout,
    trackEvent: function(name, params){ return gaEvent(name, params); },
    trackMetaCustom: function(name, params){ return metaEvent(name, params, true); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* MPMV Native Traffic Tracking — first-party, starts only after cookie consent. */
(function(){
  'use strict';
  var CONSENT_KEY='mpmv-cookie-consent-v3';
  var STORAGE_KEY='mpmv-native-tracking-v1';
  var state=null, started=false, starting=false, timer=null, lastTick=Date.now();

  function consent(){try{return localStorage.getItem(CONSENT_KEY)==='accepted'}catch(_){return false}}
  function now(){return new Date().toISOString()}
  function uuid(){try{return crypto.randomUUID()}catch(_){return 'mpmv-'+Date.now()+'-'+Math.random().toString(36).slice(2)}}
  function params(){var q=new URLSearchParams(location.search);return {
    source:q.get('utm_source')||'',medium:q.get('utm_medium')||'',campaign:q.get('utm_campaign')||'',
    adset:q.get('utm_term')||'',ad:q.get('utm_content')||'',fbclid:q.get('fbclid')||'',gclid:q.get('gclid')||''
  }}
  function sourceGuess(p){
    if(p.source)return p.source;
    if(p.fbclid)return 'meta';
    if(p.gclid)return 'google';
    var r=String(document.referrer||'').toLowerCase();
    if(!r)return 'direct';
    if(/instagram|facebook|fb\.com/.test(r))return 'meta-organic';
    if(/google\.|bing\.|yahoo\.|duckduckgo/.test(r))return 'organic-search';
    try{return new URL(r).hostname}catch(_){return 'referral'}
  }
  function device(){var ua=navigator.userAgent||'';return /mobile|iphone|android/i.test(ua)?'Mobile':'Desktop'}
  function browser(){var ua=navigator.userAgent||'';if(/CriOS|Chrome/.test(ua))return 'Chrome';if(/FxiOS|Firefox/.test(ua))return 'Firefox';if(/Safari/.test(ua)&&!/Chrome|CriOS/.test(ua))return 'Safari';return 'Outro'}
  function load(){try{var x=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'null');return x&&x.sessionId?x:null}catch(_){return null}}
  function save(){try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch(_){}}
  function page(){return location.pathname+location.search}
  function build(){
    var p=params(), existing=load(), current=page();
    if(existing){
      state=existing;state.currentPage=current;state.updatedAt=now();state.pageViews=(Number(state.pageViews)||1)+1;
      state.pages=Array.isArray(state.pages)?state.pages:[];
      if(!state.pages.length||state.pages[state.pages.length-1].path!==current)state.pages.push({path:current,at:now()});
      state.pages=state.pages.slice(-25);
      if(!state.source&&p.source)state.source=p.source;if(!state.medium&&p.medium)state.medium=p.medium;if(!state.campaign&&p.campaign)state.campaign=p.campaign;if(!state.adset&&p.adset)state.adset=p.adset;if(!state.ad&&p.ad)state.ad=p.ad;if(!state.fbclid&&p.fbclid)state.fbclid=p.fbclid;if(!state.gclid&&p.gclid)state.gclid=p.gclid;
      save();return;
    }
    state={sessionId:uuid(),noteId:'',startedAt:now(),updatedAt:now(),landingPage:current,currentPage:current,referrer:document.referrer||'',source:sourceGuess(p),medium:p.medium,campaign:p.campaign,adset:p.adset,ad:p.ad,fbclid:p.fbclid,gclid:p.gclid,activeSeconds:0,elapsedSeconds:0,pageViews:1,device:device(),browser:browser(),converted:false,conversionType:'',convertedAt:'',name:'',email:'',phone:'',pages:[{path:current,at:now()}]};save();
  }
  function tick(){
    if(!state)return;var n=Date.now(),delta=Math.max(0,Math.min(5,(n-lastTick)/1000));lastTick=n;
    if(document.visibilityState==='visible'&&document.hasFocus())state.activeSeconds=(Number(state.activeSeconds)||0)+delta;
    state.elapsedSeconds=Math.max(0,(n-new Date(state.startedAt).getTime())/1000);state.updatedAt=now();save();
  }
  async function post(action,beacon){
    if(!state||!consent())return;tick();var payload=JSON.stringify({action:action,noteId:state.noteId||'',data:state});
    if(beacon&&navigator.sendBeacon){try{return navigator.sendBeacon('/api/rastreamento',new Blob([payload],{type:'application/json'}))}catch(_){}}
    var r=await fetch('/api/rastreamento',{method:'POST',headers:{'Content-Type':'application/json'},body:payload,keepalive:!!beacon});var j={};try{j=await r.json()}catch(_){}if(!r.ok)throw new Error(j.error||('HTTP '+r.status));if(j.noteId&&!state.noteId){state.noteId=j.noteId;save()}return j;
  }
  async function start(){
    if(started||starting||!consent())return;starting=true;build();lastTick=Date.now();
    try{if(state.noteId)await post('update');else await post('start');started=true;timer=setInterval(function(){post('update').catch(function(){})},15000)}catch(_){started=false}finally{starting=false}
  }
  function context(){if(!state)build();tick();return state?JSON.parse(JSON.stringify(state)):null}
  function markLocalConversion(type,lead){if(!state)return;state.converted=true;state.conversionType=type||'lead';state.convertedAt=now();if(lead){state.name=lead.name||state.name;state.email=lead.email||state.email;state.phone=lead.phone||state.phone}save();post('update').catch(function(){})}

  window.MPMVTracking={getContext:context,start:start,markConversion:markLocalConversion};
  document.addEventListener('click',function(e){var b=e.target&&e.target.closest?e.target.closest('[data-mpmv-cookie="accepted"]'):null;if(b)setTimeout(start,30)},true);
  window.addEventListener('pagehide',function(){if(started)post('update',true)});
  document.addEventListener('visibilitychange',tick);window.addEventListener('focus',function(){lastTick=Date.now()});window.addEventListener('blur',tick);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
