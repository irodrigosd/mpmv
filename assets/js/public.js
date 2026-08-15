(function(){
'use strict';

var backdrop=document.getElementById('mpmv-modal-backdrop');
var closeBtn=document.getElementById('mpmv-close-modal');
var form=document.getElementById('mpmv-lead-form');
var formView=document.getElementById('mpmv-form-view');
var successView=document.getElementById('mpmv-success-view');
var errorEl=document.getElementById('mpmv-form-error');
var submit=document.getElementById('mpmv-submit');
var cookie=document.getElementById('mpmv-cookie-banner');
var cookieKey='mpmv-cookie-consent-v3';
var downloadKey='mpmv-guide-download-started';

function show(el){if(el)el.classList.remove('mpmv-hidden')}
function hide(el){if(el)el.classList.add('mpmv-hidden')}

function openModal(){
  show(backdrop);
  if(backdrop)backdrop.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
  setTimeout(function(){
    var i=document.getElementById('mpmv-name');
    if(i)i.focus();
  },50);
}

function closeModal(){
  hide(backdrop);
  if(backdrop)backdrop.setAttribute('aria-hidden','true');
  document.body.style.overflow='';
}

document.querySelectorAll('.js-open,.mpmv-open-extra').forEach(function(btn){
  btn.addEventListener('click',openModal);
});

if(closeBtn)closeBtn.addEventListener('click',closeModal);

if(backdrop)backdrop.addEventListener('mousedown',function(e){
  if(e.target===backdrop)closeModal();
});

document.addEventListener('keydown',function(e){
  if(e.key==='Escape')closeModal();
});

try{
  if(!localStorage.getItem(cookieKey))show(cookie);
  else hide(cookie);
}catch(e){
  show(cookie);
}

document.querySelectorAll('[data-mpmv-cookie]').forEach(function(btn){
  btn.addEventListener('click',function(){
    var v=btn.getAttribute('data-mpmv-cookie');
    try{localStorage.setItem(cookieKey,v)}catch(e){}
    hide(cookie);
  });
});

/*
  DOWNLOAD DO GUIA
  Só pode acontecer depois do envio válido do formulário.
  O sessionStorage impede um segundo disparo automático na mesma aba.
*/
function startDownloadOnce(){
  try{
    if(sessionStorage.getItem(downloadKey)==='1')return;
    sessionStorage.setItem(downloadKey,'1');
  }catch(e){}

  var a=document.createElement('a');
  a.href='/api/guia';
  a.download='[Guia Prático] Persuasao Pra Vender Todo Santo Dia.pdf';
  a.style.display='none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/*
  CURSO
  Remove qualquer comportamento de download herdado/acidental
  e força a navegação normal para /curso/.
*/
document.querySelectorAll('.mpmv-course-cta,[data-mpmv-course]').forEach(function(link){
  link.removeAttribute('download');
  link.setAttribute('href','/curso/');
  link.addEventListener('click',function(e){
    e.preventDefault();
    e.stopPropagation();
    if(e.stopImmediatePropagation)e.stopImmediatePropagation();
    window.location.assign('/curso/');
  },true);
});

/*
  MENTORIA
  Também garante navegação normal, sem herdar comportamento de download.
*/
document.querySelectorAll('.mpmv-mentor-cta').forEach(function(link){
  link.removeAttribute('download');
});

async function sendLead(payload){
  var r=await fetch('/api/leads',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  var body={};
  try{body=await r.json()}catch(e){}
  if(!r.ok){
    var err=new Error(body.message||body.error||('HTTP '+r.status));
    err.status=r.status;
    throw err;
  }
  return body;
}

if(form)form.addEventListener('submit',async function(e){
  e.preventDefault();

  var fd=new FormData(form);
  var name=String(fd.get('name')||'').trim();
  var email=String(fd.get('email')||'').trim().toLowerCase();
  var company=String(fd.get('company')||'');

  if(company)return;

  if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    if(errorEl){
      errorEl.textContent='Preencha seu nome e um e-mail válido.';
      show(errorEl);
    }
    return;
  }

  hide(errorEl);

  if(submit){
    submit.disabled=true;
    submit.textContent='LIBERANDO SEU GUIA...';
  }

  try{
    await sendLead({
      name:name,
      email:email,
      source:'guia-pratico',
      page:location.pathname
    });

    hide(formView);
    show(successView);

    /*
      Disparo isolado. A navegação para curso/mentoria não chama esta função.
    */
    setTimeout(startDownloadOnce,120);

  }catch(err){
    if(errorEl){
      errorEl.textContent='Não consegui registrar seu e-mail agora. Tente novamente.';
      show(errorEl);
    }
  }finally{
    if(submit){
      submit.disabled=false;
      submit.textContent='RECEBER O GUIA AGORA';
    }
  }
});

})();