const crypto=require('crypto');

const SITE_URL=process.env.GSC_SITE_URL||'https://www.maispersuasaomaisvendas.com.br/';
const CLIENT_EMAIL=process.env.GSC_CLIENT_EMAIL||'';
const PRIVATE_KEY=(process.env.GSC_PRIVATE_KEY||'').replace(/\\n/g,'\n');
const CANONICAL_ORIGIN='https://www.maispersuasaomaisvendas.com.br';

function json(res,status,body){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(body)}
function authorized(req){const expected=process.env.LEADS_ADMIN_TOKEN||process.env.BLOG_ADMIN_TOKEN||'';if(!expected)return false;const direct=String(req.headers['x-admin-token']||'');const auth=String(req.headers.authorization||'');const bearer=auth.toLowerCase().startsWith('bearer ')?auth.slice(7).trim():'';return direct===expected||bearer===expected}
function b64url(input){return Buffer.from(input).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}
function isoDate(d){return d.toISOString().slice(0,10)}

async function accessToken(){
  if(!CLIENT_EMAIL||!PRIVATE_KEY) throw Object.assign(new Error('search_console_not_configured'),{status:503});
  const now=Math.floor(Date.now()/1000);
  const header=b64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const payload=b64url(JSON.stringify({iss:CLIENT_EMAIL,scope:'https://www.googleapis.com/auth/webmasters.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
  const unsigned=header+'.'+payload;
  const sign=crypto.createSign('RSA-SHA256');sign.update(unsigned);sign.end();
  const sig=sign.sign(PRIVATE_KEY).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const assertion=unsigned+'.'+sig;
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||!data.access_token) throw Object.assign(new Error(data.error_description||data.error||'google_auth_failed'),{status:r.status||500});
  return data.access_token;
}

async function query(token,body){
  const url='https://searchconsole.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(SITE_URL)+'/searchAnalytics/query';
  const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw Object.assign(new Error((data.error&&data.error.message)||'search_console_query_failed'),{status:r.status||500,data});
  return data;
}

function row(r){return{keys:r.keys||[],clicks:Number(r.clicks||0),impressions:Number(r.impressions||0),ctr:Number(r.ctr||0),position:Number(r.position||0)}}
function canonicalPath(raw){try{const u=new URL(raw);return u.pathname.replace(/\/+/g,'/')}catch(_){return''}}
function mergePageRows(rows){
  const map=new Map();
  for(const r of rows){
    const raw=r.keys&&r.keys[0]||'';
    const path=canonicalPath(raw);
    if(!path)continue;
    const cur=map.get(path)||{path,clicks:0,impressions:0,positionWeighted:0};
    cur.clicks+=Number(r.clicks||0);
    cur.impressions+=Number(r.impressions||0);
    cur.positionWeighted+=Number(r.position||0)*Number(r.impressions||0);
    map.set(path,cur);
  }
  return Array.from(map.values()).map(x=>({
    keys:[CANONICAL_ORIGIN+x.path],
    clicks:x.clicks,
    impressions:x.impressions,
    ctr:x.impressions?x.clicks/x.impressions:0,
    position:x.impressions?x.positionWeighted/x.impressions:0
  }));
}

module.exports=async function handler(req,res){
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET'){res.setHeader('Allow','GET, OPTIONS');return json(res,405,{ok:false,error:'method_not_allowed'})}
  if(!authorized(req))return json(res,401,{ok:false,error:'unauthorized'});
  try{
    const days=Math.max(1,Math.min(90,Number(req.query&&req.query.days)||28));
    const end=new Date();end.setUTCDate(end.getUTCDate()-2);
    const start=new Date(end);start.setUTCDate(start.getUTCDate()-days+1);
    const token=await accessToken();
    const base={startDate:isoDate(start),endDate:isoDate(end),type:'web',rowLimit:25000,dataState:'final'};
    const [pagesData,queriesData,totalsData]=await Promise.all([
      query(token,{...base,dimensions:['page']}),
      query(token,{...base,dimensions:['query'],rowLimit:1000}),
      query(token,{...base,dimensions:[]})
    ]);
    const mergedPages=mergePageRows((pagesData.rows||[]).map(row));
    const pages=mergedPages.filter(x=>canonicalPath(x.keys[0]||'').startsWith('/blog/')).sort((a,b)=>b.clicks-a.clicks||b.impressions-a.impressions);
    const queries=(queriesData.rows||[]).map(row).sort((a,b)=>b.clicks-a.clicks||b.impressions-a.impressions);
    const total=(totalsData.rows&&totalsData.rows[0])?row(totalsData.rows[0]):{keys:[],clicks:0,impressions:0,ctr:0,position:0};
    const articleTotals=pages.reduce((a,p)=>({clicks:a.clicks+p.clicks,impressions:a.impressions+p.impressions}),{clicks:0,impressions:0});
    articleTotals.ctr=articleTotals.impressions?articleTotals.clicks/articleTotals.impressions:0;
    const opportunities=pages.filter(p=>p.clicks===0&&p.impressions>=5&&p.position>0&&p.position<=12).sort((a,b)=>a.position-b.position||b.impressions-a.impressions).slice(0,20);
    return json(res,200,{ok:true,siteUrl:SITE_URL,canonicalOrigin:CANONICAL_ORIGIN,startDate:isoDate(start),endDate:isoDate(end),days,total,articleTotals,pages:pages.slice(0,100),queries:queries.slice(0,100),opportunities});
  }catch(e){console.error('Search Console Error',e);return json(res,e.status&&e.status<600?e.status:500,{ok:false,error:e.message||'internal_error'})}
};