const BREVO_BASE = 'https://api.brevo.com/v3';
const TRACK_PREFIX = 'MPMV_TRACK|';
const TRACK_CONTACT_EMAIL = 'rastreamento@maispersuasaomaisvendas.com.br';

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
let trackingContactPromise;

function clean(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function splitMetaValue(value) {
  const raw = clean(value, 500);
  if (!raw) return { raw:'', id:'', name:'' };
  const separator = raw.indexOf('~');
  if (separator > 0) {
    return {
      raw,
      id: clean(raw.slice(0, separator), 120),
      name: clean(raw.slice(separator + 1), 250)
    };
  }
  if (/^\d{8,}$/.test(raw)) return { raw, id:raw, name:'' };
  return { raw, id:'', name:raw };
}

async function brevoJson(path, options = {}) {
  const response = await fetch(BREVO_BASE + path, {
    ...options,
    headers: {
      accept: 'application/json',
      'api-key': getApiKey(),
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw:text }; }
  if (!response.ok) {
    const error = new Error((data && data.message) || `brevo_${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

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

async function ensureTrackingContact() {
  if (trackingContactPromise) return trackingContactPromise;
  trackingContactPromise = (async () => {
    try {
      const contact = await brevoJson('/contacts/' + encodeURIComponent(TRACK_CONTACT_EMAIL));
      if (contact && Number(contact.id) > 0) return Number(contact.id);
    } catch (error) {
      if (error.status !== 404) throw error;
    }

    try {
      const created = await brevoJson('/contacts', {
        method:'POST',
        body:JSON.stringify({ email:TRACK_CONTACT_EMAIL, updateEnabled:true, getId:true })
      });
      if (created && Number(created.id) > 0) return Number(created.id);
    } catch (error) {
      if (error.status !== 400) throw error;
    }

    const contact = await brevoJson('/contacts/' + encodeURIComponent(TRACK_CONTACT_EMAIL));
    if (!contact || !Number(contact.id)) throw new Error('tracking_contact_missing');
    return Number(contact.id);
  })();

  try { return await trackingContactPromise; }
  catch (error) { trackingContactPromise = null; throw error; }
}

function sourceGuess(raw) {
  const source = clean(raw && raw.source, 150);
  if (source) return source;
  if (clean(raw && raw.fbclid, 500)) return 'meta';
  if (clean(raw && raw.gclid, 500)) return 'google';

  const referrer = clean(raw && raw.referrer, 1000).toLowerCase();
  if (!referrer) return 'direct';
  if (/instagram|facebook|fb\.com/.test(referrer)) return 'meta-organic';
  if (/google\.|bing\.|yahoo\.|duckduckgo/.test(referrer)) return 'organic-search';
  try { return new URL(referrer).hostname; } catch (_) { return 'referral'; }
}

function normalizeAttribution(raw, { name, email, page }) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const capturedAt = new Date().toISOString();
  const currentPage = clean(d.currentPage, 500) || clean(page, 500) || '/';
  const landingPage = clean(d.landingPage, 500) || currentPage;
  const pages = [{ path:currentPage, at:capturedAt }];
  const campaignRaw = clean(d.campaign, 500);
  const adsetRaw = clean(d.adset || d.term, 500);
  const adRaw = clean(d.ad || d.content, 500);
  const campaignMeta = splitMetaValue(campaignRaw);
  const adsetMeta = splitMetaValue(adsetRaw);
  const adMeta = splitMetaValue(adRaw);

  return {
    sessionId: clean(d.sessionId, 100) || `lead-${Date.now()}-${Math.random().toString(36).slice(2,10)}`,
    noteId: clean(d.noteId, 100),
    startedAt: clean(d.startedAt, 40) || capturedAt,
    updatedAt: capturedAt,
    landingPage,
    currentPage,
    referrer: clean(d.referrer, 1000),
    source: sourceGuess(d),
    medium: clean(d.medium, 150),
    campaign: campaignRaw,
    campaignId: clean(d.campaignId || campaignMeta.id, 120),
    campaignName: clean(d.campaignName || campaignMeta.name, 250),
    adset: adsetRaw,
    adsetId: clean(d.adsetId || adsetMeta.id, 120),
    adsetName: clean(d.adsetName || adsetMeta.name, 250),
    ad: adRaw,
    adId: clean(d.adId || adMeta.id, 120),
    adName: clean(d.adName || adMeta.name, 250),
    term: adsetRaw,
    fbclid: clean(d.fbclid, 500),
    gclid: clean(d.gclid, 500),
    activeSeconds: 0,
    elapsedSeconds: 0,
    pageViews: 1,
    device: '',
    browser: '',
    converted: true,
    conversionType: 'guia-attribution',
    convertedAt: capturedAt,
    name: clean(name, 120),
    email: clean(email, 180).toLowerCase(),
    phone: '',
    pages
  };
}

function encodeTrack(data) {
  return TRACK_PREFIX + Buffer.from(JSON.stringify(data), 'utf8').toString('base64');
}

async function saveAttributionFallback(attribution) {
  // Se já há noteId, a sessão consentida existe e o analytics.js fará a atualização da conversão.
  if (attribution.noteId) return { saved:false, reason:'existing_session' };
  const trackingContactId = await ensureTrackingContact();
  const data = { ...attribution, noteId:'' };
  const created = await brevoJson('/crm/notes', {
    method:'POST',
    body:JSON.stringify({ text:encodeTrack(data), contactIds:[trackingContactId] })
  });
  return { saved:true, noteId:String(created.id || '') };
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function notifyGuideLead({ name, email, source, page, attribution }) {
  const sender = await getNotificationSender();
  const submittedAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const medium = clean(attribution && attribution.medium, 150);
  const referrer = clean(attribution && attribution.referrer, 1000);
  const campaignRaw = clean(attribution && attribution.campaign, 500);
  const adsetRaw = clean(attribution && attribution.adset, 500);
  const adRaw = clean(attribution && attribution.ad, 500);
  const campaignMeta = splitMetaValue(campaignRaw);
  const adsetMeta = splitMetaValue(adsetRaw);
  const adMeta = splitMetaValue(adRaw);
  const campaignId = clean((attribution && attribution.campaignId) || campaignMeta.id, 120);
  const campaignName = clean((attribution && attribution.campaignName) || campaignMeta.name, 250);
  const adsetId = clean((attribution && attribution.adsetId) || adsetMeta.id, 120);
  const adsetName = clean((attribution && attribution.adsetName) || adsetMeta.name, 250);
  const adId = clean((attribution && attribution.adId) || adMeta.id, 120);
  const adName = clean((attribution && attribution.adName) || adMeta.name, 250);
  const subject = `Novo lead do Guia — ${name}`;
  const text = [
    'Novo lead recebido pelo Guia Prático.',
    '',
    `Nome: ${name}`,
    `E-mail: ${email}`,
    `Origem: ${source}`,
    `Mídia: ${medium || '—'}`,
    `Campanha: ${campaignName || campaignRaw || '—'}`,
    `Campaign ID: ${campaignId || '—'}`,
    `Conjunto: ${adsetName || adsetRaw || '—'}`,
    `Adset ID: ${adsetId || '—'}`,
    `Anúncio: ${adName || adRaw || '—'}`,
    `Ad ID: ${adId || '—'}`,
    `Página: ${page}`,
    `Referrer: ${referrer || '—'}`,
    `Data: ${submittedAt}`
  ].join('\n');
  const html = `<h2>Novo lead do Guia</h2>
    <p><strong>Nome:</strong> ${escapeHtml(name)}</p>
    <p><strong>E-mail:</strong> ${escapeHtml(email)}</p>
    <p><strong>Origem:</strong> ${escapeHtml(source)}</p>
    <p><strong>Mídia:</strong> ${escapeHtml(medium || '—')}</p>
    <p><strong>Campanha:</strong> ${escapeHtml(campaignName || campaignRaw || '—')}</p>
    <p><strong>Campaign ID:</strong> ${escapeHtml(campaignId || '—')}</p>
    <p><strong>Conjunto:</strong> ${escapeHtml(adsetName || adsetRaw || '—')}</p>
    <p><strong>Adset ID:</strong> ${escapeHtml(adsetId || '—')}</p>
    <p><strong>Anúncio:</strong> ${escapeHtml(adName || adRaw || '—')}</p>
    <p><strong>Ad ID:</strong> ${escapeHtml(adId || '—')}</p>
    <p><strong>Página:</strong> ${escapeHtml(page)}</p>
    <p><strong>Referrer:</strong> ${escapeHtml(referrer || '—')}</p>
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

      const page = String(body.page || '/').trim().slice(0, 200);
      const attribution = normalizeAttribution(body.tracking, { name, email, page });
      const source = attribution.source || String(body.source || 'direct').trim().slice(0, 80);
      let attributionResult = { saved:false, reason:'not_attempted' };

      try {
        attributionResult = await saveAttributionFallback(attribution);
      } catch (attributionError) {
        // O cadastro não pode falhar se a atribuição pontual estiver indisponível.
        console.error('Lead attribution error', attributionError);
      }

      try {
        await notifyGuideLead({ name, email, source, page, attribution });
      } catch (notificationError) {
        // O cadastro não pode falhar por causa do aviso administrativo.
        console.error('Lead notification error', notificationError);
      }

      return json(res, 200, {
        ok:true,
        attributionRecorded: !!attributionResult.saved,
        attributionSource: source
      });
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