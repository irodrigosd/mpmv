const QA_SECRET='qa_XZWUut6NnfkSaJQQxtIZzSY4';
const BASE='https://www.maispersuasaomaisvendas.com.br';

async function read(r){
  const text=await r.text();
  let body=text;
  try{body=JSON.parse(text)}catch(_){}
  return {status:r.status,ok:r.ok,body};
}
async function post(path,payload,headers={}){
  return read(await fetch(BASE+path,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(payload)}));
}
async function get(path){return read(await fetch(BASE+path,{headers:{'cache-control':'no-cache'}}));}

async function runQa(){
  const stamp=Date.now();
  const results={stamp};

  const home=await get('/?utm_source=instagram&utm_medium=paid_social&utm_campaign=qa_e2e_home');
  results.home={status:home.status,hasNativeForm:typeof home.body==='string'&&home.body.includes('mpmv-lead-form')};
  results.guide=await post('/api/leads',{
    name:'Teste E2E Guia',
    email:`irodrigosd+teste-e2e-guia-${stamp}@gmail.com`,
    source:'guia-pratico',page:'/',
    tracking:{landingPage:'/?utm_source=instagram&utm_medium=paid_social&utm_campaign=qa_e2e_guia',currentPage:'/',referrer:'https://l.instagram.com/',source:'instagram',medium:'paid_social',campaign:'qa_e2e_guia',adset:'qa_adset',ad:'qa_ad',fbclid:'QA_FBCLID_GUIDE',gclid:''}
  });

  const mentoriaPage=await get('/mentoria/?utm_source=google&utm_medium=cpc&utm_campaign=qa_e2e_mentoria');
  results.mentoriaPage={status:mentoriaPage.status,hasForm:typeof mentoriaPage.body==='string'&&mentoriaPage.body.includes('id="appForm"')};
  results.mentoria=await post('/api/mentoria',{
    name:'Teste E2E Mentoria',email:`irodrigosd+teste-e2e-mentoria-${stamp}@gmail.com`,phone:'11999999999',
    product:'Teste técnico de atribuição MPMV',role:'Teste automatizado',attention:'Teste do formulário e da origem',
    whyYou:'Aplicação exclusivamente de teste técnico',revenue:'R$ 0 — teste',whyRodrigo:'Teste técnico do funil',
    resultsAgreement:'SIM',priceAgreement:'SIM',
    tracking:{landingPage:'/mentoria/?utm_source=google&utm_medium=cpc&utm_campaign=qa_e2e_mentoria',currentPage:'/mentoria/',referrer:'https://www.google.com/',source:'google',medium:'cpc',campaign:'qa_e2e_mentoria',gclid:'QA_GCLID_MENTORIA'}
  });

  const articlePath='/blog/efeito-contraste-marketing/';
  const article=await get(articlePath+'?utm_source=google&utm_medium=organic&utm_campaign=qa_e2e_article');
  results.articlePage={status:article.status,hasAnalytics:typeof article.body==='string'&&article.body.includes('/analytics.js'),hasGuideLink:typeof article.body==='string'&&(article.body.includes('Baixar o guia')||article.body.includes('href="/"'))};
  results.articleTracking=await post('/api/rastreamento',{action:'start',data:{sessionId:`qa-artigo-${stamp}`,startedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),landingPage:articlePath,currentPage:articlePath,referrer:'https://www.google.com/',source:'organic-search',medium:'organic',campaign:'qa_e2e_article',activeSeconds:0,elapsedSeconds:0,pageViews:1,device:'QA',browser:'QA',converted:false,conversionType:'',convertedAt:'',name:'Teste E2E Artigo',email:`irodrigosd+teste-e2e-artigo-${stamp}@gmail.com`,phone:'',pages:[{path:articlePath,at:new Date().toISOString()}]}},{Origin:BASE});

  const course=await get('/curso/?utm_source=instagram&utm_medium=paid_social&utm_campaign=qa_e2e_course');
  results.coursePage={status:course.status,hasHotmartCheckout:typeof course.body==='string'&&course.body.includes('https://pay.hotmart.com/Q107139469W'),hasNativeForm:typeof course.body==='string'&&/<form\b/i.test(course.body)};
  results.courseTracking=await post('/api/rastreamento',{action:'start',data:{sessionId:`qa-curso-${stamp}`,startedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),landingPage:'/curso/',currentPage:'/curso/',referrer:'https://l.instagram.com/',source:'instagram',medium:'paid_social',campaign:'qa_e2e_course',adset:'qa_adset',ad:'qa_course_ad',fbclid:'QA_FBCLID_COURSE',activeSeconds:0,elapsedSeconds:0,pageViews:1,device:'QA',browser:'QA',converted:false,conversionType:'',convertedAt:'',name:'Teste E2E Curso',email:`irodrigosd+teste-e2e-curso-${stamp}@gmail.com`,phone:'',pages:[{path:'/curso/',at:new Date().toISOString()}]}},{Origin:BASE});

  const allOk=results.home.status===200&&results.home.hasNativeForm&&results.guide.ok&&results.mentoriaPage.status===200&&results.mentoriaPage.hasForm&&results.mentoria.ok&&results.articlePage.status===200&&results.articleTracking.ok&&results.coursePage.status===200&&results.coursePage.hasHotmartCheckout&&results.courseTracking.ok;
  return {ok:allOk,results};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow','GET, HEAD');
    return res.status(405).json({ok:false,error:'method_not_allowed'});
  }
  res.setHeader('Cache-Control','no-store, max-age=0');
  if(req.method==='GET'&&String(req.query&&req.query.qa||'')===QA_SECRET){
    try{const result=await runQa();return res.status(result.ok?200:500).json(result)}
    catch(e){console.error('QA E2E error',e);return res.status(500).json({ok:false,error:e.message||'qa_failed'})}
  }
  res.setHeader('Location','/guia-pratico-persuasao-pra-vender-todo-santo-dia.pdf');
  return res.status(302).end();
};
