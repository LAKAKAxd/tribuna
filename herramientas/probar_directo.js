// Prueba el directo de ESPN con los partidos de hoy: node herramientas/probar_directo.js [ruta a nba.json]
// Solo lee; no cambia nada.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { window: {}, fetch, console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'app', 'espn.js'), 'utf8'), ctx);
const E = ctx.window.TRIBUNA_ESPN;
const raw = JSON.parse(fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'nba.json'), 'utf8'));
const players = Object.entries(raw.players).map(([id, p]) => ({ id, name: p.name, team: p.team }));
(async () => {
  for (const g of raw.games || []) {
    try {
      const r = await E.live({ date: g.date, home: g.home, away: g.away, players });
      if (!r) { console.log(g.id, g.away, '@', g.home, '-> no encontrado en ESPN'); continue; }
      const b = r.box, ps = Object.entries(b.players), sinId = ps.filter(([k]) => k.startsWith('e'));
      console.log(`${g.id} ${b.away.tri} ${b.away.score} - ${b.home.score} ${b.home.tri} | ${b.text} | cuartos ${b.away.periods.join(',')} / ${b.home.periods.join(',')} | jugadores ${ps.length}, sin emparejar ${sinId.length}${sinId.length ? ' (' + sinId.map(([, x]) => x.nm).join(', ') + ')' : ''}`);
      const top = ps.filter(([, x]) => x.pl).sort((a, c) => c[1].pts - a[1].pts).slice(0, 3);
      for (const [pid, x] of top) { const s = r.pbp[pid] || []; const last = s[s.length - 1] || {};
        console.log(`   ${x.nm} (${pid}): ${x.pts} pts ${x.reb} reb ${x.ast} ast ${x.fg3m} tri ${x.min} min | jugada a jugada: ${s.length} puntos, termina en ${last.pts} pts ${last.reb} reb ${last.ast} ast`); }
    } catch (e) { console.log(g.id, 'ERROR', e.message); }
  }
})();
