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
    const code = parseInt(status, 10);
    // Netlify: `!` forces the rule even when a file exists at the path; a 200 or 404 status means SERVE the target's
    // body with that status (a rewrite), not send a Location header.
    return { from, to, status: code, force: status.endsWith('!'), rewrite: code === 200 || code === 404 };
  });
}

/** What the rules say about this path: { to, status, force, rewrite } or null. First match wins, as on the host. */
export function matchRedirect(rules, path) {
  for (const r of rules) {
    if (r.from.endsWith('/*') ? path.startsWith(r.from.slice(0, -1)) : r.from === path) return r;
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
    // A FORCED rule wins before the file system, as it does on the host (that is what `!` is for). An unforced one
    // only applies when nothing is served at the path, which is how `/* /404.html 404` can sit at the end of the
    // file without shadowing the whole site.
    if (hit && hit.force && !hit.rewrite) { res.writeHead(hit.status, { location: hit.to }); res.end(); return; }
    const resolveFile = (path) => {
      let f = join(root, path.endsWith('/') ? `${path}index.html` : path);
      if (!f.startsWith(root)) return null;
      if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
      else if (!existsSync(f) && existsSync(`${f}.html`)) f = `${f}.html`;
      return existsSync(f) && statSync(f).isFile() ? f : null;
    };
    let file = resolveFile(p);
    let status = 200;
    if (!file && hit) {
      if (hit.rewrite) { file = resolveFile(hit.to); status = hit.status; }
      else { res.writeHead(hit.status, { location: hit.to }); res.end(); return; }
    } else if (file && hit && hit.force) {
      if (hit.rewrite) { const f2 = resolveFile(hit.to); if (f2) { file = f2; status = hit.status; } }
      else { res.writeHead(hit.status, { location: hit.to }); res.end(); return; }
    }
    if (!file) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }
    if (p.endsWith('/')) p += 'index.html';
    let body = readFileSync(file);
    const h = { 'content-type': TYPES[extname(file)] || 'application/octet-stream', ...(headerRules ? headersFor(headerRules, p) : { 'cache-control': 'no-store' }), ...headers };
    if (headerRules && !h['content-type']) h['content-type'] = 'application/octet-stream';
    if (compress && /\.(html|js|css|json|svg|xml|txt)$/.test(file) && body.length > 1024 && String(req.headers['accept-encoding'] || '').includes('br')) {
      body = zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } });
      h['content-encoding'] = 'br';
    }
    h['content-length'] = body.length;
    res.writeHead(status, h);
    res.end(body);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, base: `http://127.0.0.1:${server.address().port}`, close: () => server.close(), setDir: (d) => { root = resolve(d); rules = parseRedirects(root); } })));
}
