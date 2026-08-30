const API='https://api.github.com';

const json=(res,status,data)=>{
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify(data));
};

const slugOk=s=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(s||''));
const cleanText=(value,max)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const decode=file=>Buffer.from(String(file?.content||'').replace(/\s/g,''),'base64').toString('utf8');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function fmtDate(date){
  const months=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const m=String(date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m?`${Number(m[3])} ${months[Number(m[2])-1]} ${m[1]}`:date;
}

function buildCard(post){
  return `<!-- POST:${post.slug} START -->
<a class="post" href="${esc(post.url)}"><div class="post-copy"><div class="date">${esc(fmtDate(post.publishedAt))}<br/>${esc(post.category||'Conteúdo')}</div><h3>${esc(post.title)}</h3><p>${esc(post.metaDescription||'')}</p></div></a>
<!-- POST:${post.slug} END -->`;
}

function updateBlogCard(html,post){
  const re=new RegExp(`<!-- POST:${post.slug} START -->[\\s\\S]*?<!-- POST:${post.slug} END -->`,'g');
  if(!re.test(String(html||''))) throw new Error('Não encontrei o card deste artigo em blog.html.');
  return String(html).replace(re,buildCard(post));
}

function updateSitemap(xml,post,lastmod){
  const absolute=`https://www.maispersuasaomaisvendas.com.br${post.url}`;
  return String(xml||'').replace(/<url>[\s\S]*?<\/url>/g,block=>{
    if(!block.includes(`<loc>${absolute}</loc>`)) return block;
    return /<lastmod>[^<]*<\/lastmod>/.test(block)
      ?block.replace(/<lastmod>[^<]*<\/lastmod>/,`<lastmod>${lastmod}</lastmod>`)
      :block.replace('</url>',`    <lastmod>${lastmod}</lastmod>\n  </url>`);
  });
}

export default async function handler(req,res){
  if(!['GET','POST'].includes(req.method)) return json(res,405,{error:'Método não permitido.'});

  const adminToken=process.env.ADMIN_BLOG_TOKEN;
  if(!adminToken) return json(res,500,{error:'ADMIN_BLOG_TOKEN não configurado na Vercel.'});
  if(req.headers['x-admin-token']!==adminToken) return json(res,401,{error:'Token inválido.'});

  let body={};
  try{body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});}catch{return json(res,400,{error:'Dados inválidos.'});}
  const slug=String(req.method==='GET'?req.query?.slug:body.slug||'').trim();
  if(!slugOk(slug)) return json(res,400,{error:'Slug inválido.'});

  const tokenCandidates=[process.env.BLOG_GITHUB_TOKEN,process.env.GITHUB_TOKEN]
    .filter(Boolean).map(t=>t.trim()).filter((t,i,a)=>a.indexOf(t)===i);
  const owner=(process.env.GITHUB_OWNER||'irodrigosd').trim();
  const repo=(process.env.GITHUB_REPO||'mpmv').trim();
  const branch=(process.env.GITHUB_BRANCH||'main').trim();
  if(!tokenCandidates.length) return json(res,500,{error:'Token GitHub indisponível neste deployment.'});

  const makeHeaders=token=>({
    'Accept':'application/vnd.github+json',
    'Authorization':`Bearer ${token}`,
    'X-GitHub-Api-Version':'2022-11-28',
    'User-Agent':'MPMV-Blog-Admin'
  });

  try{
    let headers=null;
    let ref=null;
    for(const token of tokenCandidates){
      const candidateHeaders=makeHeaders(token);
      const r=await fetch(`${API}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,{headers:candidateHeaders});
      if(r.ok){headers=candidateHeaders;ref=await r.json();break;}
      if(![401,403].includes(r.status)) throw new Error(`GitHub REF: ${r.status}`);
    }
    if(!headers||!ref) throw new Error('Falha ao autenticar no GitHub.');

    const pathUrl=path=>`${API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g,'/')}?ref=${encodeURIComponent(branch)}`;
    async function getFile(path){
      const r=await fetch(pathUrl(path),{headers});
      if(r.status===404)return null;
      if(!r.ok)throw new Error(`GitHub GET ${path}: ${r.status}`);
      return r.json();
    }

    const manifestFile=await getFile('data/blog-posts.json');
    if(!manifestFile) return json(res,404,{error:'Manifesto de artigos não encontrado.'});
    const manifest=JSON.parse(decode(manifestFile));
    const index=manifest.findIndex(p=>p?.slug===slug);
    if(index<0) return json(res,404,{error:'Artigo não encontrado.'});
    const currentPost=manifest[index];
    const articleFile=await getFile(currentPost.file);
    if(!articleFile) return json(res,404,{error:'Arquivo HTML do artigo não encontrado.'});

    if(req.method==='GET'){
      return json(res,200,{ok:true,post:currentPost,html:decode(articleFile)});
    }

    const html=String(body.html||'');
    const title=cleanText(body.title,220);
    const seoTitle=cleanText(body.seoTitle,220);
    const metaDescription=cleanText(body.metaDescription,400);
    const focusKeyphrase=cleanText(body.focusKeyphrase,180);
    if(!title||!seoTitle||!metaDescription||!focusKeyphrase) return json(res,400,{error:'Preencha título, título SEO, meta descrição e frase-chave.'});
    if(html.length<500||html.length>1_200_000||!/<html\b/i.test(html)||!/<h1\b/i.test(html)){
      return json(res,400,{error:'O HTML do artigo parece incompleto ou inválido.'});
    }
    if(!new RegExp(`/blog/${slug}/?`,'i').test(html)){
      return json(res,400,{error:'O HTML não corresponde à URL deste artigo. O slug não pode ser alterado por aqui.'});
    }

    const today=new Date().toISOString().slice(0,10);
    const nextPost={...currentPost,title,seoTitle,metaDescription,focusKeyphrase,updatedAt:today};
    manifest[index]=nextPost;

    const [blogFile,sitemapFile,commitRes]=await Promise.all([
      getFile('blog.html'),
      getFile('sitemap.xml'),
      fetch(`${API}/repos/${owner}/${repo}/git/commits/${ref.object.sha}`,{headers})
    ]);
    if(!blogFile) throw new Error('blog.html não encontrado.');
    if(!commitRes.ok) throw new Error(`GitHub COMMIT: ${commitRes.status}`);
    const parentCommit=await commitRes.json();
    const nextBlog=updateBlogCard(decode(blogFile),nextPost);
    const nextSitemap=sitemapFile?updateSitemap(decode(sitemapFile),nextPost,today):null;

    async function createBlob(content){
      const r=await fetch(`${API}/repos/${owner}/${repo}/git/blobs`,{
        method:'POST',headers:{...headers,'Content-Type':'application/json'},
        body:JSON.stringify({content,encoding:'utf-8'})
      });
      if(!r.ok)throw new Error(`GitHub BLOB: ${r.status}`);
      return (await r.json()).sha;
    }

    const [articleBlob,manifestBlob,blogBlob,sitemapBlob]=await Promise.all([
      createBlob(html),
      createBlob(JSON.stringify(manifest,null,2)+'\n'),
      createBlob(nextBlog),
      nextSitemap===null?Promise.resolve(null):createBlob(nextSitemap)
    ]);
    const tree=[
      {path:currentPost.file,mode:'100644',type:'blob',sha:articleBlob},
      {path:'data/blog-posts.json',mode:'100644',type:'blob',sha:manifestBlob},
      {path:'blog.html',mode:'100644',type:'blob',sha:blogBlob}
    ];
    if(sitemapBlob) tree.push({path:'sitemap.xml',mode:'100644',type:'blob',sha:sitemapBlob});

    const treeRes=await fetch(`${API}/repos/${owner}/${repo}/git/trees`,{
      method:'POST',headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({base_tree:parentCommit.tree.sha,tree})
    });
    if(!treeRes.ok)throw new Error(`GitHub TREE: ${treeRes.status}`);
    const newTree=await treeRes.json();

    const newCommitRes=await fetch(`${API}/repos/${owner}/${repo}/git/commits`,{
      method:'POST',headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({message:`blog: editar ${slug}`,tree:newTree.sha,parents:[ref.object.sha]})
    });
    if(!newCommitRes.ok)throw new Error(`GitHub NEW COMMIT: ${newCommitRes.status}`);
    const newCommit=await newCommitRes.json();

    const updateRefRes=await fetch(`${API}/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,{
      method:'PATCH',headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({sha:newCommit.sha,force:false})
    });
    if(!updateRefRes.ok)throw new Error(`GitHub UPDATE REF: ${updateRefRes.status}`);

    return json(res,200,{ok:true,slug,commit:newCommit.sha,post:nextPost});
  }catch(err){
    console.error(err);
    return json(res,500,{error:'Não foi possível editar o artigo.',detail:String(err.message||err)});
  }
}
