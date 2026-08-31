const API='https://api.github.com';

function json(res,status,data){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(data));
}

export default async function handler(req,res){
  if(req.method!=='GET') return json(res,405,{error:'Método não permitido.'});

  const adminToken=process.env.ADMIN_BLOG_TOKEN;
  if(!adminToken) return json(res,500,{error:'ADMIN_BLOG_TOKEN não configurado na Vercel.'});
  if(req.headers['x-admin-token']!==adminToken) return json(res,401,{error:'Token inválido.'});

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
    'User-Agent':'MPMV-Backup'
  });

  try{
    let headers=null;
    let ref=null;
    for(const token of tokens){
      const h=makeHeaders(token);
      const r=await fetch(`${API}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,{headers:h});
      if(r.ok){headers=h;ref=await r.json();break;}
      if(![401,403].includes(r.status)) throw new Error(`GitHub REF: ${r.status}`);
    }
    if(!headers||!ref) throw new Error('Falha ao autenticar no GitHub.');

    const sha=ref.object.sha;
    const archive=await fetch(`${API}/repos/${owner}/${repo}/zipball/${encodeURIComponent(sha)}`,{
      headers,
      redirect:'follow'
    });
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
    return json(res,500,{error:'Não foi possível gerar o backup.',detail:String(err.message||err)});
  }
}
