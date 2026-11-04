import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNetlifyHeaders, headersFor } from '../../scripts/lib/dist-server.mjs';

const rules = parseNetlifyHeaders(readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8'));
test('stable fonts cache for a year without an immutable promise', () => {
  assert.equal(headersFor(rules, '/fonts/fonts.css')['cache-control'], 'public, max-age=31536000');
});
test('stable pictures cache and revalidate while worker and page updates remain immediate', () => {
  for (const kind of ['thumb', 'full']) {
    const h = headersFor(rules, `/pictures/${kind}/genesis-1-1.webp`);
    assert.equal(h['cache-control'], 'public, max-age=86400, stale-while-revalidate=31536000');
    assert.equal(h['x-content-type-options'], 'nosniff');
  }
  assert.match(headersFor(rules, '/sw.js')['cache-control'], /no-store/);
  assert.match(headersFor(rules, '/index.html')['cache-control'], /no-cache/);
});
