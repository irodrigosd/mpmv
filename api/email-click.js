const crypto = require('crypto');

const SITE_ORIGIN='https://www.maispersuasaomaisvendas.com.br';

function apiKey(){return process.env.BREVO_API_KEY||process.env.BREVO_KEY||process.env.SENDINBLUE_API_KEY||'';}
function clean(v,max=1000){return String(v==null?'':v).trim().slice(0,max);}
function validToken(token){
  const raw=clean(token,120);
  const m=raw.match(/^(\d+)\.([a-f0-9]{24})$/i);
  if(!m||!apiKey())return null;
  const id=m[1];
  const expected=crypto.createHmac('sha256',apiKey()).update('mpmv-email:'+id).digest('hex').slice(0,24);
  const a=Buffer.from(m[2].toLowerCase());
  const b=Buffer.from(expected.toLowerCase());
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
  return {id:Number(id),token:`${id}.${expected}`};
}
function safeDestination(raw){
  try{
    const u=new URL(clean(raw,1800),SITE_ORIGIN);
    const allowed=u.origin===SITE_ORIGIN||/(^|\.)pay\.hotmart\.com$/i.test(u.hostname);
    if(!allowed||!/^https?:$/.test(u.protocol))return null;
    return u;
  }catch(_){return null;}
}

module.exports=async function handler(req,res){
  if(req.method!=='GET')return res.status(405).send('Method not allowed');
  const verified=validToken(req.query&&req.query.t);
  const target=safeDestination(req.query&&req.query.to);
  if(!verified||!target)return res.status(400).send('Link inválido.');
  const campaign=clean(req.query&&req.query.c,100).replace(/[^a-zA-Z0-9_-]/g,'');
  if(target.origin===SITE_ORIGIN){
    if(!target.searchParams.has('utm_source'))target.searchParams.set('utm_source','email');
    if(!target.searchParams.has('utm_medium'))target.searchParams.set('utm_medium','email');
    if(!target.searchParams.has('utm_campaign'))target.searchParams.set('utm_campaign',campaign||'mpmv_email');
    if(!target.searchParams.has('utm_content'))target.searchParams.set('utm_content','cta_email');
    target.searchParams.set('mpmv_lead',verified.token);
  }else{
    if(!target.searchParams.has('utm_source'))target.searchParams.set('utm_source','email');
    if(!target.searchParams.has('utm_medium'))target.searchParams.set('utm_medium','email');
    if(!target.searchParams.has('utm_campaign'))target.searchParams.set('utm_campaign',campaign||'mpmv_email');
    if(!target.searchParams.has('utm_content'))target.searchParams.set('utm_content','cta_email');
  }
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Referrer-Policy','no-referrer');
  return res.redirect(302,target.toString());
};