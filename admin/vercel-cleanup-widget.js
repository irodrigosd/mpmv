(function(){
'use strict';
function adminToken(){return sessionStorage.getItem('mpmv_admin_token')||''}
function isAdminHome(){var p=location.pathname.replace(/\/+$/,'')||'/';return p==='/admin'}
function mount(){
  if(isAdminHome())mountCleanupButton();
  mountExtraPosts();
}
function mountCleanupButton(){
  var actions=document.querySelector('header.top .actions');
  if(!actions||document.getElementById('vercelCleanupBtn'))return;
  var b=document.createElement('button');
  b.className='btn';
  b.id='vercelCleanupBtn';
  b.type='button';
  b.textContent='Limpar deploys Vercel';
  b.title='Mantém os 5 deployments mais recentes e o atual; percorre os antigos e preserva os que a Vercel não permitir excluir';
  b.onclick=cleanup;
  actions.appendChild(b);
}
async function mountExtraPosts(attempt){
  attempt=attempt||0;
  var box=document.getElementById('list');
  if(!box||typeof loadScores!=='function'){
    if(attempt<30)setTimeout(function(){mountExtraPosts(attempt+1)},300);
    return;
  }
  try{
    var r=await fetch('/data/blog-posts-extra.json?v='+Date.now(),{cache:'no-store'});
    if(!r.ok)return;
    var posts=await r.json();
    var extraMap={}; posts.forEach(function(p){extraMap[p.slug]=p});
    var bio=box.querySelector('[data-slug="como-criar-bio-instagram-que-vende"]');
    if(bio){
      if(extraMap['como-criar-bio-instagram-que-vende']){
        var eb=bio.querySelector('[data-edit]'); var db=bio.querySelector('[data-delete]');
        if(eb)eb.disabled=false; if(db)db.disabled=false;
      }else bio.remove();
    }
    posts.forEach(function(p){
      if(box.querySelector('[data-slug="'+CSS.escape(p.slug)+'"]'))return;
      var article=document.createElement('article');
      article.className='post'; article.dataset.slug=p.slug;
      article.innerHTML='<div class="row"><div><h2>'+esc(p.title)+'</h2><div class="url">'+esc(p.url)+'</div><span class="status">'+esc(p.status||'published')+'</span><div class="score-row"><div class="score-card score-loading" data-seo-score><span class="score-dot"></span><div><strong>SEO...</strong><small>Analisando artigo</small></div></div><div class="score-card score-loading" data-read-score><span class="score-dot"></span><div><strong>Legibilidade...</strong><small>Analisando artigo</small></div></div></div></div><div class="actions"><a class="btn open" href="'+esc(p.url)+'" target="_blank">Abrir</a><button class="btn edit" data-edit="'+esc(p.slug)+'">Editar</button><button class="btn delete" data-delete="'+esc(p.slug)+'">Excluir artigo</button></div></div><div class="seo"><div class="field"><b>Título SEO</b><span>'+esc(p.seoTitle)+'</span></div><div class="field"><b>Frase-chave de foco</b><span>'+esc(p.focusKeyphrase)+'</span></div><div class="field"><b>Meta descrição</b><span>'+esc(p.metaDescription)+'</span></div><div class="field"><b>Slug</b><span>'+esc(p.slug)+'</span></div></div>';
      box.prepend(article);
      var editBtn=article.querySelector('[data-edit]');
      var delBtn=article.querySelector('[data-delete]');
      if(editBtn&&typeof openEditor==='function')editBtn.addEventListener('click',function(){openEditor(p.slug,editBtn)});
      if(delBtn&&typeof removePost==='function')delBtn.addEventListener('click',function(){removePost(p.slug,delBtn)});
      loadScores(p,article);
    });
  }catch(e){console.warn('MPMV extra posts:',e)}
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
  if(!confirm('Fazer a limpeza completa dos deployments antigos do MPMV? Os 5 mais recentes e o deployment atual serão preservados.'))return;
  var b=document.getElementById('vercelCleanupBtn');
  if(!b)return;
  b.disabled=true;
  var totalDeleted=0; var skipIds=[]; var skipMap={};
  try{
    for(var round=1;round<=80;round++){
      b.textContent='Limpando... '+totalDeleted;
      var r=await fetch('/api/admin-backup?action=vercel-cleanup',{method:'POST',headers:{'Content-Type':'application/json','x-admin-token':admin},body:JSON.stringify({vercelToken:vercel,skipIds:skipIds})});
      var d=await r.json().catch(function(){return {}});
      if(r.status===401){sessionStorage.removeItem('mpmv_vercel_cleanup_token');throw new Error(d.detail||d.error||'Token da Vercel ou do admin inválido.')}
      if(!r.ok)throw new Error(d.detail||d.error||'Falha ao limpar deployments.');
      totalDeleted+=Number(d.deleted||0);
      (d.failedItems||[]).forEach(function(x){var id=String(x&&x.id||'');if(!id||skipMap[id])return;skipMap[id]=x;skipIds.push(id)});
      var remaining=Number(d.remainingActionable||0);
      if(d.done||remaining<=0){
        var protectedCount=skipIds.length;
        var msg='Limpeza concluída. '+totalDeleted+' deployment(s) antigo(s) removido(s). Os 5 mais recentes e o atual foram preservados.';
        if(protectedCount)msg+='\n\nRestaram '+protectedCount+' deployment(s) que a Vercel não permitiu excluir nesta sessão.';
        alert(msg);
        sessionStorage.removeItem('mpmv_vercel_cleanup_token');
        return;
      }
      if(Number(d.deleted||0)===0&&!(d.failedItems||[]).length)throw new Error('A limpeza não avançou.');
    }
    alert('A limpeza percorreu muitos lotes e parou por segurança. Foram removidos '+totalDeleted+' deployments.');
    sessionStorage.removeItem('mpmv_vercel_cleanup_token');
  }catch(e){alert('Erro na limpeza: '+e.message)}
  finally{b.disabled=false;b.textContent='Limpar deploys Vercel'}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
