const BREVO_BASE = 'https://api.brevo.com/v3';

function json(res, status, body) {
  res.status(status).json(body);
}

function getApiKey() {
  return process.env.BREVO_API_KEY || process.env.BREVO_KEY || process.env.SENDINBLUE_API_KEY || '';
}

function getListId() {
  const id = Number(process.env.BREVO_LIST_ID || 5);
  return Number.isFinite(id) && id > 0 ? id : 5;
}

const LEAD_NOTIFICATION_EMAIL = 'irodrigosd@gmail.com';
let notificationSenderPromise;

async function getNotificationSender() {
  if (!notificationSenderPromise) {
    notificationSenderPromise = (async () => {
      const response = await fetch(BREVO_BASE + '/senders', {
        headers: { accept: 'application/json', 'api-key': getApiKey() }
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`Brevo senders ${response.status}: ${text}`);

      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch (_) {}
      const senders = Array.isArray(data.senders) ? data.senders : [];
      const sender = senders.find(item => item && item.email && item.active !== false);
      if (!sender) throw new Error('Nenhum remetente ativo encontrado na Brevo.');

      return { name: String(sender.name || 'MPMV Leads'), email: String(sender.email) };
    })();
  }
  return notificationSenderPromise;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function notifyGuideLead({ name, email, source, page }) {
  const sender = await getNotificationSender();
  const submittedAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const subject = `Novo lead do Guia — ${name}`;
  const text = [
    'Novo lead recebido pelo Guia Prático.',
    '',
    `Nome: ${name}`,
    `E-mail: ${email}`,
    `Origem: ${source}`,
    `Página: ${page}`,
    `Data: ${submittedAt}`
  ].join('\n');
  const html = `<h2>Novo lead do Guia</h2>
    <p><strong>Nome:</strong> ${escapeHtml(name)}</p>
    <p><strong>E-mail:</strong> ${escapeHtml(email)}</p>
    <p><strong>Origem:</strong> ${escapeHtml(source)}</p>
    <p><strong>Página:</strong> ${escapeHtml(page)}</p>
    <p><strong>Data:</strong> ${escapeHtml(submittedAt)}</p>`;

  const response = await fetch(BREVO_BASE + '/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': getApiKey(),
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender,
      to: [{ email: LEAD_NOTIFICATION_EMAIL, name: 'Rodrigo Castro' }],
      subject,
      textContent: text,
      htmlContent: html
    })
  });

  const responseText = await response.text();
  if (!response.ok) throw new Error(`Brevo notification ${response.status}: ${responseText}`);
}

function adminAuthorized(req) {
  const expected = process.env.LEADS_ADMIN_TOKEN || '';
  if (!expected) return false;
  const direct = String(req.headers['x-admin-token'] || '');
  const auth = String(req.headers.authorization || '');
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  return direct === expected || bearer === expected;
}

function normalizeContact(contact) {
  const a = contact.attributes || {};
  const first = a.FIRSTNAME || a.FIRST_NAME || a.FNAME || '';
  const last = a.LASTNAME || a.LAST_NAME || a.LNAME || '';
  const explicit = a.NOME || a.NAME || '';
  const name = String(explicit || [first,last].filter(Boolean).join(' ')).trim();
  return {
    id: contact.id,
    name,
    email: contact.email || '',
    createdAt: contact.createdAt || '',
    modifiedAt: contact.modifiedAt || '',
    emailBlacklisted: !!contact.emailBlacklisted,
    listUnsubscribed: Array.isArray(contact.listUnsubscribed) ? contact.listUnsubscribed : []
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const apiKey = getApiKey();
  const listId = getListId();

  if (!apiKey) {
    return json(res, 503, {
      ok: false,
      error: 'brevo_not_configured',
      message: 'Configure BREVO_API_KEY na Vercel.'
    });
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const name = String(body.name || '').trim().slice(0, 80);
      const email = String(body.email || '').trim().toLowerCase().slice(0, 160);

      if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json(res, 400, { ok:false, error:'invalid_lead', message:'Nome ou e-mail inválido.' });
      }

      const parts = name.split(/\s+/);
      const firstName = parts.shift() || name;
      const lastName = parts.join(' ');

      const payload = {
        email,
        attributes: Object.assign({ FIRSTNAME: firstName }, lastName ? { LASTNAME: lastName } : {}),
        listIds: [listId],
        updateEnabled: true
      };

      let brevo = await fetch(BREVO_BASE + '/contacts', {
        method: 'POST',
        headers: { 'accept':'application/json', 'api-key':apiKey, 'content-type':'application/json' },
        body: JSON.stringify(payload)
      });

      // Se a conta não tiver FIRSTNAME/LASTNAME com esses nomes, ainda salva o e-mail na lista.
      if (!brevo.ok && brevo.status === 400) {
        brevo = await fetch(BREVO_BASE + '/contacts', {
          method: 'POST',
          headers: { 'accept':'application/json', 'api-key':apiKey, 'content-type':'application/json' },
          body: JSON.stringify({ email, listIds:[listId], updateEnabled:true })
        });
      }

      const responseText = await brevo.text();
      if (!brevo.ok) {
        console.error('Brevo POST error', brevo.status, responseText);
        return json(res, 502, { ok:false, error:'brevo_error', status:brevo.status });
      }

      const source = String(body.source || 'guia-pratico').trim().slice(0, 80);
      const page = String(body.page || '/').trim().slice(0, 200);

      try {
        await notifyGuideLead({ name, email, source, page });
      } catch (notificationError) {
        // O cadastro não pode falhar por causa do aviso administrativo.
        console.error('Lead notification error', notificationError);
      }

      return json(res, 200, { ok:true });
    } catch (error) {
      console.error('Lead POST error', error);
      return json(res, 500, { ok:false, error:'internal_error' });
    }
  }

  if (req.method === 'GET') {
    if (!process.env.LEADS_ADMIN_TOKEN) {
      return json(res, 503, { ok:false, error:'admin_token_not_configured', message:'Configure LEADS_ADMIN_TOKEN na Vercel.' });
    }
    if (!adminAuthorized(req)) {
      return json(res, 401, { ok:false, error:'unauthorized' });
    }

    try {
      const requestedLimit = Number((req.query && req.query.limit) || 500);
      const requestedOffset = Number((req.query && req.query.offset) || 0);
      const limit = Math.max(1, Math.min(500, Number.isFinite(requestedLimit) ? requestedLimit : 500));
      const offset = Math.max(0, Number.isFinite(requestedOffset) ? requestedOffset : 0);
      const url = `${BREVO_BASE}/contacts/lists/${listId}/contacts?limit=${limit}&offset=${offset}&sort=desc`;

      const brevo = await fetch(url, { headers: { 'accept':'application/json', 'api-key':apiKey } });
      const text = await brevo.text();
      if (!brevo.ok) {
        console.error('Brevo GET error', brevo.status, text);
        return json(res, 502, { ok:false, error:'brevo_error', status:brevo.status });
      }

      const data = text ? JSON.parse(text) : {};
      const contacts = Array.isArray(data.contacts) ? data.contacts.map(normalizeContact) : [];
      return json(res, 200, { ok:true, count:Number(data.count || contacts.length), contacts });
    } catch (error) {
      console.error('Lead GET error', error);
      return json(res, 500, { ok:false, error:'internal_error' });
    }
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return json(res, 405, { ok:false, error:'method_not_allowed' });
}

