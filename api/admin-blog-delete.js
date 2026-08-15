const API='https://api.github.com';
const json=(res,status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));};

export default async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{error:'Método não permitido.'});
  const adminToken=process.env.ADMIN_BLOG_TOKEN;
  if(!adminToken) return json(res,500,{error:'ADMIN_BLOG_TOKEN não configurado na Vercel.'});
  if(req.headers['x-admin-token']!==adminToken) return json(res,401,{error:'Token inválido.'});

  const {slug}=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  if(!slug || !/^[a-z0-9-]+$/.test(slug)) return json(res,400,{error:'Slug inválido.'});

  const token=process.env.GITHUB_TOKEN, owner=process.env.GITHUB_OWNER, repo=process.env.GITHUB_REPO, branch=process.env.GITHUB_BRANCH||'main';
  if(!token||!owner||!repo) return json(res,500,{error:'Configure GITHUB_TOKEN, GITHUB_OWNER e GITHUB_REPO na Vercel.'});
  const headers={'Accept':'application/vnd.github+json','Authorization':`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'MPMV-Blog-Admin'};
  const pathUrl=path=>`${API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g,'/')}?ref=${encodeURIComponent(branch)}`;

  async function getFile(path){const r=await fetch(pathUrl(path),{headers});if(r.status===404)return null;if(!r.ok)throw new Error(`GitHub GET ${path}: ${r.status}`);return r.json();}
  async function updateFile(path,content,sha,message){const r=await fetch(`${API}/repos/${owner}/${repo}/contents/${path}`,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({message,content:Buffer.from(content,'utf8').toString('base64'),sha,branch})});if(!r.ok)throw new Error(`GitHub UPDATE ${path}: ${r.status}`);return r.json();}
  async function deleteFile(path,sha,message){const r=await fetch(`${API}/repos/${owner}/${repo}/contents/${path}`,{method:'DELETE',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({message,sha,branch})});if(!r.ok && r.status!==404)throw new Error(`GitHub DELETE ${path}: ${r.status}`);}

  try{
    const manifestFile=await getFile('data/blog-posts.json');
    if(!manifestFile) return json(res,404,{error:'Manifesto de artigos não encontrado.'});
    const manifest=JSON.parse(Buffer.from(manifestFile.content,'base64').toString('utf8'));
    const post=manifest.find(p=>p.slug===slug);
    if(!post) return json(res,404,{error:'Artigo não encontrado.'});
    if(post.deletable===false) return json(res,403,{error:'Este artigo está protegido contra exclusão.'});

    const article=await getFile(post.file);
    if(article) await deleteFile(post.file,article.sha,`blog: apagar ${slug}`);

    const updatedManifest=manifest.filter(p=>p.slug!==slug);
    await updateFile('data/blog-posts.json',JSON.stringify(updatedManifest,null,2)+'\n',manifestFile.sha,`blog: remover ${slug} do admin`);

    const blog=await getFile('blog.html');
    if(blog){let html=Buffer.from(blog.content,'base64').toString('utf8');const re=new RegExp(`\\s*<!-- POST:${slug} START -->[\\s\\S]*?<!-- POST:${slug} END -->\\s*`,'g');const next=html.replace(re,'\n');if(next!==html)await updateFile('blog.html',next,blog.sha,`blog: remover ${slug} do índice`);}

    const sitemap=await getFile('sitemap.xml');
    if(sitemap){let xml=Buffer.from(sitemap.content,'base64').toString('utf8');const esc=post.url.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const re=new RegExp(`\\s*<url>[\\s\\S]*?<loc>https://www\\.maispersuasaomaisvendas\\.com\\.br${esc}<\\/loc>[\\s\\S]*?<\\/url>\\s*`,'g');const next=xml.replace(re,'\n');if(next!==xml)await updateFile('sitemap.xml',next,sitemap.sha,`blog: remover ${slug} do sitemap`);}

    const vercel=await getFile('vercel.json');
    if(vercel){const cfg=JSON.parse(Buffer.from(vercel.content,'base64').toString('utf8'));cfg.rewrites=(cfg.rewrites||[]).filter(r=>r.source!==post.url.replace(/\/$/,'')&&r.source!==post.url);await updateFile('vercel.json',JSON.stringify(cfg,null,2)+'\n',vercel.sha,`blog: remover rota ${slug}`);}

    return json(res,200,{ok:true,slug});
  }catch(err){console.error(err);return json(res,500,{error:'Não foi possível apagar o artigo.',detail:String(err.message||err)});}
}
