(function(){
  'use strict';

  var backdrop=document.getElementById('mpmv-modal-backdrop'),
      closeBtn=document.getElementById('mpmv-close-modal'),
      form=document.getElementById('mpmv-lead-form'),
      formView=document.getElementById('mpmv-form-view'),
      successView=document.getElementById('mpmv-success-view'),
      errorEl=document.getElementById('mpmv-form-error'),
      submit=document.getElementById('mpmv-submit'),
      cookie=document.getElementById('mpmv-cookie-banner'),
      cookieKey='mpmv-cookie-consent-v3';

  function show(el){if(el)el.classList.remove('mpmv-hidden')}
  function hide(el){if(el)el.classList.add('mpmv-hidden')}

  function openModal(){
    show(backdrop);
    if(backdrop)backdrop.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
    setTimeout(function(){var i=document.getElementById('mpmv-name');if(i)i.focus()},50)
  }

  function closeModal(){
    hide(backdrop);
    if(backdrop)backdrop.setAttribute('aria-hidden','true');
    document.body.style.overflow=''
  }

  document.querySelectorAll('.js-open').forEach(function(btn){btn.addEventListener('click',openModal)});
  if(closeBtn)closeBtn.addEventListener('click',closeModal);
  if(backdrop)backdrop.addEventListener('mousedown',function(e){if(e.target===backdrop)closeModal()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal()});

  try{if(!localStorage.getItem(cookieKey))show(cookie);else hide(cookie)}catch(e){show(cookie)}
  document.querySelectorAll('[data-mpmv-cookie]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var v=btn.getAttribute('data-mpmv-cookie');
      try{localStorage.setItem(cookieKey,v)}catch(e){}
      hide(cookie)
    })
  });

  function startDownload(){
    var a=document.createElement('a');
    a.href='/api/guia';
    a.download='[Guia Prático] Persuasão pra Vender Todo Santo Dia.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove()
  }

  async function sendLead(payload){
    var r=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    var body={};
    try{body=await r.json()}catch(e){}
    if(!r.ok){
      var err=new Error(body.message||body.error||('HTTP '+r.status));
      err.status=r.status;
      throw err
    }
    return body
  }

  if(form)form.addEventListener('submit',async function(e){
    e.preventDefault();
    var fd=new FormData(form),
        name=String(fd.get('name')||'').trim(),
        email=String(fd.get('email')||'').trim().toLowerCase(),
        company=String(fd.get('company')||'');

    if(company)return;
    if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      if(errorEl){errorEl.textContent='Preencha seu nome e um e-mail válido.';show(errorEl)}
      return
    }

    hide(errorEl);
    if(submit){submit.disabled=true;submit.textContent='LIBERANDO SEU GUIA...'}

    try{
      await sendLead({name:name,email:email,source:'guia-pratico',page:location.pathname});

      try{
        sessionStorage.setItem('mpmv-lead-converted','1');
        sessionStorage.setItem('mpmv-lead-name',name);
      }catch(_e){}

      if(window.MPMVAnalytics && typeof window.MPMVAnalytics.trackLead==='function'){
        window.MPMVAnalytics.trackLead({source:'guia-pratico',page:location.pathname});
      }

      hide(formView);
      show(successView);
      startDownload();

      setTimeout(function(){location.assign('/obrigado/')},900);
    }catch(err){
      if(errorEl){errorEl.textContent='Não consegui registrar seu e-mail agora. Tente novamente.';show(errorEl)}
    }finally{
      if(submit){submit.disabled=false;submit.textContent='RECEBER O GUIA AGORA'}
    }
  })
})();
