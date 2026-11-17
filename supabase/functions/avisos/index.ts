// Tribuna · avisos (Supabase Edge Function, Deno).
// Cada 2 minutos (pg_cron, ver supabase_avisos.sql) mira las apuestas abiertas de quien tiene los avisos
// activados, consulta el marcador de ESPN y manda notificaciones push, una sola vez cada una:
//   · ticket ganado o perdido · selección cumplida (en combinadas) · «a X le falta poco» (más de N de jugador)
// Las claves VAPID de los avisos se crean aquí la primera vez y se guardan en avisos_config (nunca salen de Supabase).
// Crear en Supabase > Edge Functions con el nombre «avisos» y «Verify JWT» desactivado.

const ESPN = {
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba',
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl',
};
const TRI = {
  nba: { GS: 'GSW', NO: 'NOP', NY: 'NYK', SA: 'SAS', UTAH: 'UTA', WSH: 'WAS', PHO: 'PHX', BRK: 'BKN', CHO: 'CHA' },
  nfl: { WSH: 'WAS', LAR: 'LA' },
};
const APP = 'https://lakakaxd.github.io/tribuna/app/index.html';
const YARDAS = new Set(['pyd', 'ryd', 'reyd', 'pry', 'rry']);
const tri = (liga, a) => TRI[liga][a] || a;
const nkey = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, '').replace(/[^a-z]/g, '');

// ---------- estadísticas (igual que en la app) ----------
const F = {
  nba: {
    pra: g => g.pts + g.reb + g.ast, pr: g => g.pts + g.reb, pa: g => g.pts + g.ast, ra: g => g.reb + g.ast, sb: g => g.stl + g.blk,
    dd: g => [g.pts, g.reb, g.ast, g.stl, g.blk].filter(x => x >= 10).length >= 2 ? 1 : 0,
    td: g => [g.pts, g.reb, g.ast, g.stl, g.blk].filter(x => x >= 10).length >= 3 ? 1 : 0,
  },
  nfl: { pry: g => g.pyd + g.ryd, rry: g => g.ryd + g.reyd, td: g => g.rtd + g.retd >= 1 ? 1 : 0 },
};
const val = (g, k, liga) => (F[liga][k] ? F[liga][k](g) : g[k]) ?? 0;

// ---------- ESPN ----------
async function getJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error('ESPN ' + r.status); return r.json(); }
const cache = new Map();
const once = (k, fn) => { if (!cache.has(k)) cache.set(k, fn()); return cache.get(k); };
function estado(st) { const s = st?.type?.state; return s === 'post' ? 'final' : s === 'in' ? 'live' : 'pre'; }
/* Partidos de una fecha (YYYY-MM-DD, EE. UU.). */
const scoreboard = (liga, date) => once(`sb|${liga}|${date}`, async () => {
  const j = await getJSON(`${ESPN[liga]}/scoreboard?dates=${date.replace(/-/g, '')}`);
  return (j.events || []).map(ev => {
    const c = ev.competitions?.[0] || {}, cs = c.competitors || [], H = cs.find(x => x.homeAway === 'home') || {}, A = cs.find(x => x.homeAway === 'away') || {};
    return { id: ev.id, state: estado(c.status || ev.status), home: { tri: tri(liga, H.team?.abbreviation), score: +H.score || 0 }, away: { tri: tri(liga, A.team?.abbreviation), score: +A.score || 0 } };
  });
});
/* Estadísticas de cada jugador del partido, por nombre normalizado. */
const boxscore = (liga, id) => once(`box|${liga}|${id}`, async () => {
  const j = await getJSON(`${ESPN[liga]}/summary?event=${id}`), out = {};
  for (const t of j.boxscore?.players || []) {
    const tm = tri(liga, t.team?.abbreviation);
    for (const grp of t.statistics || []) {
      const lab = (grp.labels || []).map(x => String(x).toUpperCase());
      for (const a of grp.athletes || []) {
        const s = a.stats || [], at = l => { const i = lab.indexOf(l); return i < 0 ? null : s[i]; }, n = l => +(at(l) || 0) || 0;
        const pair = l => { const m = /^(\d+)[-/](\d+)$/.exec(String(at(l) || '')); return m ? [+m[1], +m[2]] : [0, 0]; };
        const k = nkey(a.athlete?.displayName), o = out[k] || (out[k] = { tm });
        if (liga === 'nba') {
          const [fgm, fga] = pair('FG'), [fg3m, fg3a] = pair('3PT'), [ftm, fta] = pair('FT');
          Object.assign(o, { pts: n('PTS'), reb: n('REB'), ast: n('AST'), stl: n('STL'), blk: n('BLK'), tov: n('TO'), min: n('MIN'), fgm, fga, fg3m, fg3a, ftm, fta });
        } else if (grp.name === 'passing') { const [cmp, att] = pair('C/ATT'); Object.assign(o, { cmp, att, pyd: n('YDS'), ptd: n('TD'), int: n('INT') }); }
        else if (grp.name === 'rushing') Object.assign(o, { car: n('CAR'), ryd: n('YDS'), rtd: n('TD') });
        else if (grp.name === 'receiving') Object.assign(o, { rec: n('REC'), reyd: n('YDS'), retd: n('TD'), tgt: n('TGTS') });
      }
    }
  }
  if (liga === 'nfl') for (const o of Object.values(out)) for (const k of ['cmp', 'att', 'pyd', 'ptd', 'int', 'car', 'ryd', 'rtd', 'rec', 'reyd', 'retd', 'tgt']) o[k] = o[k] || 0;
  return out;
});
/* Partido de ESPN de una selección (por fecha y equipos). */
async function eventOf(l) {
  const liga = l.liga || 'nba', evs = await scoreboard(liga, l.date);
  return evs.find(e => (l.home && l.away && e.home.tri === l.home && e.away.tri === l.away) || (l.team && (e.home.tri === l.team || e.away.tri === l.team))) || null;
}

// ---------- estado de una selección (mismas reglas que la app) ----------
async function legEval(l) {
  if (l.type === 'x' || l.res) return { st: l.res || null, cur: l.final ?? null };
  if (!l.date) return { st: null };
  const liga = l.liga || 'nba', ev = await eventOf(l);
  if (!ev || ev.state === 'pre') return { st: null };
  const fin = ev.state === 'final';
  if (l.type === 'p') {
    const box = await boxscore(liga, ev.id), ps = box[nkey(l.name)];
    if (!ps) return { st: fin ? 'void' : null, live: !fin };
    const cur = val(ps, l.stat, liga), over = cur > l.line;
    return { st: l.side === 'over' ? (over ? 'won' : fin ? 'lost' : null) : (over ? 'lost' : fin ? 'won' : null), cur, live: !fin };
  }
  const hs = ev.home.score, as = ev.away.score, isH = l.team === l.home, mine = isH ? hs : as, theirs = isH ? as : hs;
  let st = null, cur;
  if (l.market === 'ml') { cur = mine - theirs; if (fin) st = cur > 0 ? 'won' : 'lost'; }
  else if (l.market === 'spread') { cur = mine - theirs; if (fin) st = cur + l.line > 0 ? 'won' : cur + l.line === 0 ? 'void' : 'lost'; }
  else { cur = l.market === 'total' ? hs + as : mine; const over = cur > l.line; st = l.side === 'over' ? (over ? 'won' : fin ? 'lost' : null) : (over ? 'lost' : fin ? 'won' : null); }
  return { st, cur, live: !fin };
}
function betResult(states) {
  if (states.some(x => x.st === 'lost')) return 'lost';
  if (states.every(x => x.st === 'won' || x.st === 'void')) return states.every(x => x.st === 'void') ? 'void' : 'won';
  return null;
}

// ---------- textos ----------
const T = {
  es: { won: '✅ Ticket ganado', lost: '❌ Ticket perdido', failed: 'Falló', leg: '✓ Selección cumplida', near: n => `🔥 Le falta${n === 1 ? '' : 'n'} ${n}`, hello: '🔔 Avisos activados', helloBody: 'Te avisaremos de tus tickets aunque tengas Tribuna cerrada.', combo: 'Combinada', more: 'más de', less: 'menos de' },
  it: { won: '✅ Schedina vinta', lost: '❌ Schedina persa', failed: 'Sbagliata', leg: '✓ Selezione vinta', near: n => `🔥 Manca${n === 1 ? '' : 'no'} ${n}`, hello: '🔔 Avvisi attivati', helloBody: 'Ti avviseremo delle tue schedine anche con Tribuna chiusa.', combo: 'Multipla', more: 'più di', less: 'meno di' },
  en: { won: '✅ Ticket won', lost: '❌ Ticket lost', failed: 'Missed', leg: '✓ Selection hit', near: n => `🔥 ${n} to go`, hello: '🔔 Notifications on', helloBody: 'We will notify you about your tickets even with Tribuna closed.', combo: 'Parlay', more: 'over', less: 'under' },
};
const LOCALE = { es: 'es-ES', it: 'it-IT', en: 'en-GB' };
const legText = (l, t) => l.label || (l.type === 'p' ? `${l.name} · ${l.side === 'over' ? t.more : t.less} ${l.line} ${String(l.stat).toUpperCase()}` : `${l.team || ''} ${l.market}`);
function money(v, cur, lang) {
  const s = new Intl.NumberFormat(LOCALE[lang] || 'es-ES', { style: 'currency', currency: cur || 'EUR', currencyDisplay: 'narrowSymbol' }).format(v);
  return cur === 'PEN' ? s.replace('PEN', 'S/') : s;
}
/* Lo que hay que avisar de una apuesta: [{ clave, title, body }] (la clave evita repetirlo). */
async function noticesFor(b, cur, lang) {
  const t = T[lang] || T.es, legs = b.legs || [], states = await Promise.all(legs.map(legEval)), out = [];
  const res = betResult(states), desc = legs.length > 1 ? `${t.combo} · ${legs.length}` : legText(legs[0] || {}, t);
  if (res === 'won') out.push({ clave: `fin:${b.id}`, title: t.won, body: `${desc} · +${money(b.stake * (b.odd - 1), cur, lang)}` });
  else if (res === 'lost') { const i = states.findIndex(x => x.st === 'lost'); out.push({ clave: `fin:${b.id}`, title: t.lost, body: `${t.failed}: ${legText(legs[i], t)}` }); }
  if (res) return out;
  states.forEach((x, i) => {
    const l = legs[i];
    if (x.st === 'won' && legs.length > 1 && !l.res) out.push({ clave: `ok:${b.id}:${i}`, title: t.leg, body: legText(l, t) });
    if (!x.st && x.live && l.type === 'p' && l.side === 'over' && x.cur != null) {
      const need = Math.floor(l.line) + 1 - x.cur, near = YARDAS.has(l.stat) ? 10 : 2;
      if (need > 0 && need <= near) out.push({ clave: `cerca:${b.id}:${i}`, title: t.near(need), body: legText(l, t) });
    }
  });
  return out;
}

// ---------- servidor ----------
if (typeof Deno !== 'undefined') Deno.serve(async req => {
  const { createClient } = await import('npm:@supabase/supabase-js@2.45.4');
  const webpush = (await import('npm:web-push@3.6.7')).default;
  // Clave interna: sistema nuevo (SUPABASE_SECRET_KEYS) o antiguo (SUPABASE_SERVICE_ROLE_KEY).
  const secreta = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const sb = createClient(Deno.env.get('SUPABASE_URL'), secreta, { auth: { persistSession: false } });
  const cfg = Object.fromEntries(((await sb.from('avisos_config').select('clave,valor')).data || []).map(r => [r.clave, r.valor]));
  if (!cfg.cron || req.headers.get('x-cron') !== cfg.cron) return new Response('no autorizado', { status: 401 });
  if (!cfg.vapid_public || !cfg.vapid_private) {
    const k = webpush.generateVAPIDKeys();
    await sb.from('avisos_config').upsert([{ clave: 'vapid_public', valor: k.publicKey }, { clave: 'vapid_private', valor: k.privateKey }]);
    cfg.vapid_public = k.publicKey; cfg.vapid_private = k.privateKey;
  }
  webpush.setVapidDetails(APP, cfg.vapid_public, cfg.vapid_private);

  const subs = (await sb.from('avisos_subs').select('*')).data || [];
  if (!subs.length) return Response.json({ subs: 0 });
  const users = [...new Set(subs.map(s => s.user_id))];
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  const ayer = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(Date.now() - 864e5));
  const desde = new Date(Date.now() - 7 * 864e5).toISOString();
  const [bets, perfiles, enviados] = await Promise.all([
    sb.from('apuestas').select('id,user_id,data').in('user_id', users).gte('created_at', desde),
    sb.from('perfiles').select('user_id,moneda').in('user_id', users),
    sb.from('avisos_enviados').select('clave').gte('enviado', desde),
  ]);
  const ya = new Set((enviados.data || []).map(r => r.clave)), moneda = Object.fromEntries((perfiles.data || []).map(p => [p.user_id, p.moneda]));
  const send = async (sub, msg) => {
    try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ ...msg, url: APP }), { TTL: 6 * 3600 }); return true; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await sb.from('avisos_subs').delete().eq('endpoint', sub.endpoint); console.warn('push', e.statusCode, e.body); return false; }
  };
  let enviadosAhora = 0; const nuevas = [];
  // bienvenida a los móviles recién activados (sirve de prueba)
  for (const s of subs) { const k = `hola:${s.endpoint.slice(-40)}`; if (ya.has(k)) continue; const t = T[s.lang] || T.es;
    if (await send(s, { title: t.hello, body: t.helloBody, tag: 'hola' })) enviadosAhora++; nuevas.push({ clave: k }); }
  // apuestas de hoy y de ayer (EE. UU.)
  for (const r of bets.data || []) {
    const b = { ...r.data, id: r.id };
    if (!b.legs?.length || !(b.date >= ayer && b.date <= hoy)) continue;
    const mine = subs.filter(s => s.user_id === r.user_id);
    let avisos;
    try { avisos = await noticesFor(b, moneda[r.user_id], mine[0]?.lang || 'es'); } catch (e) { console.warn('apuesta', b.id, e.message); continue; }
    for (const a of avisos) {
      if (ya.has(a.clave)) continue; ya.add(a.clave); nuevas.push({ clave: a.clave });
      for (const s of mine) { const t = await noticesFor(b, moneda[r.user_id], s.lang).then(x => x.find(y => y.clave === a.clave)).catch(() => a);
        if (await send(s, { title: (t || a).title, body: (t || a).body, tag: a.clave })) enviadosAhora++; }
    }
  }
  if (nuevas.length) await sb.from('avisos_enviados').upsert(nuevas);
  await sb.from('avisos_enviados').delete().lt('enviado', new Date(Date.now() - 14 * 864e5).toISOString());
  return Response.json({ subs: subs.length, apuestas: bets.data?.length || 0, enviados: enviadosAhora });
});

// Para probar la lógica fuera de Supabase (Node).
if (typeof module !== 'undefined') module.exports = { legEval, noticesFor, betResult, val };
