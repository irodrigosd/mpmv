const BREVO_BASE = 'https://api.brevo.com/v3';
const TRACK_PREFIX = 'MPMV_TRACK|';
const TRACK_CONTACT_EMAIL = 'rastreamento@maispersuasaomaisvendas.com.br';
const LEAD_NOTIFICATION_EMAIL = 'irodrigosd@gmail.com';

let notificationSenderPromise;
let trackingContactPromise;

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
  const id = Number(process.env.BREVO_MENTORIA_LIST_ID || process.env.MENTORIA_LIST_ID || process.env.BREVO_LIST_ID_MENTORIA || 0);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

function clean(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

async function brevo(path, options = {}) {
  const key = apiKey();
  if (!key) throw Object.assign(new Error('brevo_not_configured'), { status:503 });
  const r = await fetch(BREVO_BASE + path, {
    ...options,
    headers: {
      accept:'application/json',
      'api-key':key,
      'content-type':'application/json',
      ...(options.headers || {})
    }
  });
  const text = await r.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw:text }; }
  if (!r.ok) {
    const e = new Error((data && data.message) || `brevo_${r.status}`);
    e.status = r.status;
    e.data = data;
    throw e;
  }
  return data;
}

function adminAuthorized(req) {
  const expected = process.env.LEADS_ADMIN_TOKEN || process.env.BLOG_ADMIN_TOKEN || '';
  if (!expected) return false;
  const direct = String(req.headers['x-admin-token'] || '');
  const auth = String(req.headers.authorization || '');
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  return direct === expected || bearer === expected;
}

async function getNotificationSender() {
  if (!notificationSenderPromise) {
    notificationSenderPromise = (async () => {
      const data = await brevo('/senders');
      const senders = Array.isArray(data.senders) ? data.senders : [];
      const sender = senders.find(item => item && item.email && item.active !== false);
      if (!sender) throw new Error('Nenhum remetente ativo encontrado na Brevo.');
      return { name:String(sender.name || 'MPMV Leads'), email:String(sender.email) };
    })();
  }
  return notificationSenderPromise;
}

async function ensureTrackingContact() {
  if (trackingContactPromise) return trackingContactPromise;
  trackingContactPromise = (async () => {
    try {
      const contact = await brevo('/contacts/' + encodeURIComponent(TRACK_CONTACT_EMAIL));
      if (contact && Number(contact.id) > 0) return Number(contact.id);
    } catch (e) {
      if (e.status !== 404) throw e;
    }
    try {
      const created = await brevo('/contacts', { method:'POST', body:JSON.stringify({ email:TRACK_CONTACT_EMAIL, updateEnabled:true, getId:true }) });
      if (created && Number(created.id) > 0) return Number(created.id);
    } catch (e) {
      if (e.status !== 400) throw e;
    }
    const contact = await brevo('/contacts/' + encodeURIComponent(TRACK_CONTACT_EMAIL));
    if (!contact || !Number(contact.id)) throw new Error('tracking_contact_missing');
    return Number(contact.id);
  })();
  try { return await trackingContactPromise; }
  catch (e) { trackingContactPromise = null; throw e; }
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

function normalizeAttribution(raw, application) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const capturedAt = new Date().toISOString();
  const currentPage = clean(d.currentPage, 500) || '/mentoria/';
  const landingPage = clean(d.landingPage, 500) || currentPage;
  return {
    sessionId:clean(d.sessionId, 100) || `mentoria-${Date.now()}-${Math.random().toString(36).slice(2,10)}`,
    noteId:clean(d.noteId, 100),
    startedAt:clean(d.startedAt, 40) || capturedAt,
    updatedAt:capturedAt,
    landingPage,
    currentPage,
    referrer:clean(d.referrer, 1000),
    source:sourceGuess(d),
    medium:clean(d.medium, 150),
    campaign:clean(d.campaign, 250),
    adset:clean(d.adset || d.term, 250),
    ad:clean(d.ad || d.content, 250),
    term:clean(d.term || d.adset, 250),
    fbclid:clean(d.fbclid, 500),
    gclid:clean(d.gclid, 500),
    activeSeconds:0,
    elapsedSeconds:0,
    pageViews:1,
    device:'',
    browser:'',
    converted:true,
    conversionType:'mentoria-attribution',
    convertedAt:capturedAt,
    name:application.name,
    email:application.email,
    phone:application.phone,
    pages:[{ path:currentPage, at:capturedAt }]
  };
}

function encodeTrack(data) {
  return TRACK_PREFIX + Buffer.from(JSON.stringify(data), 'utf8').toString('base64');
}

async function saveAttributionFallback(attribution) {
  if (attribution.noteId) return { saved:false, reason:'existing_session' };
  const trackingContactId = await ensureTrackingContact();
  const created = await brevo('/crm/notes', {
    method:'POST',
    body:JSON.stringify({ text:encodeTrack({ ...attribution, noteId:'' }), contactIds:[trackingContactId] })
  });
  return { saved:true, noteId:String(created.id || '') };
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

async function notifyMentoriaApplication(application, attribution) {
  const sender = await getNotificationSender();
  const submittedAt = new Date().toLocaleString('pt-BR', { timeZone:'America/Sao_Paulo' });
  const rows = [
    ['Nome', application.name], ['E-mail', application.email], ['Telefone', application.phone],
    ['Origem', attribution.source || 'direct'], ['Mídia', attribution.medium || '—'],
    ['Campanha', attribution.campaign || '—'], ['Página de entrada', attribution.landingPage || '—'],
    ['Referrer', attribution.referrer || '—'], ['Faturamento mensal', application.revenue],
    ['Produto ou serviço', application.product], ['Perfil profissional', application.role],
    ['O que chamou atenção', application.attention], ['Por que escolher o projeto', application.whyYou],
    ['Por que escolheu Rodrigo', application.whyRodrigo], ['Ciente sobre resultados', application.resultsAgreement],
    ['De acordo com o investimento', application.priceAgreement], ['Data', submittedAt]
  ];
  const text = ['Nova aplicação recebida para a Mentoria Individual.', '', ...rows.map(([label,value]) => `${label}: ${value}`)].join('\n');
  const html = `<h2>Nova aplicação para Mentoria</h2>${rows.map(([label,value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`).join('')}`;
  await brevo('/smtp/email', { method:'POST', body:JSON.stringify({ sender, to:[{ email:LEAD_NOTIFICATION_EMAIL, name:'Rodrigo Castro' }], subject:`Nova aplicação para Mentoria — ${application.name}`, textContent:text, htmlContent:html }) });
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
    const folder = await brevo('/contacts/folders', { method:'POST', body:JSON.stringify({ name:'MPMV' }) });
    folderId = Number(folder.id || 0);
  }
  if (!folderId) throw Object.assign(new Error('mentoria_folder_missing'), { status:500 });
  const created = await brevo('/contacts/lists', { method:'POST', body:JSON.stringify({ folderId, name:'Mentoria Individual' }) });
  const id = Number(created.id || 0);
  if (!id) throw Object.assign(new Error('mentoria_list_create_failed'), { status:500 });
  return id;
}

function validate(body) {
  const p = {
    name:clean(body.name,120), email:clean(body.email,180).toLowerCase(), phone:clean(body.phone,60),
    product:clean(body.product,5000), role:clean(body.role,2000), attention:clean(body.attention,5000),
    whyYou:clean(body.whyYou,5000), revenue:clean(body.revenue,1000), whyRodrigo:clean(body.whyRodrigo,5000),
    resultsAgreement:clean(body.resultsAgreement,10).toUpperCase(), priceAgreement:clean(body.priceAgreement,10).toUpperCase()
  };
  if (p.name.length < 2) throw Object.assign(new Error('invalid_name'), { status:400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) throw Object.assign(new Error('invalid_email'), { status:400 });
  if (p.phone.length < 6) throw Object.assign(new Error('invalid_phone'), { status:400 });
  for (const k of ['product','role','attention','whyYou','revenue','whyRodrigo']) if (!p[k]) throw Object.assign(new Error(`missing_${k}`), { status:400 });
  if (!['SIM','NÃO','NAO'].includes(p.resultsAgreement)) throw Object.assign(new Error('invalid_resultsAgreement'), { status:400 });
  if (!['SIM','NÃO','NAO'].includes(p.priceAgreement)) throw Object.assign(new Error('invalid_priceAgreement'), { status:400 });
  return p;
}

function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const first = parts.shift() || name;
  return { first, last:parts.join(' ') };
}

async function upsertContact(application, listId) {
  const n = splitName(application.name);
  const payload = { email:application.email, attributes:Object.assign({ FIRSTNAME:n.first }, n.last ? { LASTNAME:n.last } : {}), listIds:[listId], updateEnabled:true, getId:true };
  let created;
  try { created = await brevo('/contacts', { method:'POST', body:JSON.stringify(payload) }); }
  catch (e) {
    if (e.status !== 400) throw e;
    created = await brevo('/contacts', { method:'POST', body:JSON.stringify({ email:application.email, listIds:[listId], updateEnabled:true, getId:true }) });
  }
  if (created && Number(created.id) > 0) return Number(created.id);
  const contact = await brevo(`/contacts/${encodeURIComponent(application.email)}`);
  if (!contact || !Number(contact.id)) throw Object.assign(new Error('contact_id_missing'), { status:502 });
  return Number(contact.id);
}

function chunkString(s, size) {
  const chunks = [];
  for (let i=0; i<s.length; i+=size) chunks.push(s.slice(i,i+size));
  return chunks.length ? chunks : [''];
}

async function saveApplicationNote(contactId, application, attribution) {
  const app = { ...application, submittedAt:new Date().toISOString(), source:'mentoria-individual', attribution:{ source:attribution.source, medium:attribution.medium, campaign:attribution.campaign, landingPage:attribution.landingPage, referrer:attribution.referrer, fbclid:attribution.fbclid, gclid:attribution.gclid } };
  const encoded = Buffer.from(JSON.stringify(app), 'utf8').toString('base64');
  const chunks = chunkString(encoded, 7600);
  const appId = `mpmv-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  for (let i=0; i<chunks.length; i++) {
    const marker = `MPMV_MENTORIA|${appId}|${i+1}|${chunks.length}|${chunks[i]}`;
    await brevo('/crm/notes', { method:'POST', body:JSON.stringify({ text:marker, contactIds:[contactId] }) });
  }
}

function parseMentoriaNotes(notes) {
  const groups = new Map();
  const sorted = Array.isArray(notes) ? notes.slice().sort((a,b) => new Date(b.createdAt||0)-new Date(a.createdAt||0)) : [];
  for (const note of sorted) {
    const text = String(note.text || '').replace(/<[^>]+>/g,'').trim();
    const m = text.match(/^MPMV_MENTORIA\|([^|]+)\|(\d+)\|(\d+)\|([\s\S]+)$/);
    if (!m) continue;
    const [,appId,partRaw,totalRaw,chunk] = m;
    const part = Number(partRaw), total = Number(totalRaw);
    if (!groups.has(appId)) groups.set(appId, { total, parts:{}, createdAt:note.createdAt || '' });
    const g = groups.get(appId); g.parts[part] = chunk; if (!g.createdAt && note.createdAt) g.createdAt = note.createdAt;
  }
  for (const [appId,g] of groups) {
    let encoded = '', complete = true;
    for (let i=1; i<=g.total; i++) { if (!g.parts[i]) { complete=false; break; } encoded += g.parts[i]; }
    if (!complete) continue;
    try { return { ...JSON.parse(Buffer.from(encoded,'base64').toString('utf8')), applicationId:appId, noteCreatedAt:g.createdAt }; } catch (_) {}
  }
  return null;
}

async function getNotesForContact(contactId) {
  const q = new URLSearchParams({ entity:'contacts', entityIds:String(contactId), limit:'50', sort:'desc' });
  const notes = await brevo('/crm/notes?' + q.toString());
  return Array.isArray(notes) ? notes : (Array.isArray(notes.notes) ? notes.notes : []);
}

async function mapWithConcurrency(items, concurrency, fn) {
  const result = new Array(items.length); let next = 0;
  async function worker() { while (true) { const idx = next++; if (idx >= items.length) return; try { result[idx] = await fn(items[idx],idx); } catch (e) { result[idx] = { __error:e }; } } }
  await Promise.all(Array.from({ length:Math.min(concurrency,items.length || 1) }, worker));
  return result;
}

async function listApplications(limit, offset) {
  const listId = await findOrCreateMentoriaList();
  const data = await brevo(`/contacts/lists/${listId}/contacts?limit=${limit}&offset=${offset}&sort=desc`);
  const contacts = Array.isArray(data.contacts) ? data.contacts : [];
  const enriched = await mapWithConcurrency(contacts, 5, async contact => {
    const notes = await getNotesForContact(contact.id);
    const app = parseMentoriaNotes(notes);
    const a = contact.attributes || {};
    const attr = app && app.attribution || {};
    return {
      id:contact.id,
      name:(app && app.name) || a.NOME || a.NAME || [a.FIRSTNAME || a.FIRST_NAME || '', a.LASTNAME || a.LAST_NAME || ''].filter(Boolean).join(' ').trim(),
      email:contact.email || (app && app.email) || '', phone:(app && app.phone) || a.SMS || '',
      createdAt:(app && (app.submittedAt || app.noteCreatedAt)) || contact.createdAt || '', modifiedAt:contact.modifiedAt || '',
      product:app ? app.product : '', role:app ? app.role : '', attention:app ? app.attention : '', whyYou:app ? app.whyYou : '',
      revenue:app ? app.revenue : '', whyRodrigo:app ? app.whyRodrigo : '', resultsAgreement:app ? app.resultsAgreement : '', priceAgreement:app ? app.priceAgreement : '',
      source:attr.source || 'mentoria-individual', medium:attr.medium || '', campaign:attr.campaign || '', landingPage:attr.landingPage || '', referrer:attr.referrer || '', hasFullApplication:!!app
    };
  });
  return { listId, count:Number(data.count || enriched.length), applications:enriched.filter(Boolean).map(x => x && x.__error ? null : x).filter(Boolean) };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!apiKey()) return json(res,503,{ ok:false, error:'brevo_not_configured', message:'Configure BREVO_API_KEY na Vercel.' });

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const application = validate(body);
      const attribution = normalizeAttribution(body.tracking, application);
      const listId = await findOrCreateMentoriaList();
      const contactId = await upsertContact(application, listId);
      await saveApplicationNote(contactId, application, attribution);
      let attributionResult = { saved:false, reason:'not_attempted' };
      try { attributionResult = await saveAttributionFallback(attribution); }
      catch (e) { console.error('Mentoria attribution error', e.status, e.message, e.data || ''); }
      try { await notifyMentoriaApplication(application, attribution); }
      catch (e) { console.error('Mentoria notification error', e); }
      return json(res,200,{ ok:true, attributionRecorded:!!attributionResult.saved, attributionSource:attribution.source });
    } catch (e) {
      console.error('Mentoria POST error', e.status, e.message, e.data || '');
      const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
      return json(res,status,{ ok:false, error:e.message || 'internal_error' });
    }
  }

  if (req.method === 'GET') {
    if (!(process.env.LEADS_ADMIN_TOKEN || process.env.BLOG_ADMIN_TOKEN)) return json(res,503,{ ok:false, error:'admin_token_not_configured', message:'Configure LEADS_ADMIN_TOKEN na Vercel.' });
    if (!adminAuthorized(req)) return json(res,401,{ ok:false, error:'unauthorized' });
    try {
      const requestedLimit = Number((req.query && req.query.limit) || 200);
      const requestedOffset = Number((req.query && req.query.offset) || 0);
      const limit = Math.max(1,Math.min(500,Number.isFinite(requestedLimit) ? requestedLimit : 200));
      const offset = Math.max(0,Number.isFinite(requestedOffset) ? requestedOffset : 0);
      return json(res,200,{ ok:true, ...(await listApplications(limit,offset)) });
    } catch (e) {
      console.error('Mentoria GET error', e.status, e.message, e.data || '');
      const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
      return json(res,status,{ ok:false, error:e.message || 'internal_error' });
    }
  }

  res.setHeader('Allow','GET, POST, OPTIONS');
  return json(res,405,{ ok:false, error:'method_not_allowed' });
};
