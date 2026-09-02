const crypto=require('crypto');

const BREVO_BASE='https://api.brevo.com/v3';
const PURCHASE_PREFIX='MPMV_PURCHASE|';
const TRACK_CONTACT_EMAIL='rastreamento@maispersuasaomaisvendas.com.br';
let trackingContactPromise;

function apiKey(){return process.env.BREVO_API_KEY||process.env.BREVO_KEY||process.env.SENDINBLUE_API_KEY||'';}
function hottok(){return String(process.env.HOTMART_HOTTOK||'').trim();}
function json(res,status,body){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(body);}
function clean(v,max=500){return String(v==null?'':v).trim().slice(0,max);}
function number(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function isoFromMillis(v){const n=Number(v);if(!Number.isFinite(n)||n<=0)return'';try{return new Date(n).toISOString()}catch(_){return''}}
function safeEqual(a,b){const aa=Buffer.from(String(a||'')),bb=Buffer.from(String(b||''));return aa.length===bb.length&&aa.length>0&&crypto.timingSafeEqual(aa,bb);}

async function brevo(path,options={}){
  const r=await fetch(BREVO_BASE+path,{...options,headers:{accept:'application/json','api-key':apiKey(),'content-type':'application/json',...(options.headers||{})}});
  const text=await r.text();let data={};
  try{data=text?JSON.parse(text):{};}catch(_){data={raw:text};}
  if(!r.ok){const e=new Error((data&&data.message)||`brevo_${r.status}`);e.status=r.status;e.data=data;throw e;}
  return data;
}

async function ensureTrackingContact(){
  if(trackingContactPromise)return trackingContactPromise;
  trackingContactPromise=(async()=>{
    try{const c=await brevo('/contacts/'+encodeURIComponent(TRACK_CONTACT_EMAIL));if(c&&Number(c.id)>0)return Number(c.id);}catch(e){if(e.status!==404)throw e;}
    try{const c=await brevo('/contacts',{method:'POST',body:JSON.stringify({email:TRACK_CONTACT_EMAIL,updateEnabled:true,getId:true})});if(c&&Number(c.id)>0)return Number(c.id);}catch(e){if(e.status!==400)throw e;}
    const c=await brevo('/contacts/'+encodeURIComponent(TRACK_CONTACT_EMAIL));
    if(!c||!Number(c.id))throw new Error('tracking_contact_missing');
    return Number(c.id);
  })();
  try{return await trackingContactPromise;}catch(e){trackingContactPromise=null;throw e;}
}

function normalize(body){
  const b=body&&typeof body==='object'?body:{};
  const d=b.data&&typeof b.data==='object'?b.data:{};
  const purchase=d.purchase&&typeof d.purchase==='object'?d.purchase:{};
  const buyer=d.buyer&&typeof d.buyer==='object'?d.buyer:(purchase.shopper&&typeof purchase.shopper==='object'?purchase.shopper:{});
  const product=d.product&&typeof d.product==='object'?d.product:{};
  const price=purchase.full_price&&typeof purchase.full_price==='object'?purchase.full_price:(purchase.price&&typeof purchase.price==='object'?purchase.price:{});
  const offer=purchase.offer&&typeof purchase.offer==='object'?purchase.offer:{};
  const tracking=d.tracking&&typeof d.tracking==='object'?d.tracking:{};
  const event=clean(b.event,80).toUpperCase();
  const eventAt=isoFromMillis(b.creation_date)||new Date().toISOString();
  const approvedAt=isoFromMillis(purchase.approved_date);
  return {
    eventId:clean(b.id,120),
    event,
    version:clean(b.version,30),
    eventAt,
    approvedAt,
    transaction:clean(purchase.transaction||purchase.id,120),
    status:clean(purchase.status,80).toUpperCase(),
    productId:clean(product.id||product.ucode,120),
    productName:clean(product.name,240),
    offerCode:clean(offer.code,120),
    offerName:clean(offer.name,180),
    value:number(price.value),
    currency:clean(price.currency_value||price.currency,12).toUpperCase(),
    buyerEmail:clean(buyer.email,180).toLowerCase(),
    buyerName:clean(buyer.name||[buyer.first_name,buyer.last_name].filter(Boolean).join(' '),180),
    sck:clean(purchase.sck||d.sck||tracking.sck||tracking.source_sck,80),
    source:clean(purchase.origin||purchase.source||d.source||tracking.source||tracking.src,160)
  };
}

function encodePurchase(data){return PURCHASE_PREFIX+Buffer.from(JSON.stringify(data),'utf8').toString('base64');}

module.exports=async function handler(req,res){
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST'){res.setHeader('Allow','POST, OPTIONS');return json(res,405,{ok:false,error:'method_not_allowed'});}
  if(!hottok())return json(res,503,{ok:false,error:'hotmart_hottok_not_configured'});
  if(!apiKey())return json(res,503,{ok:false,error:'brevo_not_configured'});

  const received=String(req.headers['x-hotmart-hottok']||'').trim();
  if(!safeEqual(received,hottok()))return json(res,401,{ok:false,error:'invalid_hottok'});

  try{
    const body=typeof req.body==='string'?JSON.parse(req.body):(req.body||{});
    const data=normalize(body);
    if(!data.event)return json(res,400,{ok:false,error:'missing_event'});
    if(!data.eventId&&!data.transaction)return json(res,400,{ok:false,error:'missing_event_identity'});

    const allowed=new Set(['PURCHASE_APPROVED','PURCHASE_COMPLETE','PURCHASE_CANCELED','PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_DELAYED','PURCHASE_EXPIRED']);
    if(!allowed.has(data.event))return json(res,200,{ok:true,ignored:true,event:data.event});

    const contactId=await ensureTrackingContact();
    const created=await brevo('/crm/notes',{method:'POST',body:JSON.stringify({text:encodePurchase(data),contactIds:[contactId]})});
    console.log('Hotmart webhook stored',{event:data.event,eventId:data.eventId,transaction:data.transaction,noteId:String(created&&created.id||'')});
    return json(res,200,{ok:true,event:data.event});
  }catch(e){
    console.error('Hotmart webhook error',e);
    return json(res,e.status&&e.status<600?e.status:500,{ok:false,error:e.message||'internal_error'});
  }
};
