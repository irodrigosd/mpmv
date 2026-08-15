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
