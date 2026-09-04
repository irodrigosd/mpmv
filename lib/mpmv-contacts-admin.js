const BREVO_BASE='https://api.brevo.com/v3';

function apiKey(){return process.env.BREVO_API_KEY||process.env.BREVO_KEY||process.env.SENDINBLUE_API_KEY||''}
function clean(v,max=500){return String(v==null?'':v).trim().slice(0,max)}
function emailOk(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(v,180))}
function authorized(req){const expected=process.env.LEADS_ADMIN_TOKEN||process.env.BLOG_ADMIN_TOKEN||'';const direct=String(req.headers['x-admin-token']||'');const auth=String(req.headers.authorization||'');const bearer=auth.toLowerCase().startsWith('bearer ')?auth.slice(7).trim():'';return !!expected&&(direct===expected||bearer===expected)}
function json(res,status,body){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(body)}
async function brevo(path,options={}){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const r=await fetch(BREVO_BASE+path,{...options,signal:controller.signal,headers:{accept:'application/json','api-key':apiKey(),'content-type':'application/json',...(options.headers||{})}});
    const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch(_){data={raw:text}}
    if(!r.ok){const e=new Error((data&&data.message)||`brevo_${r.status}`);e.status=r.status;e.data=data;throw e}
    return data;
  }catch(e){if(e&&e.name==='AbortError'){const err=new Error('brevo_timeout');err.status=504;throw err}throw e}
  finally{clearTimeout(timer)}
}
function contactName(c){const a=c&&c.attributes||{};return clean(a.NOME||a.NAME||[a.FIRSTNAME||a.FIRST_NAME||'',a.LASTNAME||a.LAST_NAME||''].filter(Boolean).join(' '),160)}
async function listContacts(listId){let offset=0,all=[];while(offset<5000){const d=await brevo(`/contacts/lists/${listId}/contacts?limit=500&offset=${offset}&sort=desc`);const batch=Array.isArray(d.contacts)?d.contacts:[];all=all.concat(batch);if(batch.length<500)break;offset+=500}return all.map(c=>({id:Number(c.id)||0,email:String(c.email||''),name:contactName(c),createdAt:c.createdAt||'',modifiedAt:c.modifiedAt||'',emailBlacklisted:!!c.emailBlacklisted,listUnsubscribed:Array.isArray(c.listUnsubscribed)?c.listUnsubscribed:[]}))}
async function removeFromList(listId,emails){const valid=emails.map(x=>clean(x,180).toLowerCase()).filter(emailOk);if(!valid.length)throw new Error('no_valid_emails');return brevo(`/contacts/lists/${listId}/contacts/remove`,{method:'DELETE',body:JSON.stringify({emails:valid})})}
async function deleteContact(email){const e=clean(email,180).toLowerCase();if(!emailOk(e))throw new Error('invalid_email');await brevo('/contacts/'+encodeURIComponent(e),{method:'DELETE'});return true}
async function handleContactsAdmin(req,res){
  if(!authorized(req))return json(res,401,{ok:false,error:'unauthorized'});
  if(!apiKey())return json(res,503,{ok:false,error:'brevo_not_configured'});
  try{
    const listId=Math.max(1,Number((req.query&&req.query.listId)||5)||5);
    if(req.method==='GET')return json(res,200,{ok:true,listId,contacts:await listContacts(listId)});
    if(req.method!=='POST')return json(res,405,{ok:false,error:'method_not_allowed'});
    const body=typeof req.body==='string'?JSON.parse(req.body):(req.body||{});const action=clean(body.action,40);const effectiveList=Math.max(1,Number(body.listId||listId)||5);
    if(action==='remove-list'){const emails=Array.isArray(body.emails)?body.emails:[body.email];await removeFromList(effectiveList,emails);return json(res,200,{ok:true,removed:emails.length,listId:effectiveList})}
    if(action==='delete-contact'){await deleteContact(body.email);return json(res,200,{ok:true,deleted:1})}
    if(action==='delete-many'){const emails=(Array.isArray(body.emails)?body.emails:[]).map(x=>clean(x,180).toLowerCase()).filter(emailOk);let deleted=0,failed=[];for(const email of emails){try{await deleteContact(email);deleted++}catch(e){failed.push({email,error:e.message})}}return json(res,failed.length?207:200,{ok:failed.length===0,deleted,failed})}
    return json(res,400,{ok:false,error:'invalid_action'});
  }catch(e){console.error('MPMV contacts admin error',e);return json(res,e.status&&e.status<600?e.status:500,{ok:false,error:e.message||'internal_error',details:e.data||undefined})}
}
module.exports={handleContactsAdmin};
