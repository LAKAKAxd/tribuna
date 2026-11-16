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
  'rob+tap': 'sb', 'stl+blk': 'sb', sb: 'sb', per: 'tov', tov: 'tov', perdidas: 'tov', tc: 'fgm', fgm: 'fgm', tci: 'fga', fga: 'fga', tl: 'ftm', ftm: 'ftm', tli: 'fta', fta: 'fta' };
const GAME_ALIAS = { ganador: 'ml', gana: 'ml', ml: 'ml', moneyline: 'ml', '1x2': 'ml', handicap: 'spread', hcp: 'spread', spread: 'spread', hand: 'spread',
  total: 'total', totales: 'total', puntos: 'pts', pts: 'pts', 'puntos-equipo': 'pts' };
const MARKET_N = { ml: 'Ganador', spread: 'Hándicap', total: 'Total del partido', pts: 'Puntos del equipo' };

/* ---------- estado ---------- */
const V = window.TRIBUNA_VISUAL;
let FONDOS = Object.assign({}, CFG.fondos || {});
let ANIM = true;
let BETS = [];
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
function verdict(edge) { if (edge == null) return ''; const c = edge >= 3 ? 'good' : edge <= -3 ? 'bad' : ''; return `<span class="pill ${c}">${edge >= 3 ? 'Con valor' : edge <= -3 ? 'Sin valor' : 'Justo'} ${edge > 0 ? '+' : ''}${dec(edge, 0)}</span>`; }

/* ---------- equipos y partidos ---------- */
function tGames(t, venue = 'all') { return (D.teams[t] || []).filter(g => venue === 'all' || (venue === 'home') === g.home); }
function record(t, season, venue = 'all') { const g = tGames(t, venue).filter(x => x.season === season); const w = g.filter(x => x.margin > 0).length; return `${w}-${g.length - w}`; }
function model(g) {
  const split = (t, v) => { const L = tGames(t, v).slice(-20); const all = tGames(t).slice(-20); const use = L.length >= 6 ? L : all; return { pf: mean(use.map(x => x.pts)), pa: mean(use.map(x => x.opp_pts)) }; };
  const H = split(g.home, 'home'), A = split(g.away, 'away');
  const eh = (H.pf + A.pa) / 2, ea = (A.pf + H.pa) / 2;
  return { eh, ea, m: eh - ea, total: eh + ea, pHome: Phi((eh - ea) / 12) };
}
const SD = { ml: 12, spread: 12, total: 17, pts: 11 };
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
  return { pModel, hist, key, eo, imp, edge: imp != null ? (pModel - imp) * 100 : null, histVal, thr };
}
function marketLabel(g, market, team, side, line) {
  if (market === 'ml') return `Gana ${team}`;
  if (market === 'spread') return `${team} ${signed(line)}`;
  if (market === 'total') return `${side === 'over' ? 'Más' : 'Menos'} de ${dec(line)} puntos`;
  return `${team} ${side === 'over' ? 'más' : 'menos'} de ${dec(line)}`;
}

/* ---------- gráfico de barras ---------- */
function chartWidth() { const sh = document.querySelector('.shell'); return Math.max(280, (sh ? sh.clientWidth - 32 : 340) - 18); }
function chart(items, line, o = {}) {
  const n = items.length; if (!n) return `<p class="empty">Sin partidos con estos filtros.</p>`;
  const W = Math.max(chartWidth(), n * 16 + 50), H = o.h || 210, padL = 44, padT = 18, padB = 34;
  const vals = items.map(i => i.v);
  let lo = o.min ?? Math.min(0, ...vals), hi = Math.max(...vals, line);
  if (o.min === 'auto') { lo = Math.floor(Math.min(...vals, line) * .93 / 5) * 5; }
  hi = hi + (hi - lo) * .14 || 1;
  const y = v => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
  const base = lo < 0 ? 0 : lo, slot = (W - padL - 6) / n, bw = Math.max(6, slot * .68);
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || '')}">`;
  [lo, (lo + hi) / 2].forEach(t => { s += `<line x1="${padL}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="var(--edge)"/>`; });
  if (lo < 0) s += `<line x1="${padL}" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="var(--mut)" stroke-width="1"/>`;
  items.forEach((it, i) => {
    const x = padL + i * slot + (slot - bw) / 2, ov = it.v > line, top = Math.min(y(it.v), y(base)), h = Math.max(2, Math.abs(y(base) - y(it.v)));
    s += `<rect x="${x}" y="${top}" width="${bw}" height="${h}" rx="${Math.min(6, bw / 3)}" fill="${ov ? 'var(--over)' : 'var(--under)'}"><title>${esc(it.title || '')}</title></rect>`;
    if (bw >= 16) s += `<text x="${x + bw / 2}" y="${it.v >= base ? top - 5 : top + h + 12}" text-anchor="middle" font-size="11" font-weight="700" fill="${ov ? 'var(--over)' : 'var(--mut)'}">${esc(it.lab ?? it.v)}</text>`;
    if (slot >= 24 || i % Math.ceil(24 / slot) === 0) s += `<text x="${x + bw / 2}" y="${H - 19}" text-anchor="middle" font-size="9.5" fill="var(--mut)">${esc(it.d1)}</text><text x="${x + bw / 2}" y="${H - 7}" text-anchor="middle" font-size="9.5" fill="var(--mut)">${esc(it.d2)}</text>`;
  });
  s += `<line x1="${padL}" x2="${W}" y1="${y(line)}" y2="${y(line)}" stroke="var(--line)" stroke-width="1.8"/>`;
  s += `<rect x="2" y="${y(line) - 10}" width="${padL - 6}" height="20" rx="6" fill="var(--line)"/><text x="${(padL - 4) / 2 + 1}" y="${y(line) + 4}" text-anchor="middle" font-size="10.5" font-weight="800" fill="var(--bg)">${esc(o.lineLab ?? dec(line))}</text>`;
  return s + '</svg>';
}
function spark(vals, line) {
  const n = vals.length; if (!n) return ''; const W = 300, H = 26, mx = Math.max(...vals, line) * 1.1 || 1, bw = W / n - 3;
  return `<svg viewBox="0 0 ${W} ${H}" height="${H}" preserveAspectRatio="none" aria-hidden="true">${vals.map((v, i) => `<rect x="${i * (bw + 3)}" y="${H - H * v / mx}" width="${bw}" height="${Math.max(1.5, H * v / mx)}" rx="2" fill="${v > line ? 'var(--over)' : 'var(--under)'}"/>`).join('')}<line x1="0" x2="${W}" y1="${H - H * line / mx}" y2="${H - H * line / mx}" stroke="var(--line)" stroke-width="1.2"/></svg>`;
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
        <div class="teams"><div class="tm">${V.crest(g.away, 34, 'sm')}<b>${g.away}</b><span>${record(g.away, D.cur)}${mlA ? ' · ' + dec(mlA.over, 2) : ''}</span></div>
        <div class="mid"><b>${esc(t.time)}</b>${g.status && !t.day ? '' : ''}</div>
        <div class="tm">${V.crest(g.home, 34, 'sm')}<b>${g.home}</b><span>${record(g.home, D.cur)}${mlH ? ' · ' + dec(mlH.over, 2) : ''}</span></div></div>
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
        <div class="tm">${V.crest(g.away, 72, ANIM ? 'in' : '')}<b>${g.away}</b><span>${record(g.away, D.cur)} · fuera ${record(g.away, D.cur, 'away')}</span></div>
        <div class="mid vs-glow"><b>${esc(t.time)}</b>${esc(t.day)}</div>
        <div class="tm">${V.crest(g.home, 72, ANIM ? 'in b' : '')}<b>${g.home}</b><span>${record(g.home, D.cur)} · casa ${record(g.home, D.cur, 'home')}</span></div></div>
    </div>
    <div class="sectabs" role="tablist" aria-label="Apartado">${tabs.map(([v, l]) => `<button role="tab" data-gtab="${v}" aria-selected="${S.gtab === v}">${esc(l)}</button>`).join('')}</div>
    ${S.gtab === 'game' ? gameSection(g, md) : teamSection(g, S.gtab === 'home' ? g.home : g.away)}
    ${legal()}</div>`;
}

/* apartado Partido: ganador de los dos equipos, historial y otros mercados */
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
  const items = series.slice(-25).map(x => ({ v: x.margin, lab: (x.margin > 0 ? '+' : '') + x.margin, d1: fdate(x.d), d2: (x.home ? '' : '@') + x.opp, title: `${fdate(x.d)} ${x.home ? 'vs' : '@'} ${x.opp}: ${x.pts}-${x.opp_pts}` }));
  const evSel = evs.find(x => x.tm === tm).ev;
  const facts = teamFacts(g, tm);
  const other = ['spread', 'total', 'pts'];
  return `<section class="stack">
    <div class="sec-h"><h3>Ganador</h3><span class="note">Modelo: ${g.home} ${md.m >= 0 ? 'por' : 'pierde por'} ${dec(Math.abs(md.m))} · ${dec(md.eh, 0)}-${dec(md.ea, 0)}</span></div>
    <div class="ml2">${evs.map(({ tm: x, ev }) => `<button class="mlb" data-mteam="${x === g.home ? 'home' : 'away'}" aria-pressed="${x === tm}">
      ${x === best ? `<span class="best">${ev.edge != null ? 'La que más conviene' : 'Favorito del modelo'}</span>` : ''}
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
      <div class="pad" style="padding-top:0"><div class="note">Diferencia de puntos de ${tm} en cada partido${S.gvenue !== 'all' ? (S.gvenue === 'home' ? ' en casa' : ' fuera') : ''}. Por encima de 0 = ganó. Pulsa una barra para ver el marcador.</div></div>
    </div>
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
  items.forEach(i => { if (S.market === 'spread') i.lab = (i.v > 0 ? '+' : '') + i.v; });
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
      <div class="chartbox">${chart(items, cLine, { min: S.market === 'spread' ? undefined : 'auto', label: MARKET_N[S.market], lineLab: S.market === 'spread' ? signed(-line) : dec(line) })}</div>
      <div class="pad" style="padding-top:0"><div class="note">${S.market === 'spread' ? `Diferencia de puntos de ${team}. Cubre el ${signed(line)} si la barra supera ${signed(-line)}.` : S.market === 'total' ? 'Puntos totales en los partidos de ' + g.home + '.' : 'Puntos de ' + team + ' en cada partido.'}</div></div>
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
    if (ODDS[key] && !yes) { const b = bestSide(hw(S.twin === 'dvp' ? 'l10' : S.twin).p, key, line); side = b.side; edge = b.edge; eo = b.eo; }
    else side = yes ? 'over' : (l10.p ?? 0) >= .5 ? 'over' : 'under';
    if (yes && ODDS[key]) { eo = effOdd(key, 'over', line); const imp = impliedProb(key, 'over', eo); edge = imp != null && l10.p != null ? (l10.p - imp) * 100 : null; }
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
        <div class="pc-name"><div class="nm">${esc(r.p.name)} <span class="mut xs">${r.p.team} · ${r.p.pos}</span></div>
          <div class="pc-line"><span class="sd ${r.side}">${r.side === 'over' ? 'Más' : 'Menos'}</span> ${yes ? SK[k].n : `${dec(r.line)} ${esc(SK[k].short || SK[k].n)}`}</div></div>
        <div class="pc-num"><small>Cuota</small><b>${r.eo.v ? dec(r.eo.v, 2) : '–'}</b></div>
        <div class="pc-num"><small>Valor</small><b class="${r.edge >= 3 ? 'ok' : r.edge <= -3 ? 'err' : ''}">${r.edge != null ? (r.edge > 0 ? '+' : '') + dec(r.edge, 0) : '–'}</b></div></div>
      <div class="tiles">${PER.map(([w, l]) => w === 'dvp'
        ? `<div class="${S.twin === w ? 'on ' : ''}${r.per.dvp.score >= .66 ? 'good' : r.per.dvp.score <= .33 ? 'bad' : ''}"><small>${l}</small><b>${r.per.dvp.rk ? r.per.dvp.rk + '.º' : '–'}</b></div>`
        : `<div class="${S.twin === w ? 'on ' : ''}${tone(r.per[w].p)}"><small>${l}</small><b>${r.per[w].n ? pct(r.per[w].p).replace('\u00a0', '') : '–'}</b></div>`).join('')}</div>
    </button>`).join('') : '<div class="card empty">Sin jugadores en los datos.</div>'}</div>
    <p class="note">Cada recuadro es el % de partidos en que se cumplió en ese tramo. DvP: puesto de ${opp} contra su posición (30.º = la defensa que más concede). La línea es la cargada hoy o, si no hay, la mediana de sus últimos 20.</p>
    <div class="floatbar" role="group" aria-label="Ordenar por">${PER.map(([w, l]) => `<button data-twin="${w}" aria-pressed="${S.twin === w}">${l}</button>`).join('')}</div>
  </section>`;
}
function avatar(p) {
  const [c1, c2] = V.colors(p.team);
  const img = CFG.fotosOficiales ? `<img src="https://cdn.nba.com/headshots/nba/latest/260x190/${p.id}.png" alt="" loading="lazy" onerror="this.remove()">` : '';
  return `<span class="pav" style="--c1:${c1};--c2:${c2}">${initials(p.name)}${img}</span>`;
}

/* ---------- vista: jugador ---------- */
function viewPlayer() {
  const p = D.players[S.pid]; if (!p) { S.view = 'hoy'; return viewHoy(); }
  const k = S.stat, key = lineKey(p.id, k), line = getLine(p, k), side = getSide(key), opp = oppOf(p.team), g = gameOfTeam(p.team);
  const base = filtered(p), games = windowGames(p, S.win, base), vals = games.map(x => val(x, k)), h = hit(games, k, line), ph = sideP(h, side);
  const eo = effOdd(key, side, line), imp = impliedProb(key, side, eo), edge = imp != null && ph != null ? (ph - imp) * 100 : null;
  const defR = opp ? defRank(opp, p.pos, SK[k].base || k) : null;
  const gradeL = (() => { const s = (sideP(hit(windowGames(p, 'l10'), k, line), side) ?? .5) * .65 + ((defR || 15) / 30) * .35; return ['D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'][Math.max(0, Math.min(9, Math.floor(s * 10)))]; })();
  const o = ODDS[key], t = g ? etToRome(g.date, g.status) : null;
  const three = (k === 'fg3m' || k === 'fg3a') ? (() => { const m = games.reduce((a, x) => a + x.fg3m, 0), a = games.reduce((s2, x) => s2 + x.fg3a, 0); return `<div>Triples<b>${m}/${a}</b></div><div>Acierto<b>${a ? dec(m / a * 100) + ' %' : '–'}</b></div>`; })() : `<div>Mediana<b>${dec(median(vals))}</b></div><div>Máx.<b>${vals.length ? Math.max(...vals) : '–'}</b></div>`;
  const items = games.map(x => ({ v: val(x, k), d1: fdate(x.d), d2: (x.home ? '' : '@') + x.opp, title: `${fdate(x.d)} ${x.home ? 'vs' : '@'} ${x.opp}: ${val(x, k)} en ${x.min} min` }));
  return `${topBar(p.name, true)}<div class="stack fade">
    <div class="card hero" style="--c2:${V.colors(p.team)[1]}">${V.playerBackdrop(p, FONDOS[p.id])}
      <div class="who"><div class="av team">${V.crest(p.team, 50, ANIM ? 'in' : '')}</div><div style="min-width:0"><div class="n">${esc(p.name)}</div><div class="mut sm">${p.team} · ${{ G: 'Base/escolta', F: 'Alero', C: 'Pívot' }[p.pos]}${g ? ` · ${g.home === p.team ? 'vs' : '@'} ${opp} · ${esc(t.time)}` : ''}</div><div class="spec"><i></i>${V.SPEC[V.specialty(p)] || ''}</div></div><div class="grade" title="Nota del duelo: % de L10 y defensa del rival">${gradeL}</div></div>
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
      <div class="pick" style="padding-top:0"><span class="sm mut">${o ? `Línea de hoy ${dec(o.line)}${o.over ? ' · más ' + dec(o.over, 2) : ''}${o.under ? ' · menos ' + dec(o.under, 2) : ''}` : 'Sin cuota cargada hoy: línea = mediana de L20'}${imp != null ? ` · La cuota le da <b>${pct(imp)}</b>, el histórico <b>${pct(ph)}</b>` : ''}</span>
        ${uLines[key] != null ? `<button class="linkb" data-act="reset-line">Usar la línea de hoy (${dec(autoLine(p, k))})</button>` : ''}${eo.src === 'tuya' ? `<button class="linkb" data-act="reset-odd">Usar la cuota de hoy</button>` : ''}
        <button class="btn ghost" data-act="add-player" style="margin-left:auto">+ Combinada</button></div>
      <div class="chartbox">${chart(items, line, { label: SK[k].n })}</div>
      <div class="pad" style="padding-top:0"><div class="note">Por encima de ${dec(line)} en <b class="hi">${h.o} de ${h.n}</b> partidos. Las barras ámbar superan la línea.</div></div>
    </div>
    <div class="wins">${WINS().map(([w, l]) => { const x = hit(windowGames(p, w, base), k, line), pp = sideP(x, side); return `<button class="win" data-win="${w}" aria-pressed="${S.win === w}"><small>${l}</small><b class="${pp >= .6 ? 'hi' : ''}">${pct(pp)}</b><span>${side === 'over' ? x.o : x.n - x.o}/${x.n}</span></button>`; }).join('')}</div>
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
    const edge = imp != null && p != null ? (p - imp) * 100 : null;
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
      const g = windowGames(p, win, p.log), line = getLine(p, k), h = hit(g, k, line), b = bestSide(h.p, key, line);
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
    <div class="card">${rows.length ? rows.map(r => r.type === 'p' ? `<button class="prow" data-open-p="${r.p.id}" data-open-k="${r.k}">
        <div style="min-width:0"><div class="nm">${esc(r.p.name)}</div><div class="mut xs">${r.p.team} · ${r.b.side === 'over' ? 'Más' : 'Menos'} de ${dec(r.line)} ${SK[r.k].l}${r.b.eo.v ? ' · ' + dec(r.b.eo.v, 2) : ''}</div></div>
        <div class="rt"><div class="pc ${r.b.p >= .6 ? 'hi' : ''}">${pct(r.b.p)}</div><div class="xs ${r.b.edge >= 3 ? 'ok' : r.b.edge <= -3 ? 'err' : 'mut'}">${r.b.edge != null ? (r.b.edge > 0 ? '+' : '') + dec(r.b.edge, 0) + ' valor' : '–'}</div></div>
        ${spark(r.spark, r.line)}</button>` : `<button class="prow" data-open-g="${esc(r.g.id)}" data-open-m="${r.m}" data-open-t="${r.tm === r.g.home ? 'home' : 'away'}">
        <div style="min-width:0"><div class="nm">${esc(marketLabel(r.g, r.m, r.tm, r.side, r.line))}</div><div class="mut xs">${r.g.away} @ ${r.g.home} · ${MARKET_N[r.m]}${r.ev.eo.v ? ' · ' + dec(r.ev.eo.v, 2) : ''}</div></div>
        <div class="rt"><div class="pc ${r.ev.pModel >= .6 ? 'hi' : ''}">${pct(r.ev.pModel)}</div><div class="xs ${r.ev.edge >= 3 ? 'ok' : r.ev.edge <= -3 ? 'err' : 'mut'}">${r.ev.edge != null ? (r.ev.edge > 0 ? '+' : '') + dec(r.ev.edge, 0) + ' valor' : '–'}</div></div></button>`).join('')
      : `<div class="empty"><b>Aún no hay cuotas cargadas hoy</b>${isAdmin ? 'Cárgalas en la pestaña Cuotas.' : 'El administrador las cargará antes de los partidos.'}</div>`}</div>
    ${legal()}</div>`;
}

/* ---------- vista: combinada ---------- */
function legEval(l) {
  if (l.type === 'p') { const p = D.players[l.pid]; if (!p) return null; const h = hit(windowGames(p, 'l10', p.log), l.stat, l.line); return { p: sideP(h, l.side), label: `${p.name} · ${l.side === 'over' ? 'más' : 'menos'} de ${dec(l.line)} ${SK[l.stat].l}`, src: 'L10' }; }
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
    ${oddsCredits ? `<div class="card pad row-between"><div><b>Cuotas automáticas</b><div class="note">Se actualizan solas a las 18:00 y a las 21:00. Las que pegues aquí tienen prioridad y el script no las toca.</div></div><div style="text-align:right"><b class="${oddsCredits.restantes < 60 ? 'err' : 'hi'}" style="font-size:20px">${oddsCredits.restantes ?? '–'}</b><div class="xs mut">créditos este mes</div></div></div>` : ''}
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
    if (ps) { cur = val(ps, l.stat); fin = lv.state === 'final'; txt = lv.text; }
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
function parseBox(j) {
  const gm = j.game, st = gm.gameStatus === 3 ? 'final' : gm.gameStatus === 2 ? 'live' : 'pre', players = {};
  for (const side of ['homeTeam', 'awayTeam']) for (const p of gm[side].players || []) {
    const o = {}; for (const [k, src] of Object.entries(LIVE_MAP)) o[k] = +(p.statistics?.[src] ?? 0);
    o.min = Math.round(parseFloat(String(p.statistics?.minutesCalculated || 'PT0M').replace(/[^\d.]/g, '')) || 0); players[String(p.personId)] = o;
  }
  return { state: st, text: st === 'final' ? 'Final' : st === 'pre' ? 'Aún no ha empezado' : gm.gameStatusText, home: { tri: gm.homeTeam.teamTricode, score: gm.homeTeam.score }, away: { tri: gm.awayTeam.teamTricode, score: gm.awayTeam.score }, players };
}
async function fetchBox(id) {
  const direct = `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${id}.json`;
  if (liveSource === 'direct') { try { const r = await fetch(direct, { cache: 'no-store' }); if (r.ok) return parseBox(await r.json()); if (r.status === 403 || r.status === 404) return null; } catch (e) { liveSource = 'proxy'; } }
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch(`${CFG.supabaseUrl}/functions/v1/nba-live?game=${encodeURIComponent(id)}`, { headers: { apikey: CFG.supabaseAnonKey, Authorization: 'Bearer ' + (session?.access_token || CFG.supabaseAnonKey) } });
  return r.ok ? parseBox(await r.json()) : null;
}
async function pollLive() {
  const ids = [...new Set(BETS.filter(b => !b.result).flatMap(b => b.legs.map(l => l.gameId)).filter(id => id && D.games.some(g => g.id === id)))];
  for (const id of ids) { if (LIVE[id]?.state === 'final') continue; try { const box = await fetchBox(id); if (box) LIVE[id] = box; } catch (e) {} }
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
    LIVE[g.id] = { state: 'live', text: '1.er cuarto · 12:00', home: { tri: g.home, score: 0 }, away: { tri: g.away, score: 0 }, players: Object.fromEntries(ps.map(p => [p.id, Object.fromEntries([...Object.keys(LIVE_MAP), 'min'].map(k => [k, 0]))])) };
    return { g, md, ps: ps.map(p => ({ p, r: per(p) })) }; });
  let minute = 0;
  simT = setInterval(() => {
    minute++;
    for (const { g, md, ps } of games) {
      const lv = LIVE[g.id]; const tracked = { [g.home]: 0, [g.away]: 0 };
      for (const { p, r } of ps) {
        if (R() > r.mpg / 48) continue;
        const s = lv.players[p.id]; s.min++;
        const thin = (n, q) => { let c = 0; for (let i = 0; i < n; i++) if (R() < q) c++; return c; }, a2r = Math.max(0, r.fga - r.fg3a);
        const a3 = pois(r.fg3a), m3 = thin(a3, r.fg3a ? r.fg3m / r.fg3a : 0), a2 = pois(a2r), m2 = thin(a2, a2r ? (r.fgm - r.fg3m) / a2r : 0), ta = pois(r.fta), tm = thin(ta, r.fta ? r.ftm / r.fta : 0);
        s.fg3a += a3; s.fg3m += m3; s.fga += a2 + a3; s.fgm += m2 + m3; s.fta += ta; s.ftm += tm; s.pts += 2 * m2 + 3 * m3 + tm;
        for (const k of ['reb', 'ast', 'stl', 'blk', 'tov']) s[k] += pois(r[k]);
        tracked[p.team] += 2 * m2 + 3 * m3 + tm;
      }
      for (const [side, exp] of [['home', md.eh], ['away', md.ea]]) {
        const tri = g[side], restRate = Math.max(.8, exp / 48 - ps.filter(x => x.p.team === tri).reduce((a, x) => a + x.r.pts * x.r.mpg / 48, 0));
        lv[side].score += tracked[tri] + pois(restRate);
      }
      if (minute >= 48 && lv.home.score === lv.away.score) lv.home.score += 1 + Math.floor(R() * 4);
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
  const s = betState(b), st = s.st, pay = b.stake * b.odd;
  const pill = st === 'won' ? `<span class="pill good">Ganada ${eurS(b.net ?? betNet(b, st))}</span>` : st === 'lost' ? `<span class="pill bad">Perdida ${eurS(-b.stake)}</span>` : st === 'void' ? '<span class="pill">Nula</span>' : s.legs.some(x => x.txt && x.txt !== 'Aún no ha empezado') ? '<span class="pill acc live">En juego</span>' : '<span class="pill">Pendiente</span>';
  const games = new Map(); b.legs.forEach((l, i) => { if (l.gameId && LIVE[l.gameId]) games.set(l.gameId, LIVE[l.gameId]); });
  return `<div class="bet ${st || 'open'}">
    <div class="bet-h"><div><b>${b.legs.length > 1 ? `Combinada · ${b.legs.length}` : 'Simple'}</b><div class="xs mut">${eur(b.stake)} a ${dec(b.odd, 2)} · cobra ${eur(pay)}</div></div>${pill}${!b.result && !b.seed ? `<button class="x" data-delbet="${esc(b.id)}" aria-label="Borrar apuesta">×</button>` : ''}</div>
    ${b.legs.map((l, i) => { const x = s.legs[i]; const c = x.st === 'won' ? 'good' : x.st === 'lost' ? 'bad' : '';
      let bar = '';
      if (x.cur != null && l.type !== 'x' && !(l.type === 'g' && (l.market === 'ml' || l.market === 'spread'))) { const tgt = l.line, f = Math.max(0, Math.min(1, x.cur / Math.max(tgt + .5, 1))); bar = `<div class="prog ${c}"><i style="width:${f * 100}%"></i><span class="tick" style="left:${Math.min(100, (tgt / Math.max(tgt + .5, 1)) * 100)}%"></span></div>`; }
      const now = x.cur == null ? '' : l.type === 'x' ? `${x.cur}` : (l.type === 'g' && (l.market === 'ml' || l.market === 'spread')) ? (x.score || '') : `${x.cur} / ${dec(l.line)}`;
      return `<div class="bleg ${c}"><div class="bl-t"><span class="dot"></span><span class="lbl">${esc(legLabel(l))}</span><b>${esc(now)}</b></div>${bar}${x.txt && l.type !== 'x' ? `<div class="xs mut">${esc(x.score && l.type === 'p' ? '' : '')}${esc(x.txt)}</div>` : ''}</div>`; }).join('')}
  </div>`;
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
    D = prepare(demo.data); ODDS = store.get('demo-odds', null) || demo.odds; isAdmin = true; Object.assign(FONDOS, store.get('fondos', {}));
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
  if (isAdmin) { const gc = await sb.from('ajustes').select('valor').eq('clave', 'codigo_grupo').maybeSingle(); groupCode = gc.data?.valor ?? null; }
  const gd = D.games[0]?.date || todayET();
  const [od, fd] = await Promise.all([sb.from('odds').select('*').eq('game_date', gd), sb.from('fondos').select('player_id,url')]);
  (fd.data || []).forEach(r => FONDOS[r.player_id] = r.url);
  const ap = await sb.from('apuestas').select('data').order('created_at', { ascending: true });
  BETS = (ap.data || []).map(r => r.data); S.calMonth = refDay().slice(0, 7);
  if (BETS.some(b => !b.result)) startLive();
  ODDS = {}; (od.data || []).forEach(r => ODDS[r.player_id + '|' + r.stat] = { line: r.line == null ? null : +r.line, over: r.over_odd == null ? null : +r.over_odd, under: r.under_odd == null ? null : +r.under_odd, src: r.fuente || 'manual', at: r.updated_at });
  if (isAdmin) { const cr = await sb.from('ajustes').select('valor').eq('clave', 'creditos_odds').maybeSingle(); try { oddsCredits = cr.data ? JSON.parse(cr.data.valor) : null; } catch (e) { oddsCredits = null; } }
  render();
}
boot().catch(err => { app.innerHTML = `<div class="shell"><div class="card empty" style="margin-top:20vh"><b>Algo ha fallado</b>${esc(err.message || err)}</div></div>`; });
})();
