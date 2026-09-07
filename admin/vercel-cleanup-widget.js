(function(){
'use strict';
function mount(){mountExtraPosts();}
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
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
