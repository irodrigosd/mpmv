const REPO_DEFAULT = 'irodrigosd/mpmv';
const BRANCH_DEFAULT = 'main';
const MEASUREMENT_ID = 'G-CJHQRJY79Z';

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}
function githubToken() {
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
function decode64(s) {
  return Buffer.from(String(s || '').replace(/\n/g, ''), 'base64').toString('utf8');
}
function analyticsSource() {
  return `(function(){\n  'use strict';\n\n  var MEASUREMENT_ID = '${MEASUREMENT_ID}';\n  var CONSENT_KEY = 'mpmv-cookie-consent-v3';\n  var loaded = false;\n\n  window.dataLayer = window.dataLayer || [];\n  window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };\n\n  window.gtag('consent', 'default', {\n    ad_storage: 'denied',\n    ad_user_data: 'denied',\n    ad_personalization: 'denied',\n    analytics_storage: 'denied',\n    wait_for_update: 500\n  });\n\n  function getConsent(){\n    try { return localStorage.getItem(CONSENT_KEY) || ''; }\n    catch (e) { return ''; }\n  }\n  function saveConsent(value){\n    try { localStorage.setItem(CONSENT_KEY, value); }\n    catch (e) {}\n  }\n  function setDenied(){\n    window.gtag('consent', 'update', {\n      ad_storage: 'denied',\n      ad_user_data: 'denied',\n      ad_personalization: 'denied',\n      analytics_storage: 'denied'\n    });\n  }\n  function loadAnalytics(){\n    if (loaded) return;\n    loaded = true;\n    window.gtag('consent', 'update', {\n      ad_storage: 'denied',\n      ad_user_data: 'denied',\n      ad_personalization: 'denied',\n      analytics_storage: 'granted'\n    });\n    var script = document.createElement('script');\n    script.async = true;\n    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEASUREMENT_ID);\n    document.head.appendChild(script);\n    window.gtag('js', new Date());\n    window.gtag('config', MEASUREMENT_ID, { send_page_view: true });\n  }\n  function hideBanner(){\n    var banner = document.getElementById('mpmv-cookie-banner');\n    if (!banner) return;\n    if (banner.classList && banner.classList.contains('mpmv-cookie-banner')) banner.classList.add('mpmv-hidden');\n    banner.style.display = 'none';\n  }\n  function createBanner(){\n    if (document.getElementById('mpmv-cookie-banner')) return;\n    var banner = document.createElement('aside');\n    banner.id = 'mpmv-cookie-banner';\n    banner.setAttribute('role', 'dialog');\n    banner.setAttribute('aria-label', 'Preferências de cookies');\n    banner.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;max-width:980px;margin:auto;background:#111;color:#fff;border:1px solid #353535;border-radius:14px;padding:16px 18px;box-shadow:0 14px 44px rgba(0,0,0,.28);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap';\n    banner.innerHTML = '<div style="flex:1 1 480px"><strong style="display:block;margin-bottom:4px">Cookies e medição</strong><span style="color:#d0d0d0;font-size:.92rem;line-height:1.45">Usamos o Google Analytics para entender o uso do site. A medição só é ativada depois da sua autorização. <a href="/politica-de-privacidade/" style="color:#fff;text-decoration:underline">Política de Privacidade</a>.</span></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" data-mpmv-cookie="declined" style="border:1px solid #555;background:transparent;color:#fff;border-radius:9px;padding:10px 14px;font-weight:700;cursor:pointer">Agora não</button><button type="button" data-mpmv-cookie="accepted" style="border:0;background:#c99a2e;color:#15110a;border-radius:9px;padding:10px 14px;font-weight:900;cursor:pointer">Aceitar cookies</button></div>';\n    document.body.appendChild(banner);\n  }\n  function handleChoice(value){\n    if (value !== 'accepted' && value !== 'declined') return;\n    saveConsent(value);\n    if (value === 'accepted') loadAnalytics(); else setDenied();\n    hideBanner();\n  }\n  function init(){\n    var current = getConsent();\n    if (current === 'accepted') loadAnalytics();\n    else if (current === 'declined') setDenied();\n    else createBanner();\n    document.addEventListener('click', function(event){\n      var target = event.target && event.target.closest ? event.target.closest('[data-mpmv-cookie]') : null;\n      if (!target) return;\n      handleChoice(target.getAttribute('data-mpmv-cookie'));\n    }, true);\n  }\n  window.MPMVAnalytics = { measurementId: MEASUREMENT_ID, getConsent: getConsent, accept: function(){handleChoice('accepted');}, decline: function(){handleChoice('declined');} };\n  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();\n})();\n`;
}
function ensureAnalyticsScript(html) {
  const source = String(html || '');
  if (/src=["']\/analytics\.js["']/i.test(source)) return source;
  if (!/<\/head>/i.test(source)) return source;
  return source.replace(/<\/head>/i, '  <script src="/analytics.js" defer></script>\n</head>');
}
function patchBlogAdmin(source) {
  let out = String(source || '');
  if (!out.includes('function ensureAnalyticsScript(html)')) {
    const needle = "function decode64(s) { return Buffer.from(String(s || '').replace(/\\n/g,''), 'base64').toString('utf8'); }";
    if (!out.includes(needle)) throw new Error('blog_admin_decode_marker_missing');
    out = out.replace(needle, `${needle}\nfunction ensureAnalyticsScript(html) {\n  const source = String(html || '');\n  if (/src=[\\"']\\/analytics\\.js[\\"']/i.test(source)) return source;\n  if (!/<\\/head>/i.test(source)) return source;\n  return source.replace(/<\\/head>/i, '  <script src=\\"/analytics.js\\" defer></script>\\n</head>');\n}`);
  }
  if (!out.includes("if (kind === 'html') {\n        const html = decode64(content);")) {
    const oldBlock = "      const content = String(body.contentBase64 || '');\n      if (!content || content.length > 4_200_000) return json(res,413,{ok:false,error:'file_too_large',message:'Cada arquivo pode ter até cerca de 3 MB.'});\n      const sha = await createBlob(content, 'base64');";
    const newBlock = "      let content = String(body.contentBase64 || '');\n      if (!content || content.length > 4_200_000) return json(res,413,{ok:false,error:'file_too_large',message:'Cada arquivo pode ter até cerca de 3 MB.'});\n      if (kind === 'html') {\n        const html = decode64(content);\n        content = Buffer.from(ensureAnalyticsScript(html), 'utf8').toString('base64');\n      }\n      const sha = await createBlob(content, 'base64');";
    if (!out.includes(oldBlock)) throw new Error('blog_admin_stage_marker_missing');
    out = out.replace(oldBlock, newBlock);
  }
  return out;
}

async function gh(path, options = {}) {
  const token = githubToken();
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
  const d = await gh(`/contents/${encodeURIComponent(path).replace(/%2F/g,'/')}?ref=${encodeURIComponent(ref || branchName())}`);
  return {text: decode64(d.content), sha:d.sha};
}
async function createBlob(content) {
  const d = await gh('/git/blobs', {method:'POST', body:JSON.stringify({content, encoding:'utf-8'})});
  return d.sha;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!authorized(req)) {
    if (!adminToken()) return json(res,503,{ok:false,error:'admin_token_missing'});
    return json(res,401,{ok:false,error:'unauthorized',message:'Senha administrativa inválida.'});
  }
  if (!githubToken()) return json(res,503,{ok:false,error:'github_token_missing',message:'BLOG_GITHUB_TOKEN não configurado.'});

  if (req.method === 'GET') return json(res,200,{ok:true,measurementId:MEASUREMENT_ID,repo:repoName(),branch:branchName()});
  if (req.method !== 'POST') return json(res,405,{ok:false,error:'method_not_allowed'});

  try {
    const branch = branchName();
    const ref = await gh(`/git/ref/heads/${encodeURIComponent(branch)}`);
    const parentSha = ref.object.sha;
    const parentCommit = await gh(`/git/commits/${parentSha}`);
    const baseTree = parentCommit.tree.sha;

    const targets = [
      'index.html',
      'blog.html',
      'blog/como-criar-posts-que-vendem-com-chatgpt/index.html',
      'blog/como-usar-persuasao-para-vender-mais/index.html',
      'blog/persuasao-para-infoprodutores/index.html',
      'como-usar-persuasao-para-vender-mais.html',
      'persuasao-para-infoprodutores.html',
      'curso',
      'curso.html',
      'mentoria.html',
      'politica-de-privacidade.html'
    ];

    const treeItems = [];
    const changed = [];

    const analyticsBlob = await createBlob(analyticsSource());
    treeItems.push({path:'analytics.js',mode:'100644',type:'blob',sha:analyticsBlob});
    changed.push('analytics.js');

    for (const path of targets) {
      try {
        const current = await getContent(path, branch);
        const next = ensureAnalyticsScript(current.text);
        if (next !== current.text) {
          const sha = await createBlob(next);
          treeItems.push({path,mode:'100644',type:'blob',sha});
          changed.push(path);
        }
      } catch (e) {
        if (e.status !== 404) throw e;
      }
    }

    const blogAdmin = await getContent('api/blog-admin.js', branch);
    const nextBlogAdmin = patchBlogAdmin(blogAdmin.text);
    if (nextBlogAdmin !== blogAdmin.text) {
      const sha = await createBlob(nextBlogAdmin);
      treeItems.push({path:'api/blog-admin.js',mode:'100644',type:'blob',sha});
      changed.push('api/blog-admin.js');
    }

    // Remove o instalador após concluir para não deixar uma rota administrativa temporária no site.
    treeItems.push({path:'install-analytics.html',mode:'100644',type:'blob',sha:null});
    treeItems.push({path:'api/install-analytics.js',mode:'100644',type:'blob',sha:null});

    const tree = await gh('/git/trees', {method:'POST',body:JSON.stringify({base_tree:baseTree,tree:treeItems})});
    const commit = await gh('/git/commits', {method:'POST',body:JSON.stringify({
      message:`Instala Google Analytics ${MEASUREMENT_ID} com consentimento`,
      tree:tree.sha,
      parents:[parentSha]
    })});
    await gh(`/git/refs/heads/${encodeURIComponent(branch)}`, {method:'PATCH',body:JSON.stringify({sha:commit.sha,force:false})});

    return json(res,200,{ok:true,commit:commit.sha,measurementId:MEASUREMENT_ID,changed});
  } catch (e) {
    console.error('install-analytics error', e);
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
    return json(res,status,{ok:false,error:e.message || 'internal_error',details:e.github || undefined});
  }
};
