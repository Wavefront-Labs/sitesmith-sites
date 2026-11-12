// Host header picks the site folder. Previews are unlisted: X-Robots-Tag noindex on every response.
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.hostname.match(/^([a-z0-9-]+)-preview\.wavefrontlabs\.dev$/);
    if (!m) return new Response('not found', { status: 404 });
    const slug = m[1];
    // Assets resolve a directory path to its index.html themselves (and redirect /index.html to /), so pass the path through as is.
    let r = await env.ASSETS.fetch(new Request(new URL(`/${slug}${url.pathname}`, url), req));
    let status = r.status;
    if (status === 404) { r = await env.ASSETS.fetch(new URL('/404.html', url)); status = 404; }
    const h = new Headers(r.headers);
    h.set('X-Robots-Tag', 'noindex, nofollow');
    h.set('Cache-Control', 'no-cache');
    if (status >= 300 && status < 400 && h.get('location')) h.set('location', h.get('location').replace(`/${slug}/`, '/'));
    return new Response(r.body, { status, headers: h });
  },
};
