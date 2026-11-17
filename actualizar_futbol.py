"""
Descarga diaria de fútbol para Tribuna (gratis, sin clave: API pública de ESPN).

Competiciones: Serie A, LaLiga, Premier League, Champions League y Nations League (temporada actual y anterior).
Cada jugador guarda su club («team») y, si ha jugado con ella, su selección («nat»).
Para medir bien a los equipos de Champions de otras ligas se bajan también los resultados
(sin jugadores) de Bundesliga, Ligue 1, Portugal, Países Bajos, Bélgica, Turquía y Escocia.

Qué hace:
  1. Calendario y resultados mes a mes de cada competición.
  2. Estadísticas de cada jugador en cada partido terminado de las 4 competiciones (goles,
     asistencias, tiros, tiros a puerta, faltas, tarjetas, paradas y minutos). Se guardan en
     futbol_cache.json: solo la primera vez se bajan las dos temporadas enteras.
     También las de cada equipo (córners, tarjetas, tiros, faltas, fueras de juego, posesión, pases...).
  3. Partidos de los próximos 7 días.
  4. Guarda futbol.json (mismo formato que nba.json) y, con --subir, lo sube a Supabase (snapshots, id 'futbol').

Uso:
  py actualizar_futbol.py            # la primera vez tarda unos 10-15 minutos
  py actualizar_futbol.py --subir
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from actualizar_nba import cargar_config

CARPETA = os.path.dirname(os.path.abspath(__file__))
ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer"
COMPS = {"ita.1": "Serie A", "esp.1": "LaLiga", "eng.1": "Premier", "uefa.champions": "Champions", "uefa.nations": "Nations League"}
# Solo resultados: ligas para medir a los rivales de Champions y partidos de selecciones para medir a las de la Nations League.
EXTRA = ["ger.1", "fra.1", "por.1", "ned.1", "bel.1", "tur.1", "sco.1", "fifa.worldq.uefa", "fifa.friendly", "fifa.world"]
SELECCIONES = {"uefa.nations", "fifa.worldq.uefa", "fifa.friendly", "fifa.world"}
CACHE = os.path.join(CARPETA, "futbol_cache.json")

# Por partido de un jugador. min = minutos jugados (90 si fue titular y no salió).
LOG_COLS = ["date", "opp", "home", "min", "g", "a", "sh", "sot", "fc", "yc", "rc", "sv", "season", "comp"]
# Estadísticas de equipo por partido (ESPN boxscore). Cada una va en pareja: la del equipo y la del rival (_a).
# ht = goles al descanso, cor = córners, off = fueras de juego, pos = posesión %, pas = pases, pp = % de pases buenos.
# Faltas recibidas = fc_a. ESPN no da saques de banda, de puerta ni tiros libres.
EQ_STATS = {"sh": "totalShots", "sot": "shotsOnTarget", "cor": "wonCorners", "fc": "foulsCommitted", "yc": "yellowCards",
            "rc": "redCards", "off": "offsides", "sv": "saves", "pos": "possessionPct", "pas": "totalPasses",
            "pp": "passPct", "tk": "totalTackles", "ht": None}
TEAM_COLS = ["date", "opp", "home", "pts", "opp_pts", "season", "comp"] + [k + suf for k in EQ_STATS for suf in ("", "_a")]


def http():
    import requests
    s = requests.Session()
    s.headers["Accept-Encoding"] = "gzip"
    return s


S = None


def get(url: str, intentos: int = 4):
    global S
    S = S or http()
    for i in range(intentos):
        try:
            r = S.get(url, timeout=30)
            if r.status_code == 200:
                return r.json()
            if r.status_code in (400, 404):
                return None
        except Exception as e:   # noqa: BLE001
            if i == intentos - 1:
                raise
            print(f"  Reintento tras error: {e}", file=sys.stderr)
        time.sleep(1.5 * (i + 1))
    return None


def temporadas(hoy: datetime) -> tuple[int, int]:
    """La temporada empieza en agosto: en nov-2026 la actual es la que empezó en 2026."""
    y = hoy.year if hoy.month >= 7 else hoy.year - 1
    return y, y - 1


def meses(inicio: int) -> list[str]:
    return [f"{inicio}{m:02d}" for m in range(7, 13)] + [f"{inicio + 1}{m:02d}" for m in range(1, 7)]


def pos_corta(p: str) -> str:
    p = (p or "").upper()
    if p in ("G", "GK"):
        return "G"
    if p.startswith(("CD", "CB", "LB", "RB", "LWB", "RWB", "D", "SW")):
        return "D"
    if p.startswith(("CF", "ST", "F", "LW", "RW", "LF", "RF", "SS")):
        return "F"
    if p in ("SUB", ""):
        return ""
    return "M"


def eventos(slug: str, inicio: int) -> list[dict]:
    """Todos los partidos de una competición en una temporada (pidiendo mes a mes)."""
    out = []
    for m in meses(inicio):
        j = get(f"{ESPN}/{slug}/scoreboard?dates={m}") or {}
        for ev in j.get("events") or []:
            c = (ev.get("competitions") or [{}])[0]
            cs = c.get("competitors") or []
            H = next((x for x in cs if x.get("homeAway") == "home"), None)
            A = next((x for x in cs if x.get("homeAway") == "away"), None)
            if not H or not A:
                continue
            st = (c.get("status") or ev.get("status") or {}).get("type") or {}
            out.append({"id": ev["id"], "comp": slug, "season": str(inicio), "start": ev.get("date"),
                        "state": st.get("state"), "completed": bool(st.get("completed")),
                        "home": H["team"], "away": A["team"],
                        "hs": int(H.get("score") or 0), "as": int(A.get("score") or 0)})
        time.sleep(.2)
    return out


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def leer_equipos(j: dict) -> dict:
    """{'home': {sh, sot, cor, ...}, 'away': {...}} del resumen de ESPN."""
    out = {}
    for t in (j.get("boxscore") or {}).get("teams") or []:
        st = {x.get("name"): num(x.get("displayValue")) for x in t.get("statistics") or []}
        fila = {k: st.get(v) for k, v in EQ_STATS.items() if v}
        if fila.get("pp") is not None:   # ESPN redondea passPct a 1 decimal: mejor buenos / totales
            ok, tot = st.get("accuratePasses"), st.get("totalPasses")
            fila["pp"] = round(100 * ok / tot) if ok is not None and tot else None
        out[t.get("homeAway")] = fila
    for c in ((j.get("header") or {}).get("competitions") or [{}])[0].get("competitors") or []:
        ls = c.get("linescores") or []
        if c.get("homeAway") in out and ls:
            out[c["homeAway"]]["ht"] = num(ls[0].get("displayValue"))
    return out if len(out) == 2 else {}


def leer_partido(slug: str, ev_id: str) -> dict | None:
    """Partido terminado: {'p': [jugadores: {id, name, team_id, pos, min, g, a, sh, sot, fc, yc, rc, sv, home}], 't': equipos}."""
    j = get(f"{ESPN}/{slug}/summary?event={ev_id}")
    if not j:
        return None
    entra, sale = {}, {}
    for k in j.get("keyEvents") or []:
        if (k.get("type") or {}).get("type") != "substitution":
            continue
        try:
            minuto = int(float((k.get("clock") or {}).get("value") or 0) // 60)
        except ValueError:
            minuto = 60
        ps = [p.get("athlete", {}).get("id") for p in k.get("participants") or []]
        if len(ps) >= 2:
            entra[ps[0]] = minuto
            sale[ps[1]] = minuto
    out = []
    for t in j.get("rosters") or []:
        tid, home = (t.get("team") or {}).get("id"), t.get("homeAway") == "home"
        for p in t.get("roster") or []:
            ath = p.get("athlete") or {}
            st = {s.get("name"): s.get("value") or 0 for s in p.get("stats") or []}
            aid = ath.get("id")
            if p.get("starter"):
                minutos = sale.get(aid, 90) if p.get("subbedOut") else 90
            elif p.get("subbedIn"):
                minutos = max(1, 90 - entra.get(aid, 70))
            else:
                continue                      # no jugó
            n = lambda k: int(st.get(k) or 0)   # noqa: E731
            out.append({"id": aid, "name": ath.get("displayName") or "", "team_id": tid, "home": home,
                        "pos": pos_corta((p.get("position") or {}).get("abbreviation")), "min": minutos,
                        "g": n("totalGoals"), "a": n("goalAssists"), "sh": n("totalShots"), "sot": n("shotsOnTarget"),
                        "fc": n("foulsCommitted"), "yc": n("yellowCards"), "rc": n("redCards"), "sv": n("saves")})
    return {"p": out, "t": leer_equipos(j)}


def construir(hoy: datetime) -> dict:
    actual, anterior = temporadas(hoy)
    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    cache = {k: v for k, v in cache.items() if isinstance(v, dict)}   # formato viejo (solo jugadores): se baja otra vez
    todos = []
    for slug in list(COMPS) + EXTRA:
        for ini in (anterior, actual):
            print(f"Calendario {slug} {ini}-{ini + 1}…")
            todos += eventos(slug, ini)

    # Siglas únicas por equipo (si dos equipos comparten siglas, se añade el final del id).
    info, por_abbr = {}, defaultdict(set)
    for e in todos:
        for t in (e["home"], e["away"]):
            info[t["id"]] = t
            por_abbr[t.get("abbreviation") or t.get("shortDisplayName") or t["id"]].add(t["id"])
    # Si dos equipos comparten siglas, las limpias son para el de nuestras 4 competiciones; el otro lleva el final del id.
    principales = {t["id"] for e in todos if e["comp"] in COMPS for t in (e["home"], e["away"])}
    code = {}
    for ab, ids in por_abbr.items():
        orden = sorted(ids, key=lambda tid: (tid not in principales, tid))
        for i, tid in enumerate(orden):
            code[tid] = ab if i == 0 else f"{ab}{tid[-2:]}"
    teams_meta = {code[tid]: {"id": tid, "name": t.get("displayName"), "short": t.get("shortDisplayName"),
                              "color": "#" + (t.get("color") or "3a4558"), "alt": "#" + (t.get("alternateColor") or "ffb84d")}
                  for tid, t in info.items()}

    # Jugadores de los partidos terminados de las 4 competiciones (con caché)
    pendientes = [e for e in todos if e["comp"] in COMPS and e["completed"] and e["id"] not in cache]
    print(f"Partidos con jugadores: {len(pendientes)} nuevos ({len(cache)} ya guardados)…")

    def bajar(e):
        return e["id"], leer_partido(e["comp"], e["id"])
    with ThreadPoolExecutor(max_workers=6) as ex:
        for i, (eid, rows) in enumerate(ex.map(bajar, pendientes), 1):
            if rows is not None:
                cache[eid] = rows
            if i % 100 == 0:
                print(f"  {i}/{len(pendientes)}")
                json.dump(cache, open(CACHE, "w", encoding="utf-8"), separators=(",", ":"))
    json.dump(cache, open(CACHE, "w", encoding="utf-8"), separators=(",", ":"))

    # Resultados por equipo (todas las competiciones; estadísticas solo en las 4 nuestras)
    equipos = defaultdict(list)
    vistos = set()
    for e in sorted(todos, key=lambda e: e["start"] or ""):
        if not e["completed"] or e["id"] in vistos:
            continue
        vistos.add(e["id"])
        d = (e["start"] or "")[:10]
        h, a = code[e["home"]["id"]], code[e["away"]["id"]]
        t = (cache.get(e["id"]) or {}).get("t") or {}
        H, A = t.get("home") or {}, t.get("away") or {}
        eh = [x for k in EQ_STATS for x in (H.get(k), A.get(k))]
        ea = [x for k in EQ_STATS for x in (A.get(k), H.get(k))]
        equipos[h].append([d, a, True, e["hs"], e["as"], e["season"], e["comp"]] + eh)
        equipos[a].append([d, h, False, e["as"], e["hs"], e["season"], e["comp"]] + ea)

    logs, jugadores, posiciones = defaultdict(list), {}, defaultdict(Counter)
    for e in sorted(todos, key=lambda e: e["start"] or ""):
        if e["id"] not in cache:
            continue
        d = (e["start"] or "")[:10]
        for p in cache[e["id"]]["p"]:
            tm = code.get(p["team_id"])
            if not tm:
                continue
            opp = code[e["away"]["id"]] if p["home"] else code[e["home"]["id"]]
            logs[p["id"]].append([d, opp, p["home"], p["min"], p["g"], p["a"], p["sh"], p["sot"], p["fc"], p["yc"], p["rc"], p["sv"], e["season"], e["comp"]])
            if p["pos"]:
                posiciones[p["id"]][p["pos"]] += 1
            if e["comp"] in SELECCIONES:   # su selección va aparte: el equipo sigue siendo el club
                jugadores.setdefault(p["id"], {"name": p["name"], "team": tm})["nat"] = tm
            elif e["comp"] != "uefa.champions" or p["id"] not in jugadores:
                jugadores[p["id"]] = {**jugadores.get(p["id"], {}), "name": p["name"], "team": tm}   # el equipo de su último partido de liga
    keep = {pid for pid, v in logs.items() if len(v) >= 5 and sum(r[3] for r in v) / len(v) >= 20}
    for pid in keep:
        jugadores[pid]["pos"] = posiciones[pid].most_common(1)[0][0] if posiciones[pid] else "M"

    # Partidos de los próximos 7 días (hora de Italia para el día)
    ahora = datetime.now(timezone.utc)
    fin = ahora + timedelta(days=7)
    games = []
    for e in sorted(todos, key=lambda e: e["start"] or ""):
        if e["comp"] not in COMPS or not e["start"]:
            continue
        ini = datetime.fromisoformat(e["start"].replace("Z", "+00:00"))
        if (e["state"] in ("pre", "in") or ini > ahora - timedelta(hours=3)) and ini < fin:
            games.append({"id": e["id"], "comp": e["comp"], "start": e["start"], "date": e["start"][:10],
                          "home": code[e["home"]["id"]], "away": code[e["away"]["id"]], "status": ""})
    return {
        "liga": "futbol",
        "updated": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "seasons": [str(anterior), str(actual)],
        "comps": COMPS,
        "cols": LOG_COLS,
        "games": games,
        "players": {pid: jugadores[pid] for pid in keep},
        "logs": {pid: logs[pid] for pid in keep},
        "team_cols": TEAM_COLS,
        "teams": dict(equipos),
        "teams_meta": teams_meta,
    }


def subir_a_supabase(datos: dict) -> None:
    import requests
    cargar_config()
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.exit("Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY.")
    r = requests.post(f"{url}/rest/v1/snapshots", timeout=120, data=json.dumps({"id": "futbol", "data": datos}, separators=(",", ":")),
                      headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
                               "Prefer": "resolution=merge-duplicates"})
    r.raise_for_status()
    print("Subido a Supabase.")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--subir", action="store_true")
    ap.add_argument("--salida", default="futbol.json")
    args = ap.parse_args()
    datos = construir(datetime.now(timezone.utc))
    with open(args.salida, "w", encoding="utf-8") as fh:
        json.dump(datos, fh, ensure_ascii=False, separators=(",", ":"))
    kb = os.path.getsize(args.salida) // 1024
    print(f"Listo: {len(datos['players'])} jugadores, {len(datos['teams'])} equipos, {len(datos['games'])} partidos en 7 días, {kb} KB → {args.salida}")
    if args.subir:
        subir_a_supabase(datos)


if __name__ == "__main__":
    main()
