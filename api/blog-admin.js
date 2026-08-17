const REPO_DEFAULT = 'irodrigosd/mpmv';
const BRANCH_DEFAULT = 'main';

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}

function envToken() {
  return process.env.BLOG_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '';
}
function adminToken() {
  return process.env.BLOG_ADMIN_TOKEN || process.env.LEADS_ADMIN_TOKEN || '';
}
function repoName() {
  return process.env.BLOG_GITHUB_REPO || REPO_DEFAULT;
}
function branchName() {
  return process.env.BLOG_GITHUB_BRANCH || BRANCH_DEFAULT;
}
function authorized(req) {
  const expected = adminToken();
  if (!expected) return false;
  const direct = String(req.headers['x-admin-token'] || '');
  const auth = String(req.headers.authorization || '');
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  return direct === expected || bearer === expected;
}
function slugOk(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(slug || ''));
}
function safeBaseName(name) {
  const n = String(name || '').split('/').pop();
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(n) ? n : '';
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function clampScore(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}
function normalizePost(m, scores) {
  const slug = String(m.slug || '').trim();
  if (!slugOk(slug)) throw new Error('slug_invalid');
  const title = String(m.title || '').trim().slice(0, 180);
  if (title.length < 5) throw new Error('title_invalid');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(m.date || '')) ? String(m.date) : new Date().toISOString().slice(0,10);
  return {
    title,
    slug,
    url: `/blog/${slug}/`,
    date,
    status: 'published',
    focusKeyword: String(m.focusKeyword || '').trim().slice(0, 140),
    seoScore: clampScore(scores && scores.seo),
    readabilityScore: clampScore(scores && scores.readability),
    readingTime: String(m.readingTime || '').trim().slice(0, 30) || '8 min',
    excerpt: String(m.excerpt || m.description || '').trim().slice(0, 280)
  };
}
function formatDatePt(date) {
  try { return new Intl.DateTimeFormat('pt-BR', {day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')); }
  catch { return date; }
}
function buildCards(posts) {
  return posts.map(p => `    <article class="post-card"><div class="meta">${esc(formatDatePt(p.date))} · cerca de ${esc(p.readingTime || '8 min')} de leitura</div><a href="${esc(p.url)}"><h2>${esc(p.title)}</h2></a><p>${esc(p.excerpt || '')}</p><a class="cta-link" href="${esc(p.url)}"><strong>Ler o artigo</strong></a></article>`).join('\n');
}
function updateBlogHtml(html, posts) {
  const start = '<!-- POSTS_START -->';
  const end = '<!-- POSTS_END -->';
  if (!html.includes(start) || !html.includes(end)) throw new Error('blog_markers_missing');
  const before = html.split(start)[0];
  const after = html.split(end).slice(1).join(end);
  return `${before}${start}\n${buildCards(posts)}\n${end}${after}`;
}
function updateSitemap(xml, post) {
  const absolute = `https://www.maispersuasaomaisvendas.com.br${post.url}`;
  const clean = String(xml || '').trim();
  if (clean.includes(`<loc>${absolute}</loc>`)) return clean + '\n';
  const entry = `  <url><loc>${absolute}</loc><lastmod>${post.date}</lastmod></url>`;
  if (clean.includes('</urlset>')) return clean.replace('</urlset>', `${entry}\n</urlset>`) + '\n';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entry}\n</urlset>\n`;
}
function decode64(s) { return Buffer.from(String(s || '').replace(/\n/g,''), 'base64').toString('utf8'); }

async function gh(path, options = {}) {
  const token = envToken();
  if (!token) throw Object.assign(new Error('github_token_missing'), {status:503});
  const r = await fetch(`https://api.github.com/repos/${repoName()}${path}`, {
    ...options,
    headers: {
      'Accept':'application/vnd.github+json',
      'Authorization':`Bearer ${token}`,
      'X-GitHub-Api-Version':'2022-11-28',
      'Content-Type':'application/json',
      ...(options.headers || {})
    }
  });
  const text = await r.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {raw:text}; }
  if (!r.ok) {
    const err = new Error(data.message || `github_${r.status}`);
    err.status = r.status;
    err.github = data;
    throw err;
  }
  return data;
}
async function getContent(path, ref) {
  try {
    const d = await gh(`/contents/${encodeURIComponent(path).replace(/%2F/g,'/')}?ref=${encodeURIComponent(ref || branchName())}`);
    return {text: decode64(d.content), sha:d.sha};
  } catch (e) {
    if (e.status === 404) return {text:'', sha:null};
    throw e;
  }
}
async function createBlob(content, encoding='utf-8') {
  const d = await gh('/git/blobs', {method:'POST', body:JSON.stringify({content, encoding})});
  return d.sha;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!authorized(req)) {
    if (!adminToken()) return json(res, 503, {ok:false,error:'admin_token_missing',message:'Configure BLOG_ADMIN_TOKEN ou LEADS_ADMIN_TOKEN na Vercel.'});
    return json(res, 401, {ok:false,error:'unauthorized'});
  }
  try {
    if (req.method === 'GET') {
      const registry = await getContent('posts.json');
      let data = {version:1,posts:[]};
      try { if (registry.text) data = JSON.parse(registry.text); } catch {}
      return json(res, 200, {ok:true, configured:!!envToken(), repo:repoName(), branch:branchName(), posts:Array.isArray(data.posts)?data.posts:[]});
    }
    if (req.method !== 'POST') return json(res, 405, {ok:false,error:'method_not_allowed'});
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

    if (body.action === 'health') {
      if (!envToken()) return json(res, 503, {ok:false,error:'github_token_missing',message:'Configure BLOG_GITHUB_TOKEN na Vercel.'});
      const repo = await gh('');
      return json(res, 200, {ok:true,repo:repo.full_name,branch:branchName()});
    }

    if (body.action === 'stage') {
      if (!envToken()) return json(res, 503, {ok:false,error:'github_token_missing',message:'Configure BLOG_GITHUB_TOKEN na Vercel.'});
      const slug = String(body.slug || '');
      if (!slugOk(slug)) return json(res, 400, {ok:false,error:'slug_invalid'});
      const kind = String(body.kind || '');
      let relativePath = '';
      if (kind === 'html') relativePath = 'index.html';
      if (kind === 'image') {
        const name = safeBaseName(body.name);
        if (!name || !/\.(png|jpe?g|webp|gif)$/i.test(name)) return json(res,400,{ok:false,error:'image_invalid'});
        relativePath = `assets/${name}`;
      }
      if (!relativePath) return json(res,400,{ok:false,error:'file_kind_invalid'});
      const content = String(body.contentBase64 || '');
      if (!content || content.length > 4_200_000) return json(res,413,{ok:false,error:'file_too_large',message:'Cada arquivo pode ter até cerca de 3 MB.'});
      const sha = await createBlob(content, 'base64');
      return json(res,200,{ok:true,blobSha:sha,relativePath});
    }

    if (body.action === 'publish') {
      if (!envToken()) return json(res,503,{ok:false,error:'github_token_missing',message:'Configure BLOG_GITHUB_TOKEN na Vercel.'});
      const post = normalizePost(body.manifest || {}, body.scores || {});
      const files = Array.isArray(body.files) ? body.files : [];
      if (!files.some(f => f.relativePath === 'index.html')) return json(res,400,{ok:false,error:'index_missing'});
      const cleanFiles = [];
      for (const f of files) {
        const rel = String(f.relativePath || '');
        const sha = String(f.blobSha || '');
        const allowed = rel === 'index.html' || /^assets\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(png|jpe?g|webp|gif)$/i.test(rel);
        if (!allowed || !/^[0-9a-f]{40}$/i.test(sha)) return json(res,400,{ok:false,error:'staged_file_invalid'});
        cleanFiles.push({path:`blog/${post.slug}/${rel}`,mode:'100644',type:'blob',sha});
      }

      const branch = branchName();
      const ref = await gh(`/git/ref/heads/${encodeURIComponent(branch)}`);
      const parentSha = ref.object.sha;
      const parentCommit = await gh(`/git/commits/${parentSha}`);
      const baseTree = parentCommit.tree.sha;

      const registry = await getContent('posts.json', branch);
      let registryData = {version:1,posts:[]};
      try { if (registry.text) registryData = JSON.parse(registry.text); } catch {}
      let posts = Array.isArray(registryData.posts) ? registryData.posts.filter(p => p && p.slug !== post.slug) : [];
      posts.unshift(post);
      posts.sort((a,b) => String(b.date||'').localeCompare(String(a.date||'')));
      const newRegistry = {version:1,updatedAt:new Date().toISOString(),posts};

      const currentBlog = await getContent('blog.html', branch);
      const nextBlog = updateBlogHtml(currentBlog.text, posts);
      const sitemap = await getContent('sitemap.xml', branch);
      const nextSitemap = updateSitemap(sitemap.text, post);

      const [registryBlob, blogBlob, sitemapBlob] = await Promise.all([
        createBlob(JSON.stringify(newRegistry,null,2)+'\n'),
        createBlob(nextBlog),
        createBlob(nextSitemap)
      ]);
      const treeItems = [
        ...cleanFiles,
        {path:'posts.json',mode:'100644',type:'blob',sha:registryBlob},
        {path:'blog.html',mode:'100644',type:'blob',sha:blogBlob},
        {path:'sitemap.xml',mode:'100644',type:'blob',sha:sitemapBlob}
      ];
      const tree = await gh('/git/trees', {method:'POST',body:JSON.stringify({base_tree:baseTree,tree:treeItems})});
      const commit = await gh('/git/commits', {method:'POST',body:JSON.stringify({message:`Publica artigo: ${post.title}`,tree:tree.sha,parents:[parentSha]})});
      await gh(`/git/refs/heads/${encodeURIComponent(branch)}`, {method:'PATCH',body:JSON.stringify({sha:commit.sha,force:false})});
      return json(res,200,{ok:true,commit:commit.sha,url:post.url,post});
    }

    return json(res,400,{ok:false,error:'action_invalid'});
  } catch (e) {
    console.error('blog-admin error', e);
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
    return json(res,status,{ok:false,error:e.message || 'internal_error',details:e.github || undefined});
  }
};
