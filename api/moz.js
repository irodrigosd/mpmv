const MOZ_URL = 'https://lsapi.seomoz.com/v2/url_metrics';

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  const token = process.env.MOZ_API_TOKEN;

  if (!token) {
    return send(res, 503, {
      configured: false,
      error: 'Moz não configurado. Adicione MOZ_API_TOKEN na Vercel.'
    });
  }

  let targets = [];
  if (req.method === 'GET') {
    const raw = req.query?.targets || req.query?.url || '';
    targets = String(raw).split(',').map(s => s.trim()).filter(Boolean);
  } else if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      targets = Array.isArray(body.targets) ? body.targets.map(String).map(s => s.trim()).filter(Boolean) : [];
    } catch {
      return send(res, 400, { configured: true, error: 'JSON inválido.' });
    }
  } else {
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { configured: true, error: 'Método não permitido.' });
  }

  targets = [...new Set(targets)].slice(0, 50);
  if (!targets.length) return send(res, 400, { configured: true, error: 'Informe pelo menos uma URL.' });

  try {
    const response = await fetch(MOZ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MPMV-SEO-Authority/1.0'
      },
      body: JSON.stringify({ targets })
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!response.ok) {
      return send(res, response.status, {
        configured: true,
        error: 'A API do Moz recusou a consulta.',
        details: data
      });
    }

    return send(res, 200, {
      configured: true,
      results: Array.isArray(data.results) ? data.results : [],
      count: Array.isArray(data.results) ? data.results.length : 0
    });
  } catch (error) {
    return send(res, 502, { configured: true, error: 'Falha ao consultar o Moz.', details: error.message });
  }
};
