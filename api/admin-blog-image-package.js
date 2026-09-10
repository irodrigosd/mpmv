const API='https://api.github.com';
const json=(res,status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(data));};
const slugOk=s=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(s||''));
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const decode=f=>Buffer.from(String(f?.content||'').replace(/\s/g,''),'base64').toString('utf8');
const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const abs=url=>/^https?:\/\//i.test(url)?url:`https://www.maispersuasaomaisvendas.com.br/${String(url||'').replace(/^\/+/,'')}`;

function metaTag(doc,selector,attrs,content){
  let tag=doc.querySelector(selector);
  if(!tag){tag=doc.createElement('meta');Object.entries(attrs).forEach(([k,v])=>tag.setAttribute(k,v));doc.head.appendChild(tag);}
  tag.setAttribute('content',content);
}
function updateStructured(doc,title,description,imageUrl){
  doc.querySelectorAll('script[type="application/ld+json"]').forEach(script=>{
    try{
      const data=JSON.parse(script.textContent);
      const visit=value=>{
        if(Array.isArray(value)){value.forEach(visit);return;}
        if(!value||typeof value!=='object')return;
        const types=Array.isArray(value['@type'])?value['@type']:[value['@type']];
        if(types.some(t=>['Article','BlogPosting','NewsArticle'].includes(t))){
          value.headline=title;value.description=description;value.dateModified=new Date().toISOString().slice(0,10);value.image=[abs(imageUrl)];
        }
        Object.values(value).forEach(visit);
      };
      visit(data);script.textContent=JSON.stringify(data,null,2);
    }catch{}
  });
}
function buildPrompt(title,keyphrase,meta){
  return [
    'Create a premium editorial image for the Brazilian marketing blog "Mais Persuasão, Mais Vendas! (MPMV)".',
    'Visual direction: clean editorial design, light background, blue and white as the main palette, subtle dark graphite details, sophisticated Pinterest-style composition, strong visual metaphor related to the article subject, realistic photography or high-end editorial 3D when useful.',
    'The image is a blog visual asset, not an advertisement. No logos, no watermarks, no interface elements, no fake screenshots, no badges, no red sales banners, no countdowns.',
    'Do not place paragraphs or small text in the image. Prefer a single clear visual concept with generous negative space so the website can overlay the article title if needed.',
    `Article title: ${title}.`,
    keyphrase ? `Focus keyphrase: ${keyphrase}.` : '',
    meta ? `Article context: ${meta}.` : '',
    'Compose for a landscape master image that can be center-cropped into 16:9, 1:1 and 4:5 without losing the main subject.'
  ].filter(Boolean).join('\n');
}
function makeAlt(title,keyphrase){
  return clean(keyphrase ? `${title} sobre ${keyphrase}` : title).slice(0,300);
}

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'Método não permitido.'});
  const adminToken=process.env.ADMIN_BLOG_TOKEN;
  if(!adminToken)return json(res,500,{error:'ADMIN_BLOG_TOKEN não configurado na Vercel.'});
  if(req.headers['x-admin-token']!==adminToken)return json(res,401,{error:'Token inválido.'});

  let body={};try{body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});}catch{return json(res,400,{error:'Dados inválidos.'});}
  const action=String(body.action||'generate');
  const slug=String(body.slug||'').trim();
  if(!slugOk(slug))return json(res,400,{error:'Slug inválido.'});

  const owner=(process.env.GITHUB_OWNER||'irodrigosd').trim();
  const repo=(process.env.GITHUB_REPO||'mpmv').trim();
  const branch=(process.env.GITHUB_BRANCH||'main').trim();
  const ghTokens=[process.env.BLOG_GITHUB_TOKEN,process.env.GITHUB_TOKEN].filter(Boolean).map(t=>t.trim()).filter((t,i,a)=>a.indexOf(t)===i);
  if(!ghTokens.length)return json(res,500,{error:'Token GitHub indisponível neste deployment.'});

  const ghHeaders=t=>({'Accept':'application/vnd.github+json','Authorization':`Bearer ${t}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'MPMV-Blog-Image-Package'});
  let headers=null,ref=null;
  try{
    for(const token of ghTokens){
      const h=ghHeaders(token);
      const r=await fetch(`${API}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,{headers:h});
      if(r.ok){headers=h;ref=await r.json();break;}
      if(![401,403].includes(r.status))throw new Error(`GitHub REF: ${r.status}`);
    }
    if(!headers||!ref)throw new Error('Falha ao autenticar no GitHub.');

    if(action==='generate'){
      const key=String(body.keyphrase||'').trim();
      const title=clean(body.title||'');
      const meta=clean(body.metaDescription||'');
      if(!title)return json(res,400,{error:'Título do artigo ausente.'});
      const openaiKey=process.env.OPENAI_API_KEY;
      if(!openaiKey)return json(res,500,{error:'OPENAI_API_KEY não configurada na Vercel.'});

      const imageRes=await fetch('https://api.openai.com/v1/images/generations',{
        method:'POST',
        headers:{'Authorization':`Bearer ${openaiKey}`,'Content-Type':'application/json'},
        body:JSON.stringify({
          model:process.env.OPENAI_IMAGE_MODEL||'gpt-image-2',
          prompt:buildPrompt(title,key,meta),
          size:'1536x1024'
        })
      });
      const imageData=await imageRes.json().catch(()=>({}));
      if(!imageRes.ok)throw new Error(imageData?.error?.message||`OpenAI Images: ${imageRes.status}`);
      const b64=imageData?.data?.[0]?.b64_json;
      if(!b64)throw new Error('A API de imagens não retornou a imagem em base64.');

      return json(res,200,{
        ok:true,
        mimeType:'image/png',
        imageBase64:b64,
        seo:{alt:makeAlt(title,key),filename:`${slug}-capa.webp`,title,slug}
      });
    }

    if(action!=='publish')return json(res,400,{error:'Ação inválida.'});

    const variants=body.variants&&typeof body.variants==='object'?body.variants:{};
    const names=[`${slug}-capa.webp`,`${slug}-card.webp`,`${slug}-social.webp`];
    for(const name of names){
      const content=String(variants[name]||'').replace(/\s/g,'');
      if(!/^[A-Za-z0-9+/]*={0,2}$/.test(content))return json(res,400,{error:`Imagem ${name} inválida.`});
      const bytes=Buffer.from(content,'base64');
      if(!bytes.length||bytes.length>4_000_000)return json(res,400,{error:`Imagem ${name} passou de 4 MB.`});
    }

    const pathUrl=path=>`${API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g,'/')}?ref=${encodeURIComponent(branch)}`;
    async function getFile(path){
      const r=await fetch(pathUrl(path),{headers});
      if(r.status===404)return null;
      if(!r.ok)throw new Error(`GitHub GET ${path}: ${r.status}`);
      return r.json();
    }
    let manifestPath=null,manifestFile=null,manifest=null,index=-1,currentPost=null;
    for(const path of ['data/blog-posts.json','data/blog-posts-extra.json','data/blog-posts-2026-09-08.json','data/blog-posts-2026-09-09.json']){
      const f=await getFile(path);if(!f)continue;
      const arr=JSON.parse(decode(f));
      const i=arr.findIndex(p=>p?.slug===slug);
      if(i>=0){manifestPath=path;manifestFile=f;manifest=arr;index=i;currentPost=arr[i];break;}
    }
    if(!currentPost)return json(res,404,{error:'Artigo não encontrado.'});
    const articleFile=await getFile(currentPost.file);
    if(!articleFile)return json(res,404,{error:'Arquivo HTML do artigo não encontrado.'});

    const html=decode(articleFile);
    const title=clean(body.title||currentPost.title);
    const alt=clean(body.alt||title).slice(0,300);
    const meta=clean(currentPost.metaDescription||'');
    const masterPath=`/assets/images/blog/${slug}-capa.webp`;
    const masterAbs=abs(masterPath);

    const doc=new (class {
      constructor(h){this.html=h}
    })(html);

    // String-based updates keep the endpoint dependency-free.
    let nextHtml=html;
    const replaceOrAddMeta=(re,tag)=>{
      if(re.test(nextHtml)) nextHtml=nextHtml.replace(re,tag);
      else nextHtml=nextHtml.replace(/<\/head>/i,tag+'\n</head>');
    };
    replaceOrAddMeta(/<meta[^>]+property=["']og:image["'][^>]*>/i,`<meta property="og:image" content="${esc(masterAbs)}">`);
    replaceOrAddMeta(/<meta[^>]+property=["']og:image:alt["'][^>]*>/i,`<meta property="og:image:alt" content="${esc(alt)}">`);
    replaceOrAddMeta(/<meta[^>]+name=["']twitter:image["'][^>]*>/i,`<meta name="twitter:image" content="${esc(masterAbs)}">`);
    replaceOrAddMeta(/<meta[^>]+name=["']twitter:image:alt["'][^>]*>/i,`<meta name="twitter:image:alt" content="${esc(alt)}">`);

    nextHtml=nextHtml.replace(/(<img\b[^>]*)(\bsrc=["'])[^"']*(["'])/gi,(m,pre,q,s)=>{
      if(/\b(?:hero-art|article-hero|admin-cover)\b/i.test(pre)||/alt=["'][^"']*capa[^"']*["']/i.test(pre)){
        return `${pre}src=${q}${masterPath}${s}`;
      }
      return m;
    });
    nextHtml=nextHtml.replace(/(<img\b[^>]*)(\balt=["'])[^"']*(["'])/gi,(m,pre,q,s)=>{
      if(/\b(?:hero-art|article-hero|admin-cover)\b/i.test(pre)||/alt=["'][^"']*capa[^"']*["']/i.test(pre)){
        return `${pre}alt=${q}${esc(alt)}${s}`;
      }
      return m;
    });
    // Atualiza JSON-LD de Article/BlogPosting/NewsArticle sem dependência externa.
    nextHtml=nextHtml.replace(/(<script[^>]+type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,(m,open,jsonText,close)=>{
      try{
        const data=JSON.parse(jsonText);
        const visit=value=>{
          if(Array.isArray(value)){value.forEach(visit);return;}
          if(!value||typeof value!=='object')return;
          const types=Array.isArray(value['@type'])?value['@type']:[value['@type']];
          if(types.some(t=>['Article','BlogPosting','NewsArticle'].includes(t))){
            value.headline=title;value.description=meta;value.dateModified=new Date().toISOString().slice(0,10);value.image=[masterAbs];
          }
          Object.values(value).forEach(visit);
        };
        visit(data);
        return open+JSON.stringify(data,null,2)+close;
      }catch{return m;}
    });

    const nextPost={...currentPost,coverImage:masterPath,cover:masterPath,coverAlt:alt,updatedAt:new Date().toISOString().slice(0,10),title};
    manifest[index]=nextPost;

    const commitRes=await fetch(`${API}/repos/${owner}/${repo}/git/commits/${ref.object.sha}`,{headers});
    if(!commitRes.ok)throw new Error(`GitHub COMMIT: ${commitRes.status}`);
    const parentCommit=await commitRes.json();

    async function createBlob(content,encoding='utf-8'){
      const r=await fetch(`${API}/repos/${owner}/${repo}/git/blobs`,{
        method:'POST',headers:{...headers,'Content-Type':'application/json'},
        body:JSON.stringify({content,encoding})
      });
      if(!r.ok)throw new Error(`GitHub BLOB: ${r.status}`);
      return (await r.json()).sha;
    }

    const blobs=await Promise.all([
      createBlob(nextHtml),
      createBlob(JSON.stringify(manifest,null,2)+'\n'),
      ...names.map(name=>createBlob(String(variants[name]).replace(/\s/g,''),'base64'))
    ]);

    const tree=[
      {path:currentPost.file,mode:'100644',type:'blob',sha:blobs[0]},
      {path:manifestPath,mode:'100644',type:'blob',sha:blobs[1]},
      ...names.map((name,i)=>({path:`assets/images/blog/${name}`,mode:'100644',type:'blob',sha:blobs[i+2]}))
    ];

    const treeRes=await fetch(`${API}/repos/${owner}/${repo}/git/trees`,{
      method:'POST',headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({base_tree:parentCommit.tree.sha,tree})
    });
    if(!treeRes.ok)throw new Error(`GitHub TREE: ${treeRes.status}`);
    const newTree=await treeRes.json();

    const commit=await fetch(`${API}/repos/${owner}/${repo}/git/commits`,{
      method:'POST',headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({message:`blog: gerar pacote de imagens ${slug}`,tree:newTree.sha,parents:[ref.object.sha]})
    });
    if(!commit.ok)throw new Error(`GitHub NEW COMMIT: ${commit.status}`);
    const newCommit=await commit.json();

    const updateRef=await fetch(`${API}/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,{
      method:'PATCH',headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({sha:newCommit.sha,force:false})
    });
    if(!updateRef.ok)throw new Error(`GitHub UPDATE REF: ${updateRef.status}`);

    return json(res,200,{ok:true,commit:newCommit.sha,coverUrl:masterPath,coverAlt:alt,post:nextPost});
  }catch(err){
    console.error(err);
    return json(res,500,{error:'Não foi possível gerar/publicar o pacote de imagens.',detail:String(err.message||err)});
  }
}
