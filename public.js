(function(){
  'use strict';
  var backdrop=document.getElementById('mpmv-modal-backdrop');
  var openBtn=document.getElementById('mpmv-open-modal');
  var closeBtn=document.getElementById('mpmv-close-modal');
  var form=document.getElementById('mpmv-lead-form');
  var formView=document.getElementById('mpmv-form-view');
  var successView=document.getElementById('mpmv-success-view');
  var errorEl=document.getElementById('mpmv-form-error');
  var submit=document.getElementById('mpmv-submit');
  var cookie=document.getElementById('mpmv-cookie-banner');
  var cookieKey='mpmv-cookie-consent-v2';
  function show(el){if(el)el.classList.remove('mpmv-hidden')}
  function hide(el){if(el)el.classList.add('mpmv-hidden')}
  function openModal(){show(backdrop);if(backdrop)backdrop.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';setTimeout(function(){var i=document.getElementById('mpmv-name');if(i)i.focus()},50)}
  function closeModal(){hide(backdrop);if(backdrop)backdrop.setAttribute('aria-hidden','true');document.body.style.overflow=''}
  if(openBtn)openBtn.addEventListener('click',openModal);
  if(closeBtn)closeBtn.addEventListener('click',closeModal);
  if(backdrop)backdrop.addEventListener('mousedown',function(e){if(e.target===backdrop)closeModal()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal()});
  try{if(!localStorage.getItem(cookieKey))show(cookie);else hide(cookie)}catch(e){show(cookie)}
  document.querySelectorAll('[data-mpmv-cookie]').forEach(function(btn){btn.addEventListener('click',function(){var v=btn.getAttribute('data-mpmv-cookie');try{localStorage.setItem(cookieKey,v)}catch(e){}hide(cookie);if(window.fbq){try{fbq('consent',v==='accepted'?'grant':'revoke');if(v==='accepted')fbq('track','PageView')}catch(e){}}})});
  function startDownload(){var a=document.createElement('a');a.href='/assets/downloads/guia-pratico-persuasao-pra-vender-todo-santo-dia.pdf';a.download='[Guia Prático] Persuasão Pra Vender Todo Santo Dia.pdf';document.body.appendChild(a);a.click();a.remove()}
  async function sendLead(payload){
    var endpoints=['/api/leads','/api/lead','/api/subscribe'];
    var lastErr=null;
    for(var i=0;i<endpoints.length;i++){
      try{
        var r=await fetch(endpoints[i],{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        if(r.ok)return true;
        if(r.status!==404)lastErr=new Error('HTTP '+r.status);
      }catch(e){lastErr=e}
    }
    throw lastErr||new Error('Integração de leads indisponível');
  }
  if(form)form.addEventListener('submit',async function(e){
    e.preventDefault();
    var fd=new FormData(form),name=String(fd.get('name')||'').trim(),email=String(fd.get('email')||'').trim(),company=String(fd.get('company')||'');
    if(company)return;
    if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){if(errorEl){errorEl.textContent='Preencha seu nome e um e-mail válido.';show(errorEl)}return}
    hide(errorEl);if(submit){submit.disabled=true;submit.textContent='LIBERANDO SEU GUIA...'}
    try{
      await sendLead({name:name,email:email,source:'guia-pratico',page:location.pathname});
      hide(formView);show(successView);startDownload();
      if(window.fbq){try{fbq('track','Lead',{content_name:'Guia Prático Persuasão pra Vender Todo Santo Dia'})}catch(e){}}
    }catch(err){
      if(errorEl){errorEl.textContent='O formulário está online, mas a integração de leads ainda precisa ser reconectada. Tente novamente em instantes.';show(errorEl)}
    }finally{if(submit){submit.disabled=false;submit.textContent='RECEBER O GUIA AGORA'}}
  });
})();
