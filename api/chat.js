export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'Mensagens inválidas.' });
    const key = process.env.OPENAI_API_KEY;
    if (!key) return res.status(200).json({ message: 'A interface do MPMV AI já está publicada. Falta apenas configurar OPENAI_API_KEY na Vercel para ativar as respostas da IA.' });
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.6',
        input: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: [{ type: 'input_text', text: String(m.content || '') }] }))
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || 'Falha na API.' });
    return res.status(200).json({ message: data.output_text || 'Sem resposta.' });
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno.' });
  }
}
