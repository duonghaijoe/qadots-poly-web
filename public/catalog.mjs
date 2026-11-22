// Reads the catalog one page at a time through the API's limit/offset paging (qadots-poly-api#12).
// Shared by the page and the tests, so it takes fetch and the base URL as options.
export const PAGE_SIZE = 20;

export async function loadPage(offset = 0, { fetch = globalThis.fetch, base = '' } = {}) {
  const get = async (at) => {
    const res = await fetch(`${base}/api/products?limit=${PAGE_SIZE}&offset=${at}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `the catalog answered ${res.status}`);
    return body;
  };
  let { products, total } = await get(offset);
  // The catalog shrank since the last page was read: show its last page instead of an empty one.
  if (!products.length && offset > 0 && total > 0) {
    offset = Math.floor((total - 1) / PAGE_SIZE) * PAGE_SIZE;
    ({ products, total } = await get(offset));
  }
  return { products, total, offset, hasPrev: offset > 0, hasNext: offset + products.length < total };
}

export const rangeText = ({ products, total, offset }) =>
  total ? `Showing ${offset + 1}–${offset + products.length} of ${total} products` : 'No products yet';
