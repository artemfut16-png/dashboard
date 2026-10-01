// Builds the standalone (GitHub Pages + Supabase) version of the dashboard from the artifact source.
// usage: node build-site.js <SUPABASE_URL> <SUPABASE_ANON_KEY>
const fs = require("fs");
const [url, key] = process.argv.slice(2);
if (!url || !key) { console.error("usage: node build-site.js <url> <anon key>"); process.exit(1); }
let h = fs.readFileSync("leads-crm.html", "utf8");
const rep = (a, b) => { if (!h.includes(a)) throw new Error("miss: " + a.slice(0, 80)); h = h.replace(a, b); };

// ---- login screen + logout button ----
rep("</style>", `
/* login */
#login{position:fixed;inset:0;z-index:100;background:#000;display:grid;place-items:center;padding:16px}
#login form{width:min(380px,100%);display:flex;flex-direction:column;gap:12px;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:26px}
#login h2{margin:0 0 4px;font-size:24px;font-weight:700;letter-spacing:-.02em}
#login p{margin:0 0 6px;color:var(--muted);font-size:14px}
#login label{display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--muted)}
#login input{height:40px;background:transparent;border:1px solid var(--input);border-radius:8px;padding:0 12px;color:var(--ink);font-size:15px}
#login .err{color:var(--bad);font-size:13px;min-height:18px}
.side .logout{margin-top:auto}
</style>`);
rep(`<div class="app" id="app">`, `<div id="login" hidden>
  <form id="loginForm">
    <h2>Дашборд</h2>
    <p>Войдите, чтобы открыть CRM и аналитику.</p>
    <label>Почта<input id="lgEmail" type="email" autocomplete="username" required></label>
    <label>Пароль<input id="lgPass" type="password" autocomplete="current-password" required></label>
    <div class="err" id="lgErr" role="alert"></div>
    <button class="btn primary" type="submit" id="lgBtn">Войти</button>
  </form>
</div>
<div class="app" id="app">`);
rep(`  </aside>
  <div class="sidescrim" id="sideScrim"></div>`, `    <button class="sbtn logout" id="logoutBtn" type="button" title="Выйти"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg><span class="lbl">Выйти</span></button>
  </aside>
  <div class="sidescrim" id="sideScrim"></div>`);

// ---- data layer: same doc()/collection() surface the page already uses, backed by Supabase ----
const adapter = `
/* ---------- Supabase data layer ---------- */
const sb = supabase.createClient(${JSON.stringify(url)}, ${JSON.stringify(key)});
function makeDb(){
  const cache = new Map();          // coll -> Map(id -> data)
  const loading = new Map();        // coll -> Promise
  const collSubs = new Map(), docSubs = new Map();
  const snap = (id, data) => ({id, exists: data != null, data: () => data});
  const split = path => { const i = path.indexOf('/'); return [path.slice(0, i), path.slice(i + 1)]; };
  function load(coll){
    if (!loading.has(coll)) loading.set(coll, sb.from('docs').select('id,data').eq('coll', coll).then(({data, error}) => {
      if (error) throw error;
      const m = cache.get(coll) || new Map();
      (data || []).forEach(r => { if (!m.has(r.id)) m.set(r.id, r.data); });
      cache.set(coll, m); return m;
    }));
    return loading.get(coll);
  }
  function emit(coll, id){
    const m = cache.get(coll) || new Map();
    (collSubs.get(coll) || []).forEach(fn => fn({docs: [...m].map(([i, d]) => snap(i, d))}));
    (docSubs.get(coll + '/' + id) || []).forEach(fn => fn(snap(id, m.get(id))));
  }
  const put = (coll, id, data) => { if (!cache.has(coll)) cache.set(coll, new Map()); cache.get(coll).set(id, data); emit(coll, id); };
  const fail = error => { const e = new Error(error.message); e.code = /row-level|permission|JWT|401|403/i.test(error.message + ' ' + (error.code || '')) ? 'invalid_argument' : 'unavailable'; return e; };
  sb.channel('docs-all').on('postgres_changes', {event: '*', schema: 'public', table: 'docs'}, p => {
    const row = p.eventType === 'DELETE' ? p.old : p.new; if (!row || !row.path) return;
    const [coll, id] = split(row.path);
    if (!cache.has(coll)) return;
    if (p.eventType === 'DELETE') cache.get(coll).delete(id); else cache.get(coll).set(id, row.data);
    emit(coll, id);
  }).subscribe();
  const docRef = path => {
    const [coll, id] = split(path);
    return {
      id, path,
      async get(){ const m = await load(coll); return snap(id, m.get(id)); },
      async set(data){
        put(coll, id, data);
        const {error} = await sb.from('docs').upsert({path, coll, id, data, updated_at: new Date().toISOString()});
        if (error) throw fail(error);
      },
      async update(patch){
        const m = await load(coll), cur = m.get(id);
        if (cur == null){ const e = new Error('no document'); e.code = 'invalid_argument'; throw e; }
        const data = {...cur, ...patch};
        put(coll, id, data);
        const {error} = await sb.from('docs').upsert({path, coll, id, data, updated_at: new Date().toISOString()});
        if (error) throw fail(error);
      },
      async delete(){
        if (cache.has(coll)){ cache.get(coll).delete(id); emit(coll, id); }
        const {error} = await sb.from('docs').delete().eq('path', path);
        if (error) throw fail(error);
      },
      onSnapshot(fn, onErr){
        if (!docSubs.has(path)) docSubs.set(path, new Set());
        docSubs.get(path).add(fn);
        load(coll).then(m => fn(snap(id, m.get(id))), e => onErr && onErr(fail(e)));
        return () => docSubs.get(path).delete(fn);
      },
    };
  };
  return {
    doc: docRef,
    collection: coll => ({
      doc: id => docRef(coll + '/' + id),
      onSnapshot(fn, onErr){
        if (!collSubs.has(coll)) collSubs.set(coll, new Set());
        collSubs.get(coll).add(fn);
        load(coll).then(m => fn({docs: [...m].map(([i, d]) => snap(i, d))}), e => onErr && onErr(fail(e)));
        return () => collSubs.get(coll).delete(fn);
      },
    }),
  };
}

/* ---------- boot ---------- */`;
rep("/* ---------- boot ---------- */", adapter);

rep(`(async () => {
  try { db = await window.claude?.use?.('db'); } catch { db = null; }
  if (!db){
    $('#sub').hidden = false; $('#sub').textContent = 'База недоступна. Откройте страницу на claude.ai, войдя в аккаунт.';
    return;
  }`, `$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('#lgErr').textContent = ''; $('#lgBtn').disabled = true;
  const {error} = await sb.auth.signInWithPassword({email: $('#lgEmail').value.trim(), password: $('#lgPass').value});
  $('#lgBtn').disabled = false;
  if (error){ $('#lgErr').textContent = /invalid/i.test(error.message) ? 'Неверная почта или пароль' : 'Не удалось войти. Проверьте соединение.'; return; }
  location.reload();
});
$('#logoutBtn').addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });
(async () => {
  const {data: {session}} = await sb.auth.getSession();
  if (!session){ $('#login').hidden = false; $('#lgEmail').focus(); return; }
  db = makeDb();`);
h = h.split("Откройте страницу на claude.ai, войдя в аккаунт.").join("Обновите страницу и войдите заново.");

// ---- standalone document skeleton ----
const titleEnd = h.indexOf("</title>") + "</title>".length;
const body = h.slice(titleEnd);
const styleEnd = body.indexOf("</style>") + "</style>".length;
const out = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>Дашборд</title>
<style>:root{color-scheme:dark}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
${body.slice(0, styleEnd).trim()}
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
</head>
<body>
${body.slice(styleEnd).trim()}
</body>
</html>
`;
fs.mkdirSync("site", {recursive: true});
fs.writeFileSync("site/index.html", out);
new Function(out.split("<script>")[1].split("</script>")[0]);
console.log("built site/index.html", out.length, "bytes");
