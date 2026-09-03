const API='https://api.github.com';

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

export default async function handler(req,res){
  const supplied=String(req.headers['x-admin-token']||'');
  const adminTokens=[process.env.ADMIN_BLOG_TOKEN,process.env.LEADS_ADMIN_TOKEN,process.env.BLOG_ADMIN_TOKEN]
    .filter(Boolean).map(v=>String(v).trim()).filter((v,i,a)=>v&&a.indexOf(v)===i);
  if(!adminTokens.length) return json(res,500,{error:'Token do admin não configurado na Vercel.'});
  if(!adminTokens.includes(supplied)) return json(res,401,{error:'Token inválido.'});

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

    const action=String(req.query?.action||'').toLowerCase();
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
