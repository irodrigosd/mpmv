const API='https://api.github.com';

const json=(res,status,data)=>{
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(data));
};

export default async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{error:'Método não permitido.'});

  const adminToken=process.env.ADMIN_BLOG_TOKEN;
  if(!adminToken) return json(res,500,{error:'ADMIN_BLOG_TOKEN não disponível neste deployment.'});
  if(req.headers['x-admin-token']!==adminToken) return json(res,401,{error:'Token do admin inválido.'});

  const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  const files=Array.isArray(body.files)?body.files:[];
  if(!files.length) return json(res,400,{error:'Nenhum arquivo recebido.'});
  if(files.length>80) return json(res,400,{error:'ZIP com arquivos demais.'});

  // Fallbacks para evitar depender de quatro variáveis diferentes.
  // BLOG_GITHUB_TOKEN já existia no projeto antes do novo painel.
  const token=process.env.GITHUB_TOKEN || process.env.BLOG_GITHUB_TOKEN;
  const owner=(process.env.GITHUB_OWNER || 'irodrigosd').trim();
  const repo=(process.env.GITHUB_REPO || 'mpmv').trim();
  const branch=(process.env.GITHUB_BRANCH || 'main').trim();

  if(!token){
    return json(res,500,{
      error:'Token GitHub indisponível neste deployment.',
      diagnostic:{
        GITHUB_TOKEN:Boolean(process.env.GITHUB_TOKEN),
        BLOG_GITHUB_TOKEN:Boolean(process.env.BLOG_GITHUB_TOKEN),
        GITHUB_OWNER:Boolean(process.env.GITHUB_OWNER),
        GITHUB_REPO:Boolean(process.env.GITHUB_REPO),
        GITHUB_BRANCH:Boolean(process.env.GITHUB_BRANCH)
      }
    });
  }

  const headers={
    'Accept':'application/vnd.github+json',
    'Authorization':`Bearer ${token.trim()}`,
    'X-GitHub-Api-Version':'2022-11-28',
    'User-Agent':'MPMV-Blog-Admin',
    'Content-Type':'application/json'
  };

  const safePath=p=>{
    if(typeof p!=='string') return false;
    if(!p || p.startsWith('/') || p.includes('..') || p.startsWith('.git/')) return false;
    return /^[A-Za-z0-9._\-\/ áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ()]+$/.test(p);
  };

  try{
    for(const f of files){
      if(!safePath(f.path)) return json(res,400,{error:`Caminho inválido no ZIP: ${String(f.path)}`});
      if(typeof f.content!=='string' || f.content.length>5_000_000) return json(res,400,{error:`Arquivo inválido ou grande demais: ${f.path}`});
    }

    const refRes=await fetch(`${API}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,{headers});
    if(!refRes.ok){
      const t=await refRes.text().catch(()=> '');
      throw new Error(`GitHub REF: ${refRes.status} ${t.slice(0,220)}`);
    }
    const ref=await refRes.json();
    const parentSha=ref.object.sha;

    const commitRes=await fetch(`${API}/repos/${owner}/${repo}/git/commits/${parentSha}`,{headers});
    if(!commitRes.ok){
      const t=await commitRes.text().catch(()=> '');
      throw new Error(`GitHub COMMIT: ${commitRes.status} ${t.slice(0,220)}`);
    }
    const parentCommit=await commitRes.json();
    const baseTree=parentCommit.tree.sha;

    const tree=[];
    for(const f of files){
      const blobRes=await fetch(`${API}/repos/${owner}/${repo}/git/blobs`,{
        method:'POST',headers,
        body:JSON.stringify({content:f.content,encoding:'base64'})
      });
      if(!blobRes.ok){
        const t=await blobRes.text().catch(()=> '');
        throw new Error(`GitHub BLOB ${f.path}: ${blobRes.status} ${t.slice(0,220)}`);
      }
      const blob=await blobRes.json();
      tree.push({path:f.path,mode:'100644',type:'blob',sha:blob.sha});
    }

    const treeRes=await fetch(`${API}/repos/${owner}/${repo}/git/trees`,{
      method:'POST',headers,
      body:JSON.stringify({base_tree:baseTree,tree})
    });
    if(!treeRes.ok){
      const t=await treeRes.text().catch(()=> '');
      throw new Error(`GitHub TREE: ${treeRes.status} ${t.slice(0,220)}`);
    }
    const newTree=await treeRes.json();

    const msg=`blog: publicar ZIP ${String(body.zipName||'artigo').slice(0,120)}`;
    const newCommitRes=await fetch(`${API}/repos/${owner}/${repo}/git/commits`,{
      method:'POST',headers,
      body:JSON.stringify({message:msg,tree:newTree.sha,parents:[parentSha]})
    });
    if(!newCommitRes.ok){
      const t=await newCommitRes.text().catch(()=> '');
      throw new Error(`GitHub NEW COMMIT: ${newCommitRes.status} ${t.slice(0,220)}`);
    }
    const newCommit=await newCommitRes.json();

    const updateRefRes=await fetch(`${API}/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,{
      method:'PATCH',headers,
      body:JSON.stringify({sha:newCommit.sha,force:false})
    });
    if(!updateRefRes.ok){
      const t=await updateRefRes.text().catch(()=> '');
      throw new Error(`GitHub UPDATE REF: ${updateRefRes.status} ${t.slice(0,220)}`);
    }

    return json(res,200,{ok:true,commit:newCommit.sha,files:files.length,repository:`${owner}/${repo}`,branch});
  }catch(err){
    console.error(err);
    return json(res,500,{error:'Não foi possível publicar o ZIP.',detail:String(err.message||err)});
  }
}
