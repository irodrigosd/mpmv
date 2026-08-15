const BREVO_BASE = 'https://api.brevo.com/v3';

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}

function apiKey() {
  return process.env.BREVO_API_KEY || process.env.BREVO_KEY || process.env.SENDINBLUE_API_KEY || '';
}

function guideListId() {
  const id = Number(process.env.BREVO_LIST_ID || 5);
  return Number.isFinite(id) && id > 0 ? id : 5;
}

function configuredMentoriaListId() {
  const id = Number(
    process.env.BREVO_MENTORIA_LIST_ID ||
    process.env.MENTORIA_LIST_ID ||
    process.env.BREVO_LIST_ID_MENTORIA ||
    0
  );
  return Number.isFinite(id) && id > 0 ? id : 0;
}

function adminAuthorized(req) {
  const expected = process.env.LEADS_ADMIN_TOKEN || process.env.BLOG_ADMIN_TOKEN || '';
  if (!expected) return false;
  const direct = String(req.headers['x-admin-token'] || '');
  const auth = String(req.headers.authorization || '');
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  return direct === expected || bearer === expected;
}

async function brevo(path, options = {}) {
  const key = apiKey();
  if (!key) {
    const e = new Error('brevo_not_configured');
    e.status = 503;
    throw e;
  }
  const r = await fetch(BREVO_BASE + path, {
    ...options,
    headers: {
      accept: 'application/json',
      'api-key': key,
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await r.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
  if (!r.ok) {
    const e = new Error((data && data.message) || `brevo_${r.status}`);
    e.status = r.status;
    e.data = data;
    throw e;
  }
  return data;
}

async function findOrCreateMentoriaList() {
  const configured = configuredMentoriaListId();
  if (configured) return configured;

  const lists = await brevo('/contacts/lists?limit=50&offset=0&sort=desc');
  const all = Array.isArray(lists.lists) ? lists.lists : [];
  const found = all.find(x => /mentoria/i.test(String(x.name || '')));
  if (found && Number(found.id) > 0) return Number(found.id);

  let folderId = 0;
  try {
    const guide = await brevo(`/contacts/lists/${guideListId()}`);
    folderId = Number(guide.folderId || 0);
  } catch (_) {}

  if (!folderId) {
    const folder = await brevo('/contacts/folders', {
      method: 'POST',
      body: JSON.stringify({ name: 'MPMV' })
    });
    folderId = Number(folder.id || 0);
  }

  if (!folderId) throw Object.assign(new Error('mentoria_folder_missing'), { status: 500 });

  const created = await brevo('/contacts/lists', {
    method: 'POST',
    body: JSON.stringify({ folderId, name: 'Mentoria Individual' })
  });
  const id = Number(created.id || 0);
  if (!id) throw Object.assign(new Error('mentoria_list_create_failed'), { status: 500 });
  return id;
}

function clean(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function validate(body) {
  const p = {
    name: clean(body.name, 120),
    email: clean(body.email, 180).toLowerCase(),
    phone: clean(body.phone, 60),
    product: clean(body.product, 5000),
    role: clean(body.role, 2000),
    attention: clean(body.attention, 5000),
    whyYou: clean(body.whyYou, 5000),
    revenue: clean(body.revenue, 1000),
    whyRodrigo: clean(body.whyRodrigo, 5000),
    resultsAgreement: clean(body.resultsAgreement, 10).toUpperCase(),
    priceAgreement: clean(body.priceAgreement, 10).toUpperCase()
  };
  if (p.name.length < 2) throw Object.assign(new Error('invalid_name'), { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) throw Object.assign(new Error('invalid_email'), { status: 400 });
  if (p.phone.length < 6) throw Object.assign(new Error('invalid_phone'), { status: 400 });
  for (const k of ['product','role','attention','whyYou','revenue','whyRodrigo']) {
    if (!p[k]) throw Object.assign(new Error(`missing_${k}`), { status: 400 });
  }
  if (!['SIM','NÃO','NAO'].includes(p.resultsAgreement)) throw Object.assign(new Error('invalid_resultsAgreement'), { status: 400 });
  if (!['SIM','NÃO','NAO'].includes(p.priceAgreement)) throw Object.assign(new Error('invalid_priceAgreement'), { status: 400 });
  return p;
}

function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const first = parts.shift() || name;
  return { first, last: parts.join(' ') };
}

async function upsertContact(application, listId) {
  const n = splitName(application.name);
  const payload = {
    email: application.email,
    attributes: Object.assign(
      { FIRSTNAME: n.first },
      n.last ? { LASTNAME: n.last } : {}
    ),
    listIds: [listId],
    updateEnabled: true,
    getId: true
  };

  let created;
  try {
    created = await brevo('/contacts', { method: 'POST', body: JSON.stringify(payload) });
  } catch (e) {
    // Fallback without name attributes for accounts whose standard attribute names differ.
    if (e.status !== 400) throw e;
    created = await brevo('/contacts', {
      method: 'POST',
      body: JSON.stringify({
        email: application.email,
        listIds: [listId],
        updateEnabled: true,
        getId: true
      })
    });
  }

  if (created && Number(created.id) > 0) return Number(created.id);

  const contact = await brevo(`/contacts/${encodeURIComponent(application.email)}`);
  if (!contact || !Number(contact.id)) throw Object.assign(new Error('contact_id_missing'), { status: 502 });
  return Number(contact.id);
}

function chunkString(s, size) {
  const chunks = [];
  for (let i = 0; i < s.length; i += size) chunks.push(s.slice(i, i + size));
  return chunks.length ? chunks : [''];
}

async function saveApplicationNote(contactId, application) {
  const app = {
    ...application,
    submittedAt: new Date().toISOString(),
    source: 'mentoria-individual'
  };
  const encoded = Buffer.from(JSON.stringify(app), 'utf8').toString('base64');
  const chunks = chunkString(encoded, 7600);
  const appId = `mpmv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  for (let i = 0; i < chunks.length; i++) {
    const marker = `MPMV_MENTORIA|${appId}|${i + 1}|${chunks.length}|${chunks[i]}`;
    await brevo('/crm/notes', {
      method: 'POST',
      body: JSON.stringify({ text: marker, contactIds: [contactId] })
    });
  }
}

function parseMentoriaNotes(notes) {
  const groups = new Map();
  const sorted = Array.isArray(notes) ? notes.slice().sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0)) : [];

  for (const note of sorted) {
    const text = String(note.text || '').replace(/<[^>]+>/g, '').trim();
    const m = text.match(/^MPMV_MENTORIA\|([^|]+)\|(\d+)\|(\d+)\|([\s\S]+)$/);
    if (!m) continue;
    const [, appId, partRaw, totalRaw, chunk] = m;
    const part = Number(partRaw), total = Number(totalRaw);
    if (!groups.has(appId)) groups.set(appId, { total, parts: {}, createdAt: note.createdAt || '' });
    const g = groups.get(appId);
    g.parts[part] = chunk;
    if (!g.createdAt && note.createdAt) g.createdAt = note.createdAt;
  }

  for (const [appId, g] of groups) {
    let complete = true;
    let encoded = '';
    for (let i = 1; i <= g.total; i++) {
      if (!g.parts[i]) { complete = false; break; }
      encoded += g.parts[i];
    }
    if (!complete) continue;
    try {
      const data = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
      return { ...data, applicationId: appId, noteCreatedAt: g.createdAt };
    } catch (_) {}
  }
  return null;
}

async function getNotesForContact(contactId) {
  const q = new URLSearchParams({
    entity: 'contacts',
    entityIds: String(contactId),
    limit: '50',
    sort: 'desc'
  });
  const notes = await brevo('/crm/notes?' + q.toString());
  return Array.isArray(notes) ? notes : (Array.isArray(notes.notes) ? notes.notes : []);
}

async function mapWithConcurrency(items, concurrency, fn) {
  const result = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      try { result[idx] = await fn(items[idx], idx); }
      catch (e) { result[idx] = { __error: e }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, worker));
  return result;
}

async function listApplications(limit, offset) {
  const listId = await findOrCreateMentoriaList();
  const url = `/contacts/lists/${listId}/contacts?limit=${limit}&offset=${offset}&sort=desc`;
  const data = await brevo(url);
  const contacts = Array.isArray(data.contacts) ? data.contacts : [];

  const enriched = await mapWithConcurrency(contacts, 5, async (contact) => {
    const notes = await getNotesForContact(contact.id);
    const app = parseMentoriaNotes(notes);
    const a = contact.attributes || {};
    return {
      id: contact.id,
      name: (app && app.name) || a.NOME || a.NAME || [a.FIRSTNAME || a.FIRST_NAME || '', a.LASTNAME || a.LAST_NAME || ''].filter(Boolean).join(' ').trim(),
      email: contact.email || (app && app.email) || '',
      phone: (app && app.phone) || a.SMS || '',
      createdAt: (app && (app.submittedAt || app.noteCreatedAt)) || contact.createdAt || '',
      modifiedAt: contact.modifiedAt || '',
      product: app ? app.product : '',
      role: app ? app.role : '',
      attention: app ? app.attention : '',
      whyYou: app ? app.whyYou : '',
      revenue: app ? app.revenue : '',
      whyRodrigo: app ? app.whyRodrigo : '',
      resultsAgreement: app ? app.resultsAgreement : '',
      priceAgreement: app ? app.priceAgreement : '',
      source: 'mentoria-individual',
      hasFullApplication: !!app
    };
  });

  return {
    listId,
    count: Number(data.count || enriched.length),
    applications: enriched.filter(Boolean).map(x => x && x.__error ? null : x).filter(Boolean)
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!apiKey()) {
    return json(res, 503, { ok:false, error:'brevo_not_configured', message:'Configure BREVO_API_KEY na Vercel.' });
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const application = validate(body);
      const listId = await findOrCreateMentoriaList();
      const contactId = await upsertContact(application, listId);
      await saveApplicationNote(contactId, application);
      return json(res, 200, { ok:true });
    } catch (e) {
      console.error('Mentoria POST error', e.status, e.message, e.data || '');
      const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
      return json(res, status, { ok:false, error:e.message || 'internal_error' });
    }
  }

  if (req.method === 'GET') {
    if (!(process.env.LEADS_ADMIN_TOKEN || process.env.BLOG_ADMIN_TOKEN)) {
      return json(res, 503, { ok:false, error:'admin_token_not_configured', message:'Configure LEADS_ADMIN_TOKEN na Vercel.' });
    }
    if (!adminAuthorized(req)) return json(res, 401, { ok:false, error:'unauthorized' });

    try {
      const requestedLimit = Number((req.query && req.query.limit) || 200);
      const requestedOffset = Number((req.query && req.query.offset) || 0);
      const limit = Math.max(1, Math.min(500, Number.isFinite(requestedLimit) ? requestedLimit : 200));
      const offset = Math.max(0, Number.isFinite(requestedOffset) ? requestedOffset : 0);
      const result = await listApplications(limit, offset);
      return json(res, 200, { ok:true, ...result });
    } catch (e) {
      console.error('Mentoria GET error', e.status, e.message, e.data || '');
      const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
      return json(res, status, { ok:false, error:e.message || 'internal_error' });
    }
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return json(res, 405, { ok:false, error:'method_not_allowed' });
};
