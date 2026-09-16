const CACHE='mpmv-os-v11';
const SHELL=['/admin/','/admin/leads360/','/admin/brevo/','/admin/relatorios/','/admin/search-console/','/admin/manifest.webmanifest','/admin/icon.svg'];
const SEO_OVERRIDES={
  'conteudo-para-cada-etapa-do-funil-de-vendas':{
    title:'Como planejar conteúdo por etapa do funil sem postar no escuro',
    seoTitle:'Como Planejar Conteúdo por Etapa do Funil | MPMV',
    metaDescription:'Aprenda a planejar uma linha editorial por etapa do funil, definindo temas, formatos, objetivos e CTAs sem transformar o calendário em uma lista aleatória de posts.',
    focusKeyphrase:'planejamento de conteúdo por etapa do funil',
    secondaryKeyphrases:['planejamento de conteúdo','conteúdo por etapa do funil','linha editorial por etapa','calendário de conteúdo estratégico','conteúdo para topo meio e fundo de funil','planejamento editorial']
  },
  'funil-de-vendas-onde-a-venda-trava':{
    title:'Funil de vendas: como identificar onde a venda está travando',
    seoTitle:'Funil de Vendas: Como Identificar Onde a Venda Está Travando | MPMV',
    metaDescription:'Aprenda a diagnosticar em qual etapa do funil de vendas a conversão está travando, separando problema de atração, interesse, proposta e fechamento.',
    focusKeyphrase:'onde o funil de vendas está travando',
    secondaryKeyphrases:['diagnóstico do funil de vendas','gargalo no funil de vendas','etapa do funil com problema','análise de conversão do funil','queda de conversão nas vendas','identificar gargalos de vendas']
  },
  'funil-de-vendas-previsivel':{
    title:'Funil de vendas previsível: como transformar meta em número de leads',
    seoTitle:'Funil de Vendas Previsível: Como Transformar Meta em Número de Leads | MPMV',
    metaDescription:'Aprenda a transformar uma meta de vendas em metas de leads, oportunidades e conversão usando a matemática do funil para planejar aquisição e vendas.',
    focusKeyphrase:'funil de vendas previsível',
    secondaryKeyphrases:['matemática do funil de vendas','meta de vendas e número de leads','previsão de leads para vender','planejamento de aquisição','quantos leads preciso para vender','projeção de vendas pelo funil']
  }
};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==location.origin) return;
  if(url.pathname.startsWith('/api/')) return;
  if(url.pathname==='/data/blog-posts.json'){
    event.respondWith(fetch(req).then(async res=>{
      try{
        const data=await res.clone().json();
        const merged=Array.isArray(data)?data.map(post=>SEO_OVERRIDES[post.slug]?{...post,...SEO_OVERRIDES[post.slug]}:post):data;
        return new Response(JSON.stringify(merged),{status:res.status,statusText:res.statusText,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
      }catch(e){return res;}
    }));
    return;
  }
  if(url.pathname.startsWith('/admin/')){
    event.respondWith(fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));return res;}).catch(()=>caches.match(req).then(r=>r||caches.match('/admin/'))));
  }
});