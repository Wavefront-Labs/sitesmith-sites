// Host header picks the site folder. Previews are unlisted: X-Robots-Tag noindex on every response.
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.hostname.match(/^([a-z0-9-]+)-preview\.wavefrontlabs\.dev$/);
    if (!m) return new Response('not found', { status: 404 });
    const slug = m[1];
    const path = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
    let r = await env.ASSETS.fetch(new Request(new URL(`/sites/${slug}${path}`, url), req));
    if (r.status === 404) r = await env.ASSETS.fetch(new URL('/404.html', url));
    const h = new Headers(r.headers);
    h.set('X-Robots-Tag', 'noindex, nofollow');
    h.set('Cache-Control', 'no-cache');
    return new Response(r.body, { status: r.status === 200 ? r.status : 404, headers: h });
  },
};
