const BASE='https://api.brevo.com/v3';
const SOURCE_LIST_ID=Number(process.env.BREVO_LIST_ID||5);
const AULA_LIST_NAME='MPMV — Aula ao Vivo 17/09';
const AULA_FOLDER_NAME='MPMV — Aulas';

function key(){return process.env.BREVO_API_KEY||process.env.BREVO_KEY||process.env.SENDINBLUE_API_KEY||''}
function json(res,status,body){res.setHeader('Cache-Control','no-store, max-age=0');return res.status(status).json(body)}
function auth(req){const expected=process.env.LEADS_ADMIN_TOKEN||'';if(!expected)return false;const direct=String(req.headers['x-admin-token']||'');const h=String(req.headers.authorization||'');const bearer=h.toLowerCase().startsWith('bearer ')?h.slice(7).trim():'';return direct===expected||bearer===expected}
async function brevo(path,opt={}){const r=await fetch(BASE+path,{...opt,headers:{accept:'application/json','api-key':key(),'content-type':'application/json',...(opt.headers||{})}});const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{}if(!r.ok){const e=new Error(data.message||`brevo_${r.status}`);e.status=r.status;e.data=data;throw e}return data}
async function ensureList(){
  const forced=Number(process.env.BREVO_AULA_LIST_ID||0);
  if(forced>0)return forced;
  const lists=await brevo('/contacts/lists?limit=50&offset=0&sort=desc');
  const existing=(lists.lists||[]).find(x=>String(x.name||'').trim()===AULA_LIST_NAME);
  if(existing?.id)return Number(existing.id);
  const folders=await brevo('/contacts/folders?limit=50&offset=0&sort=desc');
  let folder=(folders.folders||[]).find(x=>String(x.name||'').trim()===AULA_FOLDER_NAME);
  if(!folder){folder=await brevo('/contacts/folders',{method:'POST',body:JSON.stringify({name:AULA_FOLDER_NAME})})}
  const created=await brevo('/contacts/lists',{method:'POST',body:JSON.stringify({folderId:Number(folder.id),name:AULA_LIST_NAME})});
  return Number(created.id);
}
async function sourceContacts(){
  const all=[];let offset=0;const limit=500;
  for(let page=0;page<10;page++){
    const d=await brevo(`/contacts/lists/${SOURCE_LIST_ID}/contacts?limit=${limit}&offset=${offset}&sort=desc`);
    const cs=Array.isArray(d.contacts)?d.contacts:[];all.push(...cs);offset+=cs.length;
    if(!cs.length||offset>=Number(d.count||0)||cs.length<limit)break;
  }
  return all.filter(c=>c&&c.email&&c.attributes&&c.attributes.MPMV_A17_REG);
}
async function sync(aulaListId){
  const cs=await sourceContacts();
  const emails=[...new Set(cs.map(c=>String(c.email).trim().toLowerCase()).filter(Boolean))];
  for(let i=0;i<emails.length;i+=100){
    const batch=emails.slice(i,i+100);
    if(batch.length)await brevo(`/contacts/lists/${aulaListId}/contacts/add`,{method:'POST',body:JSON.stringify({emails:batch})});
  }
  return {sourceCount:cs.length,emailCount:emails.length};
}
async function aulaContacts(listId){
  const all=[];let offset=0;const limit=500;
  for(let page=0;page<10;page++){
    const d=await brevo(`/contacts/lists/${listId}/contacts?limit=${limit}&offset=${offset}&sort=desc`);
    const cs=Array.isArray(d.contacts)?d.contacts:[];all.push(...cs);offset+=cs.length;
    if(!cs.length||offset>=Number(d.count||0)||cs.length<limit)break;
  }
  return all.map(c=>{const a=c.attributes||{};return {id:c.id,name:String(a.FIRSTNAME||a.NOME||'').trim(),email:c.email||'',createdAt:c.createdAt||'',modifiedAt:c.modifiedAt||'',status:c.emailBlacklisted?'Bloqueado':'Ativo',stage:String(a.MPMV_A17_ST||'welcome'),registeredAt:String(a.MPMV_A17_REG||'')};});
}
module.exports=async function(req,res){
  if(!key())return json(res,503,{ok:false,error:'brevo_not_configured'});
  if(req.method!=='GET')return json(res,405,{ok:false,error:'method_not_allowed'});
  if(!auth(req))return json(res,401,{ok:false,error:'unauthorized'});
  try{const listId=await ensureList();const syncInfo=await sync(listId);const contacts=await aulaContacts(listId);return json(res,200,{ok:true,listId,listName:AULA_LIST_NAME,contacts,count:contacts.length,sync:syncInfo});}
  catch(e){console.error('Leads aula error',e);return json(res,e.status&&e.status<600?e.status:500,{ok:false,error:e.message||'internal_error'});}
};
