const DIAG='4KnAhT3F1xvQ8Jm5cS2L';
function json(res,status,body){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(body)}
export default async function handler(req,res){
  if(req.method!=='GET') return json(res,405,{ok:false,error:'method_not_allowed'});
  if(String(req.query&&req.query.diag||'')!==DIAG) return json(res,403,{ok:false,error:'forbidden'});
  const admin=String(process.env.LEADS_ADMIN_TOKEN||process.env.BLOG_ADMIN_TOKEN||'');
  if(!admin) return json(res,503,{ok:false,error:'admin_not_configured'});
  try{
    const r=await fetch('https://www.maispersuasaomaisvendas.com.br/api/search-console?days=30',{headers:{'x-admin-token':admin},cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    return json(res,r.ok?200:r.status,{ok:r.ok,cannibalizationCandidates:d.cannibalizationCandidates||[],pageQueries:d.pageQueries||[],opportunities:d.opportunities||[],queries:d.queries||[]});
  }catch(e){return json(res,500,{ok:false,error:e.message});}
}
