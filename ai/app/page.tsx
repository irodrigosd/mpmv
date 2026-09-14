'use client';
import { useState } from 'react';

type Msg={role:'user'|'assistant';content:string};
export default function Home(){
 const [messages,setMessages]=useState<Msg[]>([]); const [input,setInput]=useState(''); const [loading,setLoading]=useState(false);
 async function send(){const text=input.trim();if(!text||loading)return;setInput('');const next=[...messages,{role:'user' as const,content:text}];setMessages(next);setLoading(true);try{const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:next})});const d=await r.json();setMessages([...next,{role:'assistant',content:d.message||d.error||'Não foi possível responder agora.'}]);}catch{setMessages([...next,{role:'assistant',content:'Erro de conexão. Tente novamente.'}]);}finally{setLoading(false)}}
 return <div className="shell"><header className="top"><div className="brand">MPMV <span>AI</span></div><div className="status">Seu assistente de IA</div></header><main className="main"><section className="hero"><h1>Como posso ajudar?</h1><p>Converse, crie, analise e resolva.</p></section><section className="messages">{messages.length===0?<div className="empty">Comece uma conversa abaixo.</div>:messages.map((m,i)=><div key={i} className={`bubble ${m.role}`}>{m.content}</div>)}</section><form className="composer" onSubmit={e=>{e.preventDefault();send()}}><div className="box"><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Digite sua mensagem..." disabled={loading}/><button className="send" disabled={loading||!input.trim()}>{loading?'...':'Enviar'}</button></div><div className="hint">Enter envia • Shift + Enter quebra linha</div></form></main></div>
}
