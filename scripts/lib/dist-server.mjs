// A tiny static server for a built dist/ that behaves like the host for the things the gallery depends on:
// directory indexes (/p/<id> -> /p/<id>/index.html), pretty URLs for .html, and dist/_redirects (first match
// wins; "!" forces; a trailing * is a splat). Used by the verify and screenshot scripts so they test what a reader gets.
import http from 'node:http';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import zlib from 'node:zlib';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.txt': 'text/plain', '.xml': 'application/xml', '.gz': 'application/gzip', '.woff2': 'font/woff2' };

export function parseRedirects(dir) {
  const f = join(dir, '_redirects');
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => {
    const [from, to, status = '301'] = l.split(/\s+/);
    return { from, to, status: parseInt(status, 10), force: status.endsWith('!') };
  });
}

/** What the rules say about this path: { to, status } or null. */
export function matchRedirect(rules, path) {
  for (const r of rules) {
    if (r.from.endsWith('/*') ? path.startsWith(r.from.slice(0, -1)) : r.from === path) return { to: r.to, status: r.status };
  }
  return null;
}

/** The `[[headers]]` blocks of a netlify.toml as [{ for, values }], so a test server can send what the host sends. */
export function parseNetlifyHeaders(tomlText) {
  const out = [];
  let cur = null, inValues = false;
  for (const raw of tomlText.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '').trim();
    if (line === '[[headers]]') { cur = { for: '', values: {} }; out.push(cur); inValues = false; continue; }
    if (line === '[headers.values]') { inValues = true; continue; }
    if (line.startsWith('[')) { cur = null; inValues = false; continue; }
    if (!cur) continue;
    const m = /^([A-Za-z0-9_-]+)\s*=\s*"(.*)"$/.exec(line);
    if (!m) continue;
    if (inValues) cur.values[m[1]] = m[2]; else if (m[1] === 'for') cur.for = m[2];
  }
  return out;
}
/** Netlify's rule: every matching block applies in file order and a later value of the same header replaces an earlier one. */
export function headersFor(rules, path) {
  const h = {};
  for (const r of rules) {
    const re = new RegExp(`^${r.for.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    if (re.test(path)) for (const [k, v] of Object.entries(r.values)) h[k.toLowerCase()] = v;
  }
  return h;
}

/** `headerRules` (from parseNetlifyHeaders) replace the blanket no-store; `handler(req, res, url)` may answer a request itself
 *  (return true); `onRequest(req)` sees every request; the returned `setDir` points the server at another build (a simulated deploy). */
export function serveDist(dir, { compress = false, headers = {}, headerRules = null, handler = null, onRequest = null } = {}) {
  let root = resolve(dir);
  let rules = parseRedirects(root);
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    onRequest?.(req);
    if (handler?.(req, res, u)) return;
    let p = decodeURIComponent(u.pathname);
    const hit = matchRedirect(rules, p);
    if (hit) { res.writeHead(hit.status, { location: hit.to }); res.end(); return; }
    if (p.endsWith('/')) p += 'index.html';
    let file = join(root, p);
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    else if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
    if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }
    let body = readFileSync(file);
    const h = { 'content-type': TYPES[extname(file)] || 'application/octet-stream', ...(headerRules ? headersFor(headerRules, p) : { 'cache-control': 'no-store' }), ...headers };
    if (headerRules && !h['content-type']) h['content-type'] = 'application/octet-stream';
    if (compress && /\.(html|js|css|json|svg|xml|txt)$/.test(file) && body.length > 1024 && String(req.headers['accept-encoding'] || '').includes('br')) {
      body = zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } });
      h['content-encoding'] = 'br';
    }
    h['content-length'] = body.length;
    res.writeHead(200, h);
    res.end(body);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, base: `http://127.0.0.1:${server.address().port}`, close: () => server.close(), setDir: (d) => { root = resolve(d); rules = parseRedirects(root); } })));
}
