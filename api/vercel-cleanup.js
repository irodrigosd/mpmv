const VERCEL_API = 'https://api.vercel.com';
const PROJECT_ID = 'prj_c8zvkjwMmZmE4My4fiJA8zqcOUSn';
const TEAM_ID = 'team_BVsuVX2DEGb6PtSNkqdRlzjB';
const KEEP = 5;
const DELETE_BATCH = 20;

function adminAuthorized(req) {
  const expected = process.env.LEADS_ADMIN_TOKEN || '';
  if (!expected) return false;
  const direct = String(req.headers['x-admin-token'] || '');
  const auth = String(req.headers.authorization || '');
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  return direct === expected || bearer === expected;
}

async function vercelJson(path, token, options = {}) {
  const response = await fetch(VERCEL_API + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw:text }; }
  if (!response.ok) {
    const error = new Error((data && (data.error && data.error.message || data.message)) || `vercel_${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function listDeployments(token) {
  const all = [];
  let until = '';
  for (let page = 0; page < 30; page++) {
    const qs = new URLSearchParams({ projectId: PROJECT_ID, teamId: TEAM_ID, limit: '100' });
    if (until) qs.set('until', until);
    const data = await vercelJson(`/v6/deployments?${qs.toString()}`, token);
    const batch = Array.isArray(data.deployments) ? data.deployments : [];
    all.push(...batch);
    const next = data.pagination && data.pagination.next;
    if (!next || !batch.length) break;
    until = String(next);
  }
  all.sort((a,b) => Number(b.created || b.createdAt || 0) - Number(a.created || a.createdAt || 0));
  return all;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'method_not_allowed' });
  if (!adminAuthorized(req)) return res.status(401).json({ ok:false, error:'unauthorized' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const token = String(body.vercelToken || '').trim();
  if (!token) return res.status(400).json({ ok:false, error:'missing_vercel_token', message:'Informe o token temporário da Vercel.' });

  try {
    const deployments = await listDeployments(token);
    const currentUrl = String(process.env.VERCEL_URL || '').replace(/^https?:\/\//,'');
    const protectedIds = new Set();

    deployments.slice(0, KEEP).forEach(d => protectedIds.add(d.uid || d.id));
    deployments.forEach(d => {
      const url = String(d.url || '').replace(/^https?:\/\//,'');
      if (currentUrl && url === currentUrl) protectedIds.add(d.uid || d.id);
    });

    const candidates = deployments.filter(d => !protectedIds.has(d.uid || d.id));
    const batch = candidates.slice(-DELETE_BATCH);

    const results = await Promise.allSettled(batch.map(async d => {
      const id = d.uid || d.id;
      await vercelJson(`/v13/deployments/${encodeURIComponent(id)}?teamId=${encodeURIComponent(TEAM_ID)}`, token, { method:'DELETE' });
      return { id, url:d.url || '' };
    }));

    const deleted = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    const failed = results.filter(r => r.status === 'rejected').map(r => String(r.reason && r.reason.message || r.reason || 'erro'));
    const remainingOld = Math.max(0, candidates.length - deleted.length);

    return res.status(200).json({
      ok:true,
      total:deployments.length,
      kept:Math.min(KEEP, deployments.length),
      deleted:deleted.length,
      failed:failed.length,
      remainingOld,
      done:remainingOld === 0,
      currentProtected:!!currentUrl
    });
  } catch (error) {
    return res.status(error.status === 401 ? 401 : 500).json({
      ok:false,
      error:'vercel_cleanup_failed',
      message:error.message || 'Falha ao limpar deployments.'
    });
  }
}
