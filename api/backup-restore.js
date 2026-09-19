const API='https://api.github.com';

function json(res,status,data){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify(data));
}

function auth(req){
  const supplied=String(req.headers['x-admin-token']||'').trim();
  const valid=[process.env.ADMIN_BLOG_TOKEN,process.env.LEADS_ADMIN_TOKEN,process.env.BLOG_ADMIN_TOKEN]
    .filter(Boolean).map(String).map(s=>s.trim()).filter(Boolean);
  if(!valid.length) return {ok:false,status:500,error:'Token do admin não configurado na Vercel.'};
  if(!valid.includes(supplied)) return {ok:false,status:401,error:'Token inválido.'};
  return {ok:true};
}

function headers(){
  const token=String(process.env.BLOG_GITHUB_TOKEN||process.env.GITHUB_TOKEN||'').trim();
  return {
    Accept:'application/vnd.github+json',
    Authorization:'Bearer '+token,
    'X-GitHub-Api-Version':'2022-11-28',
    'User-Agent':'MPMV-Backup',
    'Content-Type':'application/json'
  };
}

function config(){
  return {
    owner:String(process.env.GITHUB_OWNER||'irodrigosd').trim(),
    repo:String(process.env.GITHUB_REPO||'mpmv').trim(),
    branch:String(process.env.GITHUB_BRANCH||'main').trim()
  };
}

async function gh(path,options={}){
  const token=String(process.env.BLOG_GITHUB_TOKEN||process.env.GITHUB_TOKEN||'').trim();
  if(!token) throw new Error('Token GitHub indisponível neste deployment.');
  const r=await fetch(API+path,{...options,headers:{...headers(),...(options.headers||{})}});
  const raw=await r.text();
  let data={};
  try{data=raw?JSON.parse(raw):{};}catch{data={raw};}
  if(!r.ok) throw new Error((data&&data.message)||('GitHub '+r.status));
  return data;
}

function safePath(p){
  p=String(p||'').replace(/\\/g,'/').replace(/^\/+/, '');
  if(!p || p.includes('\0') || p.split('/').some(x=>x==='..') || /^\.git(?:\/|$)/i.test(p)) return null;
  if(/^\.env(?:\.|$)/i.test(p) || /^\.vercel(?:\/|$)/i.test(p)) return null;
  return p;
}

export default async function handler(req,res){
  const a=auth(req);
  if(!a.ok) return json(res,a.status,{ok:false,error:a.error});
  if(req.method!=='POST') return json(res,405,{ok:false,error:'Método não permitido.'});

  const action=String(req.query?.action||'').toLowerCase();
  const {owner,repo,branch}=config();

  try{
    if(action==='prepare'){
      const ref=await gh('/repos/'+owner+'/'+repo+'/git/ref/heads/'+encodeURIComponent(branch));
      const parentSha=String(ref.object?.sha||'');
      if(!/^[0-9a-f]{40}$/i.test(parentSha)) throw new Error('Não foi possível obter o commit atual do GitHub.');
      return json(res,200,{ok:true,parentSha});
    }

    if(action==='blob'){
      const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
      const path=safePath(body.path);
      const content=String(body.content||'');
      if(!path) return json(res,400,{ok:false,error:'Caminho de arquivo inválido ou protegido.'});
      if(!content) return json(res,400,{ok:false,error:'Conteúdo vazio.'});
      if(content.length>4_000_000) return json(res,413,{ok:false,error:'Arquivo grande demais para uma única etapa. Tente novamente com um backup que não contenha arquivos individuais acima de 3 MB.'});
      const created=await gh('/repos/'+owner+'/'+repo+'/git/blobs',{
        method:'POST',
        body:JSON.stringify({content,encoding:'base64'})
      });
      return json(res,200,{ok:true,path,sha:created.sha});
    }

    if(action==='restore'){
      const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
      const parentSha=String(body.parentSha||'').trim();
      const entries=Array.isArray(body.entries)?body.entries:[];
      if(!/^[0-9a-f]{40}$/i.test(parentSha)) return json(res,400,{ok:false,error:'Commit de origem inválido.'});
      if(!entries.length) return json(res,400,{ok:false,error:'Nenhum arquivo foi preparado.'});
      if(entries.length>5000) return json(res,400,{ok:false,error:'Backup com arquivos demais para esta restauração.'});

      const ref=await gh('/repos/'+owner+'/'+repo+'/git/ref/heads/'+encodeURIComponent(branch));
      const currentSha=String(ref.object?.sha||'');
      if(currentSha!==parentSha) return json(res,409,{ok:false,error:'O repositório mudou enquanto o backup era preparado. Nada foi restaurado. Recarregue a página e tente novamente.'});

      const commit=await gh('/repos/'+owner+'/'+repo+'/git/commits/'+parentSha);
      const stamp=new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14);
      const safetyBranch='backup-pre-restore-'+stamp;
      await gh('/repos/'+owner+'/'+repo+'/git/refs',{
        method:'POST',
        body:JSON.stringify({ref:'refs/heads/'+safetyBranch,sha:parentSha})
      });

      const tree=entries.map(e=>({
        path:safePath(e.path),
        mode:e.mode==='100755'?'100755':'100644',
        type:'blob',
        sha:String(e.sha||'')
      })).filter(e=>e.path&&/^[0-9a-f]{40}$/i.test(e.sha));

      if(tree.length!==entries.length) return json(res,400,{ok:false,error:'Há arquivos inválidos no pacote. Nenhuma alteração foi feita.'});

      const newTree=await gh('/repos/'+owner+'/'+repo+'/git/trees',{
        method:'POST',
        body:JSON.stringify({tree})
      });

      const newCommit=await gh('/repos/'+owner+'/'+repo+'/git/commits',{
        method:'POST',
        body:JSON.stringify({
          message:'backup: restaurar pacote enviado pelo /backup',
          tree:newTree.sha,
          parents:[parentSha]
        })
      });

      await gh('/repos/'+owner+'/'+repo+'/git/refs/heads/'+encodeURIComponent(branch),{
        method:'PATCH',
        body:JSON.stringify({sha:newCommit.sha,force:false})
      });

      return json(res,200,{
        ok:true,
        files:tree.length,
        commit:newCommit.sha,
        safetyBranch,
        message:'Restauração concluída. Um ponto de retorno foi criado antes da restauração.'
      });
    }

    return json(res,400,{ok:false,error:'Ação inválida.'});
  }catch(err){
    console.error(err);
    return json(res,500,{ok:false,error:String(err?.message||err||'Falha na restauração.')});
  }
}
