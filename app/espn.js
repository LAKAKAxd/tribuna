/* Tribuna · directo desde la API pública de ESPN (deja leerla desde el navegador; NBA.com no).
   Convierte el marcador y el jugada a jugada de ESPN al mismo formato que usa la app,
   con los ids de jugador de NBA.com o de nflverse (se emparejan por nombre dentro de cada equipo). */
window.TRIBUNA_ESPN = (function () {
  const NFL = window.TRIBUNA_LIGA === 'nfl';
  const BASE = 'https://site.api.espn.com/apis/site/v2/sports/' + (NFL ? 'football/nfl' : 'basketball/nba');
  const TRI = NFL ? { WSH: 'WAS', LAR: 'LA' } : { GS: 'GSW', NO: 'NOP', NY: 'NYK', SA: 'SAS', UTAH: 'UTA', WSH: 'WAS', PHO: 'PHX', BRK: 'BKN', CHO: 'CHA' };
  const QL = NFL ? 15 : 12, OTL = NFL ? 10 : 5;   // minutos de cada cuarto y de la prórroga
  const tri = a => TRI[a] || a;
  const key = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, '').replace(/[^a-z]/g, '');
  const clockPT = c => { const m = /^(\d+):(\d+(?:\.\d+)?)$/.exec(String(c || '').trim()); if (m) return `PT${m[1]}M${m[2]}S`; const s = parseFloat(c); return isFinite(s) ? `PT0M${s}S` : 'PT0M0S'; };
  const clockMin = c => { const m = /PT(\d+)M([\d.]+)S/.exec(c || ''); return m ? +m[1] + +m[2] / 60 : 0; };
  const elapsed = (period, clock) => period <= 4 ? (period - 1) * QL + QL - clockMin(clock) : 4 * QL + (period - 5) * OTL + OTL - clockMin(clock);
  const ord = n => n <= 4 ? `${n}.º cuarto` : `Prórroga${n > 5 ? ' ' + (n - 4) : ''}`;

  /* Estado del partido a partir del bloque status de ESPN. */
  function status(st) {
    st = st || {};
    const state = st.type?.state === 'post' ? 'final' : st.type?.state === 'in' ? 'live' : 'pre';
    const period = st.period || 0, clock = String(st.displayClock || '').replace(/\.\d+$/, ''), det = String(st.type?.shortDetail || st.type?.detail || '');
    let q = '', cl = '', text = state === 'final' ? 'Final' : state === 'pre' ? 'Aún no ha empezado' : '';
    if (state === 'live') {
      q = ord(period);
      if (/half/i.test(det)) { q = 'Descanso'; text = 'Descanso'; }
      else if (/^end/i.test(det)) { q = `Fin ${period <= 4 ? 'del ' + period + '.º' : 'de la prórroga'}`; text = q; }
      else { cl = clock; text = `${q} · ${clock}`; }
    }
    return { state, period, clock: clockPT(st.displayClock), q, cl, text };
  }
  async function getJSON(url) { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error('ESPN ' + r.status); return r.json(); }

  /* Busca el partido de ESPN de esa fecha (YYYY-MM-DD, hora de EE. UU.) con esos equipos. */
  const idCache = {};
  async function findEvent(date, home, away, team) {
    const ck = [date, home, away, team].join('|'); if (idCache[ck]) return idCache[ck];
    const j = await getJSON(`${BASE}/scoreboard?dates=${String(date).replace(/-/g, '')}`);
    for (const ev of j.events || []) {
      const cs = ev.competitions?.[0]?.competitors || [];
      const h = tri(cs.find(c => c.homeAway === 'home')?.team?.abbreviation), a = tri(cs.find(c => c.homeAway === 'away')?.team?.abbreviation);
      if ((home && away && h === home && a === away) || (team && (h === team || a === team))) return (idCache[ck] = ev.id);
    }
    return null;
  }

  /* players: lista de { id, name, team } de la app para emparejar nombres. */
  function parseSummary(j, players) {
    const comp = j.header?.competitions?.[0] || {}, st = comp.status || j.status || {};
    const { state, period, clock, q, cl, text } = status(st);
    const side = ha => { const c = (comp.competitors || []).find(x => x.homeAway === ha) || {};
      return { tri: tri(c.team?.abbreviation), score: +c.score || 0, periods: (c.linescores || []).map(x => +(x.displayValue ?? x.value) || 0) }; };
    const home = side('home'), away = side('away');
    // nombre -> id NBA, por equipo
    const byTeam = {}; for (const p of players) (byTeam[p.team] || (byTeam[p.team] = {}))[key(p.name)] = String(p.id);
    const all = {}; for (const p of players) all[key(p.name)] = String(p.id);
    const idOf = {};   // id ESPN -> id NBA (o 'e' + id ESPN si no se encuentra)
    const map = (eid, name, team) => idOf[eid] || (idOf[eid] = byTeam[team]?.[key(name)] || all[key(name)] || 'e' + eid);
    const out = {};
    if (NFL) return { box: { state, text, q, cl, t: state === 'live' ? elapsed(period || 1, clock) : state === 'final' ? 60 : 0, home, away, players: nflBox(j, map), src: 'espn' }, pbp: {} };
    for (const t of j.boxscore?.players || []) {
      const tm = tri(t.team?.abbreviation);
      for (const grp of t.statistics || []) {
        const lab = (grp.labels || grp.names || []).map(s => String(s).toUpperCase()), ks = grp.keys || [];
        const at = (stats, l, k) => { let i = lab.indexOf(l); if (i < 0 && k) i = ks.indexOf(k); return i < 0 ? null : stats[i]; };
        const pair = s => { const m = /^(\d+)-(\d+)$/.exec(String(s || '')); return m ? [+m[1], +m[2]] : [0, 0]; };
        for (const a of grp.athletes || []) {
          const s = a.stats || [], ath = a.athlete || {};
          const [fgm, fga] = pair(at(s, 'FG', 'fieldGoalsMade-fieldGoalsAttempted')), [fg3m, fg3a] = pair(at(s, '3PT', 'threePointFieldGoalsMade-threePointFieldGoalsAttempted')), [ftm, fta] = pair(at(s, 'FT', 'freeThrowsMade-freeThrowsAttempted'));
          const n = (l, k) => +(at(s, l, k) || 0) || 0, min = n('MIN', 'minutes');
          out[map(ath.id, ath.displayName, tm)] = { pts: n('PTS', 'points'), reb: n('REB', 'rebounds'), ast: n('AST', 'assists'), stl: n('STL', 'steals'), blk: n('BLK', 'blocks'), tov: n('TO', 'turnovers'),
            fgm, fga, fg3m, fg3a, ftm, fta, min, nm: ath.shortName || ath.displayName || '', tm, on: false, pl: !a.didNotPlay && (min > 0 || s.length > 0) };
        }
      }
    }
    // jugada a jugada -> evolución de cada jugador
    const zero = () => ({ t: 0, pts: 0, reb: 0, ast: 0, fg3m: 0, fg3a: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, stl: 0, blk: 0, tov: 0 });
    const cur = {}, ser = {}, teamOf = {};
    for (const [pid, x] of Object.entries(out)) teamOf[pid] = x.tm;
    const get = pid => cur[pid] || (cur[pid] = zero());
    const push = (pid, t) => (ser[pid] || (ser[pid] = [zero()])).push({ ...cur[pid], t });
    const eidToPid = eid => idOf[eid] || null;
    for (const p of j.plays || []) {
      const t = elapsed(p.period?.number || 1, clockPT(p.clock?.displayValue)), txt = String(p.text || ''), ty = String(p.type?.text || '');
      const ids = (p.participants || []).map(x => eidToPid(x.athlete?.id)).filter(Boolean);
      if (!ids.length) continue;
      const a = ids[0];
      if (p.scoringPlay && p.scoreValue) {
        const x = get(a); x.pts += +p.scoreValue;
        if (/free throw/i.test(ty + ' ' + txt)) { x.ftm++; x.fta++; } else { x.fgm++; x.fga++; if (+p.scoreValue === 3) { x.fg3m++; x.fg3a++; } }
        push(a, t);
        if (ids[1] && /assist/i.test(txt)) { get(ids[1]).ast++; push(ids[1], t); }
      } else if (/rebound/i.test(ty)) { get(a).reb++; push(a, t); }
      else if (/free throw/i.test(ty) && /miss/i.test(txt)) { get(a).fta++; push(a, t); }
      else if (/shot|jumper|layup|dunk|hook|tip/i.test(ty + ' ' + txt) && /miss/i.test(txt)) { const x = get(a); x.fga++; if (/three point|3-pt/i.test(txt)) x.fg3a++; push(a, t);
        if (ids[1] && /block/i.test(txt)) { get(ids[1]).blk++; push(ids[1], t); } }
      else if (/turnover/i.test(ty)) { get(a).tov++; push(a, t); if (ids[1] && /steal/i.test(txt)) { get(ids[1]).stl++; push(ids[1], t); } }
    }
    const tNow = state === 'live' ? elapsed(period || 1, clock) : state === 'final' ? Math.max(48, elapsed(period || 4, 'PT0M0S')) : 0;
    return { box: { state, text, q, cl, t: tNow, home, away, players: out, src: 'espn' }, pbp: ser };
  }

  /* NFL: une las tablas de pase, carrera y recepción de cada jugador en una sola fila. */
  function nflBox(j, map) {
    const out = {}, zero = () => ({ cmp: 0, att: 0, pyd: 0, ptd: 0, int: 0, car: 0, ryd: 0, rtd: 0, tgt: 0, rec: 0, reyd: 0, retd: 0, min: 0 });
    const COLS = { passing: { 'C/ATT': 'c/att', YDS: 'pyd', TD: 'ptd', INT: 'int' }, rushing: { CAR: 'car', YDS: 'ryd', TD: 'rtd' }, receiving: { REC: 'rec', YDS: 'reyd', TD: 'retd', TGTS: 'tgt' } };
    for (const t of j.boxscore?.players || []) {
      const tm = tri(t.team?.abbreviation);
      for (const grp of t.statistics || []) {
        const cols = COLS[grp.name]; if (!cols) continue;
        const lab = (grp.labels || []).map(x => String(x).toUpperCase());
        for (const a of grp.athletes || []) {
          const ath = a.athlete || {}, id = map(ath.id, ath.displayName, tm), o = out[id] || (out[id] = { ...zero(), nm: ath.shortName || ath.displayName || '', tm, on: false, pl: true });
          lab.forEach((l, i) => { const k = cols[l], v = (a.stats || [])[i]; if (!k) return;
            if (k === 'c/att') { const m = /^(\d+)\/(\d+)$/.exec(String(v || '')); if (m) { o.cmp = +m[1]; o.att = +m[2]; } }
            else o[k] = +v || 0; });
          o.min = o.att + o.car + o.tgt;
        }
      }
    }
    return out;
  }

  /* Marcador de todos los partidos de una fecha con una sola consulta: clave 'AWAY@HOME'. */
  async function scoreboard(date) {
    const j = await getJSON(`${BASE}/scoreboard?dates=${String(date).replace(/-/g, '')}`), out = {};
    for (const ev of j.events || []) {
      const c = ev.competitions?.[0] || {}, cs = c.competitors || [], H = cs.find(x => x.homeAway === 'home') || {}, A = cs.find(x => x.homeAway === 'away') || {};
      const h = tri(H.team?.abbreviation), a = tri(A.team?.abbreviation), s = status(c.status || ev.status);
      out[a + '@' + h] = { ...s, home: { tri: h, score: +H.score || 0 }, away: { tri: a, score: +A.score || 0 } };
    }
    return out;
  }
  /* Partidos programados de una fecha (calendario de la semana). */
  async function schedule(date) {
    const j = await getJSON(`${BASE}/scoreboard?dates=${String(date).replace(/-/g, '')}`);
    return (j.events || []).map(ev => {
      const c = ev.competitions?.[0] || {}, cs = c.competitors || [], H = cs.find(x => x.homeAway === 'home') || {}, A = cs.find(x => x.homeAway === 'away') || {};
      return { id: 'espn:' + ev.id, date, start: ev.date, home: tri(H.team?.abbreviation), away: tri(A.team?.abbreviation), status: '', future: true,
        live: { ...status(c.status || ev.status), home: { tri: tri(H.team?.abbreviation), score: +H.score || 0 }, away: { tri: tri(A.team?.abbreviation), score: +A.score || 0 } } };
    }).filter(g => g.home && g.away).sort((a, b) => a.start < b.start ? -1 : 1);
  }
  async function live({ date, home, away, team, players }) {
    const id = await findEvent(date, home, away, team); if (!id) return null;
    return parseSummary(await getJSON(`${BASE}/summary?event=${id}`), players);
  }
  return { live, scoreboard, schedule, parseSummary, findEvent, tri };
})();
