const API='https://api.github.com';

const json=(res,status,data)=>{
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(data));
};

const cleanPath=p=>String(p||'').replace(/^\.\/+/, '').replace(/^\/+/, '');
const slugOk=s=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(s||''));
const decode64=s=>Buffer.from(String(s||'').replace(/\s/g,''),'base64').toString('utf8');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stripTags=s=>String(s||'')
  .replace(/<script[\s\S]*?<\/script>/gi,' ')
  .replace(/<style[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]+>/g,' ')
  .replace(/&nbsp;/gi,' ')
  .replace(/&amp;/gi,'&')
  .replace(/&quot;/gi,'"')
  .replace(/&#39;/gi,"'")
  .replace(/&lt;/gi,'<')
  .replace(/&gt;/gi,'>')
  .replace(/\s+/g,' ')
  .trim();

function safePath(p){
  if(typeof p!=='string') return false;
  if(!p || p.startsWith('/') || p.includes('..') || p.startsWith('.git/')) return false;
  return /^[A-Za-z0-9._\-\/ áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ()]+$/.test(p);
}

function getTagText(html,tag){
  const m=String(html||'').match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'));
  return m?stripTags(m[1]):'';
}

function getMeta(html,name,attr='name'){
  const tags=String(html||'').match(/<meta\b[^>]*>/gi)||[];
  for(const tag of tags){
    const key=tag.match(new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`,'i'));
    if(!key || key[1].toLowerCase()!==String(name).toLowerCase()) continue;
    const content=tag.match(/content\s*=\s*["']([^"']*)["']/i);
    if(content) return stripTags(content[1]);
  }
  return '';
}

function getCanonical(html){
  const links=String(html||'').match(/<link\b[^>]*>/gi)||[];
  for(const tag of links){
    const rel=tag.match(/rel\s*=\s*["']([^"']+)["']/i);
    if(!rel || !rel[1].toLowerCase().split(/\s+/).includes('canonical')) continue;
    const href=tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if(href) return href[1].trim();
  }
  return '';
}

function seoSection(text,label){
  const src=String(text||'').replace(/\r/g,'');
  const lines=src.split('\n');
  const wanted=label.toUpperCase();
  const known=[
    'TÍTULO SEO','TITULO SEO','SLUG','PALAVRA-CHAVE PRINCIPAL','PALAVRAS-CHAVE SECUNDÁRIAS',
    'META DESCRIPTION','META DESCRIÇÃO','META DESCRICAO','H1','CANONICAL','INTENÇÃO DE BUSCA','INTENCAO DE BUSCA',
    'FONTES PRINCIPAIS','CATEGORIA','DATA','AUTOR'
  ];
  let start=-1;
  for(let i=0;i<lines.length;i++){
    if(lines[i].trim().toUpperCase()===wanted){start=i+1;break;}
  }
  if(start<0) return '';
  const out=[];
  for(let i=start;i<lines.length;i++){
    const v=lines[i].trim();
    if(known.includes(v.toUpperCase())) break;
    if(!v && out.length) break;
    if(v) out.push(v);
  }
  return out.join('\n').trim();
}

function findSlug(files,indexFile,html,seoText){
  const canonical=getCanonical(html);
  const cm=canonical.match(/\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?(?:$|[?#])/i);
  if(cm && slugOk(cm[1].toLowerCase())) return cm[1].toLowerCase();

  const seoSlug=seoSection(seoText,'SLUG').split(/\s+/)[0].trim().toLowerCase();
  if(slugOk(seoSlug)) return seoSlug;

  const p=cleanPath(indexFile.path);
  const parts=p.split('/').filter(Boolean);
  if(parts.length>=2){
    const parent=parts[parts.length-2].toLowerCase();
    if(slugOk(parent) && parent!=='blog') return parent;
  }

  const ogUrl=getMeta(html,'og:url','property');
  const om=ogUrl.match(/\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?(?:$|[?#])/i);
  if(om && slugOk(om[1].toLowerCase())) return om[1].toLowerCase();

  return '';
}

function articleTargetPath(source,slug){
  const p=cleanPath(source);
  if(p.startsWith(`blog/${slug}/`)) return p;
  if(p.startsWith(`${slug}/`)) return `blog/${p}`;
  if(p==='blog/'+slug) return `blog/${slug}/index.html`;
  return `blog/${slug}/${p}`;
}

function parseArticleMeta(html,seoText,slug){
  const seoTitle=getTagText(html,'title') || seoSection(seoText,'TÍTULO SEO') || seoSection(seoText,'TITULO SEO');
  const h1=getTagText(html,'h1');
  const ogTitle=getMeta(html,'og:title','property');
  const title=h1 || ogTitle || seoTitle || slug.replace(/-/g,' ');
  const metaDescription=getMeta(html,'description') || seoSection(seoText,'META DESCRIPTION') || seoSection(seoText,'META DESCRIÇÃO') || seoSection(seoText,'META DESCRICAO');
  const focusKeyphrase=seoSection(seoText,'PALAVRA-CHAVE PRINCIPAL') || (()=>{
    const m=String(html||'').match(/Palavra-chave:\s*[“\"]([^”\"]+)[”\"]/i);
    return m?stripTags(m[1]):'';
  })() || slug.replace(/-/g,' ');
  const secondaryRaw=seoSection(seoText,'PALAVRAS-CHAVE SECUNDÁRIAS');
  const secondaryKeyphrases=secondaryRaw?secondaryRaw.split('\n').map(x=>x.trim()).filter(Boolean):[];
  const kickerMatch=String(html||'').match(/<[^>]+class=["'][^"']*\bkicker\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
  const kicker=kickerMatch?stripTags(kickerMatch[1]):'';
  const category=(seoSection(seoText,'CATEGORIA') || kicker || 'Conteúdo').replace(/\s*[•|·]\s*/g,' + ').replace(/\s*\+\s*/g,' + ').trim();
  const dateMatch=String(html||'').match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"/i)
    || String(html||'').match(/datetime=["'](\d{4}-\d{2}-\d{2})/i);
  const publishedAt=dateMatch?dateMatch[1]:new Date().toISOString().slice(0,10);
  const authorMatch=String(html||'').match(/"author"\s*:\s*\{[\s\S]{0,500}?"name"\s*:\s*"([^"]+)"/i);
  const author=seoSection(seoText,'AUTOR') || (authorMatch?stripTags(authorMatch[1]):'Rodrigo Castro');
  const excerpt=metaDescription || stripTags(String(html||'').match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1]||'').slice(0,280);
  return {title,seoTitle:seoTitle||title,metaDescription,focusKeyphrase,secondaryKeyphrases,category,publishedAt,author,excerpt};
}

function fmtDate(date){
  const months=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const m=String(date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return date;
  return `${Number(m[3])} ${months[Number(m[2])-1]} ${m[1]}`;
}

function buildCard(post){
  return `<!-- POST:${post.slug} START -->\n<a class="post" href="${esc(post.url)}"><div class="post-copy"><div class="date">${esc(fmtDate(post.publishedAt))}<br/>${esc(post.category||'Conteúdo')}</div><h3>${esc(post.title)}</h3><p>${esc(post.metaDescription||post.excerpt||'')}</p></div></a>\n<!-- POST:${post.slug} END -->`;
}

function upsertBlogCard(html,post){
  const re=new RegExp(`\\s*<!-- POST:${post.slug} START -->[\\s\\S]*?<!-- POST:${post.slug} END -->\\s*`,'g');
  let next=String(html||'').replace(re,'\n');
  const card=buildCard(post);
  if(/<div\s+class=["']bloglist["'][^>]*>/i.test(next)){
    return next.replace(/(<div\s+class=["']bloglist["'][^>]*>)/i,`$1\n${card}\n`);
  }
  throw new Error('Não encontrei a lista de artigos em blog.html.');
}

function upsertSitemap(xml,post){
  const absolute=`https://www.maispersuasaomaisvendas.com.br${post.url}`;
  let next=String(xml||'');
  next=next.replace(/<url>[\s\S]*?<\/url>/g,block=>block.includes(`<loc>${absolute}</loc>`)?'':block);
  const entry=`  <url>\n    <loc>${absolute}</loc>\n    <lastmod>${post.publishedAt}</lastmod>\n  </url>`;
  if(next.includes('</urlset>')) return next.replace('</urlset>',`${entry}\n</urlset>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entry}\n</urlset>\n`;
}

export default async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{error:'Método não permitido.'});

  const adminToken=process.env.ADMIN_BLOG_TOKEN;
  if(!adminToken) return json(res,500,{error:'ADMIN_BLOG_TOKEN não disponível neste deployment.'});
  if(req.headers['x-admin-token']!==adminToken) return json(res,401,{error:'Token do admin inválido.'});

  const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
  const files=Array.isArray(body.files)?body.files:[];
  if(!files.length) return json(res,400,{error:'Nenhum arquivo recebido.'});
  if(files.length>80) return json(res,400,{error:'ZIP com arquivos demais.'});

  const tokenCandidates=[process.env.BLOG_GITHUB_TOKEN,process.env.GITHUB_TOKEN]
    .filter(Boolean).map(t=>t.trim()).filter((t,i,a)=>a.indexOf(t)===i);
  const owner=(process.env.GITHUB_OWNER || 'irodrigosd').trim();
  const repo=(process.env.GITHUB_REPO || 'mpmv').trim();
  const branch=(process.env.GITHUB_BRANCH || 'main').trim();

  if(!tokenCandidates.length){
    return json(res,500,{error:'Token GitHub indisponível neste deployment.'});
  }

  const makeHeaders=token=>({
    'Accept':'application/vnd.github+json',
    'Authorization':`Bearer ${token}`,
    'X-GitHub-Api-Version':'2022-11-28',
    'User-Agent':'MPMV-Blog-Admin',
    'Content-Type':'application/json'
  });

  try{
    for(const f of files){
      if(!safePath(f.path)) return json(res,400,{error:`Caminho inválido no ZIP: ${String(f.path)}`});
      if(typeof f.content!=='string' || f.content.length>5_000_000) return json(res,400,{error:`Arquivo inválido ou grande demais: ${f.path}`});
    }

    let headers=null;
    let refRes=null;
    let refErr='';
    for(const candidate of tokenCandidates){
      const h=makeHeaders(candidate);
      const r=await fetch(`${API}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,{headers:h});
      if(r.ok){headers=h;refRes=r;break;}
      const t=await r.text().catch(()=> '');
      refErr=`GitHub REF: ${r.status} ${t.slice(0,220)}`;
      if(r.status!==401 && r.status!==403) break;
    }
    if(!refRes) throw new Error(refErr||'Falha ao autenticar no GitHub.');

    const ref=await refRes.json();
    const parentSha=ref.object.sha;
    const commitRes=await fetch(`${API}/repos/${owner}/${repo}/git/commits/${parentSha}`,{headers});
    if(!commitRes.ok){const t=await commitRes.text().catch(()=> '');throw new Error(`GitHub COMMIT: ${commitRes.status} ${t.slice(0,220)}`);}
    const parentCommit=await commitRes.json();
    const baseTree=parentCommit.tree.sha;

    async function ghJson(url,opts={}){
      const r=await fetch(url,{...opts,headers:{...headers,...(opts.headers||{})}});
      const text=await r.text();
      let data={};
      try{data=text?JSON.parse(text):{};}catch{data={raw:text};}
      if(!r.ok){const e=new Error(`GitHub ${r.status}: ${text.slice(0,240)}`);e.status=r.status;throw e;}
      return data;
    }
    async function getRepoText(path){
      const url=`${API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g,'/')}?ref=${encodeURIComponent(branch)}`;
      const r=await fetch(url,{headers});
      if(r.status===404) return {text:'',sha:null};
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(`GitHub GET ${path}: ${r.status}`);
      return {text:Buffer.from(String(data.content||'').replace(/\n/g,''),'base64').toString('utf8'),sha:data.sha||null};
    }
    async function createBlob(content,encoding='utf-8'){
      const data=await ghJson(`${API}/repos/${owner}/${repo}/git/blobs`,{
        method:'POST',
        body:JSON.stringify({content,encoding})
      });
      return data.sha;
    }

    const indexFiles=files.filter(f=>/(^|\/)index\.html$/i.test(cleanPath(f.path)));
    const articleMode=indexFiles.length===1;
    const tree=[];
    let articleResult=null;

    if(articleMode){
      const indexFile=indexFiles[0];
      const html=decode64(indexFile.content);
      const seoFile=files.find(f=>/(^|\/)seo\.txt$/i.test(cleanPath(f.path)));
      const seoText=seoFile?decode64(seoFile.content):'';
      const slug=findSlug(files,indexFile,html,seoText);
      if(!slug) return json(res,400,{error:'Não consegui identificar o slug do artigo. Inclua canonical /blog/slug/ ou um seo.txt com SLUG.'});

      const meta=parseArticleMeta(html,seoText,slug);
      const post={
        id:`${slug}-${meta.publishedAt}`,
        title:meta.title,
        seoTitle:meta.seoTitle,
        metaDescription:meta.metaDescription,
        focusKeyphrase:meta.focusKeyphrase,
        secondaryKeyphrases:meta.secondaryKeyphrases,
        slug,
        url:`/blog/${slug}/`,
        file:`blog/${slug}/index.html`,
        status:'published',
        category:meta.category,
        publishedAt:meta.publishedAt,
        author:meta.author,
        deletable:true,
        batchOrder:1
      };

      const used=new Set();
      for(const f of files){
        const target=articleTargetPath(f.path,slug);
        if(used.has(target)) continue;
        used.add(target);
        const blob=await createBlob(f.content,'base64');
        tree.push({path:target,mode:'100644',type:'blob',sha:blob});
      }

      const [manifestFile,blogFile,sitemapFile]=await Promise.all([
        getRepoText('data/blog-posts.json'),
        getRepoText('blog.html'),
        getRepoText('sitemap.xml')
      ]);

      let manifest=[];
      try{manifest=manifestFile.text?JSON.parse(manifestFile.text):[];}catch{manifest=[];}
      if(!Array.isArray(manifest)) manifest=[];
      manifest=manifest.filter(p=>p && p.slug!==slug);
      manifest.unshift(post);

      const nextBlog=upsertBlogCard(blogFile.text,post);
      const nextSitemap=upsertSitemap(sitemapFile.text,post);
      const [manifestBlob,blogBlob,sitemapBlob]=await Promise.all([
        createBlob(JSON.stringify(manifest,null,2)+'\n'),
        createBlob(nextBlog),
        createBlob(nextSitemap)
      ]);
      tree.push(
        {path:'data/blog-posts.json',mode:'100644',type:'blob',sha:manifestBlob},
        {path:'blog.html',mode:'100644',type:'blob',sha:blogBlob},
        {path:'sitemap.xml',mode:'100644',type:'blob',sha:sitemapBlob}
      );

      // Limpa a publicação antiga que o uploader anterior podia ter deixado na raiz.
      try{
        const fullTree=await ghJson(`${API}/repos/${owner}/${repo}/git/trees/${baseTree}?recursive=1`);
        for(const item of fullTree.tree||[]){
          if(item.type==='blob' && item.path.startsWith(`${slug}/`)){
            tree.push({path:item.path,mode:'100644',type:'blob',sha:null});
          }
        }
      }catch(e){
        console.warn('Não foi possível limpar a pasta antiga da raiz:',e.message);
      }

      articleResult={slug,url:post.url,registered:true,indexedInBlog:true,sitemap:true};
    }else{
      // Modo manutenção: mantém o comportamento antigo para ZIPs de correção do site.
      for(const f of files){
        const blob=await createBlob(f.content,'base64');
        tree.push({path:cleanPath(f.path),mode:'100644',type:'blob',sha:blob});
      }
    }

    const treeRes=await fetch(`${API}/repos/${owner}/${repo}/git/trees`,{
      method:'POST',headers,
      body:JSON.stringify({base_tree:baseTree,tree})
    });
    if(!treeRes.ok){const t=await treeRes.text().catch(()=> '');throw new Error(`GitHub TREE: ${treeRes.status} ${t.slice(0,220)}`);}
    const newTree=await treeRes.json();

    const msg=articleResult
      ? `blog: publicar ${articleResult.slug} + índice + admin + sitemap`
      : `site: publicar ZIP ${String(body.zipName||'correcao').slice(0,120)}`;
    const newCommitRes=await fetch(`${API}/repos/${owner}/${repo}/git/commits`,{
      method:'POST',headers,
      body:JSON.stringify({message:msg,tree:newTree.sha,parents:[parentSha]})
    });
    if(!newCommitRes.ok){const t=await newCommitRes.text().catch(()=> '');throw new Error(`GitHub NEW COMMIT: ${newCommitRes.status} ${t.slice(0,220)}`);}
    const newCommit=await newCommitRes.json();

    const updateRefRes=await fetch(`${API}/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,{
      method:'PATCH',headers,
      body:JSON.stringify({sha:newCommit.sha,force:false})
    });
    if(!updateRefRes.ok){const t=await updateRefRes.text().catch(()=> '');throw new Error(`GitHub UPDATE REF: ${updateRefRes.status} ${t.slice(0,220)}`);}

    return json(res,200,{
      ok:true,
      commit:newCommit.sha,
      files:files.length,
      repository:`${owner}/${repo}`,
      branch,
      article:articleResult
    });
  }catch(err){
    console.error(err);
    return json(res,500,{error:'Não foi possível publicar o ZIP.',detail:String(err.message||err)});
  }
}
