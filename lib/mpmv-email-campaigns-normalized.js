const { handleCampaigns: baseHandleCampaigns } = require('./mpmv-email-campaigns');

function attachLooseLinks(text){
  const lines=String(text||'').split('\n');
  for(let i=0;i<lines.length;i++){
    const url=lines[i].trim();
    if(!/^https?:\/\/\S+$/i.test(url))continue;
    let j=i-1;
    while(j>=0&&!lines[j].trim())j--;
    if(j<0)continue;
    const label=lines[j].trim();
    if(!label||/^\[[^\]]+\]\(https?:\/\//i.test(label))continue;
    lines[j]=lines[j].replace(label,`[${label}](${url})`);
    lines[i]='';
  }
  return lines.join('\n').replace(/\n{3,}/g,'\n\n');
}

async function handleCampaigns(req,res){
  if(req.method==='POST'&&req.body){
    try{
      if(typeof req.body==='string'){
        const parsed=JSON.parse(req.body);
        if(parsed&&typeof parsed.body==='string')parsed.body=attachLooseLinks(parsed.body);
        req.body=JSON.stringify(parsed);
      }else if(typeof req.body==='object'&&typeof req.body.body==='string'){
        req.body={...req.body,body:attachLooseLinks(req.body.body)};
      }
    }catch(_){/* base handler returns the normal validation error */}
  }
  return baseHandleCampaigns(req,res);
}

module.exports={handleCampaigns};
