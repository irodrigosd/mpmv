(function(){
  'use strict';

  var MEASUREMENT_ID = 'G-CJHQRJY79Z';
  var CONSENT_KEY = 'mpmv-cookie-consent-v3';
  var loaded = false;

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
  function setDenied(){
    window.gtag('consent', 'update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied'
    });
  }
  function loadAnalytics(){
    if (loaded) return;
    loaded = true;
    window.gtag('consent', 'update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted'
    });
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEASUREMENT_ID);
    document.head.appendChild(script);
    window.gtag('js', new Date());
    window.gtag('config', MEASUREMENT_ID, { send_page_view: true });
  }
  function hideBanner(){
    var banner = document.getElementById('mpmv-cookie-banner');
    if (!banner) return;
    if (banner.classList && banner.classList.contains('mpmv-cookie-banner')) banner.classList.add('mpmv-hidden');
    banner.style.display = 'none';
  }
  function createBanner(){
    if (document.getElementById('mpmv-cookie-banner')) return;
    var banner = document.createElement('aside');
    banner.id = 'mpmv-cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Preferências de cookies');
    banner.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;max-width:980px;margin:auto;background:#111;color:#fff;border:1px solid #353535;border-radius:14px;padding:16px 18px;box-shadow:0 14px 44px rgba(0,0,0,.28);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap';
    banner.innerHTML = '<div style="flex:1 1 480px"><strong style="display:block;margin-bottom:4px">Cookies e medição</strong><span style="color:#d0d0d0;font-size:.92rem;line-height:1.45">Usamos o Google Analytics para entender o uso do site. A medição só é ativada depois da sua autorização. <a href="/politica-de-privacidade/" style="color:#fff;text-decoration:underline">Política de Privacidade</a>.</span></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" data-mpmv-cookie="declined" style="border:1px solid #555;background:transparent;color:#fff;border-radius:9px;padding:10px 14px;font-weight:700;cursor:pointer">Agora não</button><button type="button" data-mpmv-cookie="accepted" style="border:0;background:#c99a2e;color:#15110a;border-radius:9px;padding:10px 14px;font-weight:900;cursor:pointer">Aceitar cookies</button></div>';
    document.body.appendChild(banner);
  }
  function handleChoice(value){
    if (value !== 'accepted' && value !== 'declined') return;
    saveConsent(value);
    if (value === 'accepted') loadAnalytics(); else setDenied();
    hideBanner();
  }
  function init(){
    var current = getConsent();
    if (current === 'accepted') loadAnalytics();
    else if (current === 'declined') setDenied();
    else createBanner();
    document.addEventListener('click', function(event){
      var target = event.target && event.target.closest ? event.target.closest('[data-mpmv-cookie]') : null;
      if (!target) return;
      handleChoice(target.getAttribute('data-mpmv-cookie'));
    }, true);
  }
  window.MPMVAnalytics = { measurementId: MEASUREMENT_ID, getConsent: getConsent, accept: function(){handleChoice('accepted');}, decline: function(){handleChoice('declined');} };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
