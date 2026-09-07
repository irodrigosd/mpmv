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
  b.title='Mantém os 5 deployments mais recentes e o atual; percorre todos os antigos e separa os realmente protegidos';
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
  if(!confirm('Fazer a limpeza completa dos deployments antigos do MPMV? Os 5 mais recentes e o deployment atual serão preservados. Os que a Vercel realmente proteger serão apenas listados e mantidos.'))return;

  var b=document.getElementById('vercelCleanupBtn');
  b.disabled=true;
  var totalDeleted=0;
  var skipIds=[];
  var skipMap={};
  try{
    for(var round=1;round<=80;round++){
      b.textContent='Limpando... '+totalDeleted;
      var r=await fetch('/api/admin-backup?action=vercel-cleanup',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-admin-token':admin},
        body:JSON.stringify({vercelToken:vercel,skipIds:skipIds})
      });
      var d=await r.json().catch(function(){return {}});
      if(r.status===401){
        sessionStorage.removeItem('mpmv_vercel_cleanup_token');
        throw new Error(d.detail||d.error||'Token da Vercel ou do admin inválido.');
      }
      if(!r.ok)throw new Error(d.detail||d.error||'Falha ao limpar deployments.');

      totalDeleted+=Number(d.deleted||0);
      (d.failedItems||[]).forEach(function(x){
        var id=String(x&&x.id||'');
        if(!id||skipMap[id])return;
        skipMap[id]=x;
        skipIds.push(id);
      });

      var remaining=Number(d.remainingActionable||0);
      if(d.done||remaining<=0){
        var protectedCount=skipIds.length;
        var sample=Object.keys(skipMap).slice(0,5).map(function(id){
          var x=skipMap[id]||{};
          return (x.url||id)+' — '+(x.reason||'Vercel recusou a exclusão');
        });
        var msg='Limpeza completa concluída. '+totalDeleted+' deployment(s) antigo(s) removido(s). Os 5 mais recentes e o atual foram preservados.';
        if(protectedCount)msg+='\n\nRestaram '+protectedCount+' deployment(s) realmente não removível(is) nesta sessão.'+(sample.length?'\n\nExemplos:\n'+sample.join('\n'):'');
        alert(msg);
        sessionStorage.removeItem('mpmv_vercel_cleanup_token');
        return;
      }

      if(Number(d.deleted||0)===0&&!(d.failedItems||[]).length){
        throw new Error('A limpeza não avançou. Nenhum deployment foi apagado nem classificado como protegido.');
      }
    }
    alert('A limpeza percorreu muitos lotes e foi interrompida por segurança. Foram removidos '+totalDeleted+' deployments. Toque novamente para continuar se ainda houver antigos.');
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
