// Yahweh's World feedback: one tap on a picture, one e-mail to the owner. Netlify Function.
//
//   POST /api/feedback     JSON  ->  { ok: true } | { error: '<code>', message?: '...' }
//
// Built the way Words' submitFeedback.mjs is (same mail service, same environment variable names, same anti-abuse layers),
// minus what a picture site has no use for (the Firebase inbox copy). The page never needs this to work: when it answers
// anything but ok, the sheet offers a prefilled mailto: link to support@yahwehword.com instead.
//
// Environment variables on the Netlify site (names only; values are set by the owner in the Netlify UI, never in the repo):
//   RESEND_API_KEY   the Resend key Words uses for its feedback and error mail          (required: without it the function answers 503)
//   FEEDBACK_TO      where the mail goes                                                  (required: no address is built in)
//   FEEDBACK_FROM    the sender, e.g. "Yahweh's World <feedback@your-verified-domain>"  (optional; Words' default sandbox sender)
//   ERROR_IP_SALT    salt for the per-IP counters, so no address is ever stored          (optional; Words' own default is used)
//
// Layers, in order, each cheap and none of which stops a real reader:
//   1 method + Origin allowlist     OPTIONS 204, anything but POST 405, a browser POST from another site 403 (no Origin = a script or curl: allowed, as in Words)
//   2 size cap                      a body over 12 KB is 413 before it is parsed
//   3 honeypot                      a filled `website` field is a bot: answered { ok: true }, nothing sent
//   4 rate limit                    per IP a few a minute (this instance) and 10 a day (Netlify Blobs, salted hash of the IP)
//   5 validation                    every field typed, trimmed, capped; CR/LF stripped from anything that reaches a mail header
// An empty message is allowed (the owner asked for that): the picture, the reasons and the context are the report.
//
// Nothing is stored. The only place a reader's words go is the one mail to FEEDBACK_TO.
import { createHash } from 'node:crypto';

export const config = { path: '/api/feedback' };

export const LIMITS = {
  body: 12 * 1024,
  message: 4000,
  email: 320,
  reasons: 4,
  perDay: 10,
  perMinute: 3,
};
/** What a reader may tick. The page and the mail use these keys; the mail also spells them out. */
export const REASONS = { picture: 'The picture looks wrong', caption: 'Caption or reference wrong', bible: 'Bible text problem', other: 'Other' };
const LANGS = new Set(['en', 'zh-Hans', 'zh-Hant', 'ru']);
const THEMES = new Set(['auto', 'dark', 'light', 'paper']);
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[a-zA-Z]{2,}$/;
const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const FROM_DEFAULT = 'Yahweh’s World Feedback <onboarding@resend.dev>';

/** Browsers may POST from these sites only; a request with no Origin (a script) passes, as it does in Words. */
const ORIGINS = new Set(['https://world.yahwehword.com', 'https://yahwehsworld.netlify.app', 'https://yahwehsworld-dev.netlify.app']);
const originOk = (req) => { const o = req.headers.get('origin') || ''; return o === '' || ORIGINS.has(o); };

function cors(req) {
  const o = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': o && ORIGINS.has(o) ? o : o ? 'https://world.yahwehword.com' : '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}
const reply = (req, status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(req) } });

const SEP = new RegExp('[\\r\\n' + String.fromCharCode(0x2028, 0x2029) + ']+', 'g');
const oneLine = (v, n) => String(v ?? '').replace(SEP, ' ').trim().slice(0, n);
const clientIp = (req) => (req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
const ipHash = (ip, salt) => createHash('sha256').update(`${salt || 'yswords-errors'}|${ip}`).digest('hex').slice(0, 16);

// ── rate limits ────────────────────────────────────────────────────────────
const recent = new Map(); // this instance: ip hash -> timestamps in the last minute
export function perMinuteAllow(map, key, now = Date.now(), rate = LIMITS.perMinute) {
  const r = (map.get(key) || []).filter((t) => now - t < 60_000);
  if (r.length >= rate) { map.set(key, r); return false; }
  r.push(now); map.set(key, r);
  if (map.size > 2000) map.clear();
  return true;
}
/** Counts this request against (kind, ip) for today and says whether it is still under `limit` (Words' _abuse.mjs). */
export async function underDailyCap(store, { kind, ip, limit, now = Date.now(), salt }) {
  const day = new Date(now).toISOString().slice(0, 10);
  const key = `cap/${kind}/${day}/${ipHash(ip, salt)}`;
  const n = ((await store.get(key)) || 0) + 1;
  await store.set(key, n);
  return n <= limit;
}
async function blobStore() {
  const { getStore } = await import('@netlify/blobs');
  const s = getStore({ name: 'abuse-caps', consistency: 'strong' });
  return { get: (k) => s.get(k, { type: 'json' }), set: (k, v) => s.setJSON(k, v) };
}

// ── the payload ────────────────────────────────────────────────────────────
/** A reader's submission, checked and cut to size. Returns { ok: true, value } or { ok: false, error }. */
export function validate(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false, error: 'bad_payload' };
  const message = String(p.message ?? '').trim();
  if (message.length > LIMITS.message) return { ok: false, error: 'message_too_long' };
  const email = String(p.email ?? '').trim();
  if (email && (email.length > LIMITS.email || !EMAIL.test(email))) return { ok: false, error: 'bad_email' };
  const pictureId = String(p.pictureId ?? '').trim();
  if (!ID.test(pictureId)) return { ok: false, error: 'bad_picture' };
  const reasons = [...new Set((Array.isArray(p.reasons) ? p.reasons : []).map(String))].filter((r) => r in REASONS).slice(0, LIMITS.reasons);
  const ctx = p.context && typeof p.context === 'object' ? p.context : {};
  const lang = String(ctx.lang ?? '');
  const theme = String(ctx.theme ?? '');
  const edition = String(ctx.edition ?? '');
  return {
    ok: true,
    value: {
      message, email, reasons, pictureId,
      ref: oneLine(ctx.ref, 120),
      pageUrl: oneLine(ctx.url, 500),
      lang: LANGS.has(lang) ? lang : '',
      edition: ID.test(edition) ? edition : '',
      theme: oneLine(ctx.theme, 24) && THEMES.has(theme.split(' ')[0]) ? oneLine(theme, 24) : '',
      userAgent: oneLine(ctx.userAgent, 600),
      clientTime: oneLine(ctx.time, 40),
      viewport: oneLine(ctx.viewport, 24),
    },
  };
}

const utc = (d) => { const z = (n) => String(n).padStart(2, '0'); return `${d.getUTCFullYear()}-${z(d.getUTCMonth() + 1)}-${z(d.getUTCDate())} ${z(d.getUTCHours())}:${z(d.getUTCMinutes())}:${z(d.getUTCSeconds())} UTC`; };

/** The mail: subject (one line) and plain text. */
export function compose(v, now = new Date()) {
  const why = v.reasons.map((r) => REASONS[r]).join('; ');
  const subject = `Yahweh\u2019s World feedback [${v.pictureId}]${why ? ` \u2014 ${why}` : ''}`.slice(0, 200);
  const opt = (value, line) => (value ? line : null);
  const rule = (t) => `--- ${t} ${'-'.repeat(Math.max(3, 40 - t.length))}`;
  const lines = [
    v.message || '(no text: the picture and the reasons are the report)', '',
    rule('The picture'),
    `Picture id  : ${v.pictureId}`,
    opt(v.ref, `Reference   : ${v.ref}`),
    opt(v.pageUrl, `Page        : ${v.pageUrl}`),
    `Reasons     : ${why || '(none ticked)'}`,
    opt(v.email, `Reply-to    : ${v.email}`),
    '', rule('Reading context'),
    opt(v.lang, `Language    : ${v.lang}`),
    opt(v.edition, `Edition     : ${v.edition}`),
    opt(v.theme, `Theme       : ${v.theme}`),
    opt(v.viewport, `Viewport    : ${v.viewport}`),
    opt(v.userAgent, `User-Agent  : ${v.userAgent}`),
    '', rule('Time'),
    `Received    : ${utc(now)}`,
    opt(v.clientTime, `Reader local: ${v.clientTime}`),
  ].filter((l) => l !== null);
  return { subject, text: lines.join('\n') };
}

async function sendViaResend(apiKey, body) {
  return fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

/** The whole function, with its dependencies handed in so a test can mock the mailer, the counters and the clock. */
export async function handle(req, deps = {}) {
  const env = deps.env ?? process.env;
  const send = deps.send ?? sendViaResend;
  const now = deps.now ?? (() => Date.now());
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return reply(req, 405, { error: 'method_not_allowed' });
  if (!originOk(req)) return reply(req, 403, { error: 'forbidden' });

  const raw = await req.text().catch(() => '');
  if (raw.length > LIMITS.body) return reply(req, 413, { error: 'too_large' });
  let payload;
  try { payload = JSON.parse(raw); } catch { return reply(req, 400, { error: 'bad_json' }); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return reply(req, 400, { error: 'bad_payload' });

  // a bot fills the honeypot: answer as if accepted, send nothing
  if (typeof payload.website === 'string' && payload.website.trim() !== '') return reply(req, 200, { ok: true });

  const salt = env.ERROR_IP_SALT;
  const ip = clientIp(req);
  if (!perMinuteAllow(deps.recent ?? recent, ipHash(ip, salt), now())) return reply(req, 429, { error: 'rate_limited' });
  try {
    const store = deps.store ?? (await blobStore());
    if (!(await underDailyCap(store, { kind: 'picture-feedback', ip, limit: LIMITS.perDay, now: now(), salt }))) return reply(req, 429, { error: 'rate_limited' });
  } catch (e) {
    // a counter store that is down must not lose a reader's note; the per-minute brake above still holds
    console.warn('[feedback] cap store', String(e?.message || e).slice(0, 200));
  }

  const v = validate(payload);
  if (!v.ok) return reply(req, 400, { error: v.error });

  const apiKey = String(env.RESEND_API_KEY || '').trim();
  const to = String(env.FEEDBACK_TO || '').trim();
  if (!apiKey || !to) return reply(req, 503, { error: 'not_configured' });
  const from = String(env.FEEDBACK_FROM || '').trim() || FROM_DEFAULT;

  const { subject, text } = compose(v.value, new Date(now()));
  const body = { from, to: [to], subject, text };
  if (v.value.email) body.reply_to = v.value.email;
  let resp;
  try { resp = await send(apiKey, body); } catch (e) {
    console.error('[feedback] Resend fetch', String(e?.message || e).slice(0, 300));
    return reply(req, 502, { error: 'mail_unavailable' });
  }
  if (!resp.ok) {
    // the upstream body can carry account state: it goes to the log, never to the reader
    console.error('[feedback] Resend', resp.status, String(await resp.text().catch(() => '')).slice(0, 600));
    return reply(req, 502, { error: 'mail_unavailable' });
  }
  return reply(req, 200, { ok: true });
}

export default (req) => handle(req);
