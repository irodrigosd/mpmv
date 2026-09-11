const { handleAutomation, handleAutomationClick } = require('./mpmv-automation');

const BREVO='https://api.brevo.com/v3';
const PREFIX='MPMV AUTO CFG · ';
const key=()=>process.env.BREVO_API_KEY||process.env.BREVO_KEY||process.env.SENDINBLUE_API_KEY||'';
async function b(path, options={}){const r=await fetch(BREVO+path,{...options,headers:{accept:'application/json','api-key':key(),'content-type':'application/json',...(options.headers||{})}});const t=await r.text();let d={};try{d=t?JSON.parse(t):{}}catch{}if(!r.ok)throw new Error(d.message||`brevo_${r.status}`);return d;}
function decode(t){try{const m=String(t.htmlContent||'').match(/<pre id="mpmv-config"[^>]*>([^<]+)<\/pre>/i);if(!m)return null;const c=JSON.parse(Buffer.from(m[1],'base64').toString('utf8'));c.templateId=Number(t.id);return c;}catch{return null}}
function encode(c){return `<pre id="mpmv-config" style="display:none">${Buffer.from(JSON.stringify(c),'utf8').toString('base64')}</pre>`}
async function repairConfig(){const d=await b('/smtp/templates?limit=100&offset=0&sort=desc');for(const x of (d.templates||[])){if(!String(x.name||x.templateName||'').startsWith(PREFIX))continue;const t=x.htmlContent?x:await b('/smtp/templates/'+x.id);const c=decode(t);if(!c||c.id!=='mentoria')continue;const r=c.steps.findIndex(s=>s.id==='reinforce'),i=c.steps.findIndex(s=>s.id==='interest1');if(r>=0&&i>=0&&r>i){const [s]=c.steps.splice(r,1);c.steps.splice(i,0,s);await b('/smtp/templates/'+c.templateId,{method:'PUT',body:JSON.stringify({templateName:PREFIX+c.id,subject:`Config · ${c.name}`,sender:t.sender,htmlContent:encode(c),isActive:false})});}break;}}
async function handleAutomationCron(req,res){try{await repairConfig();const original=require('./mpmv-automation').handleAutomationCron;return original(req,res);}catch(e){return res.status(500).json({ok:false,error:e.message||'internal_error'})}}
module.exports={handleAutomation,handleAutomationClick,handleAutomationCron};
