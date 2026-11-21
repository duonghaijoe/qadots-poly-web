import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { appFor } from '../src/app.mjs';

async function listen(handler) {
  const server = createServer(handler);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

test('serves the page and says what it runs', async () => {
  const api = await listen((req, res) => res.end(JSON.stringify({ name: 'catalog-api', version: '9.9.9' })));
  const web = await listen(appFor({ sha: 'abc', env: 'test', apiUrl: api.url }));
  assert.match(await (await fetch(web.url + '/')).text(), /<h1>Shop<\/h1>/);
  const v = await (await fetch(web.url + '/version')).json();
  assert.equal(v.name, 'storefront');
  assert.equal(v.api.version, '9.9.9');
  web.close();
  api.close();
});

test('passes /api through and answers 502 when the API is down', async () => {
  const api = await listen((req, res) => { res.writeHead(201, { 'content-type': 'application/json' }); res.end(JSON.stringify({ path: req.url, method: req.method })); });
  const web = await listen(appFor({ apiUrl: api.url }));
  const res = await fetch(web.url + '/api/products?x=1', { method: 'POST', body: '{}' });
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { path: '/api/products?x=1', method: 'POST' });
  api.close();
  const down = await fetch(web.url + '/api/products');
  assert.equal(down.status, 502);
  web.close();
});
