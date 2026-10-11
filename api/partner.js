// POST /api/partner : validates a partner enquiry and emails it to the 1016 team.
// Env: RESEND_API_KEY (required), NOTIFY_TO (comma separated), MAIL_FROM (optional)
const { parsePhoneNumberFromString } = require('libphonenumber-js/max');

const TYPES = ['Church', 'Event organiser or ministry', 'Other'];
const CITIES = ['Lagos', 'Abuja', 'Elsewhere in Nigeria', 'Outside Nigeria'];
const INTERESTS = ['A pilot in Lagos or Abuja', 'White-label app and admin portal', 'Follow-up for our events', 'The maturity course library'];
const hits = new Map();

function clean(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max); }
function esc(v) { return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function limited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000, list = (hits.get(ip) || []).filter((t) => now - t < win);
  list.push(now); hits.set(ip, list);
  if (hits.size > 500) for (const [k, v] of hits) if (!v.some((t) => now - t < win)) hits.delete(k);
  return list.length > 5;
}
function fail(res, code, message, field) { return res.status(code).json({ error: true, message, field }); }

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(res, 405, 'Method not allowed.'); }
  const origin = req.headers.origin;
  if (origin) { try { if (new URL(origin).host !== req.headers.host) return fail(res, 403, 'Request not allowed.'); } catch (e) { return fail(res, 403, 'Request not allowed.'); } }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return fail(res, 429, 'Too many messages from your connection. Please try again in a few minutes.');

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b !== 'object') return fail(res, 400, 'Your message could not be read. Please try again.');
  if (clean(b.website, 100)) return res.status(200).json({ ok: true }); // honeypot: pretend success

  const d = {
    ptype: TYPES.includes(b.ptype) ? b.ptype : 'Other',
    org: clean(b.org, 160), pname: clean(b.pname, 120), role: clean(b.role, 120), email: clean(b.email, 200),
    phone: clean(b.phone, 30), city: CITIES.includes(b.city) ? b.city : '', size: clean(b.size, 200),
    interests: Array.isArray(b.interests) ? b.interests.filter((x) => INTERESTS.includes(x)) : [],
    msg: clean(b.msg, 2000),
  };
  if (!d.org) return fail(res, 400, 'Enter your organisation name.', 'org');
  if (!d.pname) return fail(res, 400, 'Enter your name.', 'pname');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return fail(res, 400, 'Enter a valid email address.', 'email');
  if (d.phone) {
    const p = parsePhoneNumberFromString(d.phone);
    if (!p || !p.isValid()) return fail(res, 400, 'Enter a valid phone number for the country you chose.', 'phone');
    d.phone = p.number;
  }

  const key = process.env.RESEND_API_KEY, to = (process.env.NOTIFY_TO || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!key || !to.length) { console.error('partner form not configured: set RESEND_API_KEY and NOTIFY_TO'); return fail(res, 503, 'Messages cannot be sent right now. Please try again later.'); }

  const rows = [['Registering as', d.ptype], ['Organisation', d.org], ['Name', d.pname], ['Role', d.role], ['Email', d.email], ['Phone or WhatsApp', d.phone], ['Based in', d.city], ['Size', d.size], ['Interested in', d.interests.join('; ')], ['Message', d.msg]].filter((r) => r[1]);
  const text = '1016 partner enquiry\n\n' + rows.map((r) => r[0] + ': ' + r[1]).join('\n');
  const html = '<h2 style="font-family:Georgia,serif">1016 partner enquiry</h2><table cellpadding="6" style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">' +
    rows.map((r) => '<tr><td style="color:#555;vertical-align:top;white-space:nowrap">' + esc(r[0]) + '</td><td style="white-space:pre-wrap">' + esc(r[1]) + '</td></tr>').join('') + '</table>';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM || '1016 Partners <onboarding@resend.dev>', to, reply_to: d.email, subject: '1016 partner enquiry: ' + d.org + ' (' + d.ptype + ')', text, html }),
    });
    if (!r.ok) { console.error('resend failed', r.status, (await r.text()).slice(0, 300), 'PARTNER_ENQUIRY', JSON.stringify(d)); return fail(res, 502, 'We could not send your message. Please try again in a few minutes.'); }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('resend error', String(e), 'PARTNER_ENQUIRY', JSON.stringify(d));
    return fail(res, 502, 'We could not send your message. Please try again in a few minutes.');
  }
};
