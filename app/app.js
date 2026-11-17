/* Tribuna · app de estadísticas NBA para el grupo.
   Sin config de Supabase funciona en modo demostración (datos simulados y cuotas en este navegador). */
(() => {
'use strict';
const CFG = window.TRIBUNA_CONFIG || {};
const DEMO = !CFG.supabaseUrl || !CFG.supabaseAnonKey || /[?&]demo\b/.test(location.search);
const app = document.getElementById('app');

/* ---------- utilidades ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('tribuna:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('tribuna:' + k, JSON.stringify(v)); } catch (e) {} },
};
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dec = (v, d = 1) => (v == null || !isFinite(v)) ? '–' : Number(v).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = p => (p == null || !isFinite(p)) ? '–' : Math.round(p * 100) + '\u00a0%';
const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '') + dec(Math.abs(v));
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const num = s => parseFloat(String(s).replace('−', '-').replace(',', '.'));
const fdate = d => `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
const initials = n => n.split(' ').map(w => w[0]).slice(0, 2).join('');
function Phi(x) { const t = 1 / (1 + .2316419 * Math.abs(x)), d = .3989423 * Math.exp(-x * x / 2); const p = d * t * (.3193815 + t * (-.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; }
function todayET() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()); }
function etToRome(dateStr, status) {
  const m = /(\d{1,2}):(\d{2})\s*(am|pm)/i.exec(status || '');
  if (!m || !dateStr) return { time: status || '', day: '' };
  let h = +m[1] % 12 + (m[3].toLowerCase() === 'pm' ? 12 : 0);
  const [y, mo, d] = dateStr.split('-').map(Number);
  const probe = new Date(Date.UTC(y, mo - 1, d, 12));
  const off = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' }).formatToParts(probe).find(p => p.type === 'timeZoneName')?.value || 'GMT-5';
  const offH = parseInt(off.replace('GMT', '')) || -5;
  const utc = new Date(Date.UTC(y, mo - 1, d, h - offH, +m[2]));
  return {
    time: utc.toLocaleTimeString('es-ES', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }),
    day: utc.toLocaleDateString('es-ES', { timeZone: 'Europe/Rome', weekday: 'short', day: 'numeric', month: 'short' }),
  };
}
function nightLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number), a = new Date(Date.UTC(y, m - 1, d)), b = new Date(Date.UTC(y, m - 1, d + 1));
  const wd = x => x.toLocaleDateString('es-ES', { weekday: 'long', timeZone: 'UTC' }), mo = x => x.toLocaleDateString('es-ES', { month: 'long', timeZone: 'UTC' });
  return `Noche del ${wd(a)} ${a.getUTCDate()}${mo(a) !== mo(b) ? ' de ' + mo(a) : ''} al ${wd(b)} ${b.getUTCDate()} de ${mo(b)}`;
}
const ICON = {
  chev: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  hoy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
  props: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 20V10M10 20V4M15 20v-7M20 20V8"/></svg>',
  slip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
  bets: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 15l2.5 2.5L16 13"/></svg>',
  admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16v4z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor"/></svg>',
};

/* ---------- estadísticas ---------- */
const STATS = [
  { k: 'pts', l: 'PTS', n: 'Puntos' }, { k: 'reb', l: 'REB', n: 'Rebotes' }, { k: 'ast', l: 'AST', n: 'Asistencias' },
  { k: 'fg3m', l: '3PM', n: 'Triples anotados' }, { k: 'fg3a', l: '3PA', n: 'Triples intentados' },
  { k: 'pra', l: 'P+R+A', n: 'Puntos + rebotes + asistencias', f: g => g.pts + g.reb + g.ast, base: 'pts' },
  { k: 'pr', l: 'P+R', n: 'Puntos + rebotes', f: g => g.pts + g.reb, base: 'pts' },
  { k: 'pa', l: 'P+A', n: 'Puntos + asistencias', f: g => g.pts + g.ast, base: 'pts' },
  { k: 'ra', l: 'R+A', n: 'Rebotes + asistencias', f: g => g.reb + g.ast, base: 'reb' },
  { k: 'fgm', l: 'TC', n: 'Tiros de campo anotados' }, { k: 'fga', l: 'TCI', n: 'Tiros de campo intentados' },
  { k: 'ftm', l: 'TL', n: 'Tiros libres anotados' }, { k: 'fta', l: 'TLI', n: 'Tiros libres intentados' },
  { k: 'stl', l: 'ROB', n: 'Robos' }, { k: 'blk', l: 'TAP', n: 'Tapones' },
  { k: 'sb', l: 'ROB+TAP', n: 'Robos + tapones', f: g => g.stl + g.blk, base: 'stl' },
  { k: 'tov', l: 'PÉR', n: 'Pérdidas' },
  { k: 'dd', l: 'DD', n: 'Doble-doble', short: 'Dobles-dobles', f: g => [g.pts, g.reb, g.ast, g.stl, g.blk].filter(x => x >= 10).length >= 2 ? 1 : 0, base: 'pts' },
  { k: 'td', l: 'TD', n: 'Triple-doble', short: 'Triples-dobles', f: g => [g.pts, g.reb, g.ast, g.stl, g.blk].filter(x => x >= 10).length >= 3 ? 1 : 0, base: 'ast' },
  { k: 'min', l: 'MIN', n: 'Minutos' },
];
const SHORT = { pts: 'Puntos', reb: 'Rebotes', ast: 'Asistencias', fg3m: 'Triples', fg3a: 'Intentos de triple', pra: 'P+R+A', pr: 'P+R', pa: 'P+A', ra: 'R+A', stl: 'Robos', blk: 'Tapones', sb: 'Robos+tapones', tov: 'Pérdidas', fgm: 'Tiros de campo', fga: 'Intentos de campo', ftm: 'Tiros libres', fta: 'Intentos de libre' };
STATS.forEach(s => { s.short = s.short || SHORT[s.k]; });
const SK = Object.fromEntries(STATS.map(s => [s.k, s]));
const val = (g, k) => SK[k].f ? SK[k].f(g) : g[k];
const ALIAS = { pts: 'pts', puntos: 'pts', points: 'pts', p: 'pts', reb: 'reb', rebotes: 'reb', rebounds: 'reb', r: 'reb', ast: 'ast', asist: 'ast', asistencias: 'ast', assists: 'ast', a: 'ast',
  '3pm': 'fg3m', '3pt': 'fg3m', '3p': 'fg3m', triples: 'fg3m', threes: 'fg3m', '3pa': 'fg3a', 'triples-intentados': 'fg3a',
  pra: 'pra', 'p+r+a': 'pra', pr: 'pr', 'p+r': 'pr', pa: 'pa', 'p+a': 'pa', ra: 'ra', 'r+a': 'ra',
  rob: 'stl', stl: 'stl', robos: 'stl', steals: 'stl', tap: 'blk', blk: 'blk', tapones: 'blk', blocks: 'blk',
  'rob+tap': 'sb', 'stl+blk': 'sb', sb: 'sb', per: 'tov', tov: 'tov', perdidas: 'tov', tc: 'fgm', fgm: 'fgm', tci: 'fga', fga: 'fga', tl: 'ftm', ftm: 'ftm', tli: 'fta', fta: 'fta', dd: 'dd', 'doble-doble': 'dd', 'dobledoble': 'dd', td: 'td', 'triple-doble': 'td', 'tripledoble': 'td' };
const GAME_ALIAS = { ganador: 'ml', gana: 'ml', ml: 'ml', moneyline: 'ml', '1x2': 'ml', handicap: 'spread', hcp: 'spread', spread: 'spread', hand: 'spread',
  total: 'total', totales: 'total', puntos: 'pts', pts: 'pts', 'puntos-equipo': 'pts' };
const MARKET_N = { ml: 'Ganador', spread: 'Hándicap', total: 'Total del partido', pts: 'Puntos del equipo' };

/* ---------- estado ---------- */
const V = window.TRIBUNA_VISUAL;
let FONDOS = Object.assign({}, CFG.fondos || {});
let ANIM = true;
let BETS = [];
let BAJAS = {}, BAJAS_AT = null;   // id NBA -> { status: 'out'|'doubtful'|'questionable'|'probable', note, name, team }
let D = null, ODDS = {}, sb = null, isAdmin = DEMO, userEmail = '';
const S = { view: 'hoy', back: [], gameId: null, pid: null, stat: 'pts', win: 'l10', venue: 'all', minMin: 0, rest: 'all',
  market: 'ml', mTeam: 'home', gwin: 'l10', gtab: 'game', gvenue: 'all', tstat: 'pts', twin: 'l10', range: 'month', calMonth: '', calDay: null, stake: '', betOdd: '', listTab: 'players', listStat: 'all', listWin: 'l10', draft: '', saving: false, msg: '' };
let slip = store.get('slip', []), uLines = store.get('lines', {}), uOdds = store.get('uodds', {}), sides = store.get('sides', {});
const saveUser = () => { store.set('slip', slip); store.set('lines', uLines); store.set('uodds', uOdds); store.set('sides', sides); };

/* ---------- tema ---------- */
let mode = store.get('mode', 'auto');
function applyMode() { if (mode === 'auto') document.documentElement.removeAttribute('data-mode'); else document.documentElement.setAttribute('data-mode', mode); }
applyMode();

/* ---------- datos ---------- */
function prepare(raw) {
  const cols = raw.cols, tcols = raw.team_cols || ['date', 'opp', 'home', 'pts', 'opp_pts', 'season'];
  const obj = (arr, c) => { const o = {}; c.forEach((k, i) => o[k] = arr[i]); return o; };
  const players = {};
  for (const [id, p] of Object.entries(raw.players || {})) {
    const log = (raw.logs[id] || []).map(r => { const g = obj(r, cols); g.d = new Date(g.date + 'T00:00:00Z'); return g; });
    log.forEach((g, i) => { const pv = log[i - 1]; g.rest = pv && pv.season === g.season ? Math.round((g.d - pv.d) / 864e5) - 1 : 3; });
    const last = log.slice(-15);
    players[id] = { id, name: p.name, team: p.team, pos: p.pos || 'F', log, avgMin: mean(last.map(g => g.min)) };
  }
  const teams = {};
  for (const [t, arr] of Object.entries(raw.teams || {})) {
    teams[t] = arr.map(r => { const g = obj(r, tcols); g.d = new Date(g.date + 'T00:00:00Z'); g.margin = g.pts - g.opp_pts; g.total = g.pts + g.opp_pts; return g; });
  }
  const [prev, cur] = raw.seasons;
  const seen = new Set(), games = (raw.games || []).filter(g => { const k = g.id || g.away + '@' + g.home; return seen.has(k) ? false : (seen.add(k), true); });
  return { updated: raw.updated, prev, cur, games, players, teams, defCache: {} };
}
const gameOfTeam = t => D.games.find(g => g.home === t || g.away === t);
const oppOf = t => { const g = gameOfTeam(t); return g ? (g.home === t ? g.away : g.home) : null; };
const gameKey = g => g.away + '@' + g.home;

function defRank(team, pos, k) {
  const key = pos + ':' + k;
  if (!D.defCache[key]) {
    const acc = {};
    for (const p of Object.values(D.players)) {
      if (p.pos !== pos) continue;
      for (const g of p.log) { if (g.season !== D.cur && D.players && p.log.filter(x => x.season === D.cur).length > 3) continue; (acc[g.opp] ||= []).push(val(g, k)); }
    }
    const avg = Object.entries(acc).map(([t, a]) => [t, mean(a)]).sort((a, b) => a[1] - b[1]);
    D.defCache[key] = Object.fromEntries(avg.map(([t], i) => [t, i + 1]));
  }
  return D.defCache[key][team] || null;
}

/* ---------- jugadores ---------- */
const lineKey = (pid, k) => pid + '|' + k;
const autoLine = (p, k) => ODDS[lineKey(p.id, k)]?.line ?? (k === 'dd' || k === 'td' ? .5 : null) ?? Math.max(.5, Math.floor(median(p.log.slice(-20).map(g => val(g, k)))) + .5);
const getLine = (p, k) => uLines[lineKey(p.id, k)] ?? autoLine(p, k);
const getSide = key => sides[key] || 'over';
function effOdd(key, side, line) {
  const u = uOdds[key + '|' + side]; if (u > 1) return { v: u, src: 'tuya' };
  const o = ODDS[key]; if (o && (o.line === line || o.line == null) && o[side] > 1) return { v: o[side], src: 'hoy' };
  return { v: null, src: null };
}
function impliedProb(key, side, eo) {
  if (!eo.v) return null;
  const o = ODDS[key];
  if (eo.src === 'hoy' && o && o.over > 1 && o.under > 1) { const a = 1 / o.over, b = 1 / o.under; return (side === 'over' ? a : b) / (a + b); }
  return 1 / eo.v;
}
/* Probabilidad de un prop (calibrada el 16-nov-2026 con ~17.000 partidos de jugador).
   El % de L5/L10 es muy ruidoso: cuando L10 dice 80 %, en la realidad sale ~60 %.
   Aquí se usan sus últimos 40 partidos (10+ min), pesando más los recientes (vida media 10 partidos),
   y se suaviza la distribución para no depender de si cayó justo por encima o por debajo de la línea. */
/* Si falta un compañero, el resto se reparte lo suyo. Medido con los partidos ya jugados: cada jugador recibe
   ~10 % de los puntos, rebotes y asistencias que faltan, en proporción a lo que él aporta. Los triples no cambian. */
const BOOST = { pts: .10, reb: .09, ast: .11 };
function teammateBoost(p) {
  const D2 = (D.boost ||= {}); if (D2[p.id]) return D2[p.id];
  const mates = Object.values(D.players).filter(q => q.team === p.team && q.id !== p.id), out = {};
  const avg = (q, k) => { const { mine, n } = regular(q); return n ? mine.reduce((a, x) => a + x[k], 0) / n : 0; };
  for (const k of Object.keys(BOOST)) {
    let miss = 0, tot = avg(p, k);
    for (const q of mates) { const b = bajaOf(q.id), a = avg(q, k); if (b) miss += BAJA_W[b.status] * a; else tot += a; }
    out[k] = tot > 0 ? BOOST[k] * miss * avg(p, k) / tot : 0;
  }
  return (D2[p.id] = out);
}
function propProb(p, k, line, side = 'over') {
  const PROPC = (D.propc ||= {}), ck = p.id + '|' + k + '|' + line;
  if (PROPC[ck] === undefined) {
    const L = p.log.filter(g => g.min >= 10).slice(-40), n = L.length, bo = k === 'dd' || k === 'td' ? null : teammateBoost(p);
    if (n < 5 || bajaOf(p.id)?.status === 'out') PROPC[ck] = null;
    else {
      const v = L.map(g => val(bo ? { ...g, pts: g.pts + bo.pts, reb: g.reb + bo.reb, ast: g.ast + bo.ast } : g, k)), w = v.map((_, j) => Math.pow(.5, (n - 1 - j) / 10)), W = w.reduce((a, b) => a + b, 0);
      if (k === 'dd' || k === 'td') PROPC[ck] = (v.reduce((a, x, j) => a + w[j] * (x > line), 0) + .5) / (W + 1);
      else {
        const mu = v.reduce((a, x, j) => a + w[j] * x, 0) / W, sd = Math.sqrt(v.reduce((a, x, j) => a + w[j] * (x - mu) ** 2, 0) / W) + .5;
        const h = .5 * sd * Math.pow(n, -.2) + .3;
        PROPC[ck] = v.reduce((a, x, j) => a + w[j] * (1 - Phi((line - x) / h)), 0) / W;
      }
    }
  }
  const pr = PROPC[ck]; return pr == null ? null : side === 'over' ? pr : 1 - pr;
}
function filtered(p) { return p.log.filter(g => (S.venue === 'all' || (S.venue === 'home') === g.home) && g.min >= S.minMin && (S.rest === 'all' || (S.rest === '2' ? g.rest >= 2 : g.rest === +S.rest))); }
function windowGames(p, w, base) {
  const g = base ?? filtered(p), opp = oppOf(p.team);
  if (w === 'cur') return g.filter(x => x.season === D.cur);
  if (w === 'prev') return g.filter(x => x.season === D.prev);
  if (w === 'h2h') return g.filter(x => x.opp === opp);
  return g.slice(-({ l5: 5, l10: 10, l20: 20 })[w]);
}
const WINS = () => [['l5', 'L5'], ['l10', 'L10'], ['l20', 'L20'], ['h2h', 'H2H'], ['cur', D.cur.slice(2)], ['prev', D.prev.slice(2)]];
function hit(games, k, line) { const o = games.filter(g => val(g, k) > line).length; return { o, n: games.length, p: games.length ? o / games.length : null }; }
const sideP = (h, side) => h.p == null ? null : side === 'over' ? h.p : 1 - h.p;
/* El valor se muestra sin redondear hacia arriba: +2,6 sale "+2" y es "Justo"; "Con valor" empieza en +3. */
const edgeTxt = e => { const t = Math.trunc(e); return (t > 0 ? '+' : '') + t; };
const hasValue = e => e != null && e >= 3;
function verdict(edge) { if (edge == null) return ''; const c = edge >= 3 ? 'good' : edge <= -3 ? 'bad' : ''; return `<span class="pill ${c}">${edge >= 3 ? 'Con valor' : edge <= -3 ? 'Sin valor' : 'Justo'} ${edgeTxt(edge)}</span>`; }

/* ---------- equipos y partidos ---------- */
function tGames(t, venue = 'all') { return (D.teams[t] || []).filter(g => venue === 'all' || (venue === 'home') === g.home); }
function record(t, season, venue = 'all') { const g = tGames(t, venue).filter(x => x.season === season); const w = g.filter(x => x.margin > 0).length; return `${w}-${g.length - w}`; }
/* Modelo de partido (calibrado el 16-nov-2026 con 1.400 partidos de 2025-26 y 2026-27):
   regresión ridge de puntos = media + ataque del equipo + defensa del rival + ventaja de campo.
   Tiene en cuenta contra quién se jugó cada partido. La temporada anterior pesa 0,3 y la actual 1;
   la media de puntos de la temporada actual tiene su propio ajuste (este año se anota más). */
const RIDGE = { lam: 5, prevW: .3, curMuPen: 3 };
function ratings() {
  if (D.ratings) return D.ratings;
  const T = Object.keys(D.teams).sort(), n = T.length, ix = Object.fromEntries(T.map((t, i) => [t, i])), N = 2 * n + 3;
  const A = Array.from({ length: N }, () => new Float64Array(N)), b = new Float64Array(N);
  const AB = absenceSums();
  const add = (cols, y, w) => { for (const i of cols) { b[i] += w * y; for (const j of cols) A[i][j] += w; } };
  for (const [t, arr] of Object.entries(D.teams)) for (const x of arr) {
    if (!x.home || ix[x.opp] == null) continue;
    const w = x.season === D.cur ? 1 : RIDGE.prevW, cur = x.season === D.cur ? [2 * n + 2] : [];
    // Fuerza "con todos": se suma lo que valían los titulares que faltaron ese día (y se resta al rival).
    const dm = IMPACT.coef / 2 * ((AB[t]?.[x.date] || 0) - (AB[x.opp]?.[x.date] || 0));
    add([ix[t], n + ix[x.opp], 2 * n, 2 * n + 1, ...cur], x.pts + dm, w);
    add([ix[x.opp], n + ix[t], 2 * n, ...cur], x.opp_pts - dm, w);
  }
  for (let i = 0; i < 2 * n; i++) A[i][i] += RIDGE.lam;
  A[2 * n][2 * n] += 1e-4; A[2 * n + 1][2 * n + 1] += 1e-4; A[2 * n + 2][2 * n + 2] += RIDGE.curMuPen;
  for (let c = 0; c < N; c++) {               // Gauss-Jordan (matriz simétrica definida positiva)
    let piv = c; for (let r = c + 1; r < N; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = 0; r < N; r++) { if (r === c || !A[r][c]) continue; const f = A[r][c] / A[c][c]; for (let k = c; k < N; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
  }
  const x = Array.from(b, (v, i) => v / A[i][i]);
  return (D.ratings = { ix, off: t => x[ix[t]] ?? 0, def: t => x[n + ix[t]] ?? 0, mu: x[2 * n] + x[2 * n + 2], hca: x[2 * n + 1] });
}
/* ---------- bajas ----------
   Calibrado el 16-nov-2026 con los partidos ya jugados: por cada punto de "Game Score" por encima de un suplente
   (0,3 por minuto) que le falta a un equipo, pierde 0,29 puntos de diferencia. Un titular bueno suele valer 2-4 puntos.
   La fuerza de cada equipo se calcula "con todos" (cada partido pasado se corrige por quién faltó), así que
   hoy se resta cualquier baja que haya jugado con el equipo en sus últimos 40 partidos. */
const BAJA_W = { out: 1, doubtful: .8, questionable: .35, probable: 0 };
const BAJA_N = { out: 'Baja', doubtful: 'Duda seria', questionable: 'Duda', probable: 'Probable' };
const IMPACT = { coef: .29, repl: .3 };
const gameScore = g => g.pts + .4 * g.fgm - .7 * g.fga - .4 * (g.fta - g.ftm) + .5 * g.reb + .7 * g.ast + g.stl + .7 * g.blk - g.tov;
function regular(p) {   // últimos 10 partidos del equipo y los que jugó él
  const T = tGames(p.team).slice(-10), dates = new Set(T.map(x => x.date)), mine = p.log.filter(x => dates.has(x.date));
  return { mine, n: T.length };
}
/* Partidos de un jugador con su equipo actual: índice del partido del equipo -> fila del jugador. */
function teamApps(p) {
  const T = tGames(p.team), at = {}; T.forEach((x, i) => at[x.date] = i);
  const a = new Map(); for (const g of p.log) { const i = at[g.date]; if (i != null && T[i].opp === g.opp) a.set(i, g); }
  return a;
}
/* Lo que vale un jugador antes del partido i de su equipo (Game Score por encima de un suplente).
   Cuenta si jugó con el equipo en los 40 partidos anteriores, 3+ veces y 12+ minutos de media. */
function valueAt(a, i) {
  const prev = [...a.keys()].filter(j => j < i && j >= i - 40).sort((x, y) => x - y).slice(-10).map(j => a.get(j));
  if (prev.length < 3) return 0;
  const min = mean(prev.map(x => x.min)); if (min < 12) return 0;
  return Math.max(0, mean(prev.map(gameScore)) - IMPACT.repl * min);
}
/* Quién de la plantilla actual faltó en cada partido pasado y cuánto valía. */
function absences() {
  if (D.abs) return D.abs;
  const abs = {};
  for (const [t, T] of Object.entries(D.teams)) {
    const apps = Object.values(D.players).filter(p => p.team === t).map(p => ({ p, a: teamApps(p) }));
    abs[t] = {};
    T.forEach((x, i) => {
      const out = [];
      for (const { p, a } of apps) { if (a.has(i)) continue; const v = valueAt(a, i); if (v > 0) out.push({ p, v }); }
      if (out.length) abs[t][x.date] = out.sort((a, b) => b.v - a.v);
    });
  }
  return (D.abs = abs);
}
function absenceSums() {
  const A = absences(), S2 = {};
  for (const [t, m] of Object.entries(A)) { S2[t] = {}; for (const [d, L] of Object.entries(m)) S2[t][d] = L.reduce((a, x) => a + x.v, 0); }
  return S2;
}
/* Titulares que faltaron en un partido pasado (valían ~1 punto o más). */
const missed = (t, date) => (absences()[t]?.[date] || []).filter(x => x.v * IMPACT.coef >= .9).map(x => x.p.name.split(' ').slice(-1)[0]);
function withMissed(items, series, t) {
  items.forEach((it, i) => { const m = missed(t, series[series.length - items.length + i].date); if (m.length) { it.flag = true; it.title += ' · sin ' + m.join(', '); } });
  return items;
}
function missedNote(series, t) {
  const L = series.slice(-25).map(x => ({ x, m: missed(t, x.date) })).filter(z => z.m.length).slice(-6).reverse();
  return L.length ? `<div class="note" style="margin-top:6px"><span class="dotm"></span> Le faltaban titulares: ${L.map(({ x, m }) => `${fdate(x.d)} ${x.home ? 'vs' : '@'} ${x.opp} (sin ${esc(m.join(', '))})`).join(' · ')}</div>` : '';
}
function playerImpact(p) { return valueAt(teamApps(p), tGames(p.team).length) * IMPACT.coef; }
const bajaOf = pid => BAJAS[pid] && BAJA_W[BAJAS[pid].status] != null ? BAJAS[pid] : null;
function teamBajas(t) {
  return Object.values(D.players).filter(p => p.team === t && bajaOf(p.id)).map(p => { const b = bajaOf(p.id); return { p, b, w: BAJA_W[b.status], imp: playerImpact(p) }; })
    .sort((a, b) => b.w * b.imp - a.w * a.imp || b.w - a.w);
}
const teamLoss = t => teamBajas(t).reduce((a, x) => a + x.w * x.imp, 0);
function model(g) {
  const R = ratings();
  let eh = R.mu + R.hca + R.off(g.home) + R.def(g.away), ea = R.mu + R.off(g.away) + R.def(g.home);
  const lh = teamLoss(g.home), la = teamLoss(g.away);   // la pérdida se reparte: menos puntos propios y más del rival
  eh += (la - lh) / 2; ea += (lh - la) / 2;
  return { eh, ea, m: eh - ea, total: eh + ea, pHome: Phi((eh - ea) / SD.ml), lh, la };
}
/* Desviaciones ajustadas con los partidos ya jugados (probabilidad = normal con esta desviación). */
const SD = { ml: 12, spread: 13, total: 18, pts: 12 };
/* El modelo no sabe de lesiones ni descansos y el mercado sí: para el "valor" se mezcla 50/50
   la probabilidad del modelo con la de la cuota. Así no salen ventajas grandes falsas. */
const MKT_W = .5;
const edgeOf = (p, imp) => imp == null || p == null ? null : (1 - MKT_W) * (p - imp) * 100;
function marketKey(g, market, team) { return market === 'total' ? 'G:' + gameKey(g) + '|total' : 'T:' + team + '|' + market; }
function marketLine(g, market, team) {
  const key = marketKey(g, market, team);
  if (uLines[key] != null) return uLines[key];
  if (ODDS[key]?.line != null && market !== 'ml') return ODDS[key].line;
  const md = model(g), isHome = team === g.home;
  if (market === 'spread') { const other = ODDS[marketKey(g, 'spread', isHome ? g.away : g.home)]; if (other) return -other.line; return Math.round(-(isHome ? md.m : -md.m) * 2) / 2 + .5 * Math.sign(isHome ? md.m : -md.m || 1); }
  if (market === 'total') return Math.floor(md.total) + .5;
  if (market === 'pts') return Math.floor(isHome ? md.eh : md.ea) + .5;
  return 0;
}
function marketEval(g, market, team, side, line) {
  const md = model(g), isHome = team === g.home, mT = isHome ? md.m : -md.m;
  let pModel;
  if (market === 'ml') pModel = Phi(mT / SD.ml);
  else if (market === 'spread') pModel = Phi((mT + line) / SD.spread);
  else if (market === 'total') pModel = 1 - Phi((line - md.total) / SD.total);
  else pModel = 1 - Phi((line - (isHome ? md.eh : md.ea)) / SD.pts);
  if (market === 'total' || market === 'pts') pModel = side === 'over' ? pModel : 1 - pModel;
  const histVal = x => market === 'ml' ? x.margin : market === 'spread' ? x.margin + line : market === 'total' ? x.total : x.pts;
  const thr = market === 'total' || market === 'pts' ? line : 0;
  const tg = market === 'total' ? null : team;
  const hist = n => {
    let L;
    if (market === 'total') L = [...tGames(g.home).slice(-n), ...tGames(g.away).slice(-n)];
    else L = n === 'h2h' ? tGames(tg).filter(x => x.opp === (isHome ? g.away : g.home)) : n === 'cur' ? tGames(tg).filter(x => x.season === D.cur) : tGames(tg).slice(-n);
    if (n === 'h2h' && market === 'total') L = tGames(g.home).filter(x => x.opp === g.away);
    if (n === 'cur' && market === 'total') L = [...tGames(g.home), ...tGames(g.away)].filter(x => x.season === D.cur);
    const o = L.filter(x => histVal(x) > thr).length; const p = L.length ? o / L.length : null;
    return { o, n: L.length, p: (market === 'total' || market === 'pts') && side === 'under' && p != null ? 1 - p : p };
  };
  const key = marketKey(g, market, team);
  const odSide = market === 'ml' || market === 'spread' ? 'over' : side;
  const eo = effOdd(key, odSide, market === 'ml' ? 0 : line);
  let imp = null;
  if (eo.v) {
    if (eo.src === 'hoy' && market === 'ml') { const other = ODDS[marketKey(g, 'ml', isHome ? g.away : g.home)]; imp = other?.over > 1 ? (1 / eo.v) / (1 / eo.v + 1 / other.over) : 1 / eo.v; }
    else if (market === 'spread') imp = 1 / eo.v;
    else imp = impliedProb(key, odSide, eo);
  }
  return { pModel, hist, key, eo, imp, edge: edgeOf(pModel, imp), histVal, thr };
}
function marketLabel(g, market, team, side, line) {
  if (market === 'ml') return `Gana ${team}`;
  if (market === 'spread') return `${team} ${signed(line)}`;
  if (market === 'total') return `${side === 'over' ? 'Más' : 'Menos'} de ${dec(line)} puntos`;
  return `${team} ${side === 'over' ? 'más' : 'menos'} de ${dec(line)}`;
}

/* ---------- gráfico de barras ---------- */
function chartWidth() { const sh = document.querySelector('.shell'); return Math.max(280, (sh ? sh.clientWidth - 32 : 340) - 18); }
/* Barras verdes si la apuesta habría salido (según el lado elegido) y rojas si no; altura = valor real
   con el número encima, la línea de la apuesta marcada y fecha y rival debajo. */
function chart(items, line, o = {}) {
  const n = items.length; if (!n) return `<p class="empty">Sin partidos con estos filtros.</p>`;
  const side = o.side || 'over';
  const W = Math.max(chartWidth(), n * 22 + 46), H = o.h || 236, padL = 40, padR = 6, padT = 26, padB = 40;
  const vals = items.map(i => i.v);
  let lo = Math.min(0, ...vals, line), hi = Math.max(...vals, line, 0);
  if (o.min === 'auto') lo = Math.max(0, Math.floor(Math.min(...vals, line) * .9 / 5) * 5);
  hi = hi + (hi - lo) * .1 || 1;
  const y = v => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
  const base = lo < 0 ? 0 : lo, slot = (W - padL - padR) / n, bw = Math.min(38, Math.max(8, slot * .74)), r = Math.min(6, bw / 3);
  const res = v => v === line ? 'push' : (side === 'under' ? v < line : v > line) ? 'hit' : 'miss';
  let s = `<svg class="bars${ANIM ? ' grow' : ''}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || '')}">`;
  s += `<line x1="${padL}" x2="${W - padR}" y1="${y(base)}" y2="${y(base)}" class="axis"/>`;
  if (lo < 0) s += `<text x="${padL - 6}" y="${y(lo) + 4}" text-anchor="end" class="tk">${Math.round(lo)}</text>`;
  s += `<text x="${padL - 6}" y="${y(base) + 4}" text-anchor="end" class="tk">${Math.round(base)}</text>`;
  const top = Math.max(...vals); if (top > base && Math.abs(y(top) - y(line)) > 14) s += `<text x="${padL - 6}" y="${y(top) + 4}" text-anchor="end" class="tk">${Math.round(top)}</text><line x1="${padL}" x2="${W - padR}" y1="${y(top)}" y2="${y(top)}" class="grid"/>`;
  items.forEach((it, i) => {
    const x = padL + i * slot + (slot - bw) / 2, cx = x + bw / 2, up = it.v >= base, h = Math.max(3, Math.abs(y(base) - y(it.v))), t = up ? y(base) - h : y(base), k = res(it.v);
    const path = up ? `M${x} ${t + h}V${t + r}Q${x} ${t} ${x + r} ${t}H${x + bw - r}Q${x + bw} ${t} ${x + bw} ${t + r}V${t + h}Z`
                    : `M${x} ${t}V${t + h - r}Q${x} ${t + h} ${x + r} ${t + h}H${x + bw - r}Q${x + bw} ${t + h} ${x + bw} ${t + h - r}V${t}Z`;
    s += `<path d="${path}" class="b ${k}" style="--d:${i * 25}ms"><title>${esc(it.title || '')}</title></path>`;
    if (it.flag) s += `<circle cx="${cx}" cy="7" r="3.5" fill="var(--bad)"><title>${esc(it.title || '')}</title></circle>`;
    if (bw >= 13) s += `<text x="${cx}" y="${up ? t - 6 : t + h + 13}" text-anchor="middle" class="vl ${k}">${esc(it.lab ?? it.v)}</text>`;
    if (slot >= 26 || i % Math.ceil(26 / slot) === 0) s += `<text x="${cx}" y="${H - 22}" text-anchor="middle" class="d1">${esc(it.d1)}</text><text x="${cx}" y="${H - 8}" text-anchor="middle" class="d2">${esc(it.d2)}</text>`;
  });
  s += `<line x1="${padL}" x2="${W - padR}" y1="${y(line)}" y2="${y(line)}" class="ln"/>`;
  s += `<rect x="1" y="${y(line) - 10}" width="${padL - 5}" height="20" rx="10" class="lnp"/><text x="${(padL - 4) / 2 + 1}" y="${y(line) + 4}" text-anchor="middle" class="lnt">${esc(o.lineLab ?? dec(line))}</text>`;
  return s + '</svg>';
}
/* Mini barras para las listas: últimos partidos, verde si se cumplió, rojo si no. */
function spark(vals, line, side = 'over') {
  const n = vals.length; if (!n) return '';
  const W = 112, H = 34, gap = 2, bw = (W - gap * (n - 1)) / n, mx = Math.max(...vals, line) * 1.08 || 1, yl = H - H * line / mx;
  return `<svg class="mini" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">${vals.map((v, i) => { const h = Math.max(2.5, H * v / mx), ok = v === line ? 'push' : (side === 'under' ? v < line : v > line) ? 'hit' : 'miss';
    return `<rect x="${i * (bw + gap)}" y="${H - h}" width="${bw}" height="${h}" rx="1.5" class="b ${ok}"/>`; }).join('')}<line x1="0" x2="${W}" y1="${yl}" y2="${yl}" class="ln"/></svg>`;
}

/* ---------- cabecera y barra ---------- */
function topBar(title, withBack) {
  const mIcon = mode === 'light' ? ICON.sun : mode === 'dark' ? ICON.moon : ICON.auto;
  const mLab = mode === 'light' ? 'Modo claro' : mode === 'dark' ? 'Modo oscuro' : 'Modo automático';
  return `<header class="top">${withBack ? `<button class="ic" data-act="back" aria-label="Volver">${ICON.back}</button><div class="ttl">${esc(title)}</div>` : `<div class="brand">Tribuna<i>.</i></div>`}${!withBack ? fresh() : ''}
    <button class="ic" data-act="mode" aria-label="${mLab}" title="${mLab}">${mIcon}</button></header>`;
}
function fresh() {
  if (!D) return '';
  const h = (Date.now() - new Date(D.updated)) / 36e5, ok = DEMO || h < 30;
  const txt = (ok ? 'Datos al día' : 'Datos sin actualizar') + ' · ' + updatedTxt().replace('Estadísticas: ', '');
  return `<span class="fresh ${ok ? '' : 'old'}" title="${esc(txt)}" aria-label="${esc(txt)}"><i></i>${ok ? 'Al día' : 'Sin actualizar'}</span>`;
}
function tabBar() {
  const t = [['hoy', 'Hoy', ICON.hoy], ['props', 'Props', ICON.props], ['slip', 'Boleto', ICON.slip], ['bets', 'Apuestas', ICON.bets]];
  if (isAdmin) t.push(['admin', 'Cuotas', ICON.admin]);
  const root = { hoy: 'hoy', game: 'hoy', player: 'hoy', props: 'props', slip: 'slip', bets: 'bets', admin: 'admin' }[S.view];
  return `<div class="tabbar"><nav>${t.map(([v, l, i]) => `<button data-nav="${v}" ${root === v ? 'aria-current="page"' : ''}>${i}${l}${v === 'slip' && slip.length ? `<span class="badge">${slip.length}</span>` : ''}</button>`).join('')}</nav></div>`;
}
const legal = () => `<footer class="legal">Estimaciones a partir de partidos pasados; no garantizan nada. +18 · Juega solo lo que puedas permitirte perder.${DEMO ? '<br>Modo demostración: estadísticas y cuotas simuladas.' : `<div class="acct">Sesión: <b>${esc(userEmail)}</b>${isAdmin ? ' · administrador' : ''} · <button class="linkb" data-act="logout">Cerrar sesión</button>
  <details class="np"><summary>Cambiar mi contraseña</summary><form id="newpass"><input id="np" class="field" type="password" minlength="6" required autocomplete="new-password" placeholder="Nueva contraseña (mín. 6)" aria-label="Nueva contraseña"><button class="btn ghost sm-btn" type="submit">Guardar</button></form><div id="npmsg" class="sm"></div></details></div>`}</footer>`;
const updatedTxt = () => { const d = new Date(D.updated); return isNaN(d) ? '' : 'Estadísticas: ' + d.toLocaleString('es-ES', { timeZone: 'Europe/Rome', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };

/* ---------- vista: hoy ---------- */
function viewHoy() {
  const g0 = D.games[0], first = D.games.map(g => etToRome(g.date, g.status).time).filter(x => /^\d/.test(x)).sort()[0];
  const nVal = [...propRows('players', 'all', 'l10'), ...propRows('games')].filter(r => ((r.type === 'p' ? r.b.edge : r.ev.edge) ?? -99) >= 5).length;
  return `${topBar('', false)}<div class="stack fade">
    <section class="tonight">
      <div class="eyebrow">${g0 ? esc(nightLabel(g0.date)) : ''}</div>
      <h1>Esta noche</h1>
      ${D.games.length ? `<div class="kpis">
        <div><b>${D.games.length}</b><span>${D.games.length === 1 ? 'partido' : 'partidos'}</span></div>
        <div><b>${esc(first || '–')}</b><span>primer salto</span></div>
        <button data-nav="props"><b class="hi">${nVal}</b><span>${nVal === 1 ? 'apuesta con valor' : 'apuestas con valor'}</span></button>
      </div>` : ''}
    </section>
    ${D.games.length ? D.games.map(g => {
      const t = etToRome(g.date, g.status), md = model(g), mlH = ODDS['T:' + g.home + '|ml'], mlA = ODDS['T:' + g.away + '|ml'];
      return `<button class="card game" data-game="${esc(g.id)}">
        <div class="teams"><div class="tm">${V.crest(g.away, 68, 'sm')}<b>${g.away}</b><span>${record(g.away, D.cur)}${mlA ? ' · ' + dec(mlA.over, 2) : ''}</span></div>
        <div class="mid"><b>${esc(t.time)}</b>${g.status && !t.day ? '' : ''}</div>
        <div class="tm">${V.crest(g.home, 68, 'sm')}<b>${g.home}</b><span>${record(g.home, D.cur)}${mlH ? ' · ' + dec(mlH.over, 2) : ''}</span></div></div>
        <div class="wp"><i class="a" style="width:${(1 - md.pHome) * 100}%"></i><i class="h" style="width:${md.pHome * 100}%"></i></div>
        <div class="wp-l"><span>${pct(1 - md.pHome)}</span><span>Modelo · total ${dec(md.total, 0)}</span><span>${pct(md.pHome)}</span></div>
      </button>`;
    }).join('') : `<div class="card empty"><b>No hay partidos hoy</b>Vuelve mañana.</div>`}
    ${legal()}</div>`;
}

/* ---------- vista: partido ---------- */
function viewGame() {
  const g = D.games.find(x => x.id === S.gameId); if (!g) { S.view = 'hoy'; return viewHoy(); }
  const t = etToRome(g.date, g.status), md = model(g);
  const tabs = [['game', 'Partido'], ['away', 'Jugadores ' + g.away], ['home', 'Jugadores ' + g.home]];
  return `${topBar(g.away + ' @ ' + g.home, true)}<div class="stack fade">
    <div class="card pad matchup" style="--ca:${V.colors(g.away)[0]};--ch:${V.colors(g.home)[0]}">
      <div class="teams" style="position:relative;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;text-align:center">
        <div class="tm">${V.crest(g.away, 104, ANIM ? 'in' : '')}<b>${g.away}</b><span>${record(g.away, D.cur)} · fuera ${record(g.away, D.cur, 'away')}</span></div>
        <div class="mid vs-glow"><b>${esc(t.time)}</b>${esc(t.day)}</div>
        <div class="tm">${V.crest(g.home, 104, ANIM ? 'in b' : '')}<b>${g.home}</b><span>${record(g.home, D.cur)} · casa ${record(g.home, D.cur, 'home')}</span></div></div>
    </div>
    <div class="sectabs" role="tablist" aria-label="Apartado">${tabs.map(([v, l]) => `<button role="tab" data-gtab="${v}" aria-selected="${S.gtab === v}">${esc(l)}</button>`).join('')}</div>
    ${S.gtab === 'game' ? gameSection(g, md) : teamSection(g, S.gtab === 'home' ? g.home : g.away)}
    ${legal()}</div>`;
}

/* apartado Partido: ganador de los dos equipos, historial y otros mercados */
function bajasCard(g) {
  const cols = [g.away, g.home].map(t => {
    const L = teamBajas(t), loss = L.reduce((a, x) => a + x.w * x.imp, 0);
    return `<div><div class="row-between"><b>${t}</b><span class="note">${loss >= .05 ? '−' + dec(loss) + ' pts' : 'sin efecto'}</span></div>
      ${L.length ? `<ul class="bajas">${L.map(x => `<li><button class="linkb" data-pid="${x.p.id}">${esc(x.p.name)}</button> <span class="pill ${x.b.status === 'out' ? 'bad' : x.b.status === 'probable' ? '' : 'acc'}">${BAJA_N[x.b.status]}</span>${x.imp * x.w >= .3 ? ` <span class="mut xs">−${dec(x.imp * x.w)}</span>` : ''}${x.b.note ? `<div class="mut xs">${esc(x.b.note)}</div>` : ''}</li>`).join('')}</ul>` : '<div class="mut sm">Sin bajas</div>'}</div>`;
  });
  return `<div class="card pad"><div class="row-between"><h3>Bajas</h3><span class="note">${BAJAS_AT ? 'Actualizado ' + new Date(BAJAS_AT).toLocaleString('es-ES', { timeZone: 'Europe/Rome', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Sin parte de lesiones cargado'}</span></div>
    <div class="bajas-grid">${cols.join('')}</div>
    <p class="note" style="margin:8px 0 0">El modelo ya descuenta estas bajas (las dudas cuentan a medias). Lo que pierde cada equipo sale de lo que aporta el jugador frente a un suplente.</p></div>`;
}
function teamFacts(g, tm) {
  const opp = tm === g.home ? g.away : g.home, isHome = tm === g.home, L = tGames(tm), out = [];
  const restOf = x => { const l = tGames(x).slice(-1)[0]; return l ? Math.round((new Date(g.date + 'T00:00:00Z') - l.d) / 864e5) - 1 : null; };
  const r = restOf(tm), ro = restOf(opp);
  if (r != null) out.push(r === 0 ? ['bad', `Juega back-to-back (ayer también jugó)`] : [r > (ro ?? r) ? 'good' : '', `${r} ${r === 1 ? 'día' : 'días'} de descanso${ro != null && ro !== r ? ` · ${opp} ${ro === 0 ? 'viene de back-to-back' : ro + (ro === 1 ? ' día' : ' días')}` : ''}`]);
  let k = 0; const last = L.slice(-1)[0]; if (last) { const w = last.margin > 0; for (let i = L.length - 1; i >= 0 && (L[i].margin > 0) === w; i--) k++; if (k >= 2) out.push([w ? 'good' : 'bad', `Racha de ${k} ${w ? 'victorias' : 'derrotas'} seguidas`]); }
  const ven = tGames(tm, isHome ? 'home' : 'away').filter(x => x.season === D.cur), vw = ven.filter(x => x.margin > 0).length;
  if (ven.length) out.push([vw / ven.length >= .65 ? 'good' : vw / ven.length <= .35 ? 'bad' : '', `${isHome ? 'En casa' : 'Fuera de casa'} esta temporada: ${vw}-${ven.length - vw}`]);
  const l10 = L.slice(-10); if (l10.length) out.push(['', `Últimos 10: ${l10.filter(x => x.margin > 0).length}-${l10.filter(x => x.margin <= 0).length}, ${signed(mean(l10.map(x => x.margin)))} de diferencia media, ${dec(mean(l10.map(x => x.pts)), 0)} puntos a favor`]);
  const h = L.filter(x => x.opp === opp); if (h.length) { const hw = h.filter(x => x.margin > 0).length; out.push([hw > h.length - hw ? 'good' : hw < h.length - hw ? 'bad' : '', `Contra ${opp} en las dos temporadas: ${hw}-${h.length - hw}`]); }
  const oc = tGames(opp).slice(-10); if (oc.length) out.push(['', `${opp} en sus últimos 10: ${oc.filter(x => x.margin > 0).length}-${oc.filter(x => x.margin <= 0).length}, encaja ${dec(mean(oc.map(x => x.opp_pts)), 0)} puntos`]);
  return out;
}
function gameSection(g, md) {
  const evs = [g.away, g.home].map(tm => ({ tm, ev: marketEval(g, 'ml', tm, 'over', 0) }));
  const score = x => x.ev.edge ?? (x.ev.pModel - .5) * 100 - 1000;
  const best = score(evs[0]) >= score(evs[1]) ? evs[0].tm : evs[1].tm;
  if (!S.mTeam) S.mTeam = best === g.home ? 'home' : 'away';
  const tm = S.mTeam === 'home' ? g.home : g.away, isHome = tm === g.home, opp = isHome ? g.away : g.home;
  const W = [['l5', 'L5', 5], ['l10', 'L10', 10], ['l20', 'L20', 20], ['h2h', 'H2H', 'h2h'], ['cur', D.cur.slice(2), 'cur']];
  const n = W.find(w => w[0] === S.gwin)?.[2] ?? 10;
  let base = tGames(tm, S.gvenue);
  const series = n === 'h2h' ? base.filter(x => x.opp === opp) : n === 'cur' ? base.filter(x => x.season === D.cur) : base.slice(-n);
  const wins = series.filter(x => x.margin > 0).length;
  const items = series.slice(-25).map(x => ({ v: x.margin, lab: (x.margin > 0 ? '+' : '') + x.margin, d1: fdate(x.d), d2: (x.home ? '' : '@') + x.opp, title: `${fdate(x.d)} ${x.home ? 'vs' : '@'} ${x.opp}: ${x.pts}-${x.opp_pts}` })); withMissed(items, series.slice(-25), tm);
  const evSel = evs.find(x => x.tm === tm).ev;
  const facts = teamFacts(g, tm);
  const other = ['spread', 'total', 'pts'];
  return `<section class="stack">
    <div class="sec-h"><h3>Ganador</h3><span class="note">Modelo: ${g.home} ${md.m >= 0 ? 'por' : 'pierde por'} ${dec(Math.abs(md.m))} · ${dec(md.eh, 0)}-${dec(md.ea, 0)}${md.lh + md.la >= .5 ? ' · con bajas' : ''}</span></div>
    <div class="ml2">${evs.map(({ tm: x, ev }) => `<button class="mlb" data-mteam="${x === g.home ? 'home' : 'away'}" aria-pressed="${x === tm}">
      ${x === best && (ev.edge == null || hasValue(ev.edge)) ? `<span class="best">${ev.edge != null ? 'La que más conviene' : 'Favorito del modelo'}</span>` : ''}
      <div class="mlt">${V.crest(x, 30, 'sm')}<b>${x}</b></div>
      <div class="odd">${ev.eo.v ? dec(ev.eo.v, 2) : '–'}</div>
      <div class="xs mut">Modelo <b class="${ev.pModel >= .5 ? 'hi' : ''}">${pct(ev.pModel)}</b>${ev.imp != null ? `<br>La cuota le da ${pct(ev.imp)}` : ''}</div>
      ${verdict(ev.edge)}</button>`).join('')}</div>
    <div class="card">
      <div class="pick" style="padding-bottom:6px"><div><div class="big">Historial de ${tm}</div><div class="sm mut">${wins}-${series.length - wins} en este tramo · ${series.length ? signed(mean(series.map(x => x.margin))) + ' de diferencia media' : ''}</div></div></div>
      <div class="pick" style="padding-top:0">
        <div class="seg" role="group" aria-label="Tramo">${W.map(([w, l]) => `<button data-gwin="${w}" aria-pressed="${S.gwin === w}">${l}</button>`).join('')}</div>
        <div class="seg" role="group" aria-label="Lugar">${[['all', 'Todos'], ['home', 'Casa'], ['away', 'Fuera']].map(([v, l]) => `<button data-gvenue="${v}" aria-pressed="${S.gvenue === v}">${l}</button>`).join('')}</div>
        <button class="btn ghost" data-act="add-ml" style="margin-left:auto">+ Combinada</button>
      </div>
      <div class="chartbox">${chart(items, 0, { label: 'Diferencia de puntos', lineLab: '0' })}</div>
      <div class="pad" style="padding-top:0"><div class="note">Diferencia de puntos de ${tm} en cada partido${S.gvenue !== 'all' ? (S.gvenue === 'home' ? ' en casa' : ' fuera') : ''}. Por encima de 0 = ganó. Pulsa una barra para ver el marcador.</div>${missedNote(series, tm)}</div>
    </div>
    ${bajasCard(g)}
    <div class="card pad"><h3>Detalles que pueden cambiarlo todo</h3><ul class="facts-list">${facts.map(([c, txt]) => `<li class="${c}">${esc(txt)}</li>`).join('')}</ul></div>
    <div class="sec-h"><h3>Otros mercados</h3></div>
    <div class="markets three">${other.map(m => { const tmm = m === 'total' ? null : tm, L = marketLine(g, m, tmm), o = ODDS[marketKey(g, m, tmm)];
      return `<button class="mk" data-market="${m}" aria-pressed="${S.market === m}"><small>${MARKET_N[m]}${tmm ? ' · ' + tmm : ''}</small><b>${m === 'spread' ? signed(L) : dec(L)}</b>${o?.over ? `<small>${dec(o.over, 2)}</small>` : ''}</button>`; }).join('')}</div>
    ${other.includes(S.market) ? marketCard(g) : ''}
  </section>`;
}
function marketCard(g) {
  const team = S.market === 'total' ? null : (S.mTeam === 'home' ? g.home : g.away);
  const side = (S.market === 'total' || S.market === 'pts') ? getSide(marketKey(g, S.market, team)) : 'over';
  const line = marketLine(g, S.market, team), ev = marketEval(g, S.market, team, side, line);
  const W = [['l5', 'L5', 5], ['l10', 'L10', 10], ['l20', 'L20', 20], ['h2h', 'H2H', 'h2h'], ['cur', D.cur.slice(2), 'cur']];
  const nSel = W.find(w => w[0] === S.gwin)?.[2] ?? 10;
  const src = S.market === 'total' ? g.home : team, opp = src === g.home ? g.away : g.home;
  const series = nSel === 'h2h' ? tGames(src).filter(x => x.opp === opp) : nSel === 'cur' ? tGames(src).filter(x => x.season === D.cur) : tGames(src).slice(-nSel);
  const items = series.slice(-25).map(x => ({ v: S.market === 'spread' ? x.margin : S.market === 'total' ? x.total : x.pts, d1: fdate(x.d), d2: (x.home ? '' : '@') + x.opp, title: `${fdate(x.d)} ${x.home ? 'vs' : '@'} ${x.opp}: ${x.pts}-${x.opp_pts}` }));
  items.forEach(i => { if (S.market === 'spread') i.lab = (i.v > 0 ? '+' : '') + i.v; }); withMissed(items, series.slice(-25), src);
  const cLine = S.market === 'spread' ? -line : line, h = ev.hist(nSel);
  return `<div class="card">
      <div class="pick">
        ${S.market === 'total' || S.market === 'pts' ? `<div class="seg" role="group" aria-label="Lado">${[['over', 'Más'], ['under', 'Menos']].map(([v, l]) => `<button data-gside="${v}" aria-pressed="${side === v}">${l}</button>`).join('')}</div>` : ''}
        <div class="ctl"><button class="ic" data-gstep="-0.5" aria-label="Bajar línea">−</button><input id="gline" type="number" step="0.5" value="${line}" inputmode="decimal" aria-label="Línea"><button class="ic" data-gstep="0.5" aria-label="Subir línea">+</button></div>
        <div class="ctl"><span class="mut sm">Cuota</span><input id="godd" type="number" step="0.01" min="1.01" placeholder="1,90" value="${ev.eo.v ?? ''}" inputmode="decimal" aria-label="Cuota"></div>
      </div>
      <div class="pick" style="padding-top:0"><div class="big">${esc(marketLabel(g, S.market, team, side, line))}${ev.eo.v ? ` <span class="mut">· ${dec(ev.eo.v, 2)}</span>` : ''}</div>${verdict(ev.edge)}</div>
      <div class="pick" style="padding-top:0"><span class="sm mut">Modelo <b class="hi">${pct(ev.pModel)}</b> · Histórico ${S.gwin.toUpperCase()} <b>${pct(h.p)}</b> (${h.o}/${h.n})${ev.imp != null ? ` · La cuota le da <b>${pct(ev.imp)}</b>` : ' · Escribe una cuota para ver el valor'}</span>
        ${ev.eo.src === 'tuya' ? `<button class="linkb" data-act="reset-godd">Usar la cuota de hoy</button>` : ''}${uLines[ev.key] != null ? `<button class="linkb" data-act="reset-gline">Línea de hoy</button>` : ''}
        <button class="btn ghost" data-act="add-game" style="margin-left:auto">+ Combinada</button></div>
      <div class="chartbox">${chart(items, cLine, { min: S.market === 'spread' ? undefined : 'auto', side: S.market === 'spread' ? 'over' : side, label: MARKET_N[S.market], lineLab: S.market === 'spread' ? signed(-line) : dec(line) })}</div>
      <div class="pad" style="padding-top:0"><div class="note">${S.market === 'spread' ? `Diferencia de puntos de ${team}. Cubre el ${signed(line)} si la barra supera ${signed(-line)}.` : S.market === 'total' ? 'Puntos totales en los partidos de ' + g.home + '.' : 'Puntos de ' + team + ' en cada partido.'}</div>${missedNote(series, src)}</div>
    </div>`;
}

/* apartado Jugadores de un equipo: los más probables para el mercado elegido */
const TEAM_STATS = ['pts', 'reb', 'ast', 'fg3m', 'fg3a', 'pra', 'pr', 'pa', 'ra', 'dd', 'td', 'stl', 'blk', 'sb', 'tov', 'fgm', 'fga', 'ftm', 'fta'];
function teamSection(g, tm) {
  const k = S.tstat, opp = tm === g.home ? g.away : g.home, yes = k === 'dd' || k === 'td';
  const ps = Object.values(D.players).filter(p => p.team === tm && p.avgMin >= 10);
  const PER = [['cur', D.cur.slice(2)], ['h2h', 'H2H'], ['dvp', 'DvP'], ['l5', 'L5'], ['l10', 'L10'], ['l20', 'L20']];
  const rows = ps.map(p => {
    const key = lineKey(p.id, k), line = getLine(p, k);
    const hw = w => hit(windowGames(p, w, p.log), k, line);
    const l10 = hw('l10');
    let side, edge = null, eo = { v: null };
    if (ODDS[key] && !yes) { const b = bestSide(propProb(p, k, line), key, line); side = b.side; edge = b.edge; eo = b.eo; }
    else side = yes ? 'over' : (propProb(p, k, line) ?? .5) >= .5 ? 'over' : 'under';
    if (yes && ODDS[key]) { eo = effOdd(key, 'over', line); edge = edgeOf(propProb(p, k, line), impliedProb(key, 'over', eo)); }
    const per = {}; for (const [w] of PER) if (w !== 'dvp') { const h = hw(w); per[w] = { p: sideP(h, side), n: h.n }; }
    const rk = defRank(opp, p.pos, SK[k].base || k);
    per.dvp = { rk, score: rk == null ? 0 : side === 'over' ? rk / 30 : 1 - rk / 30 };
    return { p, line, side, edge, eo, per };
  }).filter(r => r.per.l20.n);
  const sortV = r => S.twin === 'dvp' ? r.per.dvp.score : (r.per[S.twin].p ?? -1);
  rows.sort((a, b) => sortV(b) - sortV(a));
  const tone = v => v == null ? '' : v >= .6 ? 'good' : v <= .4 ? 'bad' : '';
  return `<section class="stack">
    <div class="pillbar" role="tablist" aria-label="Mercado">${TEAM_STATS.map(s => `<button role="tab" data-tstat="${s}" aria-selected="${s === k}">${SK[s].short || SK[s].n}</button>`).join('')}</div>
    <div class="row-between"><h3>${SK[k].short || SK[k].n} · ${tm}</h3><span class="note">Ordenado por ${PER.find(x => x[0] === S.twin)[1]}</span></div>
    <div class="plist">${rows.length ? rows.map(r => `<button class="pcard" data-open-p="${r.p.id}" data-open-k="${k}">
      <div class="pc-top">${avatar(r.p)}
        <div class="pc-name"><div class="nm">${esc(r.p.name)} <span class="mut xs">${r.p.team} · ${r.p.pos}</span>${bajaOf(r.p.id) ? ` <span class="pill ${bajaOf(r.p.id).status === 'out' ? 'bad' : 'acc'}" style="padding:1px 6px">${BAJA_N[bajaOf(r.p.id).status]}</span>` : ''}</div>
          <div class="pc-line"><span class="sd ${r.side}">${r.side === 'over' ? 'Más' : 'Menos'}</span> ${yes ? SK[k].n : `${dec(r.line)} ${esc(SK[k].short || SK[k].n)}`}</div></div>
        <div class="pc-num"><small>Cuota</small><b>${r.eo.v ? dec(r.eo.v, 2) : '–'}</b></div>
        <div class="pc-num"><small>Valor</small><b class="${r.edge >= 3 ? 'ok' : r.edge <= -3 ? 'err' : ''}">${r.edge != null ? edgeTxt(r.edge) : '–'}</b></div></div>
      <div class="tiles">${PER.map(([w, l]) => w === 'dvp'
        ? `<div class="${S.twin === w ? 'on ' : ''}${r.per.dvp.score >= .66 ? 'good' : r.per.dvp.score <= .33 ? 'bad' : ''}"><small>${l}</small><b>${r.per.dvp.rk ? r.per.dvp.rk + '.º' : '–'}</b></div>`
        : `<div class="${S.twin === w ? 'on ' : ''}${tone(r.per[w].p)}"><small>${l}</small><b>${r.per[w].n ? pct(r.per[w].p).replace('\u00a0', '') : '–'}</b></div>`).join('')}</div>
    </button>`).join('') : '<div class="card empty">Sin jugadores en los datos.</div>'}</div>
    <p class="note">Cada recuadro es el % de partidos en que se cumplió en ese tramo. DvP: puesto de ${opp} contra su posición (30.º = la defensa que más concede). La línea es la cargada hoy o, si no hay, la mediana de sus últimos 20.</p>
    <div class="floatbar" role="group" aria-label="Ordenar por">${PER.map(([w, l]) => `<button data-twin="${w}" aria-pressed="${S.twin === w}">${l}</button>`).join('')}</div>
  </section>`;
}
/* Foto del jugador (NBA.com, solo uso privado: fotosOficiales en config.js) o sus iniciales, con el logo de su equipo en la esquina. */
function avatar(p, size = 42) {
  const [c1, c2] = V.colors(p.team);
  const img = CFG.fotosOficiales ? `<img src="https://cdn.nba.com/headshots/nba/latest/260x190/${p.id}.png" alt="" loading="lazy" onerror="this.remove()">` : '';
  return `<span class="pavw" style="--ps:${size}px"><span class="pav" style="--c1:${c1};--c2:${c2}">${initials(p.name)}${img}</span>${CFG.fotosOficiales ? `<span class="pbadge">${V.crest(p.team, Math.round(size * .38), 'sm')}</span>` : ''}</span>`;
}

/* ---------- vista: jugador ---------- */
function viewPlayer() {
  const p = D.players[S.pid]; if (!p) { S.view = 'hoy'; return viewHoy(); }
  const k = S.stat, key = lineKey(p.id, k), line = getLine(p, k), side = getSide(key), opp = oppOf(p.team), g = gameOfTeam(p.team);
  const base = filtered(p), games = windowGames(p, S.win, base), vals = games.map(x => val(x, k)), h = hit(games, k, line), ph = sideP(h, side);
  const eo = effOdd(key, side, line), imp = impliedProb(key, side, eo), pm = propProb(p, k, line, side), edge = edgeOf(pm, imp);
  const defR = opp ? defRank(opp, p.pos, SK[k].base || k) : null;
  const gradeL = (() => { const s = (sideP(hit(windowGames(p, 'l10'), k, line), side) ?? .5) * .65 + ((defR || 15) / 30) * .35; return ['D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'][Math.max(0, Math.min(9, Math.floor(s * 10)))]; })();
  const o = ODDS[key], t = g ? etToRome(g.date, g.status) : null;
  const three = (k === 'fg3m' || k === 'fg3a') ? (() => { const m = games.reduce((a, x) => a + x.fg3m, 0), a = games.reduce((s2, x) => s2 + x.fg3a, 0); return `<div>Triples<b>${m}/${a}</b></div><div>Acierto<b>${a ? dec(m / a * 100) + ' %' : '–'}</b></div>`; })() : `<div>Mediana<b>${dec(median(vals))}</b></div><div>Máx.<b>${vals.length ? Math.max(...vals) : '–'}</b></div>`;
  const items = games.map(x => ({ v: val(x, k), d1: fdate(x.d), d2: (x.home ? '' : '@') + x.opp, title: `${fdate(x.d)} ${x.home ? 'vs' : '@'} ${x.opp}: ${val(x, k)} en ${x.min} min` }));
  return `${topBar(p.name, true)}<div class="stack fade">
    <div class="card hero" style="--c2:${V.colors(p.team)[1]}">${V.playerBackdrop(p, FONDOS[p.id])}
      <div class="who"><div class="av team">${CFG.fotosOficiales ? avatar(p, 72) : V.crest(p.team, 50, ANIM ? 'in' : '')}</div><div style="min-width:0"><div class="n">${esc(p.name)}</div><div class="mut sm">${p.team} · ${{ G: 'Base/escolta', F: 'Alero', C: 'Pívot' }[p.pos]}${g ? ` · ${g.home === p.team ? 'vs' : '@'} ${opp} · ${esc(t.time)}` : ''}</div><div class="spec"><i></i>${V.SPEC[V.specialty(p)] || ''}</div>${bajaOf(p.id) ? `<div class="sm" style="margin-top:6px"><span class="pill ${bajaOf(p.id).status === 'out' ? 'bad' : 'acc'}">${BAJA_N[bajaOf(p.id).status]}</span> <span class="mut xs">${esc(bajaOf(p.id).note || '')}</span></div>` : ''}</div><div class="grade" title="Nota del duelo: % de L10 y defensa del rival">${gradeL}</div></div>
      ${isAdmin ? `<details class="fondo"><summary>Fondo animado</summary><div class="ctl" style="margin-top:8px"><input id="fondo" class="field" type="url" placeholder="Enlace a un GIF o MP4" value="${esc(FONDOS[p.id] || '')}" aria-label="Enlace del fondo"><button class="btn ghost" data-act="save-fondo">Guardar</button></div><div class="note">Vacío = animación propia según su especialidad.</div></details>` : ''}
    </div>
    <div class="chips" role="tablist" aria-label="Estadística">${STATS.map(s => `<button class="chip" role="tab" data-stat="${s.k}" aria-selected="${s.k === k}" title="${s.n}">${s.l}</button>`).join('')}</div>
    <div class="card">
      <div class="pick">
        <div class="seg" role="group" aria-label="Lado">${[['over', 'Más de'], ['under', 'Menos de']].map(([v, l]) => `<button data-side="${v}" aria-pressed="${side === v}">${l}</button>`).join('')}</div>
        <div class="ctl"><button class="ic" data-step="-0.5" aria-label="Bajar línea">−</button><input id="pline" type="number" step="0.5" min="0" value="${line}" inputmode="decimal" aria-label="Línea"><button class="ic" data-step="0.5" aria-label="Subir línea">+</button></div>
        <div class="ctl"><span class="mut sm">Cuota</span><input id="podd" type="number" step="0.01" min="1.01" placeholder="1,85" value="${eo.v ?? ''}" inputmode="decimal" aria-label="Cuota"></div>
      </div>
      <div class="pick" style="padding-top:0"><div class="big">${side === 'over' ? 'Más' : 'Menos'} de ${dec(line)} <span class="mut" style="font-weight:600;font-size:15px">${esc(SK[k].n.toLowerCase())}</span></div>${verdict(edge)}</div>
      <div class="pick" style="padding-top:0"><span class="sm mut">${o ? `Línea de hoy ${dec(o.line)}${o.over ? ' · más ' + dec(o.over, 2) : ''}${o.under ? ' · menos ' + dec(o.under, 2) : ''}` : 'Sin cuota cargada hoy: línea = mediana de L20'}${imp != null ? ` · La cuota le da <b>${pct(imp)}</b>, el modelo <b>${pct(pm)}</b> (este tramo ${pct(ph)})` : ''}</span>
        ${uLines[key] != null ? `<button class="linkb" data-act="reset-line">Usar la línea de hoy (${dec(autoLine(p, k))})</button>` : ''}${eo.src === 'tuya' ? `<button class="linkb" data-act="reset-odd">Usar la cuota de hoy</button>` : ''}
        <button class="btn ghost" data-act="add-player" style="margin-left:auto">+ Combinada</button></div>
      <div class="wins">${WINS().map(([w, l]) => { const x = hit(windowGames(p, w, base), k, line), pp = sideP(x, side); return `<button class="win ${pp == null ? '' : pp >= .55 ? 'good' : pp <= .45 ? 'bad' : ''}" data-win="${w}" aria-pressed="${S.win === w}"><small>${l}</small><b>${pct(pp)}</b><span>${side === 'over' ? x.o : x.n - x.o}/${x.n}</span></button>`; }).join('')}</div>
      <div class="chartbox">${chart(items, line, { label: SK[k].n, side })}</div>
      <div class="pad" style="padding-top:0"><div class="legend"><span><i class="hit"></i>${side === 'over' ? 'Superó' : 'Se quedó por debajo de'} ${dec(line)}</span><span><i class="miss"></i>No ${side === 'over' ? 'llegó' : 'se quedó por debajo'}</span><span><i class="lnk"></i>Línea</span></div>
        <div class="note">${side === 'over' ? 'Más' : 'Menos'} de ${dec(line)} se cumplió en <b class="hi">${side === 'over' ? h.o : h.n - h.o} de ${h.n}</b> partidos de este tramo.</div></div>
    </div>
    <div class="card pad"><div class="facts"><div>Media<b>${dec(mean(vals))}</b></div>${three}<div>Def. ${opp || '–'}<b>${defR ? defR + '.º' : '–'}</b></div></div>
      <p class="note" style="margin:8px 0 0">${defR ? `${opp} es la ${defR}.ª defensa contra ${{ G: 'bases y escoltas', F: 'aleros', C: 'pívots' }[p.pos]} en ${SK[SK[k].base || k].n.toLowerCase()} (30.ª = la que más concede).` : ''}</p></div>
    <div class="card pad filters">
      <div class="seg" role="group" aria-label="Lugar">${[['all', 'Todos'], ['home', 'Casa'], ['away', 'Fuera']].map(([v, l]) => `<button data-venue="${v}" aria-pressed="${S.venue === v}">${l}</button>`).join('')}</div>
      <label for="minr">Mín. minutos <input id="minr" type="range" min="0" max="40" step="2" value="${S.minMin}"><b id="minv">${S.minMin}</b></label>
      <label for="rest">Descanso <select id="rest">${[['all', 'Todos'], ['0', '0 días (back-to-back)'], ['1', '1 día'], ['2', '2 días o más']].map(([v, l]) => `<option value="${v}"${S.rest === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    <div class="card"><div class="pad" style="padding-bottom:0"><h3>Partidos del tramo</h3></div><div class="tbl"><table><thead><tr><th class="l">Fecha</th><th class="l">Rival</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>3PM-3PA</th><th>TC</th><th>TL</th><th>ROB</th><th>TAP</th><th>${SK[k].l}</th></tr></thead><tbody>
      ${games.slice().reverse().map(x => { const v = val(x, k); return `<tr><td class="l">${fdate(x.d)}${x.rest === 0 ? ' <span class="pill" style="padding:1px 6px">B2B</span>' : ''}</td><td class="l">${x.home ? 'vs' : '@'} ${x.opp}</td><td>${x.min}</td><td>${x.pts}</td><td>${x.reb}</td><td>${x.ast}</td><td>${x.fg3m}-${x.fg3a}</td><td>${x.fgm}-${x.fga}</td><td>${x.ftm}-${x.fta}</td><td>${x.stl}</td><td>${x.blk}</td><td class="${v > line ? 'o' : ''}">${v}</td></tr>`; }).join('') || '<tr><td class="l" colspan="12">Sin partidos con estos filtros.</td></tr>'}
    </tbody></table></div></div>
    ${legal()}</div>`;
}

/* ---------- vista: props ---------- */
function bestSide(hp, key, line) {
  let best = null;
  for (const side of ['over', 'under']) {
    const eo = effOdd(key, side, line); const imp = impliedProb(key, side, eo); const p = side === 'over' ? hp : hp == null ? null : 1 - hp;
    const edge = edgeOf(p, imp);
    if (!best || (edge ?? -999) > (best.edge ?? -999)) best = { side, eo, imp, p, edge };
  }
  return best;
}
function propRows(tab, stat, win) {
  const playing = new Set(D.games.flatMap(g => [g.home, g.away]));
  let rows = [];
  if (tab === 'players') {
    for (const [key, o] of Object.entries(ODDS)) {
      const [pid, k] = key.split('|'); const p = D.players[pid]; if (!p || !SK[k] || !playing.has(p.team)) continue;
      if (stat !== 'all' && stat !== k) continue;
      const g = windowGames(p, win, p.log), line = getLine(p, k), h = hit(g, k, line), b = bestSide(propProb(p, k, line), key, line);
      rows.push({ type: 'p', p, k, line, h, b, spark: g.slice(-10).map(x => val(x, k)) });
    }
  } else {
    for (const g of D.games) for (const [m, tms] of [['ml', [g.away, g.home]], ['spread', [g.away, g.home]], ['total', [null]], ['pts', [g.away, g.home]]]) for (const tm of tms) {
      const key = marketKey(g, m, tm); if (!ODDS[key]) continue;
      const line = marketLine(g, m, tm);
      const sidesToTry = m === 'total' || m === 'pts' ? ['over', 'under'] : ['over'];
      let best = null;
      for (const sd of sidesToTry) { const ev = marketEval(g, m, tm, sd, line); if (!best || (ev.edge ?? -999) > (best.ev.edge ?? -999)) best = { sd, ev }; }
      rows.push({ type: 'g', g, m, tm, line, side: best.sd, ev: best.ev });
    }
  }
  rows.sort((a, b) => ((b.type === 'p' ? b.b.edge : b.ev.edge) ?? -999) - ((a.type === 'p' ? a.b.edge : a.ev.edge) ?? -999));
  return rows;
}
function viewProps() {
  const rows = propRows(S.listTab, S.listStat, S.listWin);
  const statChips = ['all', 'pts', 'reb', 'ast', 'fg3m', 'pra', 'pa', 'pr', 'ra'];
  return `${topBar('', false)}<div class="stack fade">
    <div><h1>Props de esta noche</h1><div class="mut sm">Ordenadas por valor frente a las cuotas cargadas hoy</div></div>
    <div class="row-between" style="flex-wrap:wrap"><div class="seg" role="group" aria-label="Tipo">${[['players', 'Jugadores'], ['games', 'Partidos']].map(([v, l]) => `<button data-ltab="${v}" aria-pressed="${S.listTab === v}">${l}</button>`).join('')}</div>
      ${S.listTab === 'players' ? `<div class="seg" role="group" aria-label="Tramo">${[['l5', 'L5'], ['l10', 'L10'], ['l20', 'L20'], ['cur', D.cur.slice(2)]].map(([v, l]) => `<button data-lwin="${v}" aria-pressed="${S.listWin === v}">${l}</button>`).join('')}</div>` : '<span class="note">Valor frente al modelo</span>'}</div>
    ${S.listTab === 'players' ? `<div class="chips">${statChips.map(s => `<button class="chip acc" data-lstat="${s}" aria-pressed="${S.listStat === s}">${s === 'all' ? 'Todas' : SK[s].l}</button>`).join('')}</div>` : ''}
    <div class="card">${rows.length ? rows.map(r => r.type === 'p' ? `<button class="prow pl" data-open-p="${r.p.id}" data-open-k="${r.k}">
        ${CFG.fotosOficiales ? avatar(r.p, 44) : V.crest(r.p.team, 30, 'sm')}
        <div style="min-width:0"><div class="nm">${esc(r.p.name)}</div><div class="mut xs"><span class="sd ${r.b.side}">${r.b.side === 'over' ? 'Más' : 'Menos'}</span> ${dec(r.line)} ${SK[r.k].l}${r.b.eo.v ? ' · ' + dec(r.b.eo.v, 2) : ''}</div></div>
        <div class="sp">${spark(r.spark, r.line, r.b.side)}<div class="xs mut">${(() => { const v = r.spark, ok = v.filter(x => r.b.side === 'under' ? x < r.line : x > r.line).length; return `${ok}/${v.length} últimos`; })()}</div></div>
        <div class="rt"><div class="pc ${r.b.p >= .6 ? 'hi' : ''}">${pct(r.b.p)}</div><div class="xs ${r.b.edge >= 3 ? 'ok' : r.b.edge <= -3 ? 'err' : 'mut'}">${r.b.edge != null ? edgeTxt(r.b.edge) + ' valor' : '–'}</div></div>
        </button>` : `<button class="prow" data-open-g="${esc(r.g.id)}" data-open-m="${r.m}" data-open-t="${r.tm === r.g.home ? 'home' : 'away'}">
        <div style="min-width:0"><div class="nm">${esc(marketLabel(r.g, r.m, r.tm, r.side, r.line))}</div><div class="mut xs">${r.g.away} @ ${r.g.home} · ${MARKET_N[r.m]}${r.ev.eo.v ? ' · ' + dec(r.ev.eo.v, 2) : ''}</div></div>
        <div class="rt"><div class="pc ${r.ev.pModel >= .6 ? 'hi' : ''}">${pct(r.ev.pModel)}</div><div class="xs ${r.ev.edge >= 3 ? 'ok' : r.ev.edge <= -3 ? 'err' : 'mut'}">${r.ev.edge != null ? edgeTxt(r.ev.edge) + ' valor' : '–'}</div></div></button>`).join('')
      : `<div class="empty"><b>Aún no hay cuotas cargadas hoy</b>${isAdmin ? 'Cárgalas en la pestaña Cuotas.' : 'El administrador las cargará antes de los partidos.'}</div>`}</div>
    ${legal()}</div>`;
}

/* ---------- vista: combinada ---------- */
function legEval(l) {
  if (l.type === 'p') { const p = D.players[l.pid]; if (!p) return null; return { p: propProb(p, l.stat, l.line, l.side), label: `${p.name} · ${l.side === 'over' ? 'más' : 'menos'} de ${dec(l.line)} ${SK[l.stat].l}`, src: 'modelo' }; }
  const g = D.games.find(x => x.id === l.gameId); if (!g) return null; const ev = marketEval(g, l.market, l.team, l.side, l.line);
  return { p: ev.pModel, label: `${marketLabel(g, l.market, l.team, l.side, l.line)} (${g.away} @ ${g.home})`, src: 'modelo' };
}
function viewSlip() {
  const legs = slip.map(l => ({ l, e: legEval(l) })).filter(x => x.e);
  const prob = legs.reduce((a, x) => a * (x.e.p ?? 0), 1), allOdds = legs.length && legs.every(x => x.l.odd > 1), comb = allOdds ? legs.reduce((a, x) => a * x.l.odd, 1) : null;
  const edge = comb ? (prob - 1 / comb) * 100 : null;
  const sameGame = new Set(legs.map(x => x.l.type === 'p' ? D.players[x.l.pid]?.team && gameKey(gameOfTeam(D.players[x.l.pid].team) || { away: '', home: '' }) : gameKey(D.games.find(g => g.id === x.l.gameId) || { away: '', home: '' }))).size < legs.length;
  return `${topBar('', false)}<div class="stack fade"><div><h1>Boleto</h1><div class="mut sm">${legs.length === 1 ? '1 selección · apuesta simple' : legs.length + ' selecciones · combinada'}</div></div>
    ${legs.length ? `<div class="card">${legs.map((x, i) => `<div class="leg"><div style="min-width:0"><div style="font-weight:700">${esc(x.e.label)}</div><div class="mut xs">${x.e.src} ${pct(x.e.p)}${x.l.odd ? ' · cuota ' + dec(x.l.odd, 2) : ' · sin cuota'}</div></div><button class="x" data-rm="${i}" aria-label="Quitar">×</button></div>`).join('')}</div>
    <div class="sum"><div><small>Probabilidad estimada</small><b>${pct(prob)}</b></div><div><small>Cuota justa</small><b>${prob > 0 ? dec(1 / prob, 2) : '–'}</b></div><div><small>Cuota combinada</small><b>${comb ? dec(comb, 2) : '–'}</b></div><div><small>Valor</small><b>${edge != null ? verdict(edge) : '<span class="mut sm">Falta alguna cuota</span>'}</b></div></div>
    <p class="note">Multiplica las probabilidades como si fueran independientes.${sameGame ? ' Hay selecciones del mismo partido: en la realidad suelen estar relacionadas y el resultado puede ser distinto.' : ''}</p>
    <form id="placebet" class="card pad stack"><h3>¿La has jugado? Regístrala</h3>
      <div class="place"><label>Importe (€)<input id="stake" class="field" type="number" min="0.1" step="any" inputmode="decimal" required placeholder="10" value="${esc(S.stake)}"></label>
        <label>Cuota que te dieron<input id="betodd" class="field" type="number" min="1.01" step="any" inputmode="decimal" required placeholder="${comb ? dec(comb, 2) : '1,90'}" value="${esc(S.betOdd || (comb ? (Math.round(comb * 100) / 100) : ''))}"></label></div>
      <div class="row-between"><span class="sm mut">Cobras <b id="topay" class="hi">${num(S.stake) > 0 && num(S.betOdd || comb) > 1 ? eur(num(S.stake) * num(S.betOdd || comb)) : '–'}</b></span><button class="btn" type="submit">Registrar ${legs.length > 1 ? 'combinada' : 'apuesta'}</button></div>
      <div class="note">Se guarda en «Apuestas» y la sigues en directo durante el partido.</div></form>
    <button class="linkb" data-act="clear-slip">Vaciar boleto</button>`
    : `<div class="card empty"><b>Tu boleto está vacío</b>Abre un jugador o un partido y pulsa «+ Combinada». Con una sola selección es una apuesta simple.</div>`}
    ${legal()}</div>`;
}

/* ---------- vista: cuotas (administrador) ---------- */
const TEAMSET = () => new Set(Object.keys(D.teams).concat(D.games.flatMap(g => [g.home, g.away])));
function findPlayer(txt) { const t = norm(txt); if (!t) return null; const ps = Object.values(D.players);
  return ps.find(p => norm(p.name) === t) || ps.find(p => norm(p.name.split(' ').slice(-1)[0]) === t && playingTeam(p.team)) || ps.find(p => norm(p.name.split(' ').slice(-1)[0]) === t) || ps.find(p => norm(p.name).includes(t)) || null; }
const playingTeam = t => D.games.some(g => g.home === t || g.away === t);
function parsePaste(text) {
  const teams = TEAMSET();
  return text.split(/\n/).map(s => s.trim()).filter(Boolean).map(raw => {
    let s = raw.replace(/[;\t|]+/g, ' '); if (!/\s/.test(s) && s.includes(',')) s = s.replace(/,/g, ' ');
    const tk = s.split(/\s+/), nums = [];
    while (tk.length && /^[+\-−]?\d+([.,]\d+)?$/.test(tk[tk.length - 1])) nums.unshift(num(tk.pop()));
    const bad = m => ({ raw, err: m });
    const okOdd = v => v == null || v > 1;
    const first = (tk[0] || '').toUpperCase();
    if (first.includes('@') || (teams.has(first) && tk.length === 2 && GAME_ALIAS[norm(tk[1])])) {
      const kind = GAME_ALIAS[norm(tk[1])]; if (!kind) return bad('Mercado no reconocido: usa ganador, handicap, total o puntos');
      if (kind === 'total') {
        const g = first.includes('@') ? D.games.find(x => gameKey(x) === first) : gameOfTeam(first);
        if (!g) return bad('Ese partido no se juega hoy'); if (!(nums[0] > 0)) return bad('Falta la línea'); if (!okOdd(nums[1]) || !okOdd(nums[2])) return bad('Cuota no válida');
        return { raw, entity: 'G:' + gameKey(g), stat: 'total', line: nums[0], over: nums[1] ?? null, under: nums[2] ?? null, label: `${g.away} @ ${g.home} · total ${dec(nums[0])}` };
      }
      if (first.includes('@')) return bad('Para ganador, hándicap o puntos indica el equipo (p. ej. OKC)');
      if (!playingTeam(first)) return bad(first + ' no juega hoy');
      if (kind === 'ml') { if (!(nums[0] > 1)) return bad('Falta la cuota'); return { raw, entity: 'T:' + first, stat: 'ml', line: 0, over: nums[0], under: null, label: `Gana ${first}` }; }
      if (kind === 'spread') { if (nums[0] == null) return bad('Falta el hándicap (p. ej. -4,5)'); if (!okOdd(nums[1])) return bad('Cuota no válida'); return { raw, entity: 'T:' + first, stat: 'spread', line: nums[0], over: nums[1] ?? null, under: null, label: `${first} ${signed(nums[0])}` }; }
      if (!(nums[0] > 0)) return bad('Falta la línea'); if (!okOdd(nums[1]) || !okOdd(nums[2])) return bad('Cuota no válida');
      return { raw, entity: 'T:' + first, stat: 'pts', line: nums[0], over: nums[1] ?? null, under: nums[2] ?? null, label: `Puntos ${first} ${dec(nums[0])}` };
    }
    const k = ALIAS[norm(tk.pop() || '')], p = findPlayer(tk.join(' '));
    if (!p) return bad('Jugador no encontrado'); if (!k) return bad('Estadística no reconocida'); if (!(nums[0] >= 0) || nums[0] == null) return bad('Falta la línea');
    if (!okOdd(nums[1]) || !okOdd(nums[2])) return bad('Cuota no válida');
    return { raw, entity: p.id, stat: k, line: nums[0], over: nums[1] ?? null, under: nums[2] ?? null, label: `${p.name} · ${SK[k].n} ${dec(nums[0])}`, warn: playingTeam(p.team) ? '' : 'No juega hoy' };
  });
}
function viewAdmin() {
  const rows = S.draft ? parsePaste(S.draft) : [], ok = rows.filter(r => !r.err);
  return `${topBar('', false)}<div class="stack fade"><div><h1>Cuotas de hoy</h1><div class="mut sm">${(() => { const v = Object.values(ODDS), a = v.filter(o => o.src === 'auto').length; return `${v.length} cargadas${a ? ` (${a} automáticas, ${v.length - a} tuyas)` : ''}`; })()} · ${esc(updatedTxt())} · solo tú ves esta pestaña</div></div>
    ${oddsCredits ? `<div class="card pad"><b>Cuotas automáticas</b><div class="note">Se actualizan solas a las 18:00 y a las 21:00 con tres fuentes gratis: PropLine primero, y The Odds API y SportsGameOdds para lo que falte. Las que pegues aquí tienen prioridad y el script no las toca.</div>
      <div class="kpis" style="margin-top:10px">${[['PropLine', oddsCredits.propline_restantes, 'consultas hoy', 100], ['The Odds API', oddsCredits.restantes, 'créditos este mes', 60], ['SportsGameOdds', oddsCredits.sgo_eventos, 'eventos usados', null]].map(([n, v, u, low]) => `<div><div class="xs mut">${n}</div><b class="${low != null && v != null && v < low ? 'err' : 'hi'}" style="font-size:18px">${v ?? '–'}</b><div class="xs mut">${u}</div></div>`).join('')}</div></div>` : ''}
    <div class="card pad stack">
      <label for="paste" class="sm" style="font-weight:700">Pega una línea por apuesta</label>
      <textarea id="paste" spellcheck="false" placeholder="Curry 3PM 4,5 1,85 1,95&#10;Jokic PRA 52,5 1,90 1,90&#10;OKC ganador 1,55&#10;OKC handicap -4,5 1,90&#10;DEN@OKC total 229,5 1,90 1,90&#10;OKC puntos 117,5 1,88 1,92">${esc(S.draft)}</textarea>
      <div class="note">Jugador: <b>nombre estadística línea cuota-más cuota-menos</b>. Partido: <b>EQUIPO ganador cuota</b>, <b>EQUIPO handicap línea cuota</b>, <b>EQUIPO puntos línea más menos</b>, <b>VIS@LOC total línea más menos</b>. Las cuotas son opcionales salvo en ganador. Sirven comas o puntos, espacios, punto y coma o tabuladores.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="save-odds" ${ok.length && !S.saving ? '' : 'disabled'}>${S.saving ? 'Guardando…' : `Guardar ${ok.length} para todos`}</button>
        ${DEMO ? '<button class="btn ghost" data-act="example">Ejemplo</button>' : ''}
        ${Object.keys(ODDS).length ? '<button class="linkb" data-act="clear-odds">Borrar todas las de hoy</button>' : ''}</div>
      ${S.msg ? `<div class="sm ${S.msg.startsWith('Error') ? 'err' : 'ok'}">${esc(S.msg)}</div>` : ''}
    </div>
    ${!DEMO && groupCode != null ? `<form id="groupcode" class="card pad stack"><h3>Código del grupo</h3><div class="note">Pásaselo a tus amigos junto con la dirección de la app. Con él crean su cuenta en «Crear cuenta». Si lo cambias, los que ya están dentro siguen dentro.</div>
      <div style="display:flex;gap:8px"><input id="gcode" class="field" type="text" minlength="4" required value="${esc(groupCode)}" aria-label="Código del grupo" style="flex:1;min-width:0;font-weight:800;letter-spacing:.08em"><button class="btn ghost" type="submit">Guardar</button></div></form>` : ''}
    ${rows.length ? `<div class="card"><div class="tbl"><table><thead><tr><th class="l">Texto</th><th class="l">Se guarda como</th><th>Más</th><th>Menos</th><th class="l">Estado</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td class="l">${esc(r.raw)}</td><td class="l">${esc(r.label || '–')}</td><td>${r.over ? dec(r.over, 2) : '–'}</td><td>${r.under ? dec(r.under, 2) : '–'}</td><td class="l ${r.err ? 'err' : 'ok'}">${esc(r.err || r.warn || 'Listo')}</td></tr>`).join('')}
    </tbody></table></div></div>` : ''}
    ${legal()}</div>`;
}

/* ---------- login ---------- */
let loginMode = 'in';
function viewLogin(msg, email = '') {
  const up = loginMode === 'up';
  return `${topBar('', false)}<div class="login"><div class="card pad stack">
    <h1>Tribuna<span class="hi">.</span></h1><p class="mut" style="margin:0">Estadísticas NBA para el grupo.</p>
    <div class="seg wide" role="group" aria-label="Acceso"><button type="button" data-lmode="in" aria-pressed="${!up}">Entrar</button><button type="button" data-lmode="up" aria-pressed="${up}">Crear cuenta</button></div>
    <form id="login" class="stack"><label for="email" class="sm" style="font-weight:700">Correo</label><input id="email" class="field" type="email" required autocomplete="username" placeholder="tu@correo.com" value="${esc(email)}">
      <label for="pass" class="sm" style="font-weight:700">Contraseña${up ? ' (mínimo 6 caracteres)' : ''}</label><input id="pass" class="field" type="password" required minlength="6" autocomplete="${up ? 'new-password' : 'current-password'}">
      ${up ? `<label for="code" class="sm" style="font-weight:700">Código del grupo</label><input id="code" class="field" type="text" required autocomplete="off" autocapitalize="characters" placeholder="Te lo da el administrador">` : ''}
      <button class="btn" type="submit">${up ? 'Crear mi cuenta' : 'Entrar'}</button></form>
    ${msg ? `<div class="sm err" role="alert">${esc(msg)}</div>` : ''}<p class="note" style="margin:0">${up ? 'Necesitas el código que te ha pasado el administrador. ' : ''}Tus apuestas y tu boleto son privados: solo los ves tú. +18.</p></div></div>`;
}
function viewJoin(msg) {
  return `${topBar('', false)}<div class="login"><div class="card pad stack">
    <h1>Código del grupo</h1><p class="mut" style="margin:0">Has entrado como <b>${esc(userEmail)}</b>. Para ver las estadísticas escribe el código que te dio el administrador.</p>
    <form id="join" class="stack"><input id="code" class="field" type="text" required autocomplete="off" autocapitalize="characters" aria-label="Código del grupo" placeholder="Código"><button class="btn" type="submit">Entrar al grupo</button></form>
    ${msg ? `<div class="sm err" role="alert">${esc(msg)}</div>` : ''}<button class="linkb" data-act="logout">Cerrar sesión</button></div></div>`;
}
const showLogin = (msg, email) => { app.innerHTML = `<div class="shell">${viewLogin(msg, email)}</div>`; };

/* ---------- mis apuestas: registro, directo, calendario y gráfico ---------- */
const eur = v => (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '\u00a0€';
const eurS = v => (v > 0 ? '+' : '') + eur(v);
const isoDay = d => d.toISOString().slice(0, 10);
const LIVE = {};               // gameId -> { state: 'pre'|'live'|'final', text, home:{tri,score}, away:{tri,score}, players:{pid:{...}} }
let liveTimer = null, liveSource = 'direct';

function legGame(l) { return D.games.find(g => g.id === l.gameId) || null; }
function legLabel(l) {
  if (l.type === 'x') return l.label;
  if (l.type === 'p') { const yes = l.stat === 'dd' || l.stat === 'td'; return `${l.name} · ${yes ? SK[l.stat].n : `${l.side === 'over' ? 'más' : 'menos'} de ${dec(l.line)} ${SK[l.stat].l}`}`; }
  const g = { home: l.home, away: l.away };
  return marketLabel(g, l.market, l.team, l.side, l.line);
}
/* Estado de una selección: valor actual, objetivo y si ya está ganada o perdida. */
function legState(l, betDate) {
  if (l.type === 'x') return { st: l.res, cur: l.final, target: l.line, txt: '' };
  const lv = LIVE[l.gameId];
  if (l.type === 'p') {
    let cur = null, fin = false, txt = '';
    const ps = lv?.players?.[l.pid];
    if (ps && lv.state !== 'pre') { cur = val(ps, l.stat); fin = lv.state === 'final'; txt = lv.text; }
    else { const p = D.players[l.pid], g = p?.log.find(x => x.date === betDate); if (g) { cur = val(g, l.stat); fin = true; txt = 'Final'; } }
    if (cur == null) return { st: lv?.state === 'final' ? 'void' : null, cur: null, target: l.line, txt: lv?.text || '' };
    const over = cur > l.line;
    const st = l.side === 'over' ? (over ? 'won' : fin ? 'lost' : null) : (over ? 'lost' : fin ? 'won' : null);
    return { st, cur, target: l.line, txt };
  }
  // mercados de partido
  let hs = null, as = null, fin = false, txt = '';
  if (lv && lv.state !== 'pre') { hs = lv.home.score; as = lv.away.score; fin = lv.state === 'final'; txt = lv.text; }
  else { const r = (D.teams[l.home] || []).find(x => x.date === betDate && x.opp === l.away); if (r) { hs = r.pts; as = r.opp_pts; fin = true; txt = 'Final'; } }
  if (hs == null) return { st: null, cur: null, target: l.line, txt: lv?.text || '' };
  const isH = l.team === l.home, mine = isH ? hs : as, theirs = isH ? as : hs;
  let cur, st = null;
  if (l.market === 'ml') { cur = mine - theirs; if (fin) st = cur > 0 ? 'won' : 'lost'; }
  else if (l.market === 'spread') { cur = mine - theirs; if (fin) st = cur + l.line > 0 ? 'won' : cur + l.line === 0 ? 'void' : 'lost'; }
  else { cur = l.market === 'total' ? hs + as : mine; const over = cur > l.line; st = l.side === 'over' ? (over ? 'won' : fin ? 'lost' : null) : (over ? 'lost' : fin ? 'won' : null); }
  return { st, cur, target: l.market === 'ml' ? 0 : l.market === 'spread' ? -l.line : l.line, txt, score: `${l.away} ${as} - ${hs} ${l.home}` };
}
function betState(b) {
  if (b.result) return { st: b.result, legs: b.legs.map(l => legState(l, b.date)) };
  const legs = b.legs.map(l => legState(l, b.date));
  const st = legs.some(x => x.st === 'lost') ? 'lost' : legs.every(x => x.st === 'won' || x.st === 'void') ? (legs.every(x => x.st === 'void') ? 'void' : 'won') : null;
  return { st, legs };
}
function betNet(b, st = betState(b).st) {
  if (st === 'won') return b.stake * (b.odd - 1);
  if (st === 'lost') return -b.stake;
  return 0;
}
/* Cierra las apuestas que ya tienen resultado y lo guarda. */
function settleAll() {
  const changed = [];
  for (const b of BETS) { if (b.result) continue; const s = betState(b); if (s.st) { b.result = s.st; b.net = betNet(b, s.st); changed.push(b); } }
  if (changed.length) persistBets(changed);
}
async function persistBets(list, del) {
  if (DEMO) { store.set('bets', BETS.filter(b => !b.seed)); return; }
  try {
    if (del) await sb.from('apuestas').delete().eq('id', del);
    else if (list?.length) await sb.from('apuestas').upsert(list.map(b => ({ id: b.id, data: b })));
  } catch (e) { console.warn('No se pudo guardar la apuesta', e); }
}
function newId() { return (crypto.randomUUID ? crypto.randomUUID() : 'b' + Date.now() + Math.random().toString(16).slice(2)); }
function slipToLegs() {
  return slip.map(l => {
    if (l.type === 'p') { const p = D.players[l.pid], g = p && gameOfTeam(p.team); return { type: 'p', pid: l.pid, name: p?.name || '', team: p?.team, stat: l.stat, line: l.line, side: l.side, gameId: g?.id || null }; }
    const g = D.games.find(x => x.id === l.gameId); return { type: 'g', gameId: l.gameId, market: l.market, team: l.team, side: l.side, line: l.line, home: g?.home, away: g?.away };
  });
}

/* ---- directo ---- */
const LIVE_MAP = { pts: 'points', reb: 'reboundsTotal', ast: 'assists', fg3m: 'threePointersMade', fg3a: 'threePointersAttempted', fgm: 'fieldGoalsMade', fga: 'fieldGoalsAttempted', ftm: 'freeThrowsMade', fta: 'freeThrowsAttempted', stl: 'steals', blk: 'blocks', tov: 'turnovers' };
const clockMin = c => { const m = /PT(\d+)M([\d.]+)S/.exec(c || ''); return m ? +m[1] + +m[2] / 60 : 0; };
const elapsed = (period, clock) => period <= 4 ? (period - 1) * 12 + 12 - clockMin(clock) : 48 + (period - 5) * 5 + 5 - clockMin(clock);
function statusEs(t) {
  t = String(t || '').trim();
  if (/^half/i.test(t)) return 'Descanso';
  let m = /^end (?:of )?q?(\d)/i.exec(t); if (m) return `Fin del ${m[1]}.º cuarto`;
  m = /^q(\d)\s+(.+)$/i.exec(t); if (m) return `${m[1]}.º cuarto · ${m[2]}`;
  m = /^ot(\d?)\s*(.*)$/i.exec(t); if (m) return `Prórroga${m[1] > 1 ? ' ' + m[1] : ''}${m[2] ? ' · ' + m[2] : ''}`;
  return t;
}
function parseBox(j) {
  const gm = j.game, st = gm.gameStatus === 3 ? 'final' : gm.gameStatus === 2 ? 'live' : 'pre', players = {};
  for (const side of ['homeTeam', 'awayTeam']) for (const p of gm[side].players || []) {
    const o = {}; for (const [k, src] of Object.entries(LIVE_MAP)) o[k] = +(p.statistics?.[src] ?? 0);
    o.min = Math.round(parseFloat(String(p.statistics?.minutesCalculated || 'PT0M').replace(/[^\d.]/g, '')) || 0);
    o.nm = p.nameI || p.name || ''; o.tm = gm[side].teamTricode; o.on = p.oncourt === '1'; o.pl = p.played === '1' || o.min > 0;
    players[String(p.personId)] = o;
  }
  const per = t => (t.periods || []).map(x => +x.score || 0);
  return { state: st, text: st === 'final' ? 'Final' : st === 'pre' ? 'Aún no ha empezado' : statusEs(gm.gameStatusText), t: st === 'live' ? elapsed(gm.period || 1, gm.gameClock) : st === 'final' ? Math.max(48, elapsed(gm.period || 4, 'PT00M00.00S')) : 0,
    home: { tri: gm.homeTeam.teamTricode, score: gm.homeTeam.score, periods: per(gm.homeTeam) }, away: { tri: gm.awayTeam.teamTricode, score: gm.awayTeam.score, periods: per(gm.awayTeam) }, players };
}
/* Jugada a jugada de NBA.com: evolución de cada jugador a lo largo del partido (para la línea por cuartos). */
const PBP = {};                // gameId -> { pid: [{ t, pts, reb, ast, ... }] }
const ZERO = () => ({ t: 0, pts: 0, reb: 0, ast: 0, fg3m: 0, fg3a: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, stl: 0, blk: 0, tov: 0 });
const HIST = {};               // respaldo: fotos del marcador en cada actualización, gameId -> pid -> [{ t, ... }]
function parsePbp(j) {
  const ser = {}, cur = {};
  const get = pid => cur[pid] || (cur[pid] = { pts: 0, reb: 0, ast: 0, fg3m: 0, fg3a: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, stl: 0, blk: 0, tov: 0 });
  const push = (pid, t) => (ser[pid] || (ser[pid] = [ZERO()])).push({ ...cur[pid], t });
  for (const a of j.game?.actions || []) {
    const pid = String(a.personId || ''), t = elapsed(a.period || 1, a.clock), ty = a.actionType;
    if (!pid || pid === '0') continue;
    if (ty === '2pt' || ty === '3pt') {
      const x = get(pid), three = ty === '3pt'; x.fga++; if (three) x.fg3a++;
      if (a.shotResult === 'Made') { x.fgm++; if (three) x.fg3m++; x.pts = a.pointsTotal ?? x.pts + (three ? 3 : 2);
        if (a.assistPersonId) { const ap = String(a.assistPersonId), y = get(ap); y.ast = a.assistTotal ?? y.ast + 1; push(ap, t); } }
      push(pid, t);
    } else if (ty === 'freethrow') { const x = get(pid); x.fta++; if (a.shotResult === 'Made') { x.ftm++; x.pts = a.pointsTotal ?? x.pts + 1; } push(pid, t); }
    else if (ty === 'rebound') { const x = get(pid); x.reb = a.reboundTotal ?? x.reb + 1; push(pid, t); }
    else if (ty === 'steal') { get(pid).stl++; push(pid, t); }
    else if (ty === 'block') { get(pid).blk++; push(pid, t); }
    else if (ty === 'turnover') { get(pid).tov++; push(pid, t); }
  }
  return ser;
}
async function fetchNba(kind, id) {
  const direct = `https://cdn.nba.com/static/json/liveData/${kind}/${kind}_${id}.json`;
  if (liveSource === 'direct') { try { const r = await fetch(direct, { cache: 'no-store' }); if (r.ok) return await r.json(); if (r.status === 403 || r.status === 404) return null; } catch (e) { liveSource = 'proxy'; } }
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch(`${CFG.supabaseUrl}/functions/v1/nba-live?game=${encodeURIComponent(id)}${kind === 'playbyplay' ? '&kind=pbp' : ''}`, { headers: { apikey: CFG.supabaseAnonKey, Authorization: 'Bearer ' + (session?.access_token || CFG.supabaseAnonKey) } });
  return r.ok ? await r.json() : null;
}
function snapshot(id) {
  const lv = LIVE[id]; if (!lv || lv.state === 'pre') return;
  const h = HIST[id] || (HIST[id] = {});
  for (const [pid, x] of Object.entries(lv.players)) { const a = h[pid] || (h[pid] = [ZERO()]); const last = a[a.length - 1];
    if (lv.t > last.t) a.push({ ...x, t: lv.t }); }
}
async function fetchBox(id) { const j = await fetchNba('boxscore', id); return j ? parseBox(j) : null; }
const OPENBETS = new Set(), OPENBOX = new Set();
function openGameIds() { return [...new Set(BETS.filter(b => OPENBETS.has(b.id)).flatMap(b => b.legs.map(l => l.gameId)).filter(Boolean))]; }
/* Datos para buscar un partido en ESPN: fecha (EE. UU.) y equipos, sacados de los partidos de hoy o de la apuesta. */
function gameRef(id) {
  const g = D.games.find(x => x.id === id); if (g) return { date: g.date, home: g.home, away: g.away };
  for (const b of BETS) for (const l of b.legs) if (l.gameId === id) return { date: b.date, home: l.home, away: l.away, team: l.team || D.players[l.pid]?.team };
  return null;
}
let espnOk = true;
async function fetchLive(id) {
  const E = window.TRIBUNA_ESPN, ref = gameRef(id);
  if (E && ref && espnOk) {
    try { const r = await E.live({ ...ref, players: Object.values(D.players).map(p => ({ id: p.id, name: p.name, team: p.team })) }); if (r) { PBP[id] = r.pbp; return r.box; } }
    catch (e) { console.warn('Directo ESPN', e); }
  }
  const box = await fetchBox(id);
  if (box && box.state !== 'pre' && openGameIds().includes(id)) { try { const j = await fetchNba('playbyplay', id); if (j) PBP[id] = parsePbp(j); } catch (e) {} }
  return box;
}
async function pollLive() {
  const ids = [...new Set(BETS.filter(b => !b.result).flatMap(b => b.legs.map(l => l.gameId)).filter(id => id && D.games.some(g => g.id === id)).concat(openGameIds()))];
  await Promise.all(ids.map(async id => {
    if (LIVE[id]?.state === 'final' && PBP[id]) return;
    try { const box = await fetchLive(id); if (box) { LIVE[id] = box; snapshot(id); } } catch (e) {}
  }));
  settleAll(); if (['bets'].includes(S.view)) render();
}
function startLive() {
  if (DEMO || liveTimer) return;
  pollLive(); liveTimer = setInterval(() => { if (!document.hidden) pollLive(); }, 30000);
}

/* ---- simulación del directo (modo demostración) ---- */
let simT = null;
function simulateLive() {
  if (simT) return;
  const R = Math.random, pois = l => { let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= R(); } while (p > L); return k - 1; };
  const per = p => { const L = p.log.slice(-20), m = L.reduce((a, g) => a + g.min, 0) || 1; const o = {}; for (const k of Object.keys(LIVE_MAP)) o[k] = L.reduce((a, g) => a + g[k], 0) / m; o.mpg = m / L.length; return o; };
  const games = D.games.map(g => { const md = model(g); const ps = Object.values(D.players).filter(p => p.team === g.home || p.team === g.away);
    LIVE[g.id] = { state: 'live', text: '1.er cuarto · 12:00', t: 0, home: { tri: g.home, score: 0, periods: [0] }, away: { tri: g.away, score: 0, periods: [0] }, players: Object.fromEntries(ps.map(p => [p.id, { ...Object.fromEntries([...Object.keys(LIVE_MAP), 'min'].map(k => [k, 0])), nm: p.name.replace(/^(\S)\S*\s/, '$1. '), tm: p.team, pl: false, on: false }])) };
    return { g, md, ps: ps.map(p => ({ p, r: per(p) })) }; });
  let minute = 0;
  simT = setInterval(() => {
    minute++;
    for (const { g, md, ps } of games) {
      const lv = LIVE[g.id]; const tracked = { [g.home]: 0, [g.away]: 0 };
      for (const { p, r } of ps) {
        if (R() > r.mpg / 48) continue;
        const s = lv.players[p.id]; s.min++; s.pl = true;
        const thin = (n, q) => { let c = 0; for (let i = 0; i < n; i++) if (R() < q) c++; return c; }, a2r = Math.max(0, r.fga - r.fg3a);
        const a3 = pois(r.fg3a), m3 = thin(a3, r.fg3a ? r.fg3m / r.fg3a : 0), a2 = pois(a2r), m2 = thin(a2, a2r ? (r.fgm - r.fg3m) / a2r : 0), ta = pois(r.fta), tm = thin(ta, r.fta ? r.ftm / r.fta : 0);
        s.fg3a += a3; s.fg3m += m3; s.fga += a2 + a3; s.fgm += m2 + m3; s.fta += ta; s.ftm += tm; s.pts += 2 * m2 + 3 * m3 + tm;
        for (const k of ['reb', 'ast', 'stl', 'blk', 'tov']) s[k] += pois(r[k]);
        tracked[p.team] += 2 * m2 + 3 * m3 + tm;
      }
      for (const [side, exp] of [['home', md.eh], ['away', md.ea]]) {
        const tri = g[side], restRate = Math.max(.8, exp / 48 - ps.filter(x => x.p.team === tri).reduce((a, x) => a + x.r.pts * x.r.mpg / 48, 0));
        const add = tracked[tri] + pois(restRate), qi = Math.min(3, Math.floor((minute - 1) / 12)); lv[side].score += add;
        while (lv[side].periods.length <= qi) lv[side].periods.push(0); lv[side].periods[qi] += add;
      }
      lv.t = minute; snapshot(g.id);
      if (minute >= 48 && lv.home.score === lv.away.score) { const x = 1 + Math.floor(R() * 4); lv.home.score += x; lv.home.periods[3] += x; }
      const q = Math.min(4, Math.floor((minute - 1) / 12) + 1), left = 12 - ((minute - 1) % 12 + 1);
      lv.state = minute >= 48 ? 'final' : 'live';
      lv.text = minute >= 48 ? 'Final' : left === 0 ? `Fin del ${q}.º cuarto` : `${q}.º cuarto · ${left}:00`;
    }
    settleAll(); if (S.view === 'bets') render();
    if (minute >= 48) { clearInterval(simT); simT = null; }
  }, 1200);
}

/* ---- historial simulado (modo demostración) ---- */
function demoHistory() {
  let a = 77; const R = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const dates = [...new Set(Object.values(D.teams).flat().map(g => g.date))].sort();
  const last = dates[dates.length - 1], from = isoDay(new Date(new Date(last + 'T00:00:00Z') - 365 * 864e5));
  const ps = Object.values(D.players), out = [];
  for (const d of dates.filter(x => x >= from)) {
    if (R() < .4) continue;
    const n = 1 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const nl = R() < .55 ? 1 : 2 + Math.floor(R() * 3), legs = [];
      let odd = 1;
      for (let j = 0; j < nl; j++) {
        const p = ps[Math.floor(R() * ps.length)], k = ['pts', 'reb', 'ast', 'fg3m', 'pra'][Math.floor(R() * 5)], g = p.log.find(x => x.date === d) || p.log[Math.floor(R() * p.log.length)];
        const line = Math.max(.5, Math.floor(median(p.log.slice(-20).map(x => val(x, k)))) + .5), side = R() < .7 ? 'over' : 'under', v = val(g, k);
        const won = side === 'over' ? v > line : v < line, o = 1.7 + R() * .35; odd *= o;
        legs.push({ type: 'x', label: `${p.name} · ${side === 'over' ? 'más' : 'menos'} de ${dec(line)} ${SK[k].l}`, res: won ? 'won' : 'lost', final: v, line });
      }
      const result = legs.every(l => l.res === 'won') ? 'won' : 'lost', stake = [5, 5, 10, 10, 10, 15, 20, 25][Math.floor(R() * 8)];
      odd = Math.round(odd * 100) / 100;
      out.push({ id: 'h' + d + i, seed: true, date: d, created: d + 'T18:00:00Z', stake, odd, legs, result, net: result === 'won' ? stake * (odd - 1) : -stake });
    }
  }
  // dos apuestas de esta noche para ver el directo
  const g0 = D.games.find(g => g.home === 'LAL' || g.away === 'LAL') || D.games[0], g1 = D.games.find(g => g.home === 'OKC' || g.away === 'OKC') || D.games[0];
  const cur = ps.find(p => p.name.includes('Curry')), jok = ps.find(p => p.name.includes('Joki')), sga = ps.find(p => p.name.includes('Gilgeous'));
  const today = D.games[0]?.date;
  if (cur && jok && today) {
    out.push({ id: 'live1', seed: true, date: today, created: new Date().toISOString(), stake: 10, odd: 1.85, legs: [{ type: 'p', pid: cur.id, name: cur.name, team: cur.team, stat: 'fg3m', line: 3.5, side: 'over', gameId: g0.id }] });
    out.push({ id: 'live2', seed: true, date: today, created: new Date().toISOString(), stake: 5, odd: 4.62, legs: [
      { type: 'p', pid: jok.id, name: jok.name, team: jok.team, stat: 'pra', line: 47.5, side: 'over', gameId: g1.id },
      { type: 'p', pid: sga.id, name: sga.name, team: sga.team, stat: 'pts', line: 30.5, side: 'over', gameId: g1.id },
      { type: 'g', gameId: g1.id, market: 'ml', team: g1.home, side: 'over', line: 0, home: g1.home, away: g1.away }] });
  }
  return out;
}

/* ---- vista ---- */
const RANGES = [['day', 'Día', 1], ['week', 'Semana', 7], ['month', 'Mes', 30], ['3m', '3 meses', 91], ['6m', '6 meses', 182], ['year', 'Año', 365]];
function dailyNet() { const m = {}; for (const b of BETS) { const st = b.result || betState(b).st; if (!st) continue; m[b.date] = (m[b.date] || 0) + (b.result ? b.net : betNet(b, st)); } return m; }
function refDay() { return D.games[0]?.date || todayET(); }
function profitChart(days) {
  const n = days.length; if (!n) return '<p class="empty">Sin apuestas cerradas en este periodo.</p>';
  const W = chartWidth(), H = 190, pl = 48, pt = 14, pb = 26;
  let cum = 0; const cs = days.map(d => (cum += d.net));
  const lo = Math.min(0, ...cs, ...days.map(d => d.net)), hi = Math.max(0, ...cs, ...days.map(d => d.net)) || 1, pad = (hi - lo) * .1 || 1;
  const y = v => pt + (H - pt - pb) * (1 - (v - (lo - pad)) / (hi + pad - (lo - pad))), slot = (W - pl - 4) / n, bw = Math.max(2, Math.min(18, slot * .62));
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Beneficio acumulado">`;
  s += `<line x1="${pl}" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="var(--mut)" stroke-opacity=".5"/><text x="${pl - 6}" y="${y(0) + 4}" text-anchor="end" font-size="10" fill="var(--mut)">0</text>`;
  [hi, lo].forEach(v => { if (Math.abs(v) > 0.01) s += `<text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="var(--mut)">${Math.round(v)} €</text><line x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--edge)"/>`; });
  days.forEach((d, i) => { const x = pl + i * slot + (slot - bw) / 2, t = Math.min(y(d.net), y(0)), h = Math.max(1.5, Math.abs(y(d.net) - y(0)));
    s += `<rect x="${x}" y="${t}" width="${bw}" height="${h}" rx="${Math.min(3, bw / 3)}" fill="${d.net >= 0 ? 'var(--good)' : 'var(--bad)'}" opacity=".55"><title>${esc(d.lab)}: ${eurS(d.net)}</title></rect>`; });
  s += `<polyline fill="none" stroke="var(--acc)" stroke-width="2.4" stroke-linejoin="round" points="${cs.map((v, i) => `${pl + i * slot + slot / 2},${y(v)}`).join(' ')}"/>`;
  const step = Math.ceil(n / 6); days.forEach((d, i) => { if (i % step === 0 || i === n - 1) s += `<text x="${pl + i * slot + slot / 2}" y="${H - 8}" text-anchor="middle" font-size="9.5" fill="var(--mut)">${esc(d.short)}</text>`; });
  return s + '</svg>';
}
function betCard(b) {
  const s = betState(b), st = s.st, pay = b.stake * b.odd, open = OPENBETS.has(b.id);
  const pill = st === 'won' ? `<span class="pill good">Ganada ${eurS(b.net ?? betNet(b, st))}</span>` : st === 'lost' ? `<span class="pill bad">Perdida ${eurS(-b.stake)}</span>` : st === 'void' ? '<span class="pill">Nula</span>' : s.legs.some(x => x.txt && x.txt !== 'Aún no ha empezado') ? '<span class="pill acc live">En juego</span>' : '<span class="pill">Pendiente</span>';
  const canOpen = b.legs.some(l => l.type !== 'x');
  const legs = b.legs.map((l, i) => { const x = s.legs[i]; const c = x.st === 'won' ? 'good' : x.st === 'lost' ? 'bad' : '';
      let bar = '';
      if (x.cur != null && l.type !== 'x' && !(l.type === 'g' && (l.market === 'ml' || l.market === 'spread'))) { const tgt = l.line, f = Math.max(0, Math.min(1, x.cur / Math.max(tgt + .5, 1))); bar = `<div class="prog ${c}"><i style="width:${f * 100}%"></i><span class="tick" style="left:${Math.min(100, (tgt / Math.max(tgt + .5, 1)) * 100)}%"></span></div>`; }
      const now = x.cur == null ? '' : l.type === 'x' ? `${x.cur}` : (l.type === 'g' && (l.market === 'ml' || l.market === 'spread')) ? (x.score || '') : `${x.cur} / ${dec(l.line)}`;
      return `<div class="bleg ${c}"><div class="bl-t"><span class="dot"></span><span class="lbl">${esc(legLabel(l))}</span><b>${esc(now)}</b></div>${open ? '' : bar}${!open && x.txt && l.type !== 'x' ? `<div class="xs mut">${esc(x.txt)}</div>` : ''}</div>`; }).join('');
  return `<div class="bet ${st || 'open'}${open ? ' expanded' : ''}">
    <div class="bet-h"><div><b>${b.legs.length > 1 ? `Combinada · ${b.legs.length}` : 'Simple'}</b><div class="xs mut">${eur(b.stake)} a ${dec(b.odd, 2)} · cobra ${eur(pay)}</div></div>${pill}${!b.result && !b.seed ? `<button class="x" data-delbet="${esc(b.id)}" aria-label="Borrar apuesta">×</button>` : ''}</div>
    ${canOpen ? `<button class="bet-tg" data-tbet="${esc(b.id)}" aria-expanded="${open}">${legs}<span class="more">${open ? 'Ocultar el directo' : 'Ver marcador y jugadores en directo'}${ICON.chev}</span></button>` : `<div class="bet-legs">${legs}</div>`}
    ${open ? betLive(b, s) : ''}
  </div>`;
}
/* ---- ficha desplegada de una apuesta: marcador de cada partido y lo que lleva cada jugador ---- */
function gameLiveInfo(id, l) {
  const g = D.games.find(x => x.id === id), lv = LIVE[id];
  const home = lv?.home.tri || g?.home || l.home || (l.team && D.players[l.pid]?.team), away = lv?.away.tri || g?.away || l.away;
  return { g, lv, home, away };
}
function scoreboard(id, l, betDate) {
  const { g, lv, home, away } = gameLiveInfo(id, l);
  let hs = lv && lv.state !== 'pre' ? lv.home.score : null, as = lv && lv.state !== 'pre' ? lv.away.score : null, txt = lv?.text || '';
  if (hs == null && home && away) { const r = (D.teams[home] || []).find(x => x.date === betDate && x.opp === away); if (r) { hs = r.pts; as = r.opp_pts; txt = 'Final'; } }
  if (hs == null && g) { const t = etToRome(g.date, g.status); txt = `Empieza a las ${t.time}`; }
  const live = lv?.state === 'live', win = hs != null && lv?.state === 'final' ? (hs > as ? 'h' : 'a') : '';
  const per = lv?.home.periods?.length ? `<div class="linescore" style="grid-template-columns:44px repeat(${lv.home.periods.length + 1},1fr)"><span></span>${lv.home.periods.map((_, i) => `<em>${i < 4 ? i + 1 + '.º' : 'P' + (i - 3)}</em>`).join('')}<em>T</em>
      ${[['away', away], ['home', home]].map(([sd, tri]) => `<b>${tri}</b>${lv[sd].periods.map(v => `<span>${v}</span>`).join('')}<span class="tt">${lv[sd].score}</span>`).join('')}</div>` : '';
  return `<div class="sb">
      <div class="sb-t ${win === 'a' ? 'w' : ''}">${away ? V.crest(away, 38, 'sm') : ''}<b>${esc(away || '')}</b></div>
      <div class="sb-c"><div class="sb-s">${hs == null ? '<span class="mut">vs</span>' : `<span class="${win === 'h' ? 'l' : ''}">${as}</span><i>–</i><span class="${win === 'a' ? 'l' : ''}">${hs}</span>`}</div><div class="xs ${live ? 'livetxt' : 'mut'}">${esc(txt)}</div></div>
      <div class="sb-t r ${win === 'h' ? 'w' : ''}"><b>${esc(home || '')}</b>${home ? V.crest(home, 38, 'sm') : ''}</div>
    </div>${per}`;
}
/* Línea de lo que lleva el jugador a lo largo del partido, con la línea de la apuesta y su media como referencia. */
function progressChart(series, l, cur, avg) {
  const yes = l.stat === 'dd' || l.stat === 'td';
  if (yes || !series || series.length < 2) return '';
  const pts = series.map(x => ({ t: x.t, v: val(x, l.stat) }));
  if (cur != null && cur !== pts[pts.length - 1].v) pts.push({ t: pts[pts.length - 1].t, v: cur });
  const end = Math.max(48, ...pts.map(p => p.t)), W = Math.min(chartWidth(), 560), H = 150, pl = 30, pr = 34, pt = 14, pb = 22;
  const top = Math.max(l.line * 1.25, ...pts.map(p => p.v), avg || 0) || 1;
  const x = t => pl + (W - pl - pr) * t / end, y = v => pt + (H - pt - pb) * (1 - v / top);
  const last = pts[pts.length - 1], ok = l.side === 'under' ? last.v < l.line : last.v > l.line;
  const tone = ok ? 'hit' : (l.side === 'under' ? 'miss' : 'run');
  let d = `M${x(pts[0].t)} ${y(pts[0].v)}`; for (let i = 1; i < pts.length; i++) d += `H${x(pts[i].t)}V${y(pts[i].v)}`;
  let s = `<svg class="prg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución durante el partido">`;
  const qs = end > 48 ? [12, 24, 36, 48, ...Array.from({ length: Math.ceil((end - 48) / 5) }, (_, i) => 53 + i * 5)] : [12, 24, 36, 48];
  qs.forEach((q, i) => { const a = i ? qs[i - 1] : 0; s += `<line x1="${x(q)}" x2="${x(q)}" y1="${pt}" y2="${H - pb}" class="grid"/><text x="${(x(a) + x(q)) / 2}" y="${H - 6}" text-anchor="middle" class="d1">${i < 4 ? 'C' + (i + 1) : 'P' + (i - 3)}</text>`; });
  s += `<line x1="${pl}" x2="${W - pr}" y1="${y(0)}" y2="${y(0)}" class="axis"/><text x="${pl - 6}" y="${y(0) + 4}" text-anchor="end" class="tk">0</text>`;
  if (avg) s += `<line x1="${x(0)}" y1="${y(0)}" x2="${x(48)}" y2="${y(avg)}" class="pace"/><text x="${x(48) + 4}" y="${y(avg) + 4}" class="tk">${dec(avg)}</text>`;
  s += `<line x1="${pl}" x2="${W - pr}" y1="${y(l.line)}" y2="${y(l.line)}" class="ln dash"/><text x="${pl - 6}" y="${y(l.line) + 4}" text-anchor="end" class="lnt2">${dec(l.line)}</text>`;
  s += `<path d="${d}" class="pl ${tone}"/><circle cx="${x(last.t)}" cy="${y(last.v)}" r="4.5" class="pd ${tone}"/><text x="${Math.min(W - 4, x(last.t) + 8)}" y="${y(last.v) - 7}" text-anchor="${x(last.t) + 30 > W ? 'end' : 'start'}" class="vl ${tone === 'hit' ? 'hit' : tone === 'miss' ? 'miss' : ''}">${last.v}</text>`;
  return s + '</svg>';
}
function playerTracker(l, x, betDate) {
  const lv = LIVE[l.gameId], ps = lv?.players?.[l.pid], p = D.players[l.pid];
  const fin = p?.log.find(g => g.date === betDate), box = ps || (fin && !lv ? fin : null);
  const series = PBP[l.gameId]?.[l.pid] || HIST[l.gameId]?.[l.pid];
  const avg = p ? mean(p.log.slice(-10).map(g => val(g, l.stat))) : null;
  const c = x.st === 'won' ? 'good' : x.st === 'lost' ? 'bad' : '';
  const yes = l.stat === 'dd' || l.stat === 'td';
  const need = x.cur != null && !yes ? (l.side === 'over' ? Math.max(0, Math.floor(l.line) + 1 - x.cur) : null) : null;
  const stats = box ? [['MIN', box.min], ['PTS', box.pts], ['REB', box.reb], ['AST', box.ast], ['3PM', box.fg3m], ['TC', `${box.fgm}-${box.fga}`]] : [];
  return `<div class="trk ${c}">
      <div class="trk-h">${p ? avatar(p) : ''}<div style="min-width:0;flex:1"><div class="nm">${esc(l.name || p?.name || '')}${ps?.on ? ' <span class="oncourt">en pista</span>' : ''}</div><div class="xs mut">${yes ? SK[l.stat].n : `${l.side === 'over' ? 'Más' : 'Menos'} de ${dec(l.line)} ${esc(SK[l.stat].short || SK[l.stat].n)}`}</div></div>
        <div class="trk-v"><b>${x.cur ?? '–'}</b><small>${yes ? '' : '/ ' + dec(l.line)}</small></div></div>
      ${x.cur != null && !yes ? `<div class="prog big ${c}"><i style="width:${Math.max(0, Math.min(1, x.cur / Math.max(l.line + .5, 1))) * 100}%"></i><span class="tick" style="left:${Math.min(100, (l.line / Math.max(l.line + .5, 1)) * 100)}%"></span></div>` : ''}
      <div class="xs ${c ? (c === 'good' ? 'ok' : 'err') : 'mut'}">${x.st === 'won' ? 'Cumplida' : x.st === 'lost' ? 'Fallada' : need != null ? (need > 0 ? `Le faltan ${need}` : 'Ya la supera') : x.cur == null ? (lv?.state === 'live' ? 'Aún no ha jugado' : `Su media en los últimos 10: ${dec(avg)}`) : ''}${l.side === 'under' && x.cur != null && !x.st ? ` · margen ${dec(l.line - x.cur)}` : ''}</div>
      ${progressChart(series, l, x.cur, avg)}
      ${stats.length ? `<div class="mstats">${stats.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')}</div>` : ''}
    </div>`;
}
function boxTables(id) {
  const lv = LIVE[id]; if (!lv) return '';
  const open = OPENBOX.has(id);
  const tbl = tri => { const rows = Object.entries(lv.players).filter(([, x]) => x.tm === tri && x.pl).sort((a, b) => b[1].pts - a[1].pts || b[1].min - a[1].min);
    return `<div class="tbl"><table class="box"><thead><tr><th class="l">${V.crest(tri, 18, 'sm')} ${tri}</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>3PM</th></tr></thead><tbody>${rows.map(([pid, x]) => `<tr><td class="l">${esc(x.nm || D.players[pid]?.name || pid)}${x.on ? ' <i class="dotl"></i>' : ''}</td><td>${x.min}</td><td><b>${x.pts}</b></td><td>${x.reb}</td><td>${x.ast}</td><td>${x.fg3m}</td></tr>`).join('') || '<tr><td class="l" colspan="6">Sin datos todavía.</td></tr>'}</tbody></table></div>`; };
  return `<button class="linkb boxtg" data-tbox="${esc(id)}" aria-expanded="${open}">${open ? 'Ocultar' : 'Ver'} todos los jugadores del partido</button>${open ? `<div class="boxes">${tbl(lv.away.tri)}${tbl(lv.home.tri)}</div>` : ''}`;
}
function betLive(b, s) {
  const groups = new Map();
  b.legs.forEach((l, i) => { if (l.type === 'x') return; const k = l.gameId || ('?' + i); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); });
  return `<div class="bet-live">${[...groups].map(([id, idx]) => `<div class="lgame">
      ${scoreboard(id, b.legs[idx[0]], b.date)}
      ${idx.map(i => { const l = b.legs[i], x = s.legs[i];
        if (l.type === 'p') return playerTracker(l, x, b.date);
        const c = x.st === 'won' ? 'good' : x.st === 'lost' ? 'bad' : '';
        const m = l.market, mine = x.cur;
        const txt = mine == null ? 'Aún no ha empezado' : m === 'ml' ? (mine > 0 ? `${l.team} gana de ${mine}` : mine < 0 ? `${l.team} pierde de ${-mine}` : 'Empate') : m === 'spread' ? `${l.team} ${signed(mine)} · con el hándicap ${signed(mine + l.line)}` : `Van ${mine} · línea ${dec(l.line)}`;
        return `<div class="trk ${c}"><div class="trk-h"><div style="flex:1"><div class="nm">${esc(legLabel(l))}</div><div class="xs ${c === 'good' ? 'ok' : c === 'bad' ? 'err' : 'mut'}">${esc(txt)}</div></div></div></div>`; }).join('')}
      ${id && !String(id).startsWith('?') ? boxTables(id) : ''}
    </div>`).join('')}
    ${!DEMO && b.legs.some(l => l.gameId && LIVE[l.gameId]?.state === 'live') ? '<p class="xs mut">Se actualiza solo cada 30 segundos.</p>' : ''}</div>`;
}
function calendar(netMap) {
  const [y, m] = S.calMonth.split('-').map(Number), first = new Date(Date.UTC(y, m - 1, 1)), days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7, today = refDay();
  const title = first.toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  let monthNet = 0, cells = '';
  for (let i = 0; i < lead; i++) cells += '<span></span>';
  for (let d = 1; d <= days; d++) {
    const k = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, v = netMap[k]; if (v != null) monthNet += v;
    cells += `<button class="cd ${v == null ? '' : v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero'}${k === today ? ' today' : ''}" data-calday="${k}" aria-pressed="${S.calDay === k}" ${v == null && k !== today ? 'disabled' : ''}><span>${d}</span>${v != null ? `<small>${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.round(Math.abs(v))}</small>` : ''}</button>`;
  }
  return `<div class="card pad">
    <div class="row-between"><button class="ic" data-calnav="-1" aria-label="Mes anterior">${ICON.back}</button><div style="text-align:center"><b>${esc(title.charAt(0).toUpperCase() + title.slice(1))}</b><div class="xs ${monthNet > 0 ? 'ok' : monthNet < 0 ? 'err' : 'mut'}">${eurS(monthNet)}</div></div><button class="ic flip" data-calnav="1" aria-label="Mes siguiente">${ICON.back}</button></div>
    <div class="cal">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => `<em>${d}</em>`).join('')}${cells}</div></div>`;
}
function viewBets() {
  settleAll();
  const today = refDay(), netMap = dailyNet();
  const [, , nDays] = RANGES.find(r => r[0] === S.range);
  const end = new Date(today + 'T00:00:00Z'), start = new Date(end - (nDays - 1) * 864e5), sIso = isoDay(start);
  const inRange = BETS.filter(b => b.date >= sIso && b.date <= today);
  const closed = inRange.filter(b => b.result), staked = closed.reduce((a, b) => a + b.stake, 0), net = closed.reduce((a, b) => a + b.net, 0), wins = closed.filter(b => b.result === 'won').length;
  let series = [];
  if (S.range === 'day') { let i = 0; series = closed.map(b => ({ net: b.net, lab: legLabel(b.legs[0]), short: String(++i) })); }
  else if (nDays > 120) { const mm = {}; for (const [d, v] of Object.entries(netMap)) if (d >= sIso && d <= today) { const k = d.slice(0, 7); mm[k] = (mm[k] || 0) + v; }
    series = Object.keys(mm).sort().map(k => ({ net: mm[k], lab: k, short: new Date(k + '-01T00:00:00Z').toLocaleDateString('es-ES', { month: 'short', timeZone: 'UTC' }) })); }
  else if (nDays > 31) { const wk = {}; for (const [d, v] of Object.entries(netMap)) if (d >= sIso && d <= today) { const dd = new Date(d + 'T00:00:00Z'), mon = isoDay(new Date(dd - ((dd.getUTCDay() + 6) % 7) * 864e5)); wk[mon] = (wk[mon] || 0) + v; }
    series = Object.keys(wk).sort().map(k => ({ net: wk[k], lab: 'Semana del ' + fdate(new Date(k + 'T00:00:00Z')), short: fdate(new Date(k + 'T00:00:00Z')) })); }
  else series = Object.keys(netMap).filter(d => d >= sIso && d <= today).sort().map(d => ({ net: netMap[d], lab: d, short: fdate(new Date(d + 'T00:00:00Z')) }));
  const open = BETS.filter(b => !b.result || b.date === today).sort((a, b) => a.created < b.created ? 1 : -1);
  const dayBets = S.calDay ? BETS.filter(b => b.date === S.calDay) : [];
  return `${topBar('', false)}<div class="stack fade">
    <div><h1>Mis apuestas</h1><div class="mut sm">Solo las ves tú.</div></div>
    <div class="seg wide" role="group" aria-label="Periodo">${RANGES.map(([v, l]) => `<button data-range="${v}" aria-pressed="${S.range === v}">${l}</button>`).join('')}</div>
    <div class="kpis"><div><b class="${net > 0 ? 'ok' : net < 0 ? 'err' : ''}">${eurS(net)}</b><span>beneficio</span></div><div><b>${staked ? dec(net / staked * 100, 1) + ' %' : '–'}</b><span>rentabilidad · ${eur(staked)} apostados</span></div><div><b>${closed.length ? pct(wins / closed.length) : '–'}</b><span>acertadas · ${wins} de ${closed.length}</span></div></div>
    <div class="card"><div class="chartbox">${profitChart(series)}</div><div class="pad" style="padding-top:0"><div class="note">Barras: ganancia o pérdida ${S.range === 'day' ? 'de cada apuesta' : nDays > 120 ? 'de cada mes' : nDays > 31 ? 'de cada semana' : 'de cada día'}. Línea ámbar: acumulado.</div></div></div>
    <div class="sec-h"><h3>Esta noche y pendientes</h3>${DEMO && BETS.some(b => !b.result) ? `<button class="btn ghost sm-btn" data-act="sim-live" ${simT ? 'disabled' : ''}>${simT ? 'Simulando…' : 'Simular el directo'}</button>` : ''}</div>
    ${open.length ? `<div class="stack">${open.map(betCard).join('')}</div>` : `<div class="card empty"><b>No tienes apuestas para esta noche</b>Añade selecciones al boleto y regístralas con tu importe y cuota.</div>`}
    ${!DEMO && open.length ? `<p class="note">El directo se actualiza cada 30 segundos con el marcador de NBA.com mientras la app está abierta.</p>` : ''}
    <div class="sec-h"><h3>Calendario</h3></div>
    ${calendar(netMap)}
    ${S.calDay ? `<div class="sec-h"><h3>${new Date(S.calDay + 'T00:00:00Z').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}</h3><span class="${(netMap[S.calDay] || 0) >= 0 ? 'ok' : 'err'} sm" style="font-weight:800">${netMap[S.calDay] != null ? eurS(netMap[S.calDay]) : ''}</span></div>
      ${dayBets.length ? `<div class="stack">${dayBets.map(betCard).join('')}</div>` : '<p class="note">Sin apuestas ese día.</p>'}` : ''}
    ${legal()}</div>`;
}

/* ---------- render ---------- */
function render() {
  if (!D) return;
  const v = { hoy: viewHoy, game: viewGame, player: viewPlayer, props: viewProps, slip: viewSlip, bets: viewBets, admin: viewAdmin }[S.view] || viewHoy;
  const ae = document.activeElement, keep = ae && ae.id ? { id: ae.id, s: ae.selectionStart, e: ae.selectionEnd } : null;
  const anim = ANIM;
  app.innerHTML = `<div class="shell">${v()}</div>${tabBar()}`;
  if (!anim) app.querySelectorAll('.fade').forEach(el => el.classList.remove('fade'));
  const pb = app.querySelector('.pillbar'), sel = pb && pb.querySelector('[aria-selected="true"]');
  if (sel) pb.scrollLeft = Math.max(0, sel.offsetLeft - pb.offsetLeft - (pb.clientWidth - sel.offsetWidth) / 2);
  ANIM = false;
  if (keep) { const el = document.getElementById(keep.id); if (el) { el.focus(); try { el.setSelectionRange(keep.s, keep.e); } catch (e) {} } }
}
function go(view, patch = {}) { ANIM = true; S.back.push({ view: S.view, gameId: S.gameId, pid: S.pid }); Object.assign(S, patch, { view }); render(); window.scrollTo(0, 0); }

/* ---------- eventos ---------- */
app.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  if (d.lmode) { loginMode = d.lmode; return showLogin('', document.getElementById('email')?.value || ''); }
  if (d.nav) { S.back = []; S.view = d.nav; S.msg = ''; render(); window.scrollTo(0, 0); return; }
  if (d.game) return go('game', { gameId: d.game, market: 'ml', mTeam: null, gtab: 'game', gvenue: 'all' });
  if (d.pid) return go('player', { pid: d.pid });
  if (d.openP) return go('player', { pid: d.openP, stat: d.openK });
  if (d.openG) return go('game', { gameId: d.openG, market: d.openM, mTeam: d.openT, gtab: 'game' });
  if (d.stat) { S.stat = d.stat; return render(); }
  if (d.win) { S.win = d.win; return render(); }
  if (d.venue) { S.venue = d.venue; return render(); }
  if (d.side) { sides[lineKey(S.pid, S.stat)] = d.side; saveUser(); return render(); }
  if (d.step) { const p = D.players[S.pid]; uLines[lineKey(p.id, S.stat)] = Math.max(0, getLine(p, S.stat) + num(d.step)); saveUser(); return render(); }
  if (d.market) { S.market = S.market === d.market ? 'ml' : d.market; return render(); }
  if (d.gtab) { S.gtab = d.gtab; return render(); }
  if (d.gvenue) { S.gvenue = d.gvenue; return render(); }
  if (d.tstat) { S.tstat = d.tstat; return render(); }
  if (d.twin) { S.twin = d.twin; return render(); }
  if (d.mteam) { S.mTeam = d.mteam; return render(); }
  if (d.gwin) { S.gwin = d.gwin; return render(); }
  if (d.gside) { const g = D.games.find(x => x.id === S.gameId), tm = S.market === 'total' ? null : (S.mTeam === 'home' ? g.home : g.away); sides[marketKey(g, S.market, tm)] = d.gside; saveUser(); return render(); }
  if (d.gstep) { const g = D.games.find(x => x.id === S.gameId), tm = S.market === 'total' ? null : (S.mTeam === 'home' ? g.home : g.away), key = marketKey(g, S.market, tm); uLines[key] = marketLine(g, S.market, tm) + num(d.gstep); saveUser(); return render(); }
  if (d.ltab) { S.listTab = d.ltab; return render(); }
  if (d.lwin) { S.listWin = d.lwin; return render(); }
  if (d.lstat) { S.listStat = d.lstat; return render(); }
  if (d.range) { S.range = d.range; return render(); }
  if (d.calnav) { const [y, m] = S.calMonth.split('-').map(Number), n = new Date(Date.UTC(y, m - 1 + +d.calnav, 1)); S.calMonth = isoDay(n).slice(0, 7); S.calDay = null; return render(); }
  if (d.calday) { S.calDay = S.calDay === d.calday ? null : d.calday; return render(); }
  if (d.tbet) { if (OPENBETS.has(d.tbet)) OPENBETS.delete(d.tbet); else { OPENBETS.add(d.tbet); if (!DEMO) pollLive(); } return render(); }
  if (d.tbox) { if (OPENBOX.has(d.tbox)) OPENBOX.delete(d.tbox); else OPENBOX.add(d.tbox); return render(); }
  if (d.delbet) { BETS = BETS.filter(b => b.id !== d.delbet); persistBets(null, d.delbet); return render(); }
  if (d.rm) { slip.splice(+d.rm, 1); saveUser(); return render(); }
  const act = d.act;
  if (act === 'back') { const prev = S.back.pop(); if (prev) Object.assign(S, prev); else S.view = 'hoy'; ANIM = true; render(); window.scrollTo(0, 0); return; }
  if (act === 'mode') { mode = mode === 'auto' ? 'light' : mode === 'light' ? 'dark' : 'auto'; store.set('mode', mode); applyMode(); return render(); }
  if (act === 'reset-line') { delete uLines[lineKey(S.pid, S.stat)]; saveUser(); return render(); }
  if (act === 'reset-odd') { const key = lineKey(S.pid, S.stat); delete uOdds[key + '|' + getSide(key)]; saveUser(); return render(); }
  if (act === 'reset-gline' || act === 'reset-godd') { const g = D.games.find(x => x.id === S.gameId), tm = S.market === 'total' ? null : (S.mTeam === 'home' ? g.home : g.away), key = marketKey(g, S.market, tm);
    if (act === 'reset-gline') delete uLines[key]; else { delete uOdds[key + '|over']; delete uOdds[key + '|under']; } saveUser(); return render(); }
  if (act === 'add-player') { const p = D.players[S.pid], k = S.stat, key = lineKey(p.id, k), line = getLine(p, k), side = getSide(key);
    slip = slip.filter(l => !(l.type === 'p' && l.pid === p.id && l.stat === k)); slip.push({ type: 'p', pid: p.id, stat: k, line, side, odd: effOdd(key, side, line).v }); saveUser(); return render(); }
  if (act === 'add-game') { const g = D.games.find(x => x.id === S.gameId), tm = S.market === 'total' ? null : (S.mTeam === 'home' ? g.home : g.away), key = marketKey(g, S.market, tm);
    const side = S.market === 'total' || S.market === 'pts' ? getSide(key) : 'over', line = marketLine(g, S.market, tm), ev = marketEval(g, S.market, tm, side, line);
    slip = slip.filter(l => !(l.type === 'g' && l.gameId === g.id && l.market === S.market && l.team === tm)); slip.push({ type: 'g', gameId: g.id, market: S.market, team: tm, side, line, odd: ev.eo.v }); saveUser(); return render(); }
  if (act === 'save-fondo') return saveFondo();
  if (act === 'add-ml') { const g = D.games.find(x => x.id === S.gameId), tm = S.mTeam === 'home' ? g.home : g.away, ev = marketEval(g, 'ml', tm, 'over', 0);
    slip = slip.filter(l => !(l.type === 'g' && l.gameId === g.id && l.market === 'ml')); slip.push({ type: 'g', gameId: g.id, market: 'ml', team: tm, side: 'over', line: 0, odd: ev.eo.v }); saveUser(); return render(); }
  if (act === 'logout') { await sb.auth.signOut(); D = null; BETS = []; location.reload(); return; }
  if (act === 'sim-live') { simulateLive(); return render(); }
  if (act === 'clear-slip') { slip = []; saveUser(); return render(); }
  if (act === 'example') { S.draft = 'Curry 3PM 4,5 1,85 1,95\nJokic PRA 52,5 1,90 1,90\nBrunson puntos 26,5 1,83 1,97\nTatum;REB;8.5;2.05;1.75\nOKC ganador 1,55\nDEN ganador 2,45\nOKC handicap -4,5 1,90\nDEN@OKC total 229,5 1,90 1,90\nLAL puntos 116,5 1,88 1,92\nWembanyama PTS 24,5 1,90 1,90'; S.msg = ''; return render(); }
  if (act === 'save-odds') return saveOdds();
  if (act === 'clear-odds') return clearOdds();
});
app.addEventListener('change', e => {
  const t = e.target, v = num(t.value);
  if (t.id === 'pline' && v >= 0) { uLines[lineKey(S.pid, S.stat)] = Math.round(v * 2) / 2; saveUser(); render(); }
  if (t.id === 'podd') { const key = lineKey(S.pid, S.stat) + '|' + getSide(lineKey(S.pid, S.stat)); if (v > 1) uOdds[key] = Math.round(v * 100) / 100; else delete uOdds[key]; saveUser(); render(); }
  if (t.id === 'gline' || t.id === 'godd') { const g = D.games.find(x => x.id === S.gameId), tm = S.market === 'total' ? null : (S.mTeam === 'home' ? g.home : g.away), key = marketKey(g, S.market, tm);
    if (t.id === 'gline' && isFinite(v)) uLines[key] = Math.round(v * 2) / 2;
    if (t.id === 'godd') { const sd = S.market === 'total' || S.market === 'pts' ? getSide(key) : 'over'; if (v > 1) uOdds[key + '|' + sd] = Math.round(v * 100) / 100; else delete uOdds[key + '|' + sd]; }
    saveUser(); render(); }
  if (t.id === 'rest') { S.rest = t.value; render(); }
  if (t.id === 'minr') { S.minMin = +t.value; render(); }
});
let pasteT;
app.addEventListener('input', e => {
  if (e.target.id === 'minr') { const o = document.getElementById('minv'); if (o) o.textContent = e.target.value; }
  if (e.target.id === 'stake' || e.target.id === 'betodd') { if (e.target.id === 'stake') S.stake = e.target.value; else S.betOdd = e.target.value;
    const o = document.getElementById('topay'), st = num(S.stake), od = num(S.betOdd || document.getElementById('betodd').value); if (o) o.textContent = st > 0 && od > 1 ? eur(st * od) : '–'; }
  if (e.target.id === 'paste') { S.draft = e.target.value; S.msg = ''; clearTimeout(pasteT); pasteT = setTimeout(render, 400); }
});
app.addEventListener('submit', async e => {
  if (e.target.id === 'placebet') {
    e.preventDefault(); const stake = num(S.stake), odd = num(S.betOdd || document.getElementById('betodd').value);
    if (!(stake > 0) || !(odd > 1) || !slip.length) return;
    const b = { id: newId(), date: refDay(), created: new Date().toISOString(), stake: Math.round(stake * 100) / 100, odd: Math.round(odd * 100) / 100, legs: slipToLegs() };
    BETS.push(b); slip = []; S.stake = ''; S.betOdd = ''; saveUser(); persistBets([b]); startLive();
    S.calDay = null; return go('bets');
  }
  if (e.target.id === 'join') { e.preventDefault(); pendingCode = document.getElementById('code').value.trim(); return boot(); }
  if (e.target.id === 'groupcode') {
    e.preventDefault(); const v = document.getElementById('gcode').value.trim(); if (v.length < 4) return;
    const { error } = await sb.from('ajustes').upsert({ clave: 'codigo_grupo', valor: v }); S.msg = error ? 'Error al guardar el código: ' + error.message : 'Código del grupo guardado.'; if (!error) groupCode = v; return render();
  }
  if (e.target.id === 'newpass') {
    e.preventDefault(); const v = document.getElementById('np').value, out = document.getElementById('npmsg');
    const { error } = await sb.auth.updateUser({ password: v }); out.textContent = error ? 'No se pudo cambiar: ' + error.message : 'Contraseña cambiada.'; if (!error) document.getElementById('np').value = ''; return;
  }
  if (e.target.id !== 'login') return; e.preventDefault();
  const email = document.getElementById('email').value.trim(), btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Entrando…';
  const password = document.getElementById('pass').value;
  if (loginMode === 'up') {
    const code = document.getElementById('code').value.trim();
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) return showLogin(/not allowed|disabled/i.test(error.message) ? 'El registro está cerrado. Pide al administrador que te cree la cuenta.' : /already/i.test(error.message) ? 'Ese correo ya tiene cuenta: usa «Entrar».' : 'No se pudo crear la cuenta: ' + error.message, email);
    if (!data.session) return showLogin('Cuenta creada, pero falta confirmarla. Avisa al administrador.', email);
    pendingCode = code; loginMode = 'in';
    if (!D) boot(); return;
  }
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return showLogin(/invalid/i.test(error.message) ? 'Correo o contraseña incorrectos.' : 'No se pudo entrar: ' + error.message, email);
  if (!D) boot();
});
let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 200); });

/* ---------- fondo del jugador ---------- */
async function saveFondo() {
  const el = document.getElementById('fondo'), url = (el?.value || '').trim(), pid = S.pid;
  if (url && !/^https:\/\//i.test(url)) { alert('El enlace debe empezar por https://'); return; }
  if (DEMO) { if (url) FONDOS[pid] = url; else delete FONDOS[pid]; store.set('fondos', FONDOS); return render(); }
  const r = url ? await sb.from('fondos').upsert({ player_id: pid, url }) : await sb.from('fondos').delete().eq('player_id', pid);
  if (r.error) return alert('No se pudo guardar: ' + r.error.message);
  if (url) FONDOS[pid] = url; else delete FONDOS[pid]; render();
}

/* ---------- cuotas: guardar ---------- */
async function saveOdds() {
  const rows = parsePaste(S.draft).filter(r => !r.err); if (!rows.length) return;
  S.saving = true; render();
  try {
    if (DEMO) { rows.forEach(r => ODDS[r.entity + '|' + r.stat] = { line: r.line, over: r.over, under: r.under }); store.set('demo-odds', ODDS); }
    else {
      const gd = D.games[0]?.date || todayET();
      const mk = withSrc => rows.map(r => ({ player_id: r.entity, stat: r.stat, line: r.line ?? 0, over_odd: r.over, under_odd: r.under, game_date: gd, updated_at: new Date().toISOString(), ...(withSrc ? { fuente: 'manual' } : {}) }));
      let { error } = await sb.from('odds').upsert(mk(true), { onConflict: 'player_id,stat,game_date' });
      if (error && /fuente/.test(error.message)) ({ error } = await sb.from('odds').upsert(mk(false), { onConflict: 'player_id,stat,game_date' }));
      if (error) throw error;
      rows.forEach(r => ODDS[r.entity + '|' + r.stat] = { line: r.line, over: r.over, under: r.under });
    }
    S.draft = ''; S.msg = `Guardadas ${rows.length} cuotas. Tus amigos ya las ven.`;
  } catch (err) { S.msg = 'Error al guardar: ' + (err.message || err); }
  S.saving = false; render();
}
async function clearOdds() {
  if (!DEMO) { const gd = D.games[0]?.date || todayET(); const { error } = await sb.from('odds').delete().eq('game_date', gd); if (error) { S.msg = 'Error al borrar: ' + error.message; return render(); } }
  ODDS = {}; if (DEMO) store.set('demo-odds', {}); S.msg = 'Cuotas de hoy borradas.'; render();
}

/* ---------- arranque ---------- */
async function boot() {
  app.innerHTML = `<div class="shell"><div class="empty" style="padding-top:30vh">Cargando…</div></div>`;
  if (DEMO) {
    const demo = window.TRIBUNA_DEMO();
    D = prepare(demo.data); ODDS = store.get('demo-odds', null) || demo.odds; isAdmin = true;
    { const g0 = D.games[0]; if (g0) { const top = t => Object.values(D.players).filter(p => p.team === t).sort((a, b) => b.avgMin - a.avgMin); const [a] = top(g0.home), [, b] = top(g0.away); if (a) BAJAS[a.id] = { status: 'out', note: 'Ejemplo de la demo: baja por lesión en el tobillo.' }; if (b) BAJAS[b.id] = { status: 'questionable', note: 'Ejemplo de la demo: en duda.' }; BAJAS_AT = new Date().toISOString(); } } Object.assign(FONDOS, store.get('fondos', {}));
    BETS = [...demoHistory(), ...store.get('bets', [])]; S.calMonth = refDay().slice(0, 7);
    return render();
  }
  if (booting) return; booting = true;
  try { return await bootReal(); } finally { booting = false; }
}
let booting = false, pendingCode = '', groupCode = null, oddsCredits = null;
async function bootReal() {
  sb = sb || window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { app.innerHTML = `<div class="shell">${viewLogin('')}</div>`; return; }
  userEmail = session.user.email || '';
  // Grupo: si la base de datos ya tiene el control de miembros, hay que haber metido el código.
  if (pendingCode) { const j = await sb.rpc('unirse', { codigo: pendingCode }); pendingCode = ''; if (!j.error && j.data === false) { app.innerHTML = `<div class="shell">${viewJoin('Ese código no es correcto.')}</div>`; return; } }
  const mem = await sb.rpc('es_miembro');
  if (!mem.error && mem.data === false) { app.innerHTML = `<div class="shell">${viewJoin('')}</div>`; return; }
  const [snap, adm] = await Promise.all([sb.from('snapshots').select('data').eq('id', 'nba').maybeSingle(), sb.from('admins').select('email').limit(1)]);
  if (snap.error || !snap.data) { app.innerHTML = `<div class="shell"><div class="card empty" style="margin-top:20vh"><b>Aún no hay datos</b>${esc(snap.error?.message || 'Ejecuta actualizar_nba.py --subir en el ordenador del administrador.')}</div></div>`; return; }
  D = prepare(snap.data.data); isAdmin = !!adm.data?.length;
  const bj = await sb.from('snapshots').select('data').eq('id', 'bajas').maybeSingle();
  if (bj.data?.data) { BAJAS = bj.data.data.players || {}; BAJAS_AT = bj.data.data.updated || null; }
  if (isAdmin) { const gc = await sb.from('ajustes').select('valor').eq('clave', 'codigo_grupo').maybeSingle(); groupCode = gc.data?.valor ?? null; }
  const gd = D.games[0]?.date || todayET();
  /* Supabase devuelve como mucho 1.000 filas por consulta y una noche puede tener ~2.000 cuotas: se piden por páginas. */
  const allRows = async q => { const out = []; for (let i = 0; ; i += 1000) { const r = await q().range(i, i + 999); if (r.error) return { data: out.length ? out : null, error: r.error }; out.push(...(r.data || [])); if (!r.data || r.data.length < 1000) return { data: out, error: null }; } };
  const [od, fd] = await Promise.all([allRows(() => sb.from('odds').select('*').eq('game_date', gd).order('player_id').order('stat')), sb.from('fondos').select('player_id,url')]);
  (fd.data || []).forEach(r => FONDOS[r.player_id] = r.url);
  const ap = await allRows(() => sb.from('apuestas').select('data').order('created_at', { ascending: true }));
  BETS = (ap.data || []).map(r => r.data); S.calMonth = refDay().slice(0, 7);
  if (BETS.some(b => !b.result)) startLive();
  ODDS = {}; (od.data || []).forEach(r => ODDS[r.player_id + '|' + r.stat] = { line: r.line == null ? null : +r.line, over: r.over_odd == null ? null : +r.over_odd, under: r.under_odd == null ? null : +r.under_odd, src: r.fuente || 'manual', at: r.updated_at });
  if (isAdmin) { const cr = await sb.from('ajustes').select('valor').eq('clave', 'creditos_odds').maybeSingle(); try { oddsCredits = cr.data ? JSON.parse(cr.data.valor) : null; } catch (e) { oddsCredits = null; } }
  render();
}
boot().catch(err => { app.innerHTML = `<div class="shell"><div class="card empty" style="margin-top:20vh"><b>Algo ha fallado</b>${esc(err.message || err)}</div></div>`; });
})();
