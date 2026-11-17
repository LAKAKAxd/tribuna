/* Tribuna · escudos animados y fondos de jugador.
   Todo lo visual que se puede cambiar está aquí y en config.js:
   - Escudos: por defecto, escudos propios con los colores del equipo (se pueden publicar).
     Con logosOficiales:true en config.js se usan los logos de la NBA (solo para uso privado).
   - Fondo del jugador: si hay un GIF/MP4 asignado (config.js o el panel de admin) se muestra
     difuminado; si no, una animación propia según su especialidad (tirador, director, pintura, anotador). */
window.TRIBUNA_VISUAL = (function () {
  const CFG = window.TRIBUNA_CONFIG || {};
  const T = { // colores principales y secundarios, id NBA
    ATL: ['#C8102E', '#FDB927', 1610612737], BOS: ['#007A33', '#BA9653', 1610612738], BKN: ['#2a2a2a', '#bfbfbf', 1610612751],
    CHA: ['#1D1160', '#00788C', 1610612766], CHI: ['#CE1141', '#1a1a1a', 1610612741], CLE: ['#860038', '#FDBB30', 1610612739],
    DAL: ['#00538C', '#B8C4CA', 1610612742], DEN: ['#0E2240', '#FEC524', 1610612743], DET: ['#C8102E', '#1D42BA', 1610612765],
    GSW: ['#1D428A', '#FFC72C', 1610612744], HOU: ['#CE1141', '#C4CED4', 1610612745], IND: ['#002D62', '#FDBB30', 1610612754],
    LAC: ['#C8102E', '#1D428A', 1610612746], LAL: ['#552583', '#FDB927', 1610612747], MEM: ['#5D76A9', '#12173F', 1610612763],
    MIA: ['#98002E', '#F9A01B', 1610612748], MIL: ['#00471B', '#EEE1C6', 1610612749], MIN: ['#0C2340', '#78BE20', 1610612750],
    NOP: ['#0C2340', '#C8102E', 1610612740], NYK: ['#006BB6', '#F58426', 1610612752], OKC: ['#007AC1', '#EF3B24', 1610612760],
    ORL: ['#0077C0', '#C4CED4', 1610612753], PHI: ['#006BB6', '#ED174C', 1610612755], PHX: ['#1D1160', '#E56020', 1610612756],
    POR: ['#E03A3E', '#1a1a1a', 1610612757], SAC: ['#5A2D81', '#63727A', 1610612758], SAS: ['#3a4246', '#C4CED4', 1610612759],
    TOR: ['#CE1141', '#A1A1A4', 1610612761], UTA: ['#002B5C', '#F9A01B', 1610612762], WAS: ['#002B5C', '#E31837', 1610612764],
  };
  const col = t => T[t] || ['#3a4558', '#ffb84d', 0];
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let uid = 0;

  /* Escudo propio: forma de escudo con degradado del color del equipo, borde del secundario,
     siglas y un brillo que cruza una vez al entrar. */
  function crest(team, size = 64, cls = '') {
    const [c1, c2, id] = col(team), k = 'cr' + (++uid);
    if (CFG.logosOficiales && id) {
      // Dos versiones del logo oficial: «D» para fondo oscuro y «L» para fondo claro; el CSS enseña la que toca.
      const u = v => `https://cdn.nba.com/logos/nba/${id}/global/${v}/logo.svg`;
      return `<span class="crest logo ${cls}" style="--s:${size}px;--c1:${c1};--c2:${c2}"><img class="lgD" src="${u('D')}" alt="${esc(team)}" width="${size}" height="${size}" loading="lazy" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${u('L')}'}else{this.parentNode.outerHTML=window.TRIBUNA_VISUAL.crestSvg('${esc(team)}',${size},'${cls}')}"><img class="lgL" src="${u('L')}" alt="" aria-hidden="true" width="${size}" height="${size}" loading="lazy" onerror="this.remove()"></span>`;
    }
    return crestSvg(team, size, cls, k);
  }
  function crestSvg(team, size = 64, cls = '', k = 'cr' + (++uid)) {
    const [c1, c2] = col(team);
    const shield = 'M50 4 L90 16 V52 C90 76 72 92 50 100 C28 92 10 76 10 52 V16 Z';
    return `<span class="crest ${cls}" style="--s:${size}px;--c1:${c1};--c2:${c2}"><svg viewBox="0 0 100 104" width="${size}" height="${size * 1.04}" role="img" aria-label="${esc(team)}">
      <defs><linearGradient id="${k}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c1}" stop-opacity=".72"/></linearGradient>
      <clipPath id="${k}c"><path d="${shield}"/></clipPath>
      <linearGradient id="${k}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      <path d="${shield}" fill="url(#${k}g)" stroke="${c2}" stroke-width="5" stroke-linejoin="round"/>
      <g clip-path="url(#${k}c)"><path d="M10 70 Q50 58 90 70" stroke="${c2}" stroke-width="3" fill="none" opacity=".55"/><circle cx="50" cy="104" r="26" fill="none" stroke="${c2}" stroke-width="3" opacity=".4"/>
        <rect class="shine" x="-60" y="-10" width="40" height="130" fill="url(#${k}s)" transform="skewX(-18)"/></g>
      <text x="50" y="${team.length > 3 ? 54 : 55}" text-anchor="middle" font-family="Inter Tight, system-ui, sans-serif" font-weight="800" font-size="${team.length > 3 ? 22 : 27}" fill="#fff" letter-spacing=".5">${esc(team)}</text></svg></span>`;
  }

  /* Especialidad a partir de sus estadísticas recientes (por 36 minutos). */
  const SPEC = { tirador: 'Tirador de triples', director: 'Director de juego', pintura: 'Dominio de la pintura', anotador: 'Anotador desde el bote' };
  function specialty(p) {
    const L = p.log.slice(-25); if (!L.length) return 'anotador';
    const m = L.reduce((a, g) => a + g.min, 0) || 1, per = k => L.reduce((a, g) => a + g[k], 0) / m * 36;
    if (CFG.especialidades && CFG.especialidades[p.id]) return CFG.especialidades[p.id];
    if (per('fg3a') >= 8.5) return 'tirador';
    if (per('ast') >= 7) return 'director';
    if (per('reb') >= 9.5 || per('blk') >= 1.8) return 'pintura';
    if (per('fg3a') >= 6.5) return 'tirador';
    return 'anotador';
  }

  /* Animaciones propias (SVG), dibujadas como una pizarra táctica. Se difuminan con CSS. */
  function motif(kind, c1, c2) {
    const hoop = `<g stroke="currentColor" fill="none" stroke-width="2.5" opacity=".9"><path d="M372 30 V74"/><path d="M352 52 h20"/><ellipse cx="340" cy="54" rx="13" ry="4"/></g>
      <path d="M400 140 V0" stroke="currentColor" opacity=".25"/><path d="M400 6 A150 150 0 0 0 400 134" stroke="currentColor" fill="none" stroke-dasharray="4 7" opacity=".35"/>`;
    const ball = (path, dur, begin, r = 7) => `<g><circle r="${r}" fill="${c2}"><animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" path="${path}" keyPoints="0;1;1" keyTimes="0;.7;1" calcMode="linear"/>
      <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.05;.62;.7;1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></circle></g>`;
    const trail = (path, dur, begin) => `<path d="${path}" stroke="${c2}" stroke-width="2" fill="none" stroke-dasharray="3 6" pathLength="100" opacity="0">
      <animate attributeName="opacity" values="0;.6;0" keyTimes="0;.5;1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></path>`;
    const swish = (dur, begin, at = .7) => `<ellipse cx="340" cy="54" rx="13" ry="4" fill="none" stroke="${c2}" stroke-width="2" opacity="0">
      <animate attributeName="rx" values="13;13;30" keyTimes="0;${at};1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
      <animate attributeName="ry" values="4;4;10" keyTimes="0;${at};1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;0;.9;0" keyTimes="0;${at - .01};${at};1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></ellipse>`;
    let body = '';
    if (kind === 'tirador') {
      const shots = [['M196 118 Q268 -40 340 50', 0], ['M210 30 Q280 -50 340 50', 1.1], ['M232 132 Q290 -20 340 50', 2.2]];
      body = shots.map(([p, b]) => trail(p, 3.3, b) + ball(p, 3.3, b) + swish(3.3, b)).join('') +
        `<g fill="currentColor" opacity=".5"><circle cx="196" cy="118" r="3"/><circle cx="210" cy="30" r="3"/><circle cx="232" cy="132" r="3"/></g>`;
    } else if (kind === 'director') {
      const pts = [[70, 70], [150, 28], [190, 112], [270, 40], [300, 104]];
      const path = 'M' + pts.map(p => p.join(' ')).join(' L') + ' L340 50';
      body = pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="none" stroke="currentColor" stroke-width="2" opacity=".55"/>`).join('') +
        `<path d="${path}" stroke="${c2}" stroke-width="2" fill="none" stroke-dasharray="400" stroke-dashoffset="400"><animate attributeName="stroke-dashoffset" values="400;0;0" keyTimes="0;.7;1" dur="4s" repeatCount="indefinite"/></path>` +
        ball(path, 4, 0) + swish(4, 0);
    } else if (kind === 'pintura') {
      const path = 'M250 128 Q300 120 330 20 Q336 40 340 56';
      body = trail(path, 2.6, 0) + ball(path, 2.6, 0, 8) +
        [0, .15, .3].map(d => `<circle cx="340" cy="56" r="6" fill="none" stroke="${c2}" stroke-width="2" opacity="0"><animate attributeName="r" values="6;6;42" keyTimes="0;.7;1" dur="2.6s" begin="${d}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0;.8;0" keyTimes="0;.69;.7;1" dur="2.6s" begin="${d}s" repeatCount="indefinite"/></circle>`).join('') +
        `<path d="M300 120 L340 120" stroke="currentColor" opacity=".3"/>`;
    } else { // anotador: bote, cambio de dirección, paso atrás y tiro
      const path = 'M40 112 L110 84 L86 62 L170 74 L150 92 Q250 -30 340 50';
      body = `<path d="M40 112 L110 84 L86 62 L170 74 L150 92" stroke="currentColor" stroke-width="2" fill="none" opacity=".45" stroke-dasharray="2 6"/>` +
        trail(path, 3.6, 0) + ball(path, 3.6, 0) + swish(3.6, 0) +
        `<g fill="none" stroke="${c2}" stroke-width="2" opacity=".7"><path d="M150 92 l-12 -4 M150 92 l-6 10"/></g>`;
    }
    return `<svg class="motif" viewBox="0 0 400 140" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" style="color:${c1}">${hoop}${body}</svg>`;
  }

  /* Capa de fondo de la ficha de jugador. url puede ser GIF, WEBP, PNG o MP4/WEBM. */
  function playerBackdrop(p, url) {
    const [c1, c2] = col(p.team);
    let media;
    if (url && /\.(mp4|webm|mov)(\?|#|$)/i.test(url)) media = `<video class="clip" src="${esc(url)}" autoplay muted loop playsinline aria-hidden="true"></video>`;
    else if (url) media = `<img class="clip" src="${esc(url)}" alt="" aria-hidden="true">`;
    else media = motif(specialty(p), c1, c2);
    return `<div class="backdrop" style="--c1:${c1};--c2:${c2}">${media}</div>`;
  }

  return { crest, crestSvg, specialty, SPEC, playerBackdrop, colors: col };
})();
