(function(){
'use strict';
function adminToken(){return sessionStorage.getItem('mpmv_admin_token')||''}
function mount(){
  var actions=document.querySelector('.actions');
  if(!actions||document.getElementById('vercelCleanupBtn'))return;
  var b=document.createElement('button');
  b.className='btn';
  b.id='vercelCleanupBtn';
  b.textContent='Limpar deploys Vercel';
  b.title='Mantém os 5 deployments mais recentes e remove os antigos em lotes';
  b.onclick=cleanup;
  actions.appendChild(b);
}
async function cleanup(){
  var admin=adminToken();
  if(!admin){alert('Abra o admin e autentique primeiro.');return}
  var vercel=sessionStorage.getItem('mpmv_vercel_cleanup_token')||'';
  if(!vercel){
    vercel=prompt('Cole o token temporário da Vercel. Ele fica só nesta sessão do navegador:','')||'';
    if(!vercel)return;
    sessionStorage.setItem('mpmv_vercel_cleanup_token',vercel);
  }
  if(!confirm('Limpar deployments antigos do MPMV? Serão preservados os 5 mais recentes e o deployment atual.'))return;

  var b=document.getElementById('vercelCleanupBtn');
  b.disabled=true;
  var totalDeleted=0;
  try{
    for(var round=1;round<=30;round++){
      b.textContent='Limpando... '+totalDeleted;
      var r=await fetch('/api/vercel-cleanup',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-admin-token':admin},
        body:JSON.stringify({vercelToken:vercel})
      });
      var d=await r.json().catch(function(){return {}});
      if(r.status===401){
        sessionStorage.removeItem('mpmv_vercel_cleanup_token');
        throw new Error(d.message||'Token da Vercel ou do admin inválido.');
      }
      if(!r.ok)throw new Error(d.message||'Falha ao limpar deployments.');
      totalDeleted+=Number(d.deleted||0);
      if(d.done){
        alert('Limpeza concluída. '+totalDeleted+' deployment(s) antigo(s) removido(s). Os 5 mais recentes e o atual foram preservados.');
        sessionStorage.removeItem('mpmv_vercel_cleanup_token');
        return;
      }
      if(!d.deleted&&d.remainingOld>0)throw new Error('A Vercel não permitiu remover os deployments restantes.');
    }
    alert('Foram removidos '+totalDeleted+' deployments. Ainda podem restar versões antigas; toque novamente para continuar.');
  }catch(e){
    alert('Erro na limpeza: '+e.message);
  }finally{
    b.disabled=false;
    b.textContent='Limpar deploys Vercel';
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
