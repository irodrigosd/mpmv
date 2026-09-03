const DIAG='v9C2nL7xQ4mR1pS8';
const BASE='https://www.maispersuasaomaisvendas.com.br';
function json(res,status,body){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(body)}
function attrEsc(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}
function jsonStr(s){return JSON.stringify(String(s)).slice(1,-1)}
function optimizeHtml(html,seoTitle,metaDescription,socialTitle){
  let x=String(html||'');
  x=x.replace(/<title>[\s\S]*?<\/title>/i,`<title>${seoTitle}</title>`);
  x=x.replace(/<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?\s*>/i,`<meta name="description" content="${attrEsc(metaDescription)}">`);
  if(/<meta\s+name=["']mpmv:seo-title["']/i.test(x)) x=x.replace(/<meta\s+name=["']mpmv:seo-title["']\s+content=["'][^"']*["']\s*\/?\s*>/i,`<meta name="mpmv:seo-title" content="${attrEsc(seoTitle)}">`);
  if(/<meta\s+name=["']mpmv:meta-description["']/i.test(x)) x=x.replace(/<meta\s+name=["']mpmv:meta-description["']\s+content=["'][^"']*["']\s*\/?\s*>/i,`<meta name="mpmv:meta-description" content="${attrEsc(metaDescription)}">`);
  x=x.replace(/<meta\s+property=["']og:title["']\s+content=["'][^"']*["']\s*\/?\s*>/i,`<meta property="og:title" content="${attrEsc(socialTitle)}">`);
  x=x.replace(/<meta\s+property=["']og:description["']\s+content=["'][^"']*["']\s*\/?\s*>/i,`<meta property="og:description" content="${attrEsc(metaDescription)}">`);
  x=x.replace(/<meta\s+name=["']twitter:title["']\s+content=["'][^"']*["']\s*\/?\s*>/i,`<meta name="twitter:title" content="${attrEsc(socialTitle)}">`);
  x=x.replace(/<meta\s+name=["']twitter:description["']\s+content=["'][^"']*["']\s*\/?\s*>/i,`<meta name="twitter:description" content="${attrEsc(metaDescription)}">`);
  x=x.replace(/"headline":"[^"]*"/,`"headline":"${jsonStr(socialTitle)}"`);
  x=x.replace(/"description":"[^"]*"/,`"description":"${jsonStr(metaDescription)}"`);
  x=x.replace(/"dateModified":"[^"]*"/,`"dateModified":"2026-09-03"`);
  return x;
}
async function call(path,options={}){
  const r=await fetch(BASE+path,{...options,cache:'no-store'});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(`${path}: ${r.status} ${(d&&d.error)||''} ${(d&&d.detail)||''}`);
  return d;
}
export default async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{ok:false,error:'method_not_allowed'});
  if(String(req.query&&req.query.diag||'')!==DIAG)return json(res,403,{ok:false,error:'forbidden'});
  const admin=String(process.env.ADMIN_BLOG_TOKEN||'');
  if(!admin)return json(res,503,{ok:false,error:'admin_blog_token_missing'});
  const headers={'x-admin-token':admin,'content-type':'application/json'};
  const jobs=[
    {slug:'tijolo-da-supreme',seoTitle:'Tijolo da Supreme: Quanto Custava e Por Que Esgotou | MPMV',metaDescription:'Descubra quanto custava o tijolo da Supreme, por que o item de US$ 30 esgotou e como marca, escassez e pertencimento aumentaram seu valor percebido.',socialTitle:'Tijolo da Supreme: quanto custava e por que esgotou'},
    {slug:'efeito-contraste-marketing',seoTitle:'Efeito Contraste: O Que É, Como Funciona e Exemplos | MPMV',metaDescription:'Entenda o que é o efeito contraste, como ele muda a percepção de preço e valor e veja exemplos de uso em produtos, planos e ofertas.',socialTitle:'Efeito contraste: o que é, como funciona e exemplos'}
  ];
  const results=[];
  try{
    for(const j of jobs){
      const cur=await call('/api/admin-blog-edit?slug='+encodeURIComponent(j.slug),{headers:{'x-admin-token':admin}});
      const p=cur.post||{};
      const html=optimizeHtml(cur.html,j.seoTitle,j.metaDescription,j.socialTitle);
      const saved=await call('/api/admin-blog-edit',{method:'POST',headers,body:JSON.stringify({slug:j.slug,html,title:p.title,seoTitle:j.seoTitle,metaDescription:j.metaDescription,focusKeyphrase:p.focusKeyphrase,category:p.category,coverImage:p.coverImage||'',coverAlt:p.coverAlt||''})});
      results.push({slug:j.slug,commit:saved.commit,seoTitle:j.seoTitle,metaDescription:j.metaDescription});
    }
    return json(res,200,{ok:true,results});
  }catch(e){return json(res,500,{ok:false,error:e.message,results});}
}
