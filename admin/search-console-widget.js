(function(){
'use strict';
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function num(v){return Number(v||0).toLocaleString('pt-BR')}
function pct(v){return (Number(v||0)*100).toFixed(1)+'%'}
function pos(v){return Number(v||0).toFixed(1)}
function token(){return sessionStorage.getItem('mpmv_admin_token')||''}
function mount(){
  var grid=document.querySelector('.grid');
  if(!grid||document.getElementById('gscWidget'))return;
  var card=document.createElement('article');
  card.className='card full';card.id='gscWidget';
  card.innerHTML='<h2>Google Search Console</h2><div class="sub">Cliques, impressões, CTR e posição do Google. <a href="/admin/search-console/" style="color:var(--blue);font-weight:800">Abrir relatório completo →</a></div><div id="gscWidgetBody" class="empty">Carregando Search Console...</div>';
  var articles=document.getElementById('articlesBox');
  var parent=articles&&articles.closest('.card');
  if(parent)grid.insertBefore(card,parent);else grid.appendChild(card);
  load();
}
async function load(){
  var body=document.getElementById('gscWidgetBody'),t=token();if(!body)return;
  if(!t){body.textContent='Abra o relatório completo após autenticar no app.';return}
  try{
    var r=await fetch('/api/search-console?days=28',{headers:{'x-admin-token':t},cache:'no-store'}),d=await r.json();
    if(!r.ok)throw new Error(d.error||'Falha');
    var top=(d.pages||[]).slice(0,5);
    body.className='';
    body.innerHTML='<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:12px"><div class="metric"><strong>'+num(d.total.clicks)+'</strong><span>CLIQUES · 28 DIAS</span></div><div class="metric"><strong>'+num(d.total.impressions)+'</strong><span>IMPRESSÕES</span></div><div class="metric"><strong>'+pct(d.total.ctr)+'</strong><span>CTR</span></div><div class="metric"><strong>'+pos(d.total.position)+'</strong><span>POSIÇÃO MÉDIA</span></div></div>'+(top.length?'<table class="table"><thead><tr><th>ARTIGO</th><th>CLIQUES</th><th>IMPRESSÕES</th><th>CTR</th><th>POS.</th></tr></thead><tbody>'+top.map(function(x){var u=x.keys&&x.keys[0]||'',p='';try{p=new URL(u).pathname}catch(_){p=u}return '<tr><td><a href="'+esc(u)+'" target="_blank"><b>'+esc(p.replace(/^\/blog\//,'').replace(/\/$/,'').replace(/-/g,' '))+'</b></a></td><td class="good"><b>'+num(x.clicks)+'</b></td><td>'+num(x.impressions)+'</td><td>'+pct(x.ctr)+'</td><td>'+pos(x.position)+'</td></tr>'}).join('')+'</tbody></table>':'<div class="empty">Sem artigos no período.</div>');
  }catch(e){body.className='empty';body.innerHTML='Search Console aguardando configuração. <a href="/admin/search-console/" style="color:var(--blue);font-weight:800">Abrir configuração →</a>'}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();