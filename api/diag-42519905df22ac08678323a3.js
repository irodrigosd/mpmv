module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET') return res.status(405).json({ok:false,error:'method_not_allowed'});
  const base='https://www.maispersuasaomaisvendas.com.br';
  const admin=String(process.env.LEADS_ADMIN_TOKEN||process.env.BLOG_ADMIN_TOKEN||'');
  const hottok=String(process.env.HOTMART_HOTTOK||'');
  const out={ok:true,hotmartConfigured:!!hottok,adminConfigured:!!admin,gscConfigured:!!String(process.env.GSC_CLIENT_EMAIL||'')&&!!String(process.env.GSC_PRIVATE_KEY||'')};
  try{
    if(hottok){
      const r=await fetch(base+'/api/hotmart-webhook',{method:'POST',headers:{'content-type':'application/json','x-hotmart-hottok':hottok},body:JSON.stringify({id:'diag-'+Date.now(),event:'PING',version:'2.0.0',creation_date:Date.now(),data:{purchase:{transaction:'diag-'+Date.now()}}})});
      out.hotmartTest={status:r.status,body:await r.json().catch(()=>({}))};
    }
  }catch(e){out.hotmartTest={error:e.message};}
  try{
    if(admin){
      const r=await fetch(base+'/api/search-console?days=30',{headers:{'x-admin-token':admin}});
      out.searchConsoleStatus=r.status;
      out.searchConsole=await r.json().catch(()=>({}));
      const p=await fetch(base+'/api/purchases?days=30',{headers:{'x-admin-token':admin}});
      out.purchasesStatus=p.status;
      const pd=await p.json().catch(()=>({}));
      out.purchases={ok:pd.ok,configured:pd.configured,summary:pd.summary||{},diagnostic:pd.diagnostic||{}};
    }
  }catch(e){out.dataError=e.message;}
  return res.status(200).json(out);
};
