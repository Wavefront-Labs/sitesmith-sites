// Host header picks the site folder. Previews are unlisted: X-Robots-Tag noindex on every response.
// Owner self-service (13 Nov 2026): /edit is a menu editor reached by a magic link (?t=token, emailed by sitesmith/mail.py grant), the
// saved menu lives in KV as menu:<slug> and the site renders it live via /api/menu. No passwords, no accounts.
const EDITOR = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Edit menu</title>
<style>body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#f6f3ee;color:#1f1a16}.wrap{max-width:760px;margin:0 auto;padding:16px}h1{font-size:1.4rem;margin:8px 0 4px}p.m{color:#6b6560;margin:0 0 16px;font-size:.95rem}
.sec{background:#fff;border:1px solid #e3ddd3;border-radius:12px;padding:12px;margin-bottom:14px}.sec input.t{font-weight:700;font-size:1.05rem;border:0;border-bottom:1px solid #e3ddd3;width:100%;padding:6px 0;margin-bottom:8px}
.row{display:grid;grid-template-columns:1fr 90px 36px;gap:6px;align-items:start;margin-bottom:6px}.row input{width:100%;padding:8px;border:1px solid #d8d2c8;border-radius:8px;font:inherit;box-sizing:border-box}.row .d{grid-column:1/3}.row input.d{font-size:.9rem}
button{font:inherit;border:0;border-radius:8px;padding:8px 12px;cursor:pointer}.x{background:#f3ebe6;color:#8a2b1b}.add{background:#eee8df}.save{background:#1f6f5f;color:#fff;font-weight:700;padding:12px 20px;font-size:1.05rem}
.bar{position:sticky;bottom:0;background:#f6f3eeee;padding:12px 0;display:flex;gap:10px;align-items:center}#msg{color:#1f6f5f;font-weight:600}</style></head>
<body><div class="wrap"><h1>Your menu</h1><p class="m">Add or remove items, change prices, then press Save. The website updates straight away. Leave the price blank if you don't show prices.</p>
<div id="secs"></div><button class="add" onclick="addSec()">+ Add a section</button>
<div class="bar"><button class="save" onclick="save()">Save menu</button><span id="msg"></span></div></div>
<script>
let menu=[];const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function render(){$('#secs').innerHTML=menu.map((s,i)=>\`<div class="sec"><input class="t" placeholder="Section name (e.g. Mains)" value="\${esc(s.title)}" oninput="menu[\${i}].title=this.value">
\${s.items.map((it,j)=>\`<div class="row"><input placeholder="Item name" value="\${esc(it.name)}" oninput="menu[\${i}].items[\${j}].name=this.value"><input placeholder="$" value="\${esc(it.price)}" oninput="menu[\${i}].items[\${j}].price=this.value"><button class="x" title="Remove" onclick="menu[\${i}].items.splice(\${j},1);render()">x</button><input class="d" placeholder="Description (optional)" value="\${esc(it.desc)}" oninput="menu[\${i}].items[\${j}].desc=this.value"></div>\`).join('')}
<button class="add" onclick="menu[\${i}].items.push({name:'',desc:'',price:''});render()">+ Add item</button> <button class="x" onclick="if(confirm('Remove this whole section?')){menu.splice(\${i},1);render()}">Remove section</button></div>\`).join('')}
function addSec(){menu.push({title:'',items:[{name:'',desc:'',price:''}]});render()}
async function save(){const clean=menu.map(s=>({title:s.title.trim(),items:s.items.filter(i=>i.name.trim()).map(i=>({name:i.name.trim(),desc:(i.desc||'').trim(),price:(i.price||'').trim()}))})).filter(s=>s.title||s.items.length);
const r=await fetch('/api/menu',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(clean)});$('#msg').textContent=r.ok?'Saved. Your site is updated.':'Could not save: '+(await r.text());if(r.ok)setTimeout(()=>$('#msg').textContent='',4000)}
fetch('/api/menu').then(r=>r.ok?r.json():[]).then(m=>{menu=m.length?m:[{title:'',items:[{name:'',desc:'',price:''}]}];render()});
</script></body></html>`;

const H = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' };

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.hostname.match(/^([a-z0-9-]+)-preview\.wavefrontlabs\.dev$/);
    if (!m) return new Response('not found', { status: 404 });
    const slug = m[1];
    const cookie = req.headers.get('cookie') || '';
    const tok = (cookie.match(/(?:^|;\s*)edit=([A-Za-z0-9_-]+)/) || [])[1];
    const authed = async () => tok && (await env.SITEDATA.get(`token:${slug}:${tok}`)) !== null;

    if (url.pathname === '/api/menu') {
      if (req.method === 'GET') {
        const v = await env.SITEDATA.get(`menu:${slug}`);
        return v ? new Response(v, { headers: { ...H, 'content-type': 'application/json' } }) : new Response('[]', { status: 404, headers: H });
      }
      if (req.method === 'PUT') {
        if (!(await authed())) return new Response('not signed in', { status: 401, headers: H });
        const body = await req.text();
        if (body.length > 60000) return new Response('menu too large', { status: 413, headers: H });
        try { const j = JSON.parse(body); if (!Array.isArray(j)) throw 0; } catch { return new Response('bad menu', { status: 400, headers: H }); }
        await env.SITEDATA.put(`menu:${slug}`, body);
        return new Response('ok', { headers: H });
      }
    }
    if (url.pathname === '/edit') {
      const t = url.searchParams.get('t');
      if (t && (await env.SITEDATA.get(`token:${slug}:${t}`)) !== null)
        return new Response(null, { status: 302, headers: { ...H, Location: '/edit', 'Set-Cookie': `edit=${t}; Path=/; Max-Age=5184000; Secure; HttpOnly; SameSite=Lax` } });
      if (await authed()) return new Response(EDITOR, { headers: { ...H, 'content-type': 'text/html; charset=utf-8' } });
      return new Response('<!doctype html><meta name="viewport" content="width=device-width"><p style="font:16px system-ui;padding:24px">This edit link has expired. Reply to our email and we will send a fresh one.</p>', { status: 403, headers: { ...H, 'content-type': 'text/html; charset=utf-8' } });
    }

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
