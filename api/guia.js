const { handleCampaigns, handleClick, handleUnsubscribe } = require('../lib/mpmv-email');
const { handleAutomation, handleAutomationCron } = require('../lib/mpmv-automation');

module.exports = async function handler(req, res) {
  const action = String((req.query && req.query.action) || '').trim().toLowerCase();

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (action === 'email-campaigns') return handleCampaigns(req, res);
  if (action === 'email-click') return handleClick(req, res);
  if (action === 'email-unsubscribe') return handleUnsubscribe(req, res);
  if (action === 'automation') return handleAutomation(req, res);
  if (action === 'automation-cron') return handleAutomationCron(req, res);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ ok:false, error:'method_not_allowed' });
  }

  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Location', '/guia-pratico-persuasao-pra-vender-todo-santo-dia.pdf');
  return res.status(302).end();
};