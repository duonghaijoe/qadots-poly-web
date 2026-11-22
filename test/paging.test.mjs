// The storefront reaches every product once the catalog pages (duonghaijoe/qadots-poly-api#14).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { appFor } from '../src/app.mjs';
import { PAGE_SIZE, loadPage, rangeText } from '../public/catalog.mjs';

async function listen(t, handler) {
  const server = createServer(handler);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}

// A catalog API that pages like qadots-poly-api: default page size 20, `total` counts every product.
async function catalog(t, count) {
  const products = Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}`, price: 2, stock: 10, tags: [] }));
  const seen = [];
  const url = await listen(t, (req, res) => {
    const q = new URL(req.url, 'http://x').searchParams;
    seen.push(req.url);
    const limit = Number(q.get('limit') ?? 20);
    const offset = Number(q.get('offset') ?? 0);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ products: products.slice(offset, offset + limit), total: products.length }));
  });
  return { url, seen, products };
}

async function storefront(t, count) {
  const api = await catalog(t, count);
  const web = await listen(t, appFor({ apiUrl: api.url }));
  return { api, web, load: (offset) => loadPage(offset, { base: web }) };
}

test('a catalog of 22 products is reached in full, page by page through the storefront', async (t) => {
  const { api, load } = await storefront(t, 22);

  const first = await load(0);
  assert.equal(first.products.length, 20);
  assert.equal(first.total, 22);
  assert.equal(first.hasPrev, false);
  assert.equal(first.hasNext, true, 'the first page offers the next one');
  assert.equal(rangeText(first), 'Showing 1–20 of 22 products');

  const second = await load(first.offset + first.products.length);
  assert.deepEqual(second.products.map((p) => p.name), ['Item 21', 'Item 22']);
  assert.equal(second.hasPrev, true);
  assert.equal(second.hasNext, false, 'the last page offers no next one');
  assert.equal(rangeText(second), 'Showing 21–22 of 22 products');

  assert.deepEqual([...first.products, ...second.products].map((p) => p.id), api.products.map((p) => p.id));
  assert.ok(api.seen.every((u) => u.includes(`limit=${PAGE_SIZE}`)), 'the storefront asks for its page size, not the API default');
});

test('walking Next from the first page reaches every product exactly once', async (t) => {
  const { load } = await storefront(t, 95);
  const ids = [];
  let page = await load(0);
  for (;;) {
    ids.push(...page.products.map((p) => p.id));
    if (!page.hasNext) break;
    page = await load(page.offset + page.products.length);
  }
  assert.deepEqual(ids, Array.from({ length: 95 }, (_, i) => i + 1));
});

test('a catalog that fits on one page has no next page, and an empty one says so', async (t) => {
  const small = await (await storefront(t, 3)).load(0);
  assert.equal(small.products.length, 3);
  assert.equal(small.hasNext, false);
  assert.equal(rangeText(small), 'Showing 1–3 of 3 products');
  const empty = await (await storefront(t, 0)).load(0);
  assert.equal(rangeText(empty), 'No products yet');
  assert.equal(empty.hasNext, false);
});

test('a page past the end of a shrunken catalog falls back to its last page', async (t) => {
  const page = await (await storefront(t, 22)).load(40);
  assert.equal(page.offset, 20);
  assert.deepEqual(page.products.map((p) => p.id), [21, 22]);
});

test('the page loads the catalog module and has Previous and Next buttons', async (t) => {
  const { web } = await storefront(t, 1);
  const html = await (await fetch(web + '/')).text();
  assert.match(html, /from '\/catalog\.mjs'/);
  assert.match(html, /<button id="prev">Previous<\/button>/);
  assert.match(html, /<button id="next">Next<\/button>/);
  const mod = await fetch(web + '/catalog.mjs');
  assert.equal(mod.status, 200);
  assert.match(mod.headers.get('content-type'), /javascript/);
  assert.match(await mod.text(), /export async function loadPage/);
});
