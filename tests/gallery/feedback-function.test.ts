// The feedback function (netlify/functions/feedback.mjs): validation, the honeypot, both rate limits, the origin rule, the mail it
// builds and what it never says. The mailer, the counter store and the clock are mocks: no network, no real mail, no secret.
import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error plain ES module without types
import { compose, handle, LIMITS, perMinuteAllow, REASONS, underDailyCap, validate } from '../../netlify/functions/feedback.mjs';

const ENV = { RESEND_API_KEY: 're_test_not_a_key', FEEDBACK_TO: 'owner@example.test', FEEDBACK_FROM: 'Test <from@example.test>', ERROR_IP_SALT: 'salt' };
const GOOD = {
  pictureId: 'genesis-15-1', reasons: ['picture', 'bible'], message: 'The stars look wrong.', email: 'reader@example.test',
  context: { ref: 'Genesis 15:1–21', url: 'https://world.yahwehword.com/scenes.html#p=genesis-15-1', lang: 'zh-Hans', edition: 'cuvs-yhwh', theme: 'paper (auto)', userAgent: 'Mozilla/5.0 (Test)', time: '2026-11-03T20:00:00+11:00', viewport: '375x812' },
};
const req = (body: unknown, o: { method?: string; headers?: Record<string, string> } = {}) =>
  new Request('https://world.yahwehword.com/api/feedback', { method: o.method ?? 'POST', headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': '203.0.113.9', ...(o.headers ?? {}) }, body: o.method === 'GET' || o.method === 'OPTIONS' ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
function kit() {
  const sent: { apiKey: string; body: Record<string, unknown> }[] = [];
  const counts = new Map<string, number>();
  return {
    sent,
    deps: {
      env: ENV,
      send: async (apiKey: string, body: Record<string, unknown>) => { sent.push({ apiKey, body }); return new Response('{}', { status: 200 }); },
      store: { get: async (k: string) => counts.get(k) ?? 0, set: async (k: string, v: number) => { counts.set(k, v); } },
      recent: new Map(),
      now: () => Date.UTC(2026, 10, 3, 9, 0, 0),
    } as Record<string, unknown>,
    counts,
  };
}
const json = async (r: Response) => r.json() as Promise<Record<string, unknown>>;

test('a good report is mailed once, to FEEDBACK_TO, from FEEDBACK_FROM, with the reader’s address as reply-to', async () => {
  const k = kit();
  const r = await handle(req(GOOD), k.deps);
  assert.equal(r.status, 200);
  assert.deepEqual(await json(r), { ok: true });
  assert.equal(k.sent.length, 1);
  const m = k.sent[0]!;
  assert.equal(m.apiKey, ENV.RESEND_API_KEY);
  assert.deepEqual(m.body.to, ['owner@example.test']);
  assert.equal(m.body.from, 'Test <from@example.test>');
  assert.equal(m.body.reply_to, 'reader@example.test');
  assert.match(String(m.body.subject), /genesis-15-1/);
  assert.ok(!/[\r\n]/.test(String(m.body.subject)));
});

test('the payload shape: the mail carries the picture, the reference, the page, the language, the edition, the theme, the user agent, the time, the text and the reasons', async () => {
  const k = kit();
  await handle(req(GOOD), k.deps);
  const text = String(k.sent[0]!.body.text);
  for (const want of ['The stars look wrong.', 'Picture id  : genesis-15-1', 'Genesis 15:1–21', 'https://world.yahwehword.com/scenes.html#p=genesis-15-1',
    'Language    : zh-Hans', 'Edition     : cuvs-yhwh', 'Theme       : paper (auto)', 'User-Agent  : Mozilla/5.0 (Test)', 'Received    : 2026-11-03 09:00:00 UTC',
    REASONS.picture, REASONS.bible, 'Reply-to    : reader@example.test', 'Reader local: 2026-11-03T20:00:00+11:00']) assert.ok(text.includes(want), `missing: ${want}`);
  assert.ok(!text.includes(ENV.RESEND_API_KEY), 'the mail never carries the key');
});

test('an empty report is allowed: no text, no reasons, no address; the picture id is the report', async () => {
  const k = kit();
  const r = await handle(req({ pictureId: 'psalms-23-1', reasons: [], message: '', email: '', context: {} }), k.deps);
  assert.equal(r.status, 200);
  assert.equal(k.sent.length, 1);
  assert.match(String(k.sent[0]!.body.text), /no text: the picture and the reasons are the report/);
  assert.equal('reply_to' in k.sent[0]!.body, false);
});

test('validation: bad JSON, a non-object, an unknown picture id, a bad address, an over-long message', async () => {
  const k = kit();
  const h = (b: unknown) => { (k.deps.recent as Map<string, number[]>).clear(); return handle(req(b), k.deps); };
  assert.equal((await h('{nope')).status, 400);
  assert.equal((await h([1, 2])).status, 400);
  assert.equal((await json(await h({ ...GOOD, pictureId: '../etc/passwd' }))).error, 'bad_picture');
  assert.equal((await json(await h({ ...GOOD, pictureId: '' }))).error, 'bad_picture');
  assert.equal((await json(await h({ ...GOOD, email: 'a b@c' }))).error, 'bad_email');
  assert.equal((await json(await h({ ...GOOD, email: 'x@y.zz\nBcc: evil@example.test' }))).error, 'bad_email');
  assert.equal((await json(await h({ ...GOOD, message: 'x'.repeat(LIMITS.message + 1) }))).error, 'message_too_long');
  assert.equal(k.sent.length, 0);
});

test('size cap: a body over 12 KB is 413 and is never parsed or mailed', async () => {
  const k = kit();
  const r = await handle(req(JSON.stringify({ ...GOOD, message: 'x'.repeat(13000) }), {}), k.deps);
  assert.equal(r.status, 413);
  assert.equal(k.sent.length, 0);
});

test('fields are cut to size and cleaned: unknown reasons dropped, at most four, line breaks stripped from anything that reaches a header', () => {
  const v = validate({ ...GOOD, reasons: ['picture', 'picture', 'caption', 'bible', 'other', 'nonsense', '<b>'], context: { ref: 'Gen\r\nBcc: x', url: 'u'.repeat(900), userAgent: 'a\nb', lang: 'xx', edition: 'Bad Id', theme: 'neon' } });
  assert.ok(v.ok);
  assert.deepEqual(v.value.reasons, ['picture', 'caption', 'bible', 'other']);
  assert.equal(v.value.ref, 'Gen Bcc: x');
  assert.equal(v.value.pageUrl.length, 500);
  assert.equal(v.value.userAgent, 'a b');
  assert.equal(v.value.lang, '');
  assert.equal(v.value.edition, '');
  assert.equal(v.value.theme, '');
  const { subject } = compose(v.value);
  assert.ok(!/[\r\n]/.test(subject));
});

test('the honeypot: a filled `website` field is answered ok and sends nothing', async () => {
  const k = kit();
  const r = await handle(req({ ...GOOD, website: 'http://spam.example' }), k.deps);
  assert.equal(r.status, 200);
  assert.deepEqual(await json(r), { ok: true });
  assert.equal(k.sent.length, 0);
  assert.equal(k.counts.size, 0, 'a bot does not even use a counter');
  assert.equal((await handle(req({ ...GOOD, website: '   ' }), k.deps)).status, 200);
  assert.equal(k.sent.length, 1, 'a blank honeypot is a real reader');
});

test('rate limit, per minute: the fourth report from one address inside a minute is 429', async () => {
  const k = kit();
  const out = [];
  for (let i = 0; i < 4; i++) out.push((await handle(req(GOOD), k.deps)).status);
  assert.deepEqual(out, [200, 200, 200, 429]);
  assert.equal(k.sent.length, 3);
  // another address is not held back
  assert.equal((await handle(req(GOOD, { headers: { 'x-nf-client-connection-ip': '198.51.100.4' } }), k.deps)).status, 200);
  assert.equal(perMinuteAllow(new Map(), 'k', 0, 1), true);
});

test('rate limit, per day: the eleventh report from one address today is 429; the counter holds a salted hash, never the address', async () => {
  const k = kit();
  for (let i = 0; i < LIMITS.perDay; i++) { (k.deps.recent as Map<string, number[]>).clear(); assert.equal((await handle(req(GOOD), k.deps)).status, 200, `report ${i + 1}`); }
  (k.deps.recent as Map<string, number[]>).clear();
  assert.equal((await handle(req(GOOD), k.deps)).status, 429);
  assert.equal(k.sent.length, LIMITS.perDay);
  for (const key of k.counts.keys()) assert.ok(!key.includes('203.0.113.9') && /^cap\/picture-feedback\/2026-11-03\/[0-9a-f]{16}$/.test(key), key);
  const s = { m: new Map<string, number>(), get: async (x: string) => s.m.get(x) ?? 0, set: async (x: string, v: number) => { s.m.set(x, v); } };
  assert.equal(await underDailyCap(s, { kind: 'a', ip: '1.1.1.1', limit: 1, now: 0 }), true);
  assert.equal(await underDailyCap(s, { kind: 'a', ip: '1.1.1.1', limit: 1, now: 0 }), false);
});

test('a counter store that is down does not lose a reader’s note', async () => {
  const k = kit();
  k.deps.store = { get: async () => { throw new Error('blobs down'); }, set: async () => { throw new Error('blobs down'); } };
  const warn = console.warn; console.warn = () => {};
  try { assert.equal((await handle(req(GOOD), k.deps)).status, 200); } finally { console.warn = warn; }
  assert.equal(k.sent.length, 1);
});

test('the origin rule: this site may post, another site’s page may not, a script with no Origin may (as in Words)', async () => {
  const k = kit();
  assert.equal((await handle(req(GOOD, { headers: { origin: 'https://world.yahwehword.com' } }), k.deps)).status, 200);
  const bad = await handle(req(GOOD, { headers: { origin: 'https://evil.example' } }), k.deps);
  assert.equal(bad.status, 403);
  assert.notEqual(bad.headers.get('access-control-allow-origin'), 'https://evil.example');
  assert.equal(k.sent.length, 1);
  assert.equal((await handle(req(GOOD), k.deps)).status, 200);
});

test('methods: OPTIONS is 204 with CORS, GET is 405', async () => {
  const k = kit();
  const o = await handle(req(null, { method: 'OPTIONS', headers: { origin: 'https://world.yahwehword.com' } }), k.deps);
  assert.equal(o.status, 204);
  assert.equal(o.headers.get('access-control-allow-origin'), 'https://world.yahwehword.com');
  assert.equal((await handle(req(null, { method: 'GET' }), k.deps)).status, 405);
});

test('not configured: without RESEND_API_KEY or FEEDBACK_TO the answer is 503 not_configured (the page then offers mailto:)', async () => {
  for (const env of [{ ...ENV, RESEND_API_KEY: '' }, { ...ENV, FEEDBACK_TO: undefined }, {}]) {
    const k = kit(); k.deps.env = env;
    const r = await handle(req(GOOD), k.deps);
    assert.equal(r.status, 503);
    assert.deepEqual(await json(r), { error: 'not_configured' });
    assert.equal(k.sent.length, 0);
  }
});

test('the mail service failing is 502 with a generic message: the upstream’s own words and the key never reach the reader', async () => {
  const k = kit();
  k.deps.send = async () => new Response('account quota exceeded for re_test_not_a_key', { status: 429 });
  const err = console.error; console.error = () => {};
  let r: Response;
  try { r = await handle(req(GOOD), k.deps); } finally { console.error = err; }
  assert.equal(r.status, 502);
  const body = JSON.stringify(await json(r));
  assert.ok(!/quota|re_test|account/.test(body), body);
  k.deps.send = async () => { throw new Error('ECONNRESET re_test_not_a_key'); };
  console.error = () => {};
  try { r = await handle(req(GOOD), k.deps); } finally { console.error = err; }
  assert.equal(r.status, 502);
  assert.ok(!/ECONNRESET|re_test/.test(JSON.stringify(await json(r))));
});

test('the environment variables are the ones Words names: RESEND_API_KEY, FEEDBACK_TO, FEEDBACK_FROM, ERROR_IP_SALT', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../../netlify/functions/feedback.mjs', import.meta.url), 'utf8');
  const names = [...new Set([...src.matchAll(/env\.([A-Z_]+)/g)].map((m) => m[1]))].sort();
  assert.deepEqual(names, ['ERROR_IP_SALT', 'FEEDBACK_FROM', 'FEEDBACK_TO', 'RESEND_API_KEY']);
  assert.ok(!/re_[A-Za-z0-9]{20,}/.test(src), 'no key in the source');
});
