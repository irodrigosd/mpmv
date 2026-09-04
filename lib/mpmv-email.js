const crypto = require('crypto');

const BREVO_BASE = 'https://api.brevo.com/v3';
const TRACK_ATTRIBUTE = 'MPMV_TRACK';
const SITE_ORIGIN = 'https://www.maispersuasaomaisvendas.com.br';
const AUTO_CONTROL_EMAIL = 'automacao@maispersuasaomaisvendas.com.br';
const AUTO_ATTR = {
  enabled:'MPMV_AUTO_ENABLED',
  stage:'MPMV_AUTO_STAGE',
  last:'MPMV_AUTO_LAST',
  click:'MPMV_MENTORIA_CLICK',
  clickAt:'MPMV_MENTORIA_CLICK_AT',
  client:'MPMV_CLIENTE'
};

function apiKey(){return process.env.BREVO_API_KEY||process.env.BREVO_KEY||process.env.SENDINBLUE_API_KEY||'';}
function listId(){const n=Number(process.env.BREVO_LIST_ID||5);return Number.isFinite(n)&&n>0?n:5;}
function clean(v,max=500){return String(v==null?'':v).trim().slice(0,max);}
function emailOk(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());}
function authorized(req){const expected=process.env.LEADS_ADMIN_TOKEN||process.env.BLOG_ADMIN_TOKEN||'';if(!expected)return false;const direct=String(req.headers['x-admin-token']||'');const auth=String(req.headers.authorization||'');const bearer=auth.toLowerCase().startsWith('bearer ')?auth.slice(7).trim():'';return direct===expected||bearer===expected;}
function json(res,status,body){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(body);}
function slug(v){return clean(v,100).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80)||`campanha_${Date.now()}`;}
function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function trackingToken(contactId){const id=String(contactId||'');const sig=crypto.createHmac('sha256',apiKey()).update('mpmv-email:'+id).digest('hex').slice(0,24);return `${id}.${sig}`;}
function destination(raw){const u=new URL(clean(raw,1500),SITE_ORIGIN);const allowed=u.origin===SITE_ORIGIN||/(^|\.)pay\.hotmart\.com$/i.test(u.hostname);if(!allowed||!/^https?:$/.test(u.protocol))throw Object.assign(new Error('invalid_cta_url'),{status:400});return u.toString();}
function paragraphs(text){return clean(text,20000).split(/\n{2,}/).map(p=>p.trim()).filter(Boolean).map(p=>`<p style="margin:0 0 18px;line-height:1.65;color:#17202a;font-size:16px">${escapeHtml(p).replace(/\n/g,'<br>')}</p>`).join('');}
function campaignHtml({preheader,body,ctaLabel,ctaUrl,campaignSlug,testMode=false}){const base=destination(ctaUrl);let href;if(testMode){const testUrl=new URL(base);testUrl.searchParams.set('utm_source','email_test');testUrl.searchParams.set('utm_medium','email');testUrl.searchParams.set('utm_campaign',campaignSlug||'mpmv_email_test');testUrl.searchParams.set('utm_content','cta_test');href=testUrl.toString();}else{href=`${SITE_ORIGIN}/api/guia?action=email-click&t={{contact.${TRACK_ATTRIBUTE}}}&c=${encodeURIComponent(campaignSlug)}&to=${encodeURIComponent(base)}`;}return `<!doctype html><html><body style="margin:0;background:#f3f6f8;font-family:Arial,Helvetica,sans-serif;color:#17202a"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader||'')}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6f8;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border:1px solid #dfe7ec;border-radius:14px;overflow:hidden"><tr><td style="padding:28px 30px 10px"><div style="font-weight:800;font-size:16px;color:#0d6f9f">MPMV</div></td></tr><tr><td style="padding:10px 30px 28px">${paragraphs(body)}<p style="margin:28px 0 8px"><a href="${href}" style="display:inline-block;background:#0d6f9f;color:#fff;text-decoration:none;font-weight:800;padding:14px 20px;border-radius:9px">${escapeHtml(ctaLabel)}</a></p></td></tr><tr><td style="border-top:1px solid #e8eef2;padding:18px 30px;color:#73808c;font-size:12px;line-height:1.5">Recebeu este e-mail por fazer parte da base MPMV. <a href="{{ unsubscribe }}" style="color:#52606b">Cancelar inscrição</a>.</td></tr></table></td></tr></table></body></html>`;}
async function brevo(path,options={}){const r=await fetch(BREVO_BASE+path,{...options,headers:{accept:'application/json','api-key':apiKey(),'content-type':'application/json',...(options.headers||{})}});const text=await r.text();let data={};try{data=text?JSON.parse(text):{};}catch(_){data={raw:text};}if(!r.ok){const e=new Error((data&&data.message)||`brevo_${r.status}`);e.status=r.status;e.data=data;throw e;}return data;}
async function activeSender(){const data=await brevo('/senders');const senders=Array.isArray(data.senders)?data.senders:[];const sender=senders.find(s=>s&&s.email&&s.active!==false);if(!sender)throw Object.assign(new Error('no_active_sender'),{status:503});return Number(sender.id)>0?{id:Number(sender.id)}:{email:String(sender.email),name:String(sender.name||'MPMV')};}
async function activeSenderDetails(){const data=await brevo('/senders');const senders=Array.isArray(data.senders)?data.senders:[];const sender=senders.find(s=>s&&s.email&&s.active!==false);if(!sender)throw Object.assign(new Error('no_active_sender'),{status:503});return {email:String(sender.email),name:String(sender.name||'MPMV')};}
async function ensureTrackAttribute(){const all=await brevo('/contacts/attributes');const attrs=Array.isArray(all.attributes)?all.attributes:[];if(attrs.some(a=>String(a&&a.name||'').toUpperCase()===TRACK_ATTRIBUTE))return;try{await brevo('/contacts/attributes/normal/'+TRACK_ATTRIBUTE,{method:'POST',body:JSON.stringify({type:'text'})});}catch(e){if(e.status!==400)throw e;}}
async function contactsFromMainList(){const data=await brevo(`/contacts/lists/${listId()}/contacts?limit=500&offset=0&sort=desc`);return Array.isArray(data.contacts)?data.contacts:[];}
async function prepareTracking(contacts){await ensureTrackAttribute();const usable=contacts.filter(c=>c&&Number(c.id)>0&&emailOk(c.email)&&!c.emailBlacklisted);for(let i=0;i<usable.length;i+=8){await Promise.all(usable.slice(i,i+8).map(c=>brevo('/contacts/'+encodeURIComponent(String(c.id))+'?identifierType=contact_id',{method:'PUT',body:JSON.stringify({attributes:{[TRACK_ATTRIBUTE]:trackingToken(c.id)}})})));}return usable;}
async function temporaryList(name,emails){const main=await brevo('/contacts/lists/'+listId());const folderId=Number(main.folderId);if(!Number.isFinite(folderId))throw new Error('main_list_folder_missing');const created=await brevo('/contacts/lists',{method:'POST',body:JSON.stringify({name:`MPMV · ${clean(name,55)} · ${Date.now()}`,folderId})});const id=Number(created.id);if(!id)throw new Error('temporary_list_not_created');await brevo(`/contacts/lists/${id}/contacts/add`,{method:'POST',body:JSON.stringify({emails})});return id;}
function normalizeRecipients(body,all){const requested=Array.isArray(body.recipients)?body.recipients.map(v=>clean(v,180).toLowerCase()).filter(emailOk):[];const allowed=new Map(all.filter(c=>c&&emailOk(c.email)&&!c.emailBlacklisted).map(c=>[String(c.email).toLowerCase(),c]));if(!requested.length)return Array.from(allowed.values());return Array.from(new Set(requested)).map(e=>allowed.get(e)).filter(Boolean);}
async function createCampaign(body,mode){const name=clean(body.name,120),subject=clean(body.subject,180),preheader=clean(body.preheader,180),message=clean(body.body,20000),ctaLabel=clean(body.ctaLabel,80)||'Saiba mais',ctaUrl=destination(body.ctaUrl);if(name.length<3||subject.length<3||message.length<10)throw Object.assign(new Error('campaign_fields_required'),{status:400});const all=await contactsFromMainList();const selected=normalizeRecipients(body,all);if(!selected.length)throw Object.assign(new Error('no_recipients'),{status:400});const prepared=mode==='test'?selected.filter(c=>c&&Number(c.id)>0&&emailOk(c.email)&&!c.emailBlacklisted):await prepareTracking(selected);if(!prepared.length)throw Object.assign(new Error('no_deliverable_recipients'),{status:400});const deliverableAll=all.filter(c=>c&&emailOk(c.email)&&!c.emailBlacklisted);let targetListId=listId();if(mode!=='test'&&prepared.length!==deliverableAll.length)targetListId=await temporaryList(name,prepared.map(c=>String(c.email).toLowerCase()));const campaignSlug=slug(body.campaign||name);const brevoName=String(name).startsWith('MPMV')?name:`MPMV · ${name}`;const payload={name:brevoName,subject,previewText:preheader,htmlContent:campaignHtml({preheader,body:message,ctaLabel,ctaUrl,campaignSlug,testMode:mode==='test'}),sender:await activeSender(),recipients:{listIds:[targetListId]},replyTo:process.env.MPMV_REPLY_TO||undefined};Object.keys(payload).forEach(k=>payload[k]===undefined&&delete payload[k]);const created=await brevo('/emailCampaigns',{method:'POST',body:JSON.stringify(payload)});const campaignId=Number(created.id);if(!campaignId)throw new Error('campaign_not_created');if(mode==='test'){const testEmail=clean(body.testEmail,180).toLowerCase();if(!emailOk(testEmail))throw Object.assign(new Error('invalid_test_email'),{status:400});await brevo(`/emailCampaigns/${campaignId}/sendTest`,{method:'POST',body:JSON.stringify({emailTo:[testEmail]})});}else if(mode==='send'){await brevo(`/emailCampaigns/${campaignId}/sendNow`,{method:'POST',body:'{}'});}return {campaignId,campaignSlug,recipients:prepared.length,targetListId,mode};}

async function handleCampaigns(req,res){if(!authorized(req))return json(res,401,{ok:false,error:'unauthorized'});if(!apiKey())return json(res,503,{ok:false,error:'brevo_not_configured'});try{if(req.method==='GET'){const data=await brevo('/emailCampaigns?type=classic&limit=30&offset=0&sort=desc');const campaigns=Array.isArray(data.campaigns)?data.campaigns.filter(c=>String(c.tag||'')==='MPMV_NATIVE'||String(c.name||'').startsWith('MPMV')).slice(0,20):[];return json(res,200,{ok:true,campaigns});}if(req.method==='POST'){const body=typeof req.body==='string'?JSON.parse(req.body):(req.body||{});const mode=['draft','test','send'].includes(body.mode)?body.mode:'draft';return json(res,200,{ok:true,...await createCampaign(body,mode)});}res.setHeader('Allow','GET, POST, OPTIONS');return json(res,405,{ok:false,error:'method_not_allowed'});}catch(e){console.error('MPMV email campaign error',e);return json(res,e.status&&e.status<600?e.status:500,{ok:false,error:e.message||'internal_error',details:e.data||undefined});}}

function validToken(token){const raw=clean(token,120),m=raw.match(/^(\d+)\.([a-f0-9]{24})$/i);if(!m||!apiKey())return null;const id=m[1],expected=crypto.createHmac('sha256',apiKey()).update('mpmv-email:'+id).digest('hex').slice(0,24),a=Buffer.from(m[2].toLowerCase()),b=Buffer.from(expected.toLowerCase());if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;return {id:Number(id),token:`${id}.${expected}`};}
function safeDestination(raw){try{const u=new URL(clean(raw,1800),SITE_ORIGIN);const allowed=u.origin===SITE_ORIGIN||/(^|\.)pay\.hotmart\.com$/i.test(u.hostname);return allowed&&/^https?:$/.test(u.protocol)?u:null;}catch(_){return null;}}
function addUtm(target,campaign){if(!target.searchParams.has('utm_source'))target.searchParams.set('utm_source','email');if(!target.searchParams.has('utm_medium'))target.searchParams.set('utm_medium','email');if(!target.searchParams.has('utm_campaign'))target.searchParams.set('utm_campaign',campaign||'mpmv_email');if(!target.searchParams.has('utm_content'))target.searchParams.set('utm_content','cta_email');}

let autoSetupPromise;
async function ensureAutomationSetup(){
  if(autoSetupPromise)return autoSetupPromise;
  autoSetupPromise=(async()=>{
    const data=await brevo('/contacts/attributes');
    const existing=new Set((Array.isArray(data.attributes)?data.attributes:[]).map(a=>String(a&&a.name||'').toUpperCase()));
    for(const name of Object.values(AUTO_ATTR)){
      if(existing.has(name))continue;
      try{await brevo('/contacts/attributes/normal/'+name,{method:'POST',body:JSON.stringify({type:'text'})});}catch(e){if(e.status!==400)throw e;}
    }
    try{await brevo('/contacts/'+encodeURIComponent(AUTO_CONTROL_EMAIL));}
    catch(e){if(e.status!==404)throw e;await brevo('/contacts',{method:'POST',body:JSON.stringify({email:AUTO_CONTROL_EMAIL,updateEnabled:true})});}
  })();
  try{return await autoSetupPromise;}catch(e){autoSetupPromise=null;throw e;}
}
async function autoControl(){await ensureAutomationSetup();return brevo('/contacts/'+encodeURIComponent(AUTO_CONTROL_EMAIL));}
async function autoEnabled(){const c=await autoControl();return String(c&&c.attributes&&c.attributes[AUTO_ATTR.enabled]||'').toLowerCase()==='yes';}
async function setAutoEnabled(value){await ensureAutomationSetup();await brevo('/contacts/'+encodeURIComponent(AUTO_CONTROL_EMAIL),{method:'PUT',body:JSON.stringify({attributes:{[AUTO_ATTR.enabled]:value?'yes':'no'}})});return !!value;}
function contactName(c){const a=c&&c.attributes||{};return clean(a.NOME||a.NAME||[a.FIRSTNAME||a.FIRST_NAME||'',a.LASTNAME||a.LAST_NAME||''].filter(Boolean).join(' '),120)||'Olá';}
function isYes(v){return ['yes','sim','true','1'].includes(String(v||'').toLowerCase());}
function daysSince(v){const t=Date.parse(String(v||''));return Number.isFinite(t)?(Date.now()-t)/86400000:9999;}
async function updateContact(c,attrs){return brevo('/contacts/'+encodeURIComponent(String(c.id))+'?identifierType=contact_id',{method:'PUT',body:JSON.stringify({attributes:attrs})});}

const AUTO_FLOW=[
  {id:'guide',label:'Entrega do Guia',when:'Novo lead · próxima execução',subject:'Seu Guia Prático está aqui'},
  {id:'content',label:'Conteúdo de consciência',when:'+1 dia',subject:'Seu cliente entendeu por que precisa do seu produto?'},
  {id:'mentoria',label:'Convite para mentoria',when:'+2 dias',subject:'Quer montar sua estratégia de persuasão comigo?'},
  {id:'interest1',label:'Interesse · prova e processo',when:'Clicou na mentoria · +1 dia',subject:'Como eu trabalho sua persuasão na prática'},
  {id:'interest2',label:'Interesse · objeção e próximo passo',when:'+2 dias',subject:'Se você quer que eu olhe sua estratégia com você'},
  {id:'reinforce',label:'Reforço sem clique',when:'Não clicou · +2 dias',subject:'Uma pergunta antes de você deixar isso para depois'}
];
function autoTemplate(step,name){
  const first=clean(name,80)||'Olá';
  const guide=`${SITE_ORIGIN}/guia-pratico-persuasao-pra-vender-todo-santo-dia.pdf`;
  const mentoria=`${SITE_ORIGIN}/mentoria/`;
  const map={
    guide:{subject:'Seu Guia Prático está aqui',preheader:'O material que você pediu já está liberado.',body:`${first}, seu Guia Prático já está liberado.\n\nUse o material como uma ferramenta de consulta. Pegue uma ideia, aplique numa oferta, numa página ou num conteúdo e observe o que muda na resposta das pessoas.\n\nO melhor uso começa pela prática.`,ctaLabel:'Abrir o Guia',ctaUrl:guide,mentor:false},
    content:{subject:'Seu cliente entendeu por que precisa do seu produto?',preheader:'Uma pergunta que muda a forma de apresentar uma oferta.',body:`${first}, antes de tentar melhorar uma oferta, vale conferir uma coisa: a pessoa entendeu o que muda na vida dela depois da compra?\n\nCaracterísticas ajudam a explicar o produto. Benefícios ajudam o cliente a enxergar consequência, uso e resultado.\n\nQuando essa ponte fica clara, a persuasão ganha espaço para trabalhar.`,ctaLabel:'Revisar o Guia',ctaUrl:guide,mentor:false},
    mentoria:{subject:'Quer montar sua estratégia de persuasão comigo?',preheader:'Um convite para aplicar isso no seu negócio.',body:`${first}, até aqui eu te entreguei princípios que você consegue aplicar sozinho.\n\nNa mentoria, eu entro na sua operação com você: oferta, mensagem, conteúdo, páginas e pontos de perda da venda.\n\nSe faz sentido ter meu olhar em cima da sua estratégia, veja como funciona.`,ctaLabel:'Conhecer a mentoria',ctaUrl:mentoria,mentor:true},
    reinforce:{subject:'Uma pergunta antes de você deixar isso para depois',preheader:'Talvez valha olhar a mentoria por outro ângulo.',body:`${first}, uma estratégia pode continuar rodando mesmo com pequenos vazamentos de persuasão. O custo aparece aos poucos: clique que não avança, lead que esfria, oferta que exige explicação demais.\n\nNa mentoria, eu procuro esses pontos com você e transformo o diagnóstico em ação.`,ctaLabel:'Ver como funciona a mentoria',ctaUrl:mentoria,mentor:true},
    interest1:{subject:'Como eu trabalho sua persuasão na prática',preheader:'Você clicou na mentoria. Então vale mostrar o processo.',body:`${first}, vi que você demonstrou interesse na mentoria.\n\nO trabalho começa pelo que já existe: sua oferta, seus anúncios, páginas, conteúdos e números. A partir daí, eu procuro onde a decisão do cliente está travando e o que deve ser testado primeiro.\n\nVocê entra com o negócio. Eu entro com diagnóstico, direção e copy.`,ctaLabel:'Ver a mentoria',ctaUrl:mentoria,mentor:true},
    interest2:{subject:'Se você quer que eu olhe sua estratégia com você',preheader:'O próximo passo é simples.',body:`${first}, se você chegou até aqui, já viu a lógica do meu trabalho.\n\nA mentoria existe para colocar esse raciocínio em cima da sua operação e transformar análise em próximas ações.\n\nSe quiser meu olhar no seu negócio, veja os detalhes e dê o próximo passo pela página.`,ctaLabel:'Quero conhecer a mentoria',ctaUrl:mentoria,mentor:true}
  };
  return map[step];
}
function autoHtml({template,contact,testMode=false}){
  const token=contact&&contact.id?trackingToken(contact.id):'';
  const base=destination(template.ctaUrl);
  let href=base;
  if(testMode){const u=new URL(base);u.searchParams.set('utm_source','email_test');u.searchParams.set('utm_medium','email');u.searchParams.set('utm_campaign','automacao_'+(template.mentor?'mentoria':'nutricao'));u.searchParams.set('utm_content','cta_test');href=u.toString();}
  else{href=`${SITE_ORIGIN}/api/guia?action=email-click&t=${encodeURIComponent(token)}&c=${encodeURIComponent('automacao_'+(template.mentor?'mentoria':'nutricao'))}&a=${template.mentor?'mentoria':'conteudo'}&to=${encodeURIComponent(base)}`;}
  const unsub=testMode?'#':`${SITE_ORIGIN}/api/guia?action=email-unsubscribe&t=${encodeURIComponent(token)}`;
  return `<!doctype html><html><body style="margin:0;background:#f3f6f8;font-family:Arial,Helvetica,sans-serif;color:#17202a"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(template.preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6f8;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border:1px solid #dfe7ec;border-radius:14px"><tr><td style="padding:28px 30px 10px;color:#0d6f9f;font-weight:800">MPMV</td></tr><tr><td style="padding:10px 30px 28px">${paragraphs(template.body)}<p style="margin:28px 0 8px"><a href="${href}" style="display:inline-block;background:#0d6f9f;color:#fff;text-decoration:none;font-weight:800;padding:14px 20px;border-radius:9px">${escapeHtml(template.ctaLabel)}</a></p></td></tr><tr><td style="border-top:1px solid #e8eef2;padding:18px 30px;color:#73808c;font-size:12px">Recebeu este e-mail por fazer parte da base MPMV.${testMode?'':' <a href="'+unsub+'" style="color:#52606b">Cancelar inscrição</a>.'}</td></tr></table></td></tr></table></body></html>`;
}
async function sendAutoStep(c,step,{testEmail}={}){
  const template=autoTemplate(step,contactName(c));if(!template)throw new Error('invalid_automation_step');
  const sender=await activeSenderDetails();
  const recipient=testEmail?clean(testEmail,180).toLowerCase():String(c.email||'').toLowerCase();
  if(!emailOk(recipient))throw new Error('invalid_recipient');
  return brevo('/smtp/email',{method:'POST',body:JSON.stringify({sender,to:[{email:recipient,name:testEmail?'Teste MPMV':contactName(c)}],subject:template.subject,htmlContent:autoHtml({template,contact:c,testMode:!!testEmail})})});
}
async function transition(c,step,nextStage){
  await updateContact(c,{[AUTO_ATTR.stage]:'sending_'+step,[AUTO_ATTR.last]:new Date().toISOString()});
  try{await sendAutoStep(c,step);await updateContact(c,{[AUTO_ATTR.stage]:nextStage,[AUTO_ATTR.last]:new Date().toISOString()});return step;}
  catch(e){await updateContact(c,{[AUTO_ATTR.stage]:'error_'+step});throw e;}
}
async function processAutoContact(c){
  if(!c||!Number(c.id)||!emailOk(c.email)||c.emailBlacklisted||((c.listUnsubscribed||[]).includes(listId())))return 'skip';
  const a=c.attributes||{};
  if(isYes(a[AUTO_ATTR.client])){if(a[AUTO_ATTR.stage]!=='client')await updateContact(c,{[AUTO_ATTR.stage]:'client',[AUTO_ATTR.last]:new Date().toISOString()});return 'client';}
  const stage=String(a[AUTO_ATTR.stage]||'');const last=a[AUTO_ATTR.last];const clicked=isYes(a[AUTO_ATTR.click]);const clickAge=daysSince(a[AUTO_ATTR.clickAt]);
  if(!stage)return transition(c,'guide','guide_sent');
  if(stage==='guide_sent'&&daysSince(last)>=1)return transition(c,'content','content_sent');
  if(stage==='content_sent'&&daysSince(last)>=2)return transition(c,'mentoria','mentoria_sent');
  if(stage==='mentoria_sent'){
    if(clicked&&clickAge>=1)return transition(c,'interest1','interest1_sent');
    if(!clicked&&daysSince(last)>=2)return transition(c,'reinforce','reinforce_sent');
  }
  if(stage==='reinforce_sent'){
    if(clicked&&clickAge>=1)return transition(c,'interest1','interest1_sent');
    if(!clicked&&daysSince(last)>=2){await updateContact(c,{[AUTO_ATTR.stage]:'done',[AUTO_ATTR.last]:new Date().toISOString()});return 'done';}
  }
  if(stage==='interest1_sent'&&daysSince(last)>=2)return transition(c,'interest2','interest2_sent');
  if(stage==='interest2_sent'&&daysSince(last)>=2){await updateContact(c,{[AUTO_ATTR.stage]:'done',[AUTO_ATTR.last]:new Date().toISOString()});return 'done';}
  if(/^error_/.test(stage)&&daysSince(last)>=1){await updateContact(c,{[AUTO_ATTR.stage]:''});return 'reset_error';}
  return 'waiting';
}
async function runAutomation(){
  await ensureAutomationSetup();if(!(await autoEnabled()))return {enabled:false,processed:0,sent:0,events:[]};
  const contacts=await contactsFromMainList();let sent=0;const events=[];
  for(const c of contacts){try{const result=await processAutoContact(c);if(['guide','content','mentoria','reinforce','interest1','interest2'].includes(result))sent++;if(result!=='waiting'&&result!=='skip')events.push({email:c.email,result});}catch(e){events.push({email:c.email,result:'error',error:e.message});}}
  return {enabled:true,processed:contacts.length,sent,events:events.slice(0,50)};
}
function autoSummaryContact(c){const a=c.attributes||{};return {id:c.id,email:c.email||'',name:contactName(c),createdAt:c.createdAt||'',stage:a[AUTO_ATTR.stage]||'',last:a[AUTO_ATTR.last]||'',clicked:isYes(a[AUTO_ATTR.click]),clickAt:a[AUTO_ATTR.clickAt]||'',client:isYes(a[AUTO_ATTR.client]),emailBlacklisted:!!c.emailBlacklisted};}
async function handleAutomation(req,res){
  if(!authorized(req))return json(res,401,{ok:false,error:'unauthorized'});if(!apiKey())return json(res,503,{ok:false,error:'brevo_not_configured'});
  try{
    await ensureAutomationSetup();
    if(req.method==='GET'){const enabled=await autoEnabled();const contacts=(await contactsFromMainList()).map(autoSummaryContact);const stats={total:contacts.length,waiting:contacts.filter(c=>c.stage&&!['done','client'].includes(c.stage)).length,clicked:contacts.filter(c=>c.clicked).length,clients:contacts.filter(c=>c.client).length,done:contacts.filter(c=>c.stage==='done').length};return json(res,200,{ok:true,enabled,flow:AUTO_FLOW,stats,contacts});}
    if(req.method==='POST'){const body=typeof req.body==='string'?JSON.parse(req.body):(req.body||{});const action=clean(body.action,50);
      if(action==='toggle')return json(res,200,{ok:true,enabled:await setAutoEnabled(!!body.enabled)});
      if(action==='run')return json(res,200,{ok:true,...await runAutomation()});
      if(action==='test'){const step=clean(body.step,30),testEmail=clean(body.testEmail,180);if(!emailOk(testEmail))return json(res,400,{ok:false,error:'invalid_test_email'});const fake={id:0,email:testEmail,attributes:{FIRSTNAME:'Teste'}};await sendAutoStep(fake,step,{testEmail});return json(res,200,{ok:true,step,testEmail});}
      if(action==='mark-client'){const email=clean(body.email,180).toLowerCase();const contact=await brevo('/contacts/'+encodeURIComponent(email));await updateContact(contact,{[AUTO_ATTR.client]:body.client?'yes':'no',[AUTO_ATTR.stage]:body.client?'client':'',[AUTO_ATTR.last]:new Date().toISOString()});return json(res,200,{ok:true,email,client:!!body.client});}
      if(action==='reset'){const email=clean(body.email,180).toLowerCase();const contact=await brevo('/contacts/'+encodeURIComponent(email));await updateContact(contact,{[AUTO_ATTR.stage]:'',[AUTO_ATTR.last]:'',[AUTO_ATTR.click]:'no',[AUTO_ATTR.clickAt]:'',[AUTO_ATTR.client]:'no'});return json(res,200,{ok:true,email});}
      return json(res,400,{ok:false,error:'invalid_action'});
    }
    res.setHeader('Allow','GET, POST, OPTIONS');return json(res,405,{ok:false,error:'method_not_allowed'});
  }catch(e){console.error('MPMV automation error',e);return json(res,e.status&&e.status<600?e.status:500,{ok:false,error:e.message||'internal_error',details:e.data||undefined});}
}
async function handleAutomationCron(req,res){if(req.method!=='GET')return json(res,405,{ok:false,error:'method_not_allowed'});try{return json(res,200,{ok:true,...await runAutomation()});}catch(e){console.error('MPMV automation cron error',e);return json(res,500,{ok:false,error:e.message||'internal_error'});}}

async function handleClick(req,res){if(req.method!=='GET')return res.status(405).send('Method not allowed');const verified=validToken(req.query&&req.query.t),target=safeDestination(req.query&&req.query.to);if(!verified||!target)return res.status(400).send('Link inválido.');const campaign=clean(req.query&&req.query.c,100).replace(/[^a-zA-Z0-9_-]/g,'');addUtm(target,campaign);if(target.origin===SITE_ORIGIN&&!target.searchParams.has('utm_term'))target.searchParams.set('utm_term','lead_'+verified.token);if(clean(req.query&&req.query.a,30)==='mentoria'){try{await ensureAutomationSetup();const contact=await brevo('/contacts/'+encodeURIComponent(String(verified.id))+'?identifierType=contact_id');await updateContact(contact,{[AUTO_ATTR.click]:'yes',[AUTO_ATTR.clickAt]:new Date().toISOString()});}catch(e){console.error('automation click mark error',e);}}res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('Referrer-Policy','no-referrer');return res.redirect(302,target.toString());}
async function handleUnsubscribe(req,res){if(req.method!=='GET')return res.status(405).send('Method not allowed');const verified=validToken(req.query&&req.query.t);if(!verified)return res.status(400).send('Link inválido.');try{await ensureAutomationSetup();const contact=await brevo('/contacts/'+encodeURIComponent(String(verified.id))+'?identifierType=contact_id');await brevo('/contacts/'+encodeURIComponent(String(verified.id))+'?identifierType=contact_id',{method:'PUT',body:JSON.stringify({emailBlacklisted:true,attributes:{[AUTO_ATTR.stage]:'unsubscribed',[AUTO_ATTR.last]:new Date().toISOString()}})});return res.status(200).send('<!doctype html><meta charset="utf-8"><title>Inscrição cancelada</title><body style="font-family:Arial;padding:40px;max-width:620px;margin:auto"><h1>Inscrição cancelada</h1><p>Você não receberá novos e-mails de marketing da MPMV.</p></body>');}catch(e){return res.status(500).send('Não foi possível cancelar agora.');}}

module.exports={handleCampaigns,handleClick,handleUnsubscribe,handleAutomation,handleAutomationCron,runAutomation};