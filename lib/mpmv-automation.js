const crypto = require('crypto');

const BREVO_BASE='https://api.brevo.com/v3';
const SITE_ORIGIN='https://www.maispersuasaomaisvendas.com.br';
const CONFIG_PREFIX='MPMV AUTO CFG · ';
const CONTROL_EMAIL='automacao@maispersuasaomaisvendas.com.br';
const CLIENT_ATTR='MPMV_CLIENTE';
const LEGACY={enabled:'MPMV_AUTO_ENABLED',stage:'MPMV_AUTO_STAGE',last:'MPMV_AUTO_LAST',click:'MPMV_MENTORIA_CLICK',clickAt:'MPMV_MENTORIA_CLICK_AT'};

function apiKey(){return process.env.BREVO_API_KEY||process.env.BREVO_KEY||process.env.SENDINBLUE_API_KEY||''}
function clean(v,max=20000){return String(v==null?'':v).trim().slice(0,max)}
function emailOk(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(v,180))}
function slug(v){return clean(v,80).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,50)||`auto_${Date.now()}`}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function json(res,status,body){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(body)}
function authorized(req){const expected=process.env.LEADS_ADMIN_TOKEN||process.env.BLOG_ADMIN_TOKEN||'';const direct=String(req.headers['x-admin-token']||'');const auth=String(req.headers.authorization||'');const bearer=auth.toLowerCase().startsWith('bearer ')?auth.slice(7).trim():'';return !!expected&&(direct===expected||bearer===expected)}
async function brevo(path,options={}){const r=await fetch(BREVO_BASE+path,{...options,headers:{accept:'application/json','api-key':apiKey(),'content-type':'application/json',...(options.headers||{})}});const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch(_){data={raw:text}}if(!r.ok){const e=new Error((data&&data.message)||`brevo_${r.status}`);e.status=r.status;e.data=data;throw e}return data}
async function sender(){const d=await brevo('/senders');const s=(Array.isArray(d.senders)?d.senders:[]).find(x=>x&&x.email&&x.active!==false);if(!s)throw new Error('no_active_sender');return {email:String(s.email),name:String(s.name||'MPMV')}}
function token(id){const raw=String(id||'');const sig=crypto.createHmac('sha256',apiKey()).update('mpmv-email:'+raw).digest('hex').slice(0,24);return `${raw}.${sig}`}
function validToken(t){const m=clean(t,120).match(/^(\d+)\.([a-f0-9]{24})$/i);if(!m||!apiKey())return null;const expected=crypto.createHmac('sha256',apiKey()).update('mpmv-email:'+m[1]).digest('hex').slice(0,24);if(m[2].toLowerCase()!==expected.toLowerCase())return null;return Number(m[1])}
function safeUrl(raw){try{const u=new URL(clean(raw,1800),SITE_ORIGIN);const allowed=u.origin===SITE_ORIGIN||u.protocol==='https:';return allowed&&/^https?:$/.test(u.protocol)?u:null}catch(_){return null}}
function attrsFor(cfg){if(cfg.legacy)return {stage:LEGACY.stage,last:LEGACY.last,click:LEGACY.click,clickAt:LEGACY.clickAt};const k=crypto.createHash('sha1').update(cfg.id).digest('hex').slice(0,7).toUpperCase();return {stage:`MPMV_A_${k}_ST`,last:`MPMV_A_${k}_TS`,click:`MPMV_A_${k}_CK`,clickAt:`MPMV_A_${k}_CT`}}
function encodeConfig(cfg){return `<pre id="mpmv-config" style="display:none">${Buffer.from(JSON.stringify(cfg),'utf8').toString('base64')}</pre>`}
function decodeConfig(tpl){try{const html=String(tpl&&tpl.htmlContent||'');const m=html.match(/<pre id="mpmv-config"[^>]*>([^<]+)<\/pre>/i);if(!m)return null;const cfg=JSON.parse(Buffer.from(m[1],'base64').toString('utf8'));cfg.templateId=Number(tpl.id);return cfg}catch(_){return null}}

function defaultConfig(enabled=false){
  return {
    id:'mentoria',name:'Automação da mentoria',listId:Number(process.env.BREVO_LIST_ID||5)||5,enabled:!!enabled,legacy:true,stopOnClient:true,createdAt:new Date().toISOString(),
    steps:[
      {id:'guide',label:'Entrega do Guia',after:[],delayHours:0,condition:'always',subject:'Seu Guia Prático está aqui',preheader:'O material que você pediu já está liberado.',body:'{{nome}}, seu Guia Prático já está liberado.\n\nUse o material como uma ferramenta de consulta. Pegue uma ideia, aplique numa oferta, numa página ou num conteúdo e observe o que muda na resposta das pessoas.\n\nO melhor uso começa pela prática.',ctaLabel:'Abrir o Guia',ctaUrl:`${SITE_ORIGIN}/guia-pratico-persuasao-pra-vender-todo-santo-dia.pdf`},
      {id:'content',label:'Conteúdo de consciência',after:['guide'],delayHours:24,condition:'always',subject:'Uma pergunta antes de mexer na sua oferta',preheader:'Uma pergunta que ajuda a enxergar onde a venda pode estar travando.',body:'{{nome}}, antes de mexer em preço, anúncio ou página, olha para uma pergunta simples:\n\nSeu cliente consegue enxergar o que muda para ele depois da compra?\n\nMuita oferta explica bem o produto e deixa essa consequência escondida. Quando isso acontece, a pessoa entende o que você vende, mas ainda precisa fazer esforço para entender por que deveria querer aquilo.\n\nNo Guia, esse é um dos pontos que vale revisar com calma.',ctaLabel:'Revisar o Guia',ctaUrl:`${SITE_ORIGIN}/guia-pratico-persuasao-pra-vender-todo-santo-dia.pdf`},
      {id:'mentoria',label:'Convite para mentoria',after:['content'],delayHours:48,condition:'always',subject:'Quer montar sua estratégia de persuasão comigo?',preheader:'Quero te apresentar como funciona a mentoria da MPMV.',body:'{{nome}}, quero te apresentar uma forma de levar esse trabalho para dentro do seu negócio.\n\nEu tenho uma mentoria de persuasão e vendas em que analiso com você sua oferta, mensagem, conteúdo, páginas e os pontos em que a decisão do cliente pode estar travando.\n\nA gente parte do que já existe na sua operação, define prioridades e transforma o diagnóstico em ações de copy e persuasão.\n\nSe quiser conhecer a proposta, os detalhes estão na página.',ctaLabel:'Conhecer a mentoria',ctaUrl:`${SITE_ORIGIN}/mentoria/`},
      {id:'interest1',label:'Interesse · prova e processo',after:['mentoria','reinforce'],delayHours:24,condition:'clicked',conditionStep:'mentoria',subject:'O que eu olho primeiro dentro de uma operação',preheader:'Você abriu a página da mentoria. Então vale mostrar o processo.',body:'{{nome}}, você abriu a página da mentoria. Então quero te mostrar uma parte do processo que costuma acontecer antes de qualquer mudança de copy.\n\nEu começo procurando onde a decisão do cliente perde força: promessa, oferta, prova, página, anúncio, sequência de conteúdo e o caminho entre o clique e a compra.\n\nDepois disso vem a ordem de ataque. A ideia é evitar mexer em dez coisas ao mesmo tempo e concentrar esforço no ponto com maior chance de impacto.\n\nSe quiser ver como esse acompanhamento funciona, a página está aqui.',ctaLabel:'Ver a mentoria',ctaUrl:`${SITE_ORIGIN}/mentoria/`},
      {id:'interest2',label:'Interesse · objeção e próximo passo',after:['interest1'],delayHours:48,condition:'always',subject:'Se você quiser meu olhar na sua estratégia',preheader:'O próximo passo é colocar sua operação na mesa.',body:'{{nome}}, se você ainda está considerando a mentoria, o próximo passo é simples: colocar sua operação na mesa.\n\nEu preciso entender o que você vende, como atrai pessoas, onde elas entram, o que recebem e em qual ponto a venda perde força.\n\nA partir daí, a mentoria vira trabalho em cima do seu cenário, com diagnóstico, prioridade e copy.\n\nSe quiser avançar, os detalhes estão na página.',ctaLabel:'Quero conhecer a mentoria',ctaUrl:`${SITE_ORIGIN}/mentoria/`},
      {id:'reinforce',label:'Reforço sem clique',after:['mentoria'],delayHours:48,exitAfterHours:48,condition:'not_clicked',conditionStep:'mentoria',subject:'Uma pergunta antes de deixar isso para depois',preheader:'Talvez valha olhar a mentoria por outro ângulo.',body:'{{nome}}, talvez sua operação já esteja vendendo. A pergunta é quanto resultado pode estar ficando pelo caminho em páginas, anúncios, ofertas ou mensagens que ainda exigem esforço demais do cliente.\n\nNa mentoria, eu procuro esses pontos com você e transformo o diagnóstico em prioridade de ação.\n\nSe quiser entender como funciona, a página continua disponível.',ctaLabel:'Ver como funciona a mentoria',ctaUrl:`${SITE_ORIGIN}/mentoria/`}
    ]
  }
}
async function templates(){const d=await brevo('/smtp/templates?limit=100&offset=0&sort=desc');return Array.isArray(d.templates)?d.templates:[]}
async function configs(){const all=(await templates()).filter(t=>String(t.name||t.templateName||'').startsWith(CONFIG_PREFIX)),out=[];for(const item of all){let tpl=item;if(!tpl.htmlContent&&item.id){try{tpl=await brevo('/smtp/templates/'+item.id)}catch(_){tpl=item}}const cfg=decodeConfig(tpl);if(cfg)out.push(cfg)}return out}
async function legacyEnabled(){
  try{
    const d=await brevo('/contacts/attributes');
    const have=new Set((Array.isArray(d.attributes)?d.attributes:[]).map(a=>String(a&&a.name||'').toUpperCase()));
    if(!have.has(LEGACY.enabled))return false;
    const c=await brevo('/contacts/'+encodeURIComponent(CONTROL_EMAIL));
    return ['yes','sim','true','1'].includes(String(c.attributes&&c.attributes[LEGACY.enabled]||'').toLowerCase());
  }catch(_){return false}
}
async function ensureDefault(){let cs=await configs();if(cs.some(c=>c.id==='mentoria'))return cs;await saveConfig(defaultConfig(await legacyEnabled()));return configs()}
async function ensureAttrs(cfg){const want=[CLIENT_ATTR,...Object.values(attrsFor(cfg))];const d=await brevo('/contacts/attributes');const have=new Set((Array.isArray(d.attributes)?d.attributes:[]).map(a=>String(a&&a.name||'').toUpperCase()));for(const n of want){if(have.has(n))continue;try{await brevo('/contacts/attributes/normal/'+n,{method:'POST',body:JSON.stringify({type:'text'})})}catch(e){if(e.status!==400)throw e}}}
async function saveConfig(raw){
  const cfg=sanitizeConfig(raw);await ensureAttrs(cfg);const s=await sender();const payload={templateName:CONFIG_PREFIX+cfg.id,subject:`Config · ${cfg.name}`,sender:s,htmlContent:encodeConfig(cfg),isActive:false};
  if(cfg.templateId){await brevo('/smtp/templates/'+cfg.templateId,{method:'PUT',body:JSON.stringify(payload)});return {...cfg,templateId:cfg.templateId}}
  const d=await brevo('/smtp/templates',{method:'POST',body:JSON.stringify(payload)});return {...cfg,templateId:Number(d.id)}
}
function sanitizeStep(s,i,seen){
  let id=slug(s.id||s.label||`etapa_${i+1}`);if(seen.has(id))id=`${id}_${i+1}`;seen.add(id);
  const after=Array.isArray(s.after)?s.after.map(x=>slug(x)).filter(Boolean):[];const condition=['always','clicked','not_clicked'].includes(s.condition)?s.condition:'always';const u=safeUrl(s.ctaUrl)||new URL(SITE_ORIGIN);
  return {id,label:clean(s.label,100)||`Etapa ${i+1}`,after,delayHours:Math.max(0,Number(s.delayHours)||0),exitAfterHours:Math.max(0,Number(s.exitAfterHours)||0),condition,conditionStep:condition==='always'?'':slug(s.conditionStep||''),subject:clean(s.subject,180),preheader:clean(s.preheader,180),body:clean(s.body,20000),ctaLabel:clean(s.ctaLabel,80)||'Saiba mais',ctaUrl:u.toString()}
}
function sanitizeConfig(raw){
  const id=slug(raw.id||raw.name),seen=new Set();const steps=(Array.isArray(raw.steps)?raw.steps:[]).slice(0,30).map((s,i)=>sanitizeStep(s,i,seen));
  if(!steps.length)steps.push(sanitizeStep({id:'email_1',label:'E-mail 1',subject:'Assunto do e-mail',body:'Escreva aqui o conteúdo do e-mail.',ctaLabel:'Saiba mais',ctaUrl:SITE_ORIGIN,delayHours:0,condition:'always',after:[]},0,seen));
  const ids=new Set(steps.map(s=>s.id));steps.forEach((s,i)=>{s.after=s.after.filter(x=>ids.has(x)&&x!==s.id);if(i>0&&!s.after.length)s.after=[steps[i-1].id];if(s.condition!=='always'&&!ids.has(s.conditionStep))s.conditionStep=s.after[0]||''});
  return {id,name:clean(raw.name,120)||id,listId:Math.max(1,Number(raw.listId)||Number(process.env.BREVO_LIST_ID||5)||5),enabled:!!raw.enabled,legacy:!!raw.legacy,stopOnClient:!!raw.stopOnClient,createdAt:raw.createdAt||new Date().toISOString(),templateId:Number(raw.templateId)||undefined,steps}
}
async function getConfig(id){const cs=await ensureDefault();return cs.find(c=>c.id===slug(id))}
async function contactsFor(cfg){const d=await brevo(`/contacts/lists/${cfg.listId}/contacts?limit=500&offset=0&sort=desc`);return Array.isArray(d.contacts)?d.contacts:[]}
function nameOf(c){const a=c.attributes||{};return clean(a.NOME||a.NAME||[a.FIRSTNAME||a.FIRST_NAME||'',a.LASTNAME||a.LAST_NAME||''].filter(Boolean).join(' '),120)||'Olá'}
function fill(text,c){return String(text||'').replace(/\{\{\s*nome\s*\}\}/gi,nameOf(c))}
function renderHtml(cfg,step,c,test){
  const target=safeUrl(step.ctaUrl)||new URL(SITE_ORIGIN);let href=target.toString();
  if(test){target.searchParams.set('utm_source','email_test');target.searchParams.set('utm_medium','email');target.searchParams.set('utm_campaign','automacao_'+cfg.id);target.searchParams.set('utm_content',step.id);href=target.toString()}
  else href=`${SITE_ORIGIN}/api/guia?action=automation-click&t=${encodeURIComponent(token(c.id))}&aid=${encodeURIComponent(cfg.id)}&sid=${encodeURIComponent(step.id)}`;
  const body=fill(step.body,c).split(/\n{2,}/).map(p=>p.trim()).filter(Boolean).map(p=>`<p style="margin:0 0 18px;line-height:1.65;color:#17202a;font-size:16px">${esc(p).replace(/\n/g,'<br>')}</p>`).join('');
  const unsub=test?'#':`${SITE_ORIGIN}/api/guia?action=email-unsubscribe&t=${encodeURIComponent(token(c.id))}`;return `<!doctype html><html><body style="margin:0;background:#f3f6f8;font-family:Arial,Helvetica,sans-serif;color:#17202a"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(fill(step.preheader,c))}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6f8;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border:1px solid #dfe7ec;border-radius:14px"><tr><td style="padding:28px 30px 10px;color:#0d6f9f;font-weight:800">MPMV</td></tr><tr><td style="padding:10px 30px 28px">${body}<p style="margin:28px 0 8px"><a href="${href}" style="display:inline-block;background:#0d6f9f;color:#fff;text-decoration:none;font-weight:800;padding:14px 20px;border-radius:9px">${esc(step.ctaLabel)}</a></p></td></tr><tr><td style="border-top:1px solid #e8eef2;padding:18px 30px;color:#73808c;font-size:12px">Recebeu este e-mail por fazer parte da base MPMV.${test?'':' <a href="'+unsub+'" style="color:#52606b">Cancelar inscrição</a>.'}</td></tr></table></td></tr></table></body></html>`
}
async function sendStep(cfg,c,step,testEmail){const from=await sender();const to=testEmail?clean(testEmail,180).toLowerCase():clean(c.email,180).toLowerCase();if(!emailOk(to))throw new Error('invalid_recipient');return brevo('/smtp/email',{method:'POST',body:JSON.stringify({sender:from,to:[{email:to,name:testEmail?'Teste MPMV':nameOf(c)}],subject:fill(step.subject,c),htmlContent:renderHtml(cfg,step,c,!!testEmail)})})}
function hours(v){const t=Date.parse(String(v||''));return Number.isFinite(t)?(Date.now()-t)/3600000:999999}
function clickSet(v,cfg){const set=new Set(clean(v,500).split(',').map(x=>x.trim()).filter(Boolean));if(cfg&&cfg.legacy&&set.has('yes')){set.delete('yes');set.add('mentoria')}return set}
function conditionOk(step,clicks){if(step.condition==='always')return true;const hit=clicks.has(step.conditionStep);return step.condition==='clicked'?hit:!hit}
function delayReady(step,last,clickAt){if(step.condition==='clicked')return hours(clickAt)>=step.delayHours;return hours(last)>=step.delayHours}
async function updateContact(c,attributes){return brevo('/contacts/'+encodeURIComponent(String(c.id))+'?identifierType=contact_id',{method:'PUT',body:JSON.stringify({attributes})})}
async function processOne(cfg,c){
  if(!c||!Number(c.id)||!emailOk(c.email)||c.emailBlacklisted||((c.listUnsubscribed||[]).includes(cfg.listId)))return'skip';
  const at=attrsFor(cfg),a=c.attributes||{};if(cfg.stopOnClient&&['yes','sim','true','1'].includes(String(a[CLIENT_ATTR]||'').toLowerCase()))return'client';
  let stage=String(a[at.stage]||'');if(cfg.legacy&&stage.endsWith('_sent'))stage=stage.slice(0,-5);const last=a[at.last],clicks=clickSet(a[at.click],cfg);
  if(!stage){const root=cfg.steps.find(s=>!s.after.length);if(!root)return'waiting';await sendStep(cfg,c,root);await updateContact(c,{[at.stage]:root.id,[at.last]:new Date().toISOString()});return root.id}
  if(stage==='done'||stage==='client')return stage;
  const candidates=cfg.steps.filter(s=>s.after.includes(stage));const ready=candidates.find(s=>conditionOk(s,clicks)&&delayReady(s,last,a[at.clickAt]));
  if(ready){await sendStep(cfg,c,ready);await updateContact(c,{[at.stage]:ready.id,[at.last]:new Date().toISOString()});return ready.id}
  const current=cfg.steps.find(s=>s.id===stage);if(current&&current.exitAfterHours>0&&hours(last)>=current.exitAfterHours){await updateContact(c,{[at.stage]:'done',[at.last]:new Date().toISOString()});return'done'}if(candidates.length)return'waiting';await updateContact(c,{[at.stage]:'done',[at.last]:new Date().toISOString()});return'done'
}
async function migrateLegacyOnEnable(cfg){
  if(!cfg.legacy)return 0;const at=attrsFor(cfg),cs=await contactsFor(cfg);let migrated=0;
  for(const c of cs){const a=c.attributes||{};if(String(a[at.stage]||'').trim())continue;const age=hours(c.createdAt)/24;let stage='done',last=new Date().toISOString();
    if(age<1){stage='guide';last=c.createdAt||last}else if(age<3){stage='content';last=c.createdAt||last}
    await updateContact(c,{[at.stage]:stage,[at.last]:last,[at.click]:a[at.click]||'',[at.clickAt]:a[at.clickAt]||''});migrated++;
  }return migrated
}
async function runConfig(cfg){if(!cfg.enabled)return{automation:cfg.id,enabled:false,processed:0,sent:0,events:[]};await ensureAttrs(cfg);const cs=await contactsFor(cfg);let sent=0;const events=[];for(const c of cs){try{const r=await processOne(cfg,c);if(cfg.steps.some(s=>s.id===r))sent++;if(!['waiting','skip'].includes(r))events.push({email:c.email,result:r})}catch(e){events.push({email:c.email,result:'error',error:e.message})}}return{automation:cfg.id,enabled:true,processed:cs.length,sent,events:events.slice(0,40)}}
async function summaries(cs){const out=[];for(const cfg of cs){await ensureAttrs(cfg);const at=attrsFor(cfg),contacts=await contactsFor(cfg);out.push({id:cfg.id,name:cfg.name,listId:cfg.listId,enabled:cfg.enabled,legacy:cfg.legacy,stopOnClient:cfg.stopOnClient,createdAt:cfg.createdAt,templateId:cfg.templateId,steps:cfg.steps,stats:{total:contacts.length,waiting:contacts.filter(c=>{const s=String((c.attributes||{})[at.stage]||'');return s&&s!=='done'&&s!=='client'}).length,clicked:contacts.filter(c=>clean((c.attributes||{})[at.click],500)).length,clients:cfg.stopOnClient?contacts.filter(c=>['yes','sim','true','1'].includes(String((c.attributes||{})[CLIENT_ATTR]||'').toLowerCase())).length:0}})}return out}

async function handleAutomation(req,res){
  if(!authorized(req))return json(res,401,{ok:false,error:'unauthorized'});if(!apiKey())return json(res,503,{ok:false,error:'brevo_not_configured'});
  try{
    if(req.method==='GET'){const cs=await ensureDefault();return json(res,200,{ok:true,automations:await summaries(cs)})}
    if(req.method!=='POST')return json(res,405,{ok:false,error:'method_not_allowed'});
    const body=typeof req.body==='string'?JSON.parse(req.body):(req.body||{}),action=clean(body.action,40);
    if(action==='create'){const starterSteps=Array.isArray(body.steps)&&body.steps.length?body.steps:[{id:'email_1',label:'E-mail 1',after:[],delayHours:0,condition:'always',subject:'',preheader:'',body:'{{nome}}, escreva aqui o primeiro e-mail da automação.',ctaLabel:'Saiba mais',ctaUrl:SITE_ORIGIN}];const cfg=sanitizeConfig({name:body.name,id:body.id,listId:body.listId,enabled:false,stopOnClient:!!body.stopOnClient,steps:starterSteps});const all=await ensureDefault();if(all.some(x=>x.id===cfg.id))return json(res,409,{ok:false,error:'automation_already_exists'});return json(res,200,{ok:true,automation:await saveConfig(cfg)})}
    if(action==='save'){const existing=await getConfig(body.automation&&body.automation.id);if(!existing)return json(res,404,{ok:false,error:'automation_not_found'});const cfg=sanitizeConfig({...existing,...body.automation,templateId:existing.templateId,legacy:existing.legacy});return json(res,200,{ok:true,automation:await saveConfig(cfg)})}
    if(action==='toggle'){const cfg=await getConfig(body.id);if(!cfg)return json(res,404,{ok:false,error:'automation_not_found'});const turningOn=!!body.enabled&&!cfg.enabled;let migrated=0;if(turningOn)migrated=await migrateLegacyOnEnable(cfg);cfg.enabled=!!body.enabled;return json(res,200,{ok:true,migrated,automation:await saveConfig(cfg)})}
    if(action==='test'){const cfg=await getConfig(body.id),email=clean(body.testEmail,180);if(!cfg)return json(res,404,{ok:false,error:'automation_not_found'});if(!emailOk(email))return json(res,400,{ok:false,error:'invalid_test_email'});const step=cfg.steps.find(s=>s.id===slug(body.stepId));if(!step)return json(res,404,{ok:false,error:'step_not_found'});const d=await sendStep(cfg,{id:0,email,attributes:{FIRSTNAME:'Teste'}},step,email);return json(res,200,{ok:true,messageId:d.messageId||'',stepId:step.id})}
    if(action==='run'){if(body.id){const cfg=await getConfig(body.id);if(!cfg)return json(res,404,{ok:false,error:'automation_not_found'});return json(res,200,{ok:true,...await runConfig(cfg)})}const all=await ensureDefault(),runs=[];for(const cfg of all)runs.push(await runConfig(cfg));return json(res,200,{ok:true,runs})}
    if(action==='reset'){const cfg=await getConfig(body.id);if(!cfg)return json(res,404,{ok:false,error:'automation_not_found'});const c=await brevo('/contacts/'+encodeURIComponent(clean(body.email,180).toLowerCase())),at=attrsFor(cfg);await updateContact(c,{[at.stage]:'',[at.last]:'',[at.click]:'',[at.clickAt]:''});return json(res,200,{ok:true})}
    if(action==='mark-client'){const c=await brevo('/contacts/'+encodeURIComponent(clean(body.email,180).toLowerCase()));await updateContact(c,{[CLIENT_ATTR]:body.client?'yes':'no'});return json(res,200,{ok:true})}
    return json(res,400,{ok:false,error:'invalid_action'})
  }catch(e){console.error('MPMV automation error',e);return json(res,e.status&&e.status<600?e.status:500,{ok:false,error:e.message||'internal_error',details:e.data||undefined})}
}
async function handleAutomationClick(req,res){
  try{
    const id=validToken(req.query&&req.query.t),aid=slug(req.query&&req.query.aid),sid=slug(req.query&&req.query.sid);
    if(!id)return res.status(400).send('Link inválido.');const cfg=await getConfig(aid);if(!cfg)return res.status(404).send('Automação não encontrada.');const step=cfg.steps.find(s=>s.id===sid),target=step&&safeUrl(step.ctaUrl);if(!step||!target)return res.status(400).send('Destino inválido.');
    const c=await brevo('/contacts/'+id+'?identifierType=contact_id'),at=attrsFor(cfg),clicks=clickSet((c.attributes||{})[at.click],cfg);clicks.add(sid);await updateContact(c,{[at.click]:Array.from(clicks).join(','),[at.clickAt]:new Date().toISOString()});
    if(!target.searchParams.has('utm_source'))target.searchParams.set('utm_source','email');if(!target.searchParams.has('utm_medium'))target.searchParams.set('utm_medium','email');if(!target.searchParams.has('utm_campaign'))target.searchParams.set('utm_campaign','automacao_'+cfg.id);if(!target.searchParams.has('utm_content'))target.searchParams.set('utm_content',sid);
    res.setHeader('Location',target.toString());return res.status(302).end()
  }catch(e){console.error('MPMV automation click error',e);return res.status(500).send('Não foi possível abrir o link.')}
}
async function handleAutomationCron(req,res){if(req.method!=='GET')return json(res,405,{ok:false,error:'method_not_allowed'});try{const all=await ensureDefault(),runs=[];for(const cfg of all.filter(x=>x.enabled))runs.push(await runConfig(cfg));return json(res,200,{ok:true,runs})}catch(e){console.error('MPMV automation cron error',e);return json(res,500,{ok:false,error:e.message||'internal_error'})}}

module.exports={handleAutomation,handleAutomationClick,handleAutomationCron};
