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
  if(!adminToken) return json(res,500,{error:'ADMIN_BLOG_TOKEN não configurado na Vercel.'});
  if(req.headers['x-admin-token']!==adminToken) return json(res,401,{error:'Token inválido.'});

  const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  const files=Array.isArray(body.files)?body.files:[];
  if(!files.length) return json(res,400,{error:'Nenhum arquivo recebido.'});
  if(files.length>80) return json(res,400,{error:'ZIP com arquivos demais.'});

  const token=process.env.GITHUB_TOKEN;
  const owner=process.env.GITHUB_OWNER;
  const repo=process.env.GITHUB_REPO;
  const branch=process.env.GITHUB_BRANCH||'main';
  if(!token||!owner||!repo) return json(res,500,{error:'Configure GITHUB_TOKEN, GITHUB_OWNER e GITHUB_REPO na Vercel.'});

  const headers={
    'Accept':'application/vnd.github+json',
    'Authorization':`Bearer ${token}`,
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
    if(!refRes.ok) throw new Error(`GitHub REF: ${refRes.status}`);
    const ref=await refRes.json();
    const parentSha=ref.object.sha;

    const commitRes=await fetch(`${API}/repos/${owner}/${repo}/git/commits/${parentSha}`,{headers});
    if(!commitRes.ok) throw new Error(`GitHub COMMIT: ${commitRes.status}`);
    const parentCommit=await commitRes.json();
    const baseTree=parentCommit.tree.sha;

    const tree=[];
    for(let i=0;i<files.length;i++){
      const f=files[i];
      const blobRes=await fetch(`${API}/repos/${owner}/${repo}/git/blobs`,{
        method:'POST',headers,
        body:JSON.stringify({content:f.content,encoding:'base64'})
      });
      if(!blobRes.ok){
        const t=await blobRes.text().catch(()=> '');
        throw new Error(`GitHub BLOB ${f.path}: ${blobRes.status} ${t.slice(0,160)}`);
      }
      const blob=await blobRes.json();
      tree.push({path:f.path,mode:'100644',type:'blob',sha:blob.sha});
    }

    const treeRes=await fetch(`${API}/repos/${owner}/${repo}/git/trees`,{
      method:'POST',headers,
      body:JSON.stringify({base_tree:baseTree,tree})
    });
    if(!treeRes.ok) throw new Error(`GitHub TREE: ${treeRes.status}`);
    const newTree=await treeRes.json();

    const msg=`blog: publicar ZIP ${String(body.zipName||'artigo').slice(0,120)}`;
    const newCommitRes=await fetch(`${API}/repos/${owner}/${repo}/git/commits`,{
      method:'POST',headers,
      body:JSON.stringify({message:msg,tree:newTree.sha,parents:[parentSha]})
    });
    if(!newCommitRes.ok) throw new Error(`GitHub NEW COMMIT: ${newCommitRes.status}`);
    const newCommit=await newCommitRes.json();

    const updateRefRes=await fetch(`${API}/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,{
      method:'PATCH',headers,
      body:JSON.stringify({sha:newCommit.sha,force:false})
    });
    if(!updateRefRes.ok) throw new Error(`GitHub UPDATE REF: ${updateRefRes.status}`);

    return json(res,200,{ok:true,commit:newCommit.sha,files:files.length});
  }catch(err){
    console.error(err);
    return json(res,500,{error:'Não foi possível publicar o ZIP.',detail:String(err.message||err)});
  }
}
