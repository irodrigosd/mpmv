const BREVO_BASE='https://api.brevo.com/v3';
function key(){return process.env.BREVO_API_KEY||process.env.BREVO_KEY||process.env.SENDINBLUE_API_KEY||'';}
function json(res,status,body){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(body);}
function authorized(req){const expected=process.env.LEADS_ADMIN_TOKEN||process.env.BLOG_ADMIN_TOKEN||'';if(!expected)return false;const direct=String(req.headers['x-admin-token']||'');const auth=String(req.headers.authorization||'');const bearer=auth.toLowerCase().startsWith('bearer ')?auth.slice(7).trim():'';return direct===expected||bearer===expected;}
async function brevo(path){const r=await fetch(BREVO_BASE+path,{headers:{accept:'application/json','api-key':key()}});const text=await r.text();let data={};try{data=text?JSON.parse(text):{};}catch(_){data={raw:text};}if(!r.ok){const e=new Error((data&&data.message)||`brevo_${r.status}`);e.status=r.status;e.data=data;throw e;}return data;}
function eventDate(e){return e&&String(e.date||e.eventTime||e.createdAt||'');}
function eventType(e){return String(e&&e.event||'').toLowerCase();}
function isOpen(t){return ['opened','unique_opened','first_opening','proxy_open','unique_proxy_open'].includes(String(t||'').toLowerCase());}
function isClick(t){t=String(t||'').toLowerCase();return t==='click'||t==='clicked';}
function messageKey(prefix,id,fallback){return prefix+':'+String(id||fallback||'unknown');}
function latest(a,b){if(!a)return b||'';if(!b)return a||'';return new Date(a)>new Date(b)?a:b;}
function earliest(a,b){if(!a)return b||'';if(!b)return a||'';return new Date(a)<new Date(b)?a:b;}
function baseMessage(kind,id,subject){return{kind,messageId:'',campaignId:id==null?null:id,subject:subject||'',sentAt:'',deliveredAt:'',openedAt:'',clickedAt:'',lastEventAt:'',sent:false,delivered:false,opened:false,clicked:false,opens:0,clicks:0,urls:[],clickedUrls:[]};}

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
   const campaignDelivered=Array.isArray(campaign.delivered)?campaign.delivered:[];
   const sentCampaigns=Array.isArray(campaign.messagesSent)?campaign.messagesSent:[];
   const txOpened=events.filter(e=>isOpen(eventType(e)));
   const txClicked=events.filter(e=>isClick(eventType(e)));
   const txDelivered=events.filter(e=>eventType(e)==='delivered');
   const txSent=events.filter(e=>eventType(e)==='sent');
   const opened=campaignOpens.length>0||txOpened.length>0;
   const clicked=campaignClicks.length>0||txClicked.length>0;
   const delivered=campaignDelivered.length>0||txDelivered.length>0;
   const sent=sentCampaigns.length>0||txSent.length>0||delivered||opened||clicked;
   const activity=[];
   const grouped={};

   for(const e of events){
     const type=eventType(e)||'evento',date=eventDate(e),mid=String(e.messageId||e.message_id||''),subject=String(e.subject||''),url=String(e.link||e.url||'');
     activity.push({type,date,subject,messageId:mid,url:isClick(type)?url:'',source:'transactional'});
     const k=messageKey('tx',mid,subject+'|'+date.slice(0,16));
     const m=grouped[k]||(grouped[k]=baseMessage('transactional',null,subject||'E-mail transacional'));
     m.messageId=mid||m.messageId;
     if(subject)m.subject=subject;
     m.lastEventAt=latest(m.lastEventAt,date);
     if(type==='sent'){m.sent=true;m.sentAt=earliest(m.sentAt,date);}
     if(type==='delivered'){m.sent=true;m.delivered=true;m.deliveredAt=earliest(m.deliveredAt,date);}
     if(isOpen(type)){m.sent=true;m.opened=true;m.opens++;m.openedAt=earliest(m.openedAt,date);}
     if(isClick(type)){m.sent=true;m.clicked=true;m.clicks++;m.clickedAt=earliest(m.clickedAt,date);if(url){m.urls.push(url);m.clickedUrls.push(url);}}
   }

   const campaignIds=new Set();
   function campaignMessage(id,date){
     if(id!=null)campaignIds.add(String(id));
     const k=messageKey('campaign',id,date);
     return grouped[k]||(grouped[k]=baseMessage('campaign',id,'Campanha '+String(id||'')));
   }

   for(const s of sentCampaigns){
     const id=s&&s.campaignId,date=eventDate(s),m=campaignMessage(id,date);
     m.sent=true;m.sentAt=earliest(m.sentAt,date);m.lastEventAt=latest(m.lastEventAt,date);
   }
   for(const d of campaignDelivered){
     const id=d&&d.campaignId,date=eventDate(d),m=campaignMessage(id,date);
     activity.push({type:'delivered',date,campaignId:id||null,source:'campaign'});
     m.sent=true;m.delivered=true;m.deliveredAt=earliest(m.deliveredAt,date);m.lastEventAt=latest(m.lastEventAt,date);
   }
   for(const o of campaignOpens){
     const id=o&&o.campaignId,date=eventDate(o),m=campaignMessage(id,date);
     activity.push({type:'opened',date,campaignId:id||null,source:'campaign'});
     m.sent=true;m.opened=true;m.opens++;m.openedAt=earliest(m.openedAt,date);m.lastEventAt=latest(m.lastEventAt,date);
   }
   for(const c of campaignClicks){
     const id=c&&c.campaignId,links=Array.isArray(c&&c.links)?c.links:[],baseDate=eventDate(c),m=campaignMessage(id,baseDate);
     if(links.length){
       for(const l of links){
         const date=eventDate(l)||baseDate,url=String(l&&l.url||''),count=Math.max(1,Number(l&&l.count||1));
         activity.push({type:'clicked',date,campaignId:id||null,url,count,source:'campaign'});
         m.sent=true;m.clicked=true;m.clicks+=count;m.clickedAt=earliest(m.clickedAt,date);m.lastEventAt=latest(m.lastEventAt,date);if(url){m.urls.push(url);m.clickedUrls.push(url);}
       }
     }else{
       activity.push({type:'clicked',date:baseDate,campaignId:id||null,source:'campaign'});
       m.sent=true;m.clicked=true;m.clicks++;m.clickedAt=earliest(m.clickedAt,baseDate);m.lastEventAt=latest(m.lastEventAt,baseDate);
     }
   }

   const campaignNames={};
   await Promise.all(Array.from(campaignIds).slice(0,30).map(async id=>{try{const d=await brevo('/emailCampaigns/'+encodeURIComponent(id)+'?statistics=globalStats&excludeHtmlContent=true');campaignNames[id]=String(d&&d.name||d&&d.subject||('Campanha '+id));}catch(_){campaignNames[id]='Campanha '+id;}}));

   const messages=Object.values(grouped).map(m=>{
     if(m.kind==='campaign'&&m.campaignId!=null)m.subject=campaignNames[String(m.campaignId)]||m.subject;
     m.clickedUrls=Array.from(new Set(m.clickedUrls||m.urls||[])).slice(0,10);
     m.urls=m.clickedUrls.slice();
     m.date=m.sentAt||m.deliveredAt||m.openedAt||m.clickedAt||m.lastEventAt||'';
     return m;
   }).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
   activity.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));

   return json(res,200,{
     ok:true,
     email,
     summary:{sent,delivered,opened,clicked,opens:campaignOpens.length+txOpened.length,clicks:campaignClicks.length+txClicked.length,deliveredEvents:campaignDelivered.length+txDelivered.length,messages:messages.length},
     messages:messages.slice(0,100),
     activity:activity.slice(0,150),
     diagnostics:{
       campaignStatsAvailable:campaignResult.status==='fulfilled',
       transactionalStatsAvailable:eventResult.status==='fulfilled',
       transactionalClickEvents:txClicked.length,
       campaignClickGroups:campaignClicks.length,
       urlFieldMeaning:'urls e clickedUrls contêm somente URLs que tiveram evento de clique. Array vazio significa nenhum clique registrado; não significa que o e-mail foi enviado sem links.'
     },
     campaignStatsAvailable:campaignResult.status==='fulfilled',
     transactionalStatsAvailable:eventResult.status==='fulfilled'
   });
 }catch(e){console.error('Brevo activity error',e);return json(res,e.status&&e.status<600?e.status:500,{ok:false,error:e.message||'internal_error'});}
}