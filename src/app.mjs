// The storefront of the shop: one page, and /api/* passed through to the catalog API at API_URL.
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const page = () => readFileSync(new URL('../public/index.html', import.meta.url));

export function appFor(info = {}) {
  const api = info.apiUrl ?? 'http://127.0.0.1:4721';
  return async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }
    if (url.pathname === '/version') {
      let upstream = null;
      try {
        upstream = await (await fetch(`${api}/version`, { signal: AbortSignal.timeout(2_000) })).json();
      } catch {
        /* the API is down: the page still says what it runs */
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ name: 'storefront', version: pkg.version, sha: info.sha ?? null, env: info.env ?? null, api: upstream }));
    }
    if (url.pathname.startsWith('/api/')) {
      let body;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        body = '';
        for await (const chunk of req) body += chunk;
      }
      try {
        const up = await fetch(api + url.pathname + url.search, { method: req.method, headers: { 'content-type': 'application/json' }, body, signal: AbortSignal.timeout(5_000) });
        res.writeHead(up.status, { 'content-type': up.headers.get('content-type') ?? 'application/json' });
        return res.end(Buffer.from(await up.arrayBuffer()));
      } catch {
        res.writeHead(502, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: 'the catalog is not answering' }));
      }
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(page());
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  };
}
