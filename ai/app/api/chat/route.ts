import { NextResponse } from 'next/server';

export async function POST(req: Request) {
 try {
  const { messages } = await req.json();
  if (!Array.isArray(messages)) return NextResponse.json({error:'Mensagens inválidas.'},{status:400});
  const key=process.env.OPENAI_API_KEY;
  if(!key) return NextResponse.json({message:'O app já está instalado, mas falta configurar OPENAI_API_KEY na Vercel para ativar a IA.'});
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.6',input:messages.map((m:{role:string,content:string})=>({role:m.role==='assistant'?'assistant':'user',content:[{type:'input_text',text:m.content}]}))})});
  const data=await response.json();
  if(!response.ok) return NextResponse.json({error:data?.error?.message||'Falha na API.'},{status:response.status});
  const text=data.output_text||data.output?.flatMap((x:{content?:{text?:string}[]})=>x.content||[]).map(x=>x.text||'').join('')||'Sem resposta.';
  return NextResponse.json({message:text});
 } catch(e){return NextResponse.json({error:'Erro interno.'},{status:500});}
}
