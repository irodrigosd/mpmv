const crypto=require('crypto');

const CLIENT_EMAIL=process.env.GSC_CLIENT_EMAIL||'';
const PRIVATE_KEY=(process.env.GSC_PRIVATE_KEY||'').replace(/\\n/g,'\n');

function b64url(input){return Buffer.from(input).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}

async function accessToken(){
  if(!CLIENT_EMAIL||!PRIVATE_KEY) throw new Error('search_console_not_configured');
  const now=Math.floor(Date.now()/1000);
  const header=b64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const payload=b64url(JSON.stringify({iss:CLIENT_EMAIL,scope:'https://www.googleapis.com/auth/webmasters.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+300}));
  const unsigned=header+'.'+payload;
  const sign=crypto.createSign('RSA-SHA256');sign.update(unsigned);sign.end();
  const sig=sign.sign(PRIVATE_KEY).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+sig})});
  const data=await r.json();
  if(!r.ok||!data.access_token) throw new Error('google_auth_failed');
  return data.access_token;
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    const token=await accessToken();
    const r=await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites',{headers:{Authorization:'Bearer '+token}});
    const data=await r.json();
    if(!r.ok) return res.status(r.status).json({ok:false,error:'sites_list_failed'});
    const entries=(data.siteEntry||[]).filter(x=>/instagram|sc-platform/i.test(String(x.siteUrl||''))).map(x=>({siteUrl:x.siteUrl,permissionLevel:x.permissionLevel}));
    return res.status(200).json({ok:true,count:entries.length,entries});
  }catch(e){return res.status(500).json({ok:false,error:e.message||'diagnostic_failed'});}
};
