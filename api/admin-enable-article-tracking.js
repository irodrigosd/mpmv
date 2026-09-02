const API='https://api.github.com';
const TRACK_TAG='<script defer src="/assets/js/article-tracking.js"></script>';
function json(res,status,body){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(body)}
function authorized(req){const expected=process.env.LEADS_ADMIN_TOKEN||process.env.BLOG_ADMIN_TOKEN||process.env.ADMIN_BLOG_TOKEN||'';if(!expected)return false;const direct=String(req.headers['x-admin-token']||'');const auth=String(req.headers.authorization||'');const bearer=auth.toLowerCase().startsWith('bearer ')?auth.slice(7).trim():'';return direct===expected||bearer===expected}
function ghToken(){return process.env.BLOG_GITHUB_TOKEN||process.env.GITHUB_TOKEN||''}
function headers(){return {'Accept':'application/vnd.github+json','Authorization':'Bearer '+ghToken(),'X-GitHub-Api-Version':'2022-11-28','User-Agent':'MPMV-Article-Tracking','Content-Type':'application/json'}}
async function gh(url,opts={}){const r=await fetch(url,{...opts,headers:{...headers(),...(opts.headers||{})}});const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch(_){data={raw:text}}if(!r.ok){const e=new Error((data&&data.message)||('github_'+r.status));e.status=r.status;throw e}return data}
function isArticleHtml(path,html){if(!/\.html$/i.test(path))return false;if(/^admin\//i.test(path)||/^api\//i.test(path))return false;if(/<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']+\/blog\/[^"']+/i.test(html))return true;return /^blog\/[^/]+\/index\.html$/i.test(path)}
function inject(html){if(html.includes('/assets/js/article-tracking.js'))return html;if(/<\/body>/i.test(html))return html.replace(/<\/body>/i,TRACK_TAG+'\n</body>');return html+'\n'+TRACK_TAG+'\n'}
module.exports=async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{ok:false,error:'method_not_allowed'})}
 if(!authorized(req))return json(res,401,{ok:false,error:'unauthorized'});
 if(!ghToken())return json(res,503,{ok:false,error:'github_not_configured'});
 const owner=(process.env.GITHUB_OWNER||'irodrigosd').trim(),repo=(process.env.GITHUB_REPO||'mpmv').trim(),branch=(process.env.GITHUB_BRANCH||'main').trim();
 try{
  const ref=await gh(`${API}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`),parentSha=ref.object.sha;
  const commit=await gh(`${API}/repos/${owner}/${repo}/git/commits/${parentSha}`),baseTree=commit.tree.sha;
  const treeData=await gh(`${API}/repos/${owner}/${repo}/git/trees/${baseTree}?recursive=1`),files=(treeData.tree||[]).filter(x=>x.type==='blob'&&/\.html$/i.test(x.path));
  const changes=[];let scanned=0,articles=0,already=0;
  for(const f of files){
    if(scanned>=250)break;scanned++;
    const blob=await gh(`${API}/repos/${owner}/${repo}/git/blobs/${f.sha}`),html=Buffer.from(blob.content||'','base64').toString('utf8');
    if(!isArticleHtml(f.path,html))continue;articles++;
    const next=inject(html);if(next===html){already++;continue}
    const b=await gh(`${API}/repos/${owner}/${repo}/git/blobs`,{method:'POST',body:JSON.stringify({content:next,encoding:'utf-8'})});
    changes.push({path:f.path,mode:'100644',type:'blob',sha:b.sha});
  }
  if(!changes.length)return json(res,200,{ok:true,changed:0,articles,already,message:'Todos os artigos encontrados já possuem rastreamento.'});
  const newTree=await gh(`${API}/repos/${owner}/${repo}/git/trees`,{method:'POST',body:JSON.stringify({base_tree:baseTree,tree:changes})});
  const newCommit=await gh(`${API}/repos/${owner}/${repo}/git/commits`,{method:'POST',body:JSON.stringify({message:'Enable tracking across blog articles',tree:newTree.sha,parents:[parentSha]})});
  await gh(`${API}/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,{method:'PATCH',body:JSON.stringify({sha:newCommit.sha,force:false})});
  return json(res,200,{ok:true,changed:changes.length,articles,already,commit:newCommit.sha});
 }catch(e){console.error('Article tracking installer error',e);return json(res,e.status&&e.status<600?e.status:500,{ok:false,error:e.message||'internal_error'})}
};