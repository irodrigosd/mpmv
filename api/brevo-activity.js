const BREVO_BASE='https://api.brevo.com/v3';
function key(){return process.env.BREVO_API_KEY||process.env.BREVO_KEY||process.env.SENDINBLUE_API_KEY||'';}
function json(res,status,body){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(body);}
function authorized(req){const expected=process.env.LEADS_ADMIN_TOKEN||process.env.BLOG_ADMIN_TOKEN||'';if(!expected)return false;const direct=String(req.headers['x-admin-token']||'');const auth=String(req.headers.authorization||'');const bearer=auth.toLowerCase().startsWith('bearer ')?auth.slice(7).trim():'';return direct===expected||bearer===expected;}
async function brevo(path){const r=await fetch(BREVO_BASE+path,{headers:{accept:'application/json','api-key':key()}});const text=await r.text();let data={};try{data=text?JSON.parse(text):{};}catch(_){data={raw:text};}if(!r.ok){const e=new Error((data&&data.message)||`brevo_${r.status}`);e.status=r.status;e.data=data;throw e;}return data;}
function eventDate(e){return e&&String(e.date||e.eventTime||e.createdAt||'');}
function eventType(e){return String(e&&e.event||'').toLowerCase();}
export default async function handler(req,res){
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='GET'){res.setHeader('Allow','GET, OPTIONS');return json(res,405,{ok:false,error:'method_not_allowed'});}
 if(!authorized(req))return json(res,401,{ok:false,error:'unauthorized'});
 if(!key())return json(res,503,{ok:false,error:'brevo_not_configured'});
 const email=String(req.query&&req.query.email||'').trim().toLowerCase().slice(0,180);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json(res,400,{ok:false,error:'invalid_email'});
 try{
   const [campaignResult,eventResult]=await Promise.allSettled([
     brevo('/contacts/'+encodeURIComponent(email)+'/campaignStats'),
     brevo('/smtp/statistics/events?email='+encodeURIComponent(email)+'&days=90&limit=500&sort=desc')
   ]);
   const campaign=campaignResult.status==='fulfilled'?campaignResult.value:{};
   const events=eventResult.status==='fulfilled'&&Array.isArray(eventResult.value&&eventResult.value.events)?eventResult.value.events:[];
   const campaignOpens=Array.isArray(campaign.opened)?campaign.opened:[];
   const campaignClicks=Array.isArray(campaign.clicked)?campaign.clicked:[];
   const sentCampaigns=Array.isArray(campaign.messagesSent)?campaign.messagesSent:[];
   const txOpened=events.filter(e=>['opened','unique_opened','first_opening','proxy_open','unique_proxy_open'].includes(eventType(e)));
   const txClicked=events.filter(e=>eventType(e)==='click'||eventType(e)==='clicked');
   const txDelivered=events.filter(e=>eventType(e)==='delivered');
   const txSent=events.filter(e=>eventType(e)==='sent');
   const opened=campaignOpens.length>0||txOpened.length>0;
   const clicked=campaignClicks.length>0||txClicked.length>0;
   const sent=sentCampaigns.length>0||txSent.length>0||txDelivered.length>0||opened||clicked;
   const activity=[];
   for(const e of events){activity.push({type:eventType(e)||'evento',date:eventDate(e),subject:String(e.subject||''),messageId:String(e.messageId||''),source:'transactional'});}
   for(const o of campaignOpens){activity.push({type:'opened',date:String(o.eventTime||o.date||''),campaignId:o.campaignId||null,source:'campaign'});}
   for(const c of campaignClicks){const links=Array.isArray(c.links)?c.links:[];if(links.length){for(const l of links)activity.push({type:'clicked',date:String(l.eventTime||''),campaignId:c.campaignId||null,url:String(l.url||''),count:Number(l.count||1),source:'campaign'});}else activity.push({type:'clicked',date:String(c.eventTime||''),campaignId:c.campaignId||null,source:'campaign'});}
   activity.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
   return json(res,200,{ok:true,email,summary:{sent,opened,clicked,opens:campaignOpens.length+txOpened.length,clicks:campaignClicks.length+txClicked.length,delivered:txDelivered.length},activity:activity.slice(0,100),campaignStatsAvailable:campaignResult.status==='fulfilled',transactionalStatsAvailable:eventResult.status==='fulfilled'});
 }catch(e){console.error('Brevo activity error',e);return json(res,e.status&&e.status<600?e.status:500,{ok:false,error:e.message||'internal_error'});}
}
