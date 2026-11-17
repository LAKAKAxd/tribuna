/* Tribuna · directo desde la API pública de ESPN (deja leerla desde el navegador; NBA.com no).
   Convierte el marcador y el jugada a jugada de ESPN al mismo formato que usa la app,
   con los ids de jugador de NBA.com (se emparejan por nombre dentro de cada equipo). */
window.TRIBUNA_ESPN = (function () {
  const BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
  const TRI = { GS: 'GSW', NO: 'NOP', NY: 'NYK', SA: 'SAS', UTAH: 'UTA', WSH: 'WAS', PHO: 'PHX', BRK: 'BKN', CHO: 'CHA' };
  const tri = a => TRI[a] || a;
  const key = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, '').replace(/[^a-z]/g, '');
  const clockPT = c => { const m = /^(\d+):(\d+(?:\.\d+)?)$/.exec(String(c || '').trim()); if (m) return `PT${m[1]}M${m[2]}S`; const s = parseFloat(c); return isFinite(s) ? `PT0M${s}S` : 'PT0M0S'; };
  const clockMin = c => { const m = /PT(\d+)M([\d.]+)S/.exec(c || ''); return m ? +m[1] + +m[2] / 60 : 0; };
  const elapsed = (period, clock) => period <= 4 ? (period - 1) * 12 + 12 - clockMin(clock) : 48 + (period - 5) * 5 + 5 - clockMin(clock);
  const ord = n => n <= 4 ? `${n}.º cuarto` : `Prórroga${n > 5 ? ' ' + (n - 4) : ''}`;

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
    const state = st.type?.state === 'post' ? 'final' : st.type?.state === 'in' ? 'live' : 'pre';
    const period = st.period || 0, clock = clockPT(st.displayClock);
    const det = String(st.type?.shortDetail || st.type?.detail || '');
    let text = state === 'final' ? 'Final' : state === 'pre' ? 'Aún no ha empezado' : '';
    if (state === 'live') {
      if (/half/i.test(det)) text = 'Descanso';
      else if (/^end/i.test(det)) text = `Fin del ${ord(period)}`.replace('Fin del Prórroga', 'Fin de la prórroga');
      else text = `${ord(period)} · ${String(st.displayClock || '').replace(/\.\d+$/, '')}`;
    }
    const side = ha => { const c = (comp.competitors || []).find(x => x.homeAway === ha) || {};
      return { tri: tri(c.team?.abbreviation), score: +c.score || 0, periods: (c.linescores || []).map(x => +(x.displayValue ?? x.value) || 0) }; };
    const home = side('home'), away = side('away');
    // nombre -> id NBA, por equipo
    const byTeam = {}; for (const p of players) (byTeam[p.team] || (byTeam[p.team] = {}))[key(p.name)] = String(p.id);
    const all = {}; for (const p of players) all[key(p.name)] = String(p.id);
    const idOf = {};   // id ESPN -> id NBA (o 'e' + id ESPN si no se encuentra)
    const map = (eid, name, team) => idOf[eid] || (idOf[eid] = byTeam[team]?.[key(name)] || all[key(name)] || 'e' + eid);
    const out = {};
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
    return { box: { state, text, t: tNow, home, away, players: out, src: 'espn' }, pbp: ser };
  }

  async function live({ date, home, away, team, players }) {
    const id = await findEvent(date, home, away, team); if (!id) return null;
    return parseSummary(await getJSON(`${BASE}/summary?event=${id}`), players);
  }
  return { live, parseSummary, findEvent, tri };
})();
