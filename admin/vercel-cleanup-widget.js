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
  var totalDeleted=0,totalSkipped=0,stalledRounds=0;
  try{
    for(var round=1;round<=30;round++){
      b.textContent='Limpando... '+totalDeleted;
      var r=await fetch('/api/admin-backup?action=vercel-cleanup',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-admin-token':admin},
        body:JSON.stringify({vercelToken:vercel})
      });
      var d=await r.json().catch(function(){return {}});
      if(r.status===401){
        sessionStorage.removeItem('mpmv_vercel_cleanup_token');
        throw new Error(d.detail||d.error||'Token da Vercel ou do admin inválido.');
      }
      if(!r.ok)throw new Error(d.detail||d.error||'Falha ao limpar deployments.');

      var deleted=Number(d.deleted||0),skipped=Number(d.skipped||0),remaining=Number(d.remainingOld||0);
      totalDeleted+=deleted;
      totalSkipped+=skipped;

      if(d.done||remaining<=0){
        alert('Limpeza concluída. '+totalDeleted+' deployment(s) removido(s). '+(totalSkipped?totalSkipped+' protegido(s)/não removível(is) foram ignorados. ':'')+'Os 5 mais recentes e o atual foram preservados.');
        sessionStorage.removeItem('mpmv_vercel_cleanup_token');
        return;
      }

      if(deleted===0){
        stalledRounds++;
        if(stalledRounds>=2){
          alert('Limpeza encerrada. '+totalDeleted+' deployment(s) removido(s). Os '+remaining+' restante(s) não puderam ser apagados pela Vercel e foram ignorados.');
          sessionStorage.removeItem('mpmv_vercel_cleanup_token');
          return;
        }
      }else{
        stalledRounds=0;
      }
    }
    alert('Limpeza encerrada. '+totalDeleted+' deployment(s) removido(s). Alguns protegidos podem ter sido mantidos pela Vercel.');
    sessionStorage.removeItem('mpmv_vercel_cleanup_token');
  }catch(e){
    alert('Erro na limpeza: '+e.message);
  }finally{
    b.disabled=false;
    b.textContent='Limpar deploys Vercel';
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
