const BASE='https://www.maispersuasaomaisvendas.com.br';
const SECRET='qa_relay_7D4kP9mX2';

function clean(v,max){return String(v==null?'':v).trim().slice(0,max||500)}
function refInfo(ref,host){
  if(!ref)return {source:'direct',medium:'none'};
  let h='';try{h=new URL(ref).hostname.toLowerCase()}catch(_){return {source:'referral',medium:'referral'}}
  if(h===host.toLowerCase())return {source:'internal',medium:'internal'};
  if(/(^|\.)google\./.test(h))return {source:'google',medium:'organic'};
  if(/(^|\.)bing\.com$/.test(h))return {source:'bing',medium:'organic'};
  if(/yahoo\./.test(h))return {source:'yahoo',medium:'organic'};
  if(/duckduckgo\./.test(h))return {source:'duckduckgo',medium:'organic'};
  if(/instagram\./.test(h))return {source:'instagram',medium:'organic_social'};
  if(/facebook\.|fb\.com/.test(h))return {source:'facebook',medium:'organic_social'};
  return {source:h||'referral',medium:'referral'};
}
function context(rawUrl,docRef){
  const u=new URL(rawUrl,BASE),q=u.searchParams,ref=clean(q.get('mpmv_referrer')||docRef||'',1000);
  let source=clean(q.get('utm_source')||q.get('mpmv_source')||'',150);
  let medium=clean(q.get('utm_medium')||q.get('mpmv_medium')||'',150);
  const campaign=clean(q.get('utm_campaign')||q.get('mpmv_campaign')||'',250);
  const term=clean(q.get('utm_term')||q.get('mpmv_term')||'',250);
  const content=clean(q.get('utm_content')||q.get('mpmv_content')||'',250);
  const fbclid=clean(q.get('fbclid')||q.get('mpmv_fbclid')||'',500);
  const gclid=clean(q.get('gclid')||q.get('mpmv_gclid')||'',500);
  if(!source){if(fbclid){source='meta';medium=medium||'paid_social'}else if(gclid){source='google';medium=medium||'cpc'}else{const ri=refInfo(ref,u.hostname);source=ri.source;medium=medium||ri.medium}}
  return {source:source||'direct',medium:medium||'none',campaign,term,content,fbclid,gclid,referrer:ref,landingPage:clean(q.get('mpmv_landing')||(u.pathname+u.search),1000)};
}
function setIfMissing(sp,k,v){if(v&&!sp.has(k))sp.set(k,v)}
function hotmartCode(c){let raw=[c.source,c.medium,c.campaign].filter(Boolean).join('-').toLowerCase();raw=raw.replace(/_/g,'-').replace(/[^a-z0-9|.-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');return(raw||'mpmv').slice(0,30)}
function decorate(href,c){
  const u=new URL(href,BASE),same=u.origin===BASE;
  if(same){
    const p=u.pathname.toLowerCase();
    if(p==='/'||/^\/blog(?:\/|$)/.test(p)||/^\/(curso|mentoria|obrigado)(?:\/|$)/.test(p)){
      setIfMissing(u.searchParams,'mpmv_source',c.source);setIfMissing(u.searchParams,'mpmv_medium',c.medium);setIfMissing(u.searchParams,'mpmv_campaign',c.campaign);
      setIfMissing(u.searchParams,'mpmv_term',c.term);setIfMissing(u.searchParams,'mpmv_content',c.content);setIfMissing(u.searchParams,'mpmv_referrer',c.referrer);
      setIfMissing(u.searchParams,'mpmv_landing',c.landingPage);setIfMissing(u.searchParams,'mpmv_fbclid',c.fbclid);setIfMissing(u.searchParams,'mpmv_gclid',c.gclid);
      return u.pathname+u.search+u.hash;
    }
  }
  if(/(^|\.)pay\.hotmart\.com$/i.test(u.hostname)){
    setIfMissing(u.searchParams,'utm_source',c.source);setIfMissing(u.searchParams,'utm_medium',c.medium);setIfMissing(u.searchParams,'utm_campaign',c.campaign||'mpmv');
    setIfMissing(u.searchParams,'utm_term',c.term);setIfMissing(u.searchParams,'utm_content',c.content);setIfMissing(u.searchParams,'sck',hotmartCode(c));
    return u.toString();
  }
  return href;
}
function trackingFrom(url,c,type){const u=new URL(url,BASE),t=new Date().toISOString();return{sessionId:`qa-${type}-${Date.now()}`,noteId:'',startedAt:t,updatedAt:t,landingPage:c.landingPage,currentPage:u.pathname+u.search,referrer:c.referrer,source:c.source,medium:c.medium,campaign:c.campaign,adset:c.term,ad:c.content,fbclid:c.fbclid,gclid:c.gclid,activeSeconds:0,elapsedSeconds:0,pageViews:1,device:'',browser:'',converted:false,conversionType:'',convertedAt:'',name:'',email:'',phone:'',pages:[{path:u.pathname+u.search,at:t}]}}
async function read(r){const text=await r.text();let body=text;try{body=JSON.parse(text)}catch(_){}return{status:r.status,ok:r.ok,body}}
async function post(path,payload){return read(await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}))}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  if(String(req.query&&req.query.qa||'')!==SECRET){res.setHeader('Location','/guia-pratico-persuasao-pra-vender-todo-santo-dia.pdf');return res.status(302).end()}
  try{
    const stamp=Date.now();
    const article=BASE+'/blog/efeito-contraste-marketing/?utm_source=instagram&utm_medium=paid_social&utm_campaign=qa_relay&utm_content=criativo_a';
    const articleCtx=context(article,'https://l.instagram.com/');
    const guidePath=decorate('/',articleCtx),guideUrl=BASE+guidePath,guideCtx=context(guideUrl,article);
    const obrigadoPath=decorate('/obrigado/',guideCtx),obrigadoUrl=BASE+obrigadoPath,obrigadoCtx=context(obrigadoUrl,guideUrl);
    const coursePath=decorate('/curso/',obrigadoCtx),courseUrl=BASE+coursePath,courseCtx=context(courseUrl,obrigadoUrl);
    const hotmart=decorate('https://pay.hotmart.com/Q107139469W',courseCtx);
    const mentoriaPath=decorate('/mentoria/',articleCtx),mentoriaUrl=BASE+mentoriaPath,mentoriaCtx=context(mentoriaUrl,article);

    const guideEmail=`irodrigosd+teste-relay-guia-${stamp}@gmail.com`;
    const mentoriaEmail=`irodrigosd+teste-relay-mentoria-${stamp}@gmail.com`;
    const guide=await post('/api/leads',{name:'Teste Relay Guia',email:guideEmail,source:'guia-pratico',page:'/',tracking:trackingFrom(guideUrl,guideCtx,'guide')});
    const mentoria=await post('/api/mentoria',{name:'Teste Relay Mentoria',email:mentoriaEmail,phone:'11999999999',product:'Produto QA',role:'Empresário QA',attention:'Teste de atribuição',whyYou:'Teste automatizado',revenue:'R$ 10.000',whyRodrigo:'Teste automatizado',resultsAgreement:'SIM',priceAgreement:'SIM',tracking:trackingFrom(mentoriaUrl,mentoriaCtx,'mentoria')});

    const h=new URL(hotmart);
    const continuity=[articleCtx,guideCtx,obrigadoCtx,courseCtx,mentoriaCtx].every(c=>c.source==='instagram'&&c.medium==='paid_social'&&c.campaign==='qa_relay');
    const landingPreserved=[guideCtx,obrigadoCtx,courseCtx,mentoriaCtx].every(c=>String(c.landingPage).startsWith('/blog/efeito-contraste-marketing/'));
    const hotmartOk=h.searchParams.get('utm_source')==='instagram'&&h.searchParams.get('utm_medium')==='paid_social'&&h.searchParams.get('utm_campaign')==='qa_relay'&&h.searchParams.get('utm_content')==='criativo_a'&&!!h.searchParams.get('sck');
    return res.status(200).json({ok:true,continuity,landingPreserved,hotmartOk,paths:{guide:guidePath,obrigado:obrigadoPath,course:coursePath,mentoria:mentoriaPath,hotmart},guide,mentoria});
  }catch(e){return res.status(500).json({ok:false,error:e.message||'qa_failed'})}
};