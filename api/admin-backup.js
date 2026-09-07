const API='https://api.github.com';
const VERCEL_API='https://api.vercel.com';
const VERCEL_PROJECT_ID='prj_c8zvkjwMmZmE4My4fiJA8zqcOUSn';
const VERCEL_TEAM_ID='team_BVsuVX2DEGb6PtSNkqdRlzjB';

function json(res,status,data){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify(data));
}

const decodeBlob=data=>Buffer.from(String(data?.content||'').replace(/\s/g,''),'base64').toString('utf8');

function injectTracking(html){
  const source=String(html||'');
  if(/<script\b[^>]*\bsrc\s*=\s*["']\/analytics\.js(?:\?[^"']*)?["'][^>]*>/i.test(source)) return {html:source,changed:false};
  const tag='\n  <script src="/analytics.js" defer></script>\n';
  if(/<\/head>/i.test(source)) return {html:source.replace(/<\/head>/i,tag+'</head>'),changed:true};
  if(/<\/body>/i.test(source)) return {html:source.replace(/<\/body>/i,tag+'</body>'),changed:true};
  return {html:source+tag,changed:true};
}

async function mapLimit(items,limit,worker){
  let cursor=0;
  async function runner(){
    while(true){
      const index=cursor++;
      if(index>=items.length) return;
      await worker(items[index],index);
    }
  }
  const count=Math.max(1,Math.min(limit,items.length||1));
  await Promise.all(Array.from({length:count},runner));
}

async function vercelJson(path,token,options={}){
  const r=await fetch(VERCEL_API+path,{
    ...options,
    headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(options.headers||{})}
  });
  const text=await r.text();
  let data={};
  try{data=text?JSON.parse(text):{};}catch{data={raw:text};}
  if(!r.ok){const e=new Error((data&&data.error&&data.error.message)||data.message||`Vercel ${r.status}`);e.status=r.status;e.data=data;throw e;}
  return data;
}

async function listVercelDeployments(token){
  const all=[];let until='';
  for(let page=0;page<30;page++){
    const qs=new URLSearchParams({projectId:VERCEL_PROJECT_ID,teamId:VERCEL_TEAM_ID,limit:'100'});
    if(until)qs.set('until',until);
    const data=await vercelJson(`/v6/deployments?${qs.toString()}`,token);
    const batch=Array.isArray(data.deployments)?data.deployments:[];
    all.push(...batch);
    const next=data.pagination&&data.pagination.next;
    if(!next||!batch.length)break;
    until=String(next);
  }
  all.sort((a,b)=>Number(b.created||b.createdAt||0)-Number(a.created||a.createdAt||0));
  return all;
}

export default async function handler(req,res){
  const supplied=String(req.headers['x-admin-token']||'');
  const adminTokens=[process.env.ADMIN_BLOG_TOKEN,process.env.LEADS_ADMIN_TOKEN,process.env.BLOG_ADMIN_TOKEN]
    .filter(Boolean).map(v=>String(v).trim()).filter((v,i,a)=>v&&a.indexOf(v)===i);
  if(!adminTokens.length) return json(res,500,{error:'Token do admin não configurado na Vercel.'});
  if(!adminTokens.includes(supplied)) return json(res,401,{error:'Token inválido.'});

  const action=String(req.query?.action||'').toLowerCase();
  if(req.method==='POST'&&action==='vercel-cleanup'){
    try{
      const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
      const token=String(body.vercelToken||'').trim();
      if(!token)return json(res,400,{ok:false,error:'Token temporário da Vercel não informado.'});

      const skipIds=new Set((Array.isArray(body.skipIds)?body.skipIds:[]).map(v=>String(v||'').trim()).filter(Boolean));
      const deployments=await listVercelDeployments(token);
      const keep=5,currentUrl=String(process.env.VERCEL_URL||'').replace(/^https?:\/\//,'');
      const protectedIds=new Set();
      deployments.slice(0,keep).forEach(d=>protectedIds.add(d.uid||d.id));
      deployments.forEach(d=>{if(currentUrl&&String(d.url||'').replace(/^https?:\/\//,'')===currentUrl)protectedIds.add(d.uid||d.id)});

      const old=deployments.filter(d=>!protectedIds.has(d.uid||d.id));
      const actionable=old.filter(d=>!skipIds.has(String(d.uid||d.id)));
      const batch=actionable.slice(-20);
      const settled=await Promise.allSettled(batch.map(async d=>{
        const id=d.uid||d.id;
        try{
          await vercelJson(`/v13/deployments/${encodeURIComponent(id)}?teamId=${encodeURIComponent(VERCEL_TEAM_ID)}`,token,{method:'DELETE'});
          return {id,url:d.url||'',deleted:true};
        }catch(err){
          throw {id,url:d.url||'',reason:String(err&&err.message||err||'Vercel recusou a exclusão').slice(0,240),status:Number(err&&err.status||0)};
        }
      }));

      const failedItems=[];
      let deleted=0;
      settled.forEach(r=>{
        if(r.status==='fulfilled')deleted++;
        else{
          const x=r.reason&&typeof r.reason==='object'?r.reason:{};
          failedItems.push({
            id:String(x.id||''),
            url:String(x.url||''),
            reason:String(x.reason||'Vercel recusou a exclusão').slice(0,240),
            status:Number(x.status||0)
          });
        }
      });

      const newlySkipped=new Set(failedItems.map(x=>x.id).filter(Boolean));
      const remainingActionable=Math.max(0,actionable.length-deleted-newlySkipped.size);
      return json(res,200,{
        ok:true,
        total:deployments.length,
        kept:Math.min(keep,deployments.length),
        currentProtected:protectedIds.size,
        deleted,
        failed:failedItems.length,
        failedItems,
        alreadySkipped:skipIds.size,
        oldTotal:old.length,
        remainingActionable,
        done:remainingActionable===0
      });
    }catch(err){
      return json(res,err.status===401?401:500,{ok:false,error:'Falha na limpeza da Vercel.',detail:String(err.message||err)});
    }
  }

  const tokens=[process.env.BLOG_GITHUB_TOKEN,process.env.GITHUB_TOKEN]
    .filter(Boolean).map(t=>t.trim()).filter((t,i,a)=>a.indexOf(t)===i);
  const owner=(process.env.GITHUB_OWNER||'irodrigosd').trim();
  const repo=(process.env.GITHUB_REPO||'mpmv').trim();
  const branch=(process.env.GITHUB_BRANCH||'main').trim();
  if(!tokens.length) return json(res,500,{error:'Token GitHub indisponível neste deployment.'});

  const makeHeaders=token=>({
    Accept:'application/vnd.github+json',
    Authorization:`Bearer ${token}`,
    'X-GitHub-Api-Version':'2022-11-28',
    'User-Agent':'MPMV-Admin',
    'Content-Type':'application/json'
  });

  try{
    let headers=null,ref=null;
    for(const token of tokens){
      const h=makeHeaders(token);
      const r=await fetch(`${API}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,{headers:h});
      if(r.ok){headers=h;ref=await r.json();break;}
      if(![401,403].includes(r.status)) throw new Error(`GitHub REF: ${r.status}`);
    }
    if(!headers||!ref) throw new Error('Falha ao autenticar no GitHub.');

    if(req.method==='POST'&&action==='article-tracking'){
      async function gh(url,opts={}){
        const r=await fetch(url,{...opts,headers:{...headers,...(opts.headers||{})}});
        const text=await r.text();
        let data={};
        try{data=text?JSON.parse(text):{};}catch{data={raw:text};}
        if(!r.ok) throw new Error((data&&data.message)||`GitHub ${r.status}`);
        return data;
      }

      const parentSha=ref.object.sha;
      const parentCommit=await gh(`${API}/repos/${owner}/${repo}/git/commits/${parentSha}`);
      const baseTree=parentCommit.tree.sha;
      const fullTree=await gh(`${API}/repos/${owner}/${repo}/git/trees/${baseTree}?recursive=1`);
      if(fullTree.truncated) throw new Error('A árvore do repositório veio truncada.');
      const byPath=new Map((fullTree.tree||[]).filter(x=>x&&x.type==='blob').map(x=>[x.path,x]));
      if(!byPath.has('analytics.js')) throw new Error('analytics.js não encontrado no repositório.');
      const manifestEntry=byPath.get('data/blog-posts.json');
      if(!manifestEntry) throw new Error('Manifesto de artigos não encontrado.');
      const manifestBlob=await gh(`${API}/repos/${owner}/${repo}/git/blobs/${manifestEntry.sha}`);
      let manifest=[];
      try{manifest=JSON.parse(decodeBlob(manifestBlob));}catch{throw new Error('Manifesto de artigos inválido.');}
      if(!Array.isArray(manifest)) throw new Error('Manifesto de artigos inválido.');

      const files=[...new Set(manifest.filter(p=>p&&p.status!=='deleted'&&typeof p.file==='string')
        .map(p=>p.file.replace(/^\/+/,''))
        .filter(p=>p.endsWith('.html')&&byPath.has(p)))].slice(0,250);
      const changes=[],failures=[];

      await mapLimit(files,8,async path=>{
        try{
          const entry=byPath.get(path);
          const blob=await gh(`${API}/repos/${owner}/${repo}/git/blobs/${entry.sha}`);
          const next=injectTracking(decodeBlob(blob));
          if(!next.changed) return;
          const created=await gh(`${API}/repos/${owner}/${repo}/git/blobs`,{method:'POST',body:JSON.stringify({content:next.html,encoding:'utf-8'})});
          changes.push({path,mode:'100644',type:'blob',sha:created.sha});
        }catch(err){failures.push({path,error:String(err.message||err).slice(0,180)});}
      });

      if(failures.length) return json(res,502,{ok:false,error:'Falha ao preparar alguns artigos.',failures:failures.slice(0,10),scanned:files.length,prepared:changes.length});
      if(!changes.length) return json(res,200,{ok:true,changed:0,scanned:files.length,message:'Todos os artigos já estão com tracking.'});

      const newTree=await gh(`${API}/repos/${owner}/${repo}/git/trees`,{method:'POST',body:JSON.stringify({base_tree:baseTree,tree:changes})});
      const newCommit=await gh(`${API}/repos/${owner}/${repo}/git/commits`,{method:'POST',body:JSON.stringify({message:`tracking: ativar em ${changes.length} artigo(s)`,tree:newTree.sha,parents:[parentSha]})});
      await gh(`${API}/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,{method:'PATCH',body:JSON.stringify({sha:newCommit.sha,force:false})});
      return json(res,200,{ok:true,changed:changes.length,scanned:files.length,commit:newCommit.sha,message:`Tracking instalado em ${changes.length} artigo(s).`});
    }

    if(req.method!=='GET') return json(res,405,{error:'Método não permitido.'});

    const sha=ref.object.sha;
    const archive=await fetch(`${API}/repos/${owner}/${repo}/zipball/${encodeURIComponent(sha)}`,{headers,redirect:'follow'});
    if(!archive.ok) throw new Error(`GitHub ZIP: ${archive.status}`);
    const bytes=Buffer.from(await archive.arrayBuffer());
    res.statusCode=200;
    res.setHeader('Content-Type','application/zip');
    res.setHeader('Content-Length',String(bytes.length));
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-MPMV-Commit',sha);
    res.setHeader('X-MPMV-Branch',branch);
    res.end(bytes);
  }catch(err){
    console.error(err);
    return json(res,500,{error:req.method==='POST'?'Não foi possível instalar o tracking nos artigos.':'Não foi possível gerar o backup.',detail:String(err.message||err)});
  }
}
