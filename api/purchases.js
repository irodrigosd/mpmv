const BREVO_BASE='https://api.brevo.com/v3';
const PURCHASE_PREFIX='MPMV_PURCHASE|';
const TRACK_CONTACT_EMAIL='rastreamento@maispersuasaomaisvendas.com.br';
let trackingContactPromise;

function apiKey(){return process.env.BREVO_API_KEY||process.env.BREVO_KEY||process.env.SENDINBLUE_API_KEY||'';}
function json(res,status,body){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(body);}
function authorized(req){const expected=process.env.LEADS_ADMIN_TOKEN||process.env.BLOG_ADMIN_TOKEN||'';if(!expected)return false;const direct=String(req.headers['x-admin-token']||'');const auth=String(req.headers.authorization||'');const bearer=auth.toLowerCase().startsWith('bearer ')?auth.slice(7).trim():'';return direct===expected||bearer===expected;}
function clean(v,max=500){return String(v==null?'':v).trim().slice(0,max);}

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
    const c=await brevo('/contacts/'+encodeURIComponent(TRACK_CONTACT_EMAIL));
    if(!c||!Number(c.id))throw new Error('tracking_contact_missing');
    return Number(c.id);
  })();
  try{return await trackingContactPromise;}catch(e){trackingContactPromise=null;throw e;}
}

function parsePurchase(note){
  const text=String(note&&note.text||'').replace(/<[^>]+>/g,'').trim();
  if(!text.startsWith(PURCHASE_PREFIX))return null;
  try{
    const x=JSON.parse(Buffer.from(text.slice(PURCHASE_PREFIX.length),'base64').toString('utf8'));
    return {
      noteId:String(note.id||''),
      eventId:clean(x.eventId,120),event:clean(x.event,80).toUpperCase(),version:clean(x.version,30),
      eventAt:clean(x.eventAt||note.createdAt,40),approvedAt:clean(x.approvedAt,40),
      transaction:clean(x.transaction,120),status:clean(x.status,80).toUpperCase(),
      productId:clean(x.productId,120),productName:clean(x.productName,240),
      offerCode:clean(x.offerCode,120),offerName:clean(x.offerName,180),
      value:Number.isFinite(Number(x.value))?Number(x.value):null,currency:clean(x.currency,12),
      buyerEmail:clean(x.buyerEmail,180).toLowerCase(),buyerName:clean(x.buyerName,180),
      sck:clean(x.sck,80),source:clean(x.source,160)
    };
  }catch(_){return null;}
}

function ts(v){const n=Date.parse(v||'');return Number.isFinite(n)?n:0;}
function paidEvent(e){return e==='PURCHASE_APPROVED'||e==='PURCHASE_COMPLETE';}
function negativeEvent(e){return ['PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_CANCELED','PURCHASE_EXPIRED'].includes(e);}

module.exports=async function handler(req,res){
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET'){res.setHeader('Allow','GET, OPTIONS');return json(res,405,{ok:false,error:'method_not_allowed'});}
  if(!authorized(req))return json(res,401,{ok:false,error:'unauthorized'});
  if(!apiKey())return json(res,503,{ok:false,error:'brevo_not_configured'});
  try{
    const days=Math.max(1,Math.min(365,Number(req.query&&req.query.days)||30));
    const cutoff=Date.now()-days*86400000;
    const contactId=await ensureTrackingContact();
    const limit=Math.max(100,Math.min(1000,Number(req.query&&req.query.limit)||500));
    let offset=0,all=[];
    while(all.length<limit){
      const size=Math.min(100,limit-all.length);
      const q=new URLSearchParams({entity:'contacts',entityIds:String(contactId),offset:String(offset),limit:String(size),sort:'desc'});
      const chunk=await brevo('/crm/notes?'+q.toString());
      const arr=Array.isArray(chunk)?chunk:(Array.isArray(chunk.notes)?chunk.notes:(Array.isArray(chunk.items)?chunk.items:[]));
      all=all.concat(arr);
      if(arr.length<size)break;
      offset+=arr.length;
    }

    const parsed=all.map(parsePurchase).filter(Boolean);
    const dedup=new Map();
    for(const e of parsed){
      const key=e.eventId||[e.transaction,e.event,e.eventAt].join('|');
      if(!dedup.has(key)||ts(e.eventAt)>ts(dedup.get(key).eventAt))dedup.set(key,e);
    }
    const events=Array.from(dedup.values()).filter(e=>!ts(e.eventAt)||ts(e.eventAt)>=cutoff).sort((a,b)=>ts(b.eventAt)-ts(a.eventAt));

    const byTx=new Map();
    for(const e of events){
      const key=e.transaction||('event:'+e.eventId);
      const current=byTx.get(key);
      if(!current||ts(e.eventAt)>ts(current.eventAt))byTx.set(key,e);
    }
    const transactions=Array.from(byTx.values()).sort((a,b)=>ts(b.eventAt)-ts(a.eventAt));
    const paid=transactions.filter(x=>paidEvent(x.event));
    const refunded=transactions.filter(x=>x.event==='PURCHASE_REFUNDED');
    const chargebacks=transactions.filter(x=>x.event==='PURCHASE_CHARGEBACK');
    const canceled=transactions.filter(x=>negativeEvent(x.event)&&x.event!=='PURCHASE_REFUNDED'&&x.event!=='PURCHASE_CHARGEBACK');
    const grossApproved=new Set(events.filter(x=>paidEvent(x.event)).map(x=>x.transaction||x.eventId)).size;
    const revenue=paid.reduce((s,x)=>s+(Number.isFinite(x.value)?x.value:0),0);
    const currency=paid.length&&paid.every(x=>x.currency===paid[0].currency)?paid[0].currency:'';

    return json(res,200,{
      ok:true,
      configured:!!String(process.env.HOTMART_HOTTOK||'').trim(),
      days,
      summary:{purchases:paid.length,grossApproved,refunded:refunded.length,chargebacks:chargebacks.length,canceled:canceled.length,revenue,currency},
      purchases:paid.slice(0,100),
      transactions:transactions.slice(0,150),
      events:events.slice(0,250),
      diagnostic:{rawNotes:all.length,purchaseNotes:parsed.length,dedupedEvents:dedup.size}
    });
  }catch(e){
    if(e.status===404)return json(res,200,{ok:true,configured:!!String(process.env.HOTMART_HOTTOK||'').trim(),days:Number(req.query&&req.query.days)||30,summary:{purchases:0,grossApproved:0,refunded:0,chargebacks:0,canceled:0,revenue:0,currency:''},purchases:[],transactions:[],events:[],diagnostic:{rawNotes:0,purchaseNotes:0,dedupedEvents:0}});
    console.error('Purchases GET error',e);
    return json(res,e.status&&e.status<600?e.status:500,{ok:false,error:e.message||'internal_error'});
  }
};
