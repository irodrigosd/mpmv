const crypto = require('crypto');

const BREVO_BASE = 'https://api.brevo.com/v3';
const TRACK_ATTRIBUTE = 'MPMV_TRACK';
const SITE_ORIGIN = 'https://www.maispersuasaomaisvendas.com.br';

function apiKey(){return process.env.BREVO_API_KEY||process.env.BREVO_KEY||process.env.SENDINBLUE_API_KEY||'';}
function listId(){const n=Number(process.env.BREVO_LIST_ID||5);return Number.isFinite(n)&&n>0?n:5;}
function clean(v,max=500){return String(v==null?'':v).trim().slice(0,max);}
function emailOk(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());}
function authorized(req){const expected=process.env.LEADS_ADMIN_TOKEN||process.env.BLOG_ADMIN_TOKEN||'';if(!expected)return false;const direct=String(req.headers['x-admin-token']||'');const auth=String(req.headers.authorization||'');const bearer=auth.toLowerCase().startsWith('bearer ')?auth.slice(7).trim():'';return direct===expected||bearer===expected;}
function json(res,status,body){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(body);}
function slug(v){return clean(v,100).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80)||`campanha_${Date.now()}`;}
function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function trackingToken(contactId){const id=String(contactId||'');const sig=crypto.createHmac('sha256',apiKey()).update('mpmv-email:'+id).digest('hex').slice(0,24);return `${id}.${sig}`;}
function destination(raw){const u=new URL(clean(raw,1500),SITE_ORIGIN);const allowed=u.origin===SITE_ORIGIN||/(^|\.)pay\.hotmart\.com$/i.test(u.hostname);if(!allowed||!/^https?:$/.test(u.protocol))throw Object.assign(new Error('invalid_link_url'),{status:400});return u.toString();}
function campaignHref(raw,campaignSlug,testMode,content='cta_email'){
  const base=destination(raw);
  const target=new URL(base);
  if(!target.searchParams.has('utm_content'))target.searchParams.set('utm_content',content);
  if(testMode){
    if(!target.searchParams.has('utm_source'))target.searchParams.set('utm_source','email_test');
    if(!target.searchParams.has('utm_medium'))target.searchParams.set('utm_medium','email');
    if(!target.searchParams.has('utm_campaign'))target.searchParams.set('utm_campaign',campaignSlug||'mpmv_email_test');
    return target.toString();
  }
  return `${SITE_ORIGIN}/api/guia?action=email-click&t={{contact.${TRACK_ATTRIBUTE}}}&c=${encodeURIComponent(campaignSlug)}&to=${encodeURIComponent(target.toString())}`;
}
function personalize(text){
  return String(text||'').replace(/\{\{\s*nome\s*\}\}/gi,'{{ contact.NOME }}');
}
function normalizeLooseLinks(text){
  const lines=String(text||'').replace(/\r\n/g,'\n').split('\n');
  const out=[];
  for(const rawLine of lines){
    const line=rawLine.trim();
    const onlyUrl=line.match(/^(https?:\/\/\S+)$/i);
    if(onlyUrl&&out.length&&out[out.length-1].trim()){
      const prev=out[out.length-1];
      const prevTrim=prev.trim();
      const alreadyLinked=/\[[^\]]+\]\s*\(\s*https?:\/\//i.test(prevTrim);
      const prevIsUrl=/^https?:\/\//i.test(prevTrim);
      if(!alreadyLinked&&!prevIsUrl){out[out.length-1]=`[${prevTrim}](${onlyUrl[1]})`;continue;}
    }
    const trailing=line.match(/^(.+?)\s+(https?:\/\/\S+)$/i);
    if(trailing&&!/\[[^\]]+\]\s*\(\s*https?:\/\//i.test(line)){
      out.push(`[${trailing[1].trim()}](${trailing[2]})`);continue;
    }
    out.push(rawLine);
  }
  return out.join('\n');
}
function formatInline(text,campaignSlug,testMode){
  const source=String(text||'');
  const re=/\[([^\]\n]{1,240})\]\s*\(\s*(https?:\/\/[^\s)]+)\s*\)/g;
  let html='',last=0,m;
  while((m=re.exec(source))){
    html+=escapeHtml(source.slice(last,m.index));
    const href=campaignHref(m[2],campaignSlug,testMode,'inline_text');
    html+=`<a href="${escapeHtml(href)}" style="color:#0d6f9f;text-decoration:underline;font-weight:700">${escapeHtml(m[1])}</a>`;
    last=re.lastIndex;
  }
  html+=escapeHtml(source.slice(last));
  return html.replace(/\n/g,'<br>');
}
function paragraphs(text,campaignSlug,testMode){const normalized=normalizeLooseLinks(personalize(clean(text,20000)));return normalized.split(/\n{2,}/).map(p=>p.trim()).filter(Boolean).map(p=>`<p style="margin:0 0 18px;line-height:1.65;color:#17202a;font-size:16px">${formatInline(p,campaignSlug,testMode)}</p>`).join('');}
function splitSignature(text){
  const source=clean(text,20000);
  const re=/\n{2,}(?=(?:(?:até mais|um abraço|abraço|abs|atenciosamente),?\s*(?:\n|$)|rodrigo\s*\n\s*mais persuasão))/gi;
  let last=-1,m;
  while((m=re.exec(source)))last=m.index;
  if(last<0)return {main:source,signature:''};
  return {main:source.slice(0,last).trim(),signature:source.slice(last).trim()};
}
function campaignHtml({preheader,body,ctaLabel,ctaUrl,campaignSlug,testMode=false,showCtaButton=true}){
  const parts=splitSignature(body);
  const mainHtml=paragraphs(parts.main,campaignSlug,testMode);
  const signatureHtml=parts.signature?paragraphs(parts.signature,campaignSlug,testMode):'';
  let ctaHtml='';
  if(showCtaButton){
    const href=campaignHref(ctaUrl,campaignSlug,testMode,'cta_email');
    ctaHtml=`<p style="margin:28px 0 24px"><a href="${escapeHtml(href)}" style="display:inline-block;background:#0d6f9f;color:#fff;text-decoration:none;font-weight:800;padding:14px 20px;border-radius:9px">${escapeHtml(ctaLabel||'Saiba mais')}</a></p>`;
  }
  return `<!doctype html><html><body style="margin:0;background:#f3f6f8;font-family:Arial,Helvetica,sans-serif;color:#17202a"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(personalize(preheader||''))}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6f8;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border:1px solid #dfe7ec;border-radius:14px;overflow:hidden"><tr><td style="padding:28px 30px 10px"><div style="font-weight:800;font-size:16px;color:#0d6f9f">MPMV</div></td></tr><tr><td style="padding:10px 30px 28px">${mainHtml}${ctaHtml}${signatureHtml}</td></tr><tr><td style="border-top:1px solid #e8eef2;padding:18px 30px;color:#73808c;font-size:12px;line-height:1.5">Recebeu este e-mail por fazer parte da base MPMV. <a href="{{ unsubscribe }}" style="color:#52606b">Cancelar inscrição</a>.</td></tr></table></td></tr></table></body></html>`;
}
async function brevo(path,options={}){const r=await fetch(BREVO_BASE+path,{...options,headers:{accept:'application/json','api-key':apiKey(),'content-type':'application/json',...(options.headers||{})}});const text=await r.text();let data={};try{data=text?JSON.parse(text):{};}catch(_){data={raw:text};}if(!r.ok){const e=new Error((data&&data.message)||`brevo_${r.status}`);e.status=r.status;e.data=data;throw e;}return data;}
async function activeSender(){const data=await brevo('/senders');const senders=Array.isArray(data.senders)?data.senders:[];const sender=senders.find(s=>s&&s.email&&s.active!==false);if(!sender)throw Object.assign(new Error('no_active_sender'),{status:503});return Number(sender.id)>0?{id:Number(sender.id)}:{email:String(sender.email),name:String(sender.name||'MPMV')};}
async function ensureTrackAttribute(){const all=await brevo('/contacts/attributes');const attrs=Array.isArray(all.attributes)?all.attributes:[];if(attrs.some(a=>String(a&&a.name||'').toUpperCase()===TRACK_ATTRIBUTE))return;try{await brevo('/contacts/attributes/normal/'+TRACK_ATTRIBUTE,{method:'POST',body:JSON.stringify({type:'text'})});}catch(e){if(e.status!==400)throw e;}}
async function contactsFromMainList(){const data=await brevo(`/contacts/lists/${listId()}/contacts?limit=500&offset=0&sort=desc`);return Array.isArray(data.contacts)?data.contacts:[];}
async function prepareTracking(contacts){await ensureTrackAttribute();const usable=contacts.filter(c=>c&&Number(c.id)>0&&emailOk(c.email)&&!c.emailBlacklisted);for(let i=0;i<usable.length;i+=8){await Promise.all(usable.slice(i,i+8).map(c=>brevo('/contacts/'+encodeURIComponent(String(c.id))+'?identifierType=contact_id',{method:'PUT',body:JSON.stringify({attributes:{[TRACK_ATTRIBUTE]:trackingToken(c.id)}})})));}return usable;}
async function temporaryList(name,emails){const main=await brevo('/contacts/lists/'+listId());const folderId=Number(main.folderId);if(!Number.isFinite(folderId))throw new Error('main_list_folder_missing');const created=await brevo('/contacts/lists',{method:'POST',body:JSON.stringify({name:`MPMV · ${clean(name,55)} · ${Date.now()}`,folderId})});const id=Number(created.id);if(!id)throw new Error('temporary_list_not_created');await brevo(`/contacts/lists/${id}/contacts/add`,{method:'POST',body:JSON.stringify({emails})});return id;}
function normalizeRecipients(body,all){const requested=Array.isArray(body.recipients)?body.recipients.map(v=>clean(v,180).toLowerCase()).filter(emailOk):[];const allowed=new Map(all.filter(c=>c&&emailOk(c.email)&&!c.emailBlacklisted).map(c=>[String(c.email).toLowerCase(),c]));if(!requested.length)return Array.from(allowed.values());return Array.from(new Set(requested)).map(e=>allowed.get(e)).filter(Boolean);}
async function createCampaign(body,mode){
  const name=clean(body.name,120),subject=personalize(clean(body.subject,180)),preheader=clean(body.preheader,180),message=clean(body.body,20000),ctaLabel=clean(body.ctaLabel,80)||'Saiba mais';
  const showCtaButton=body.showCtaButton!==false;
  const ctaUrl=showCtaButton?destination(body.ctaUrl):'';
  if(name.length<3||subject.length<3||message.length<10)throw Object.assign(new Error('campaign_fields_required'),{status:400});
  if(showCtaButton&&!ctaUrl)throw Object.assign(new Error('cta_url_required'),{status:400});
  const all=await contactsFromMainList();const selected=normalizeRecipients(body,all);if(!selected.length)throw Object.assign(new Error('no_recipients'),{status:400});
  const prepared=mode==='test'?selected.filter(c=>c&&Number(c.id)>0&&emailOk(c.email)&&!c.emailBlacklisted):await prepareTracking(selected);if(!prepared.length)throw Object.assign(new Error('no_deliverable_recipients'),{status:400});
  const deliverableAll=all.filter(c=>c&&emailOk(c.email)&&!c.emailBlacklisted);let targetListId=listId();if(mode!=='test'&&prepared.length!==deliverableAll.length)targetListId=await temporaryList(name,prepared.map(c=>String(c.email).toLowerCase()));
  const campaignSlug=slug(body.campaign||name),brevoName=String(name).startsWith('MPMV')?name:`MPMV · ${name}`;
  const payload={name:brevoName,subject,previewText:personalize(preheader),htmlContent:campaignHtml({preheader,body:message,ctaLabel,ctaUrl,campaignSlug,testMode:mode==='test',showCtaButton}),sender:await activeSender(),recipients:{listIds:[targetListId]},replyTo:process.env.MPMV_REPLY_TO||undefined};
  Object.keys(payload).forEach(k=>payload[k]===undefined&&delete payload[k]);
  const created=await brevo('/emailCampaigns',{method:'POST',body:JSON.stringify(payload)}),campaignId=Number(created.id);if(!campaignId)throw new Error('campaign_not_created');
  if(mode==='test'){const testEmail=clean(body.testEmail,180).toLowerCase();if(!emailOk(testEmail))throw Object.assign(new Error('invalid_test_email'),{status:400});await brevo(`/emailCampaigns/${campaignId}/sendTest`,{method:'POST',body:JSON.stringify({emailTo:[testEmail]})});}
  else if(mode==='send'){await brevo(`/emailCampaigns/${campaignId}/sendNow`,{method:'POST',body:'{}'});}
  return {campaignId,campaignSlug,recipients:prepared.length,targetListId,mode};
}
async function handleCampaigns(req,res){if(!authorized(req))return json(res,401,{ok:false,error:'unauthorized'});if(!apiKey())return json(res,503,{ok:false,error:'brevo_not_configured'});try{if(req.method==='GET'){const data=await brevo('/emailCampaigns?type=classic&limit=30&offset=0&sort=desc');const campaigns=Array.isArray(data.campaigns)?data.campaigns.filter(c=>String(c.tag||'')==='MPMV_NATIVE'||String(c.name||'').startsWith('MPMV')).slice(0,20):[];return json(res,200,{ok:true,campaigns});}if(req.method==='POST'){const body=typeof req.body==='string'?JSON.parse(req.body):(req.body||{});const mode=['draft','test','send'].includes(body.mode)?body.mode:'draft';return json(res,200,{ok:true,...await createCampaign(body,mode)});}res.setHeader('Allow','GET, POST, OPTIONS');return json(res,405,{ok:false,error:'method_not_allowed'});}catch(e){console.error('MPMV email campaign error',e);return json(res,e.status&&e.status<600?e.status:500,{ok:false,error:e.message||'internal_error',details:e.data||undefined});}}

module.exports={handleCampaigns};
