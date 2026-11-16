"""
Descarga diaria de estadísticas de la NBA desde NBA.com (gratis, con nba_api).

Pensado para ejecutarse cada mañana en el ordenador de Fabio: NBA.com suele
bloquear los servidores en la nube, pero permite conexiones desde casa.

Qué hace:
  1. Descarga el registro partido a partido de todos los jugadores
     (temporada actual y anterior) con UNA llamada por temporada.
  2. Descarga los resultados por equipo (para ganador, hándicap y totales).
  3. Descarga los partidos de hoy (fecha de EE. UU.).
  4. Descarga la posición de cada jugador (para la defensa del rival por posición).
  5. Guarda todo en un único archivo compacto: nba.json
  6. (Opcional) lo sube a Supabase para que la app lo lea.

Uso:
  pip install nba_api requests
  python actualizar_nba.py                 # solo genera nba.json
  python actualizar_nba.py --subir         # además lo sube a Supabase
    (necesita las variables SUPABASE_URL y SUPABASE_SERVICE_KEY)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

# Columnas que guarda la app, en este orden, para cada partido de un jugador.
LOG_COLS = ["date", "opp", "home", "min", "pts", "reb", "ast", "fg3m", "fg3a",
            "fgm", "fga", "ftm", "fta", "stl", "blk", "tov", "season"]


def temporadas(hoy: datetime) -> tuple[str, str]:
    """La temporada NBA empieza en octubre: en nov-2026 la actual es 2026-27."""
    y = hoy.year if hoy.month >= 10 else hoy.year - 1
    return f"{y}-{str(y + 1)[2:]}", f"{y - 1}-{str(y)[2:]}"


def minutos(v) -> int:
    """MIN puede venir como 34, 34.5 o '34:12'."""
    if v is None or v == "":
        return 0
    if isinstance(v, str) and ":" in v:
        m, s = v.split(":", 1)
        return int(m) + (1 if int(s or 0) >= 30 else 0)
    return int(round(float(v)))


def filas_a_logs(filas: list[dict], season: str) -> dict[str, list]:
    """Convierte las filas de LeagueGameLog en {player_id: [[...LOG_COLS], ...]}."""
    logs: dict[str, list] = {}
    for f in filas:
        matchup = f["MATCHUP"]               # "GSW vs. LAL" o "GSW @ LAL"
        home = " vs. " in matchup
        opp = matchup.split(" vs. " if home else " @ ")[-1].strip()
        fila = [f["GAME_DATE"][:10], opp, home, minutos(f["MIN"]),
                int(f["PTS"] or 0), int(f["REB"] or 0), int(f["AST"] or 0),
                int(f["FG3M"] or 0), int(f["FG3A"] or 0), int(f["FGM"] or 0),
                int(f["FGA"] or 0), int(f["FTM"] or 0), int(f["FTA"] or 0),
                int(f["STL"] or 0), int(f["BLK"] or 0), int(f["TOV"] or 0), season]
        logs.setdefault(str(f["PLAYER_ID"]), []).append(fila)
    for v in logs.values():
        v.sort(key=lambda r: r[0])
    return logs


TEAM_COLS = ["date", "opp", "home", "pts", "opp_pts", "season"]


def filas_a_equipos(filas: list[dict], season: str) -> dict[str, list]:
    """Resultados por equipo: {abbr: [[fecha, rival, casa, puntos, puntos_rival, temporada], ...]}."""
    por_partido: dict[str, list[dict]] = {}
    for f in filas:
        por_partido.setdefault(f["GAME_ID"], []).append(f)
    out: dict[str, list] = {}
    for filas_p in por_partido.values():
        if len(filas_p) != 2:
            continue
        a, b = filas_p
        for yo, rival in ((a, b), (b, a)):
            home = " vs. " in yo["MATCHUP"]
            out.setdefault(yo["TEAM_ABBREVIATION"], []).append(
                [yo["GAME_DATE"][:10], rival["TEAM_ABBREVIATION"], home,
                 int(yo["PTS"] or 0), int(rival["PTS"] or 0), season])
    for v in out.values():
        v.sort(key=lambda r: r[0])
    return out


def jugadores_de(filas: list[dict]) -> dict[str, dict]:
    """Nombre y equipo actual (el del partido más reciente) de cada jugador."""
    out: dict[str, dict] = {}
    for f in sorted(filas, key=lambda r: r["GAME_DATE"]):
        out[str(f["PLAYER_ID"])] = {"name": f["PLAYER_NAME"], "team": f["TEAM_ABBREVIATION"]}
    return out


def con_reintentos(fn, intentos=4, espera=5):
    for i in range(intentos):
        try:
            return fn()
        except Exception as e:  # NBA.com a veces tarda o corta la conexión
            if i == intentos - 1:
                raise
            print(f"  Reintento {i + 1} tras error: {e}", file=sys.stderr)
            time.sleep(espera * (i + 1))


def descargar(hoy_us: datetime) -> dict:
    from nba_api.stats.endpoints import leaguegamelog, playerindex, scoreboardv2
    from nba_api.stats.static import teams as static_teams

    actual, anterior = temporadas(hoy_us)
    abbr = {t["id"]: t["abbreviation"] for t in static_teams.get_teams()}

    logs: dict[str, list] = {}
    jugadores: dict[str, dict] = {}
    equipos: dict[str, list] = {}
    for season in (anterior, actual):
        print(f"Descargando resultados por equipo de {season}…")
        filas_t = con_reintentos(lambda: leaguegamelog.LeagueGameLog(
            season=season, player_or_team_abbreviation="T", timeout=60
        ).get_normalized_dict()["LeagueGameLog"])
        for t, v in filas_a_equipos(filas_t, season).items():
            equipos.setdefault(t, []).extend(v)
        time.sleep(2)
        print(f"Descargando partidos de {season}…")
        filas = con_reintentos(lambda: leaguegamelog.LeagueGameLog(
            season=season, player_or_team_abbreviation="P", timeout=60
        ).get_normalized_dict()["LeagueGameLog"])
        for pid, v in filas_a_logs(filas, season).items():
            logs.setdefault(pid, []).extend(v)
        jugadores.update(jugadores_de(filas))   # la temporada actual pisa a la anterior
        time.sleep(2)

    print("Descargando posiciones…")
    try:
        idx = con_reintentos(lambda: playerindex.PlayerIndex(
            season=actual, timeout=60).get_normalized_dict()["PlayerIndex"])
        for r in idx:
            pid = str(r["PERSON_ID"])
            if pid in jugadores:
                pos = (r.get("POSITION") or "").split("-")[0]
                jugadores[pid]["pos"] = {"G": "G", "F": "F", "C": "C"}.get(pos, "F")
    except Exception as e:
        print(f"  Sin posiciones ({e}); se usará 'F' por defecto.", file=sys.stderr)

    print("Descargando partidos de hoy…")
    sb = con_reintentos(lambda: scoreboardv2.ScoreboardV2(
        game_date=hoy_us.strftime("%Y-%m-%d"), timeout=60).get_normalized_dict())
    partidos = [{
        "id": g["GAME_ID"],
        "home": abbr.get(g["HOME_TEAM_ID"], str(g["HOME_TEAM_ID"])),
        "away": abbr.get(g["VISITOR_TEAM_ID"], str(g["VISITOR_TEAM_ID"])),
        "status": g.get("GAME_STATUS_TEXT", "").strip(),   # p. ej. "7:30 pm ET"
        "date": hoy_us.strftime("%Y-%m-%d"),
    } for g in sb.get("GameHeader", [])]

    return construir(jugadores, logs, partidos, actual, anterior, equipos)


def construir(jugadores, logs, partidos, actual, anterior, equipos=None) -> dict:
    # Solo jugadores con minutos de verdad, para que el archivo sea ligero.
    keep = {pid for pid, v in logs.items()
            if len(v) >= 5 and sum(r[3] for r in v) / len(v) >= 10}
    return {
        "updated": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "seasons": [anterior, actual],
        "cols": LOG_COLS,
        "games": partidos,
        "players": {pid: jugadores[pid] for pid in keep if pid in jugadores},
        "logs": {pid: logs[pid] for pid in keep},
        "team_cols": TEAM_COLS,
        "teams": equipos or {},
    }


def cargar_config() -> None:
    """Lee config.env (junto al script) si las variables no están ya definidas."""
    ruta = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.env")
    if not os.path.exists(ruta):
        return
    with open(ruta, encoding="utf-8") as fh:
        for linea in fh:
            linea = linea.strip()
            if linea and not linea.startswith("#") and "=" in linea:
                k, v = linea.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"'))


def subir_a_supabase(datos: dict) -> None:
    import requests
    cargar_config()
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.exit("Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY.")
    r = requests.post(
        f"{url}/rest/v1/snapshots",
        headers={"apikey": key, "Authorization": f"Bearer {key}",
                 "Content-Type": "application/json",
                 "Prefer": "resolution=merge-duplicates"},
        data=json.dumps({"id": "nba", "data": datos}), timeout=60)
    r.raise_for_status()
    print("Subido a Supabase.")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--subir", action="store_true", help="subir el resultado a Supabase")
    ap.add_argument("--salida", default="nba.json")
    args = ap.parse_args()

    # Los partidos de "esta noche" en Italia tienen la fecha de hoy en EE. UU.
    hoy_us = datetime.now(timezone(timedelta(hours=-5)))
    datos = descargar(hoy_us)
    with open(args.salida, "w", encoding="utf-8") as fh:
        json.dump(datos, fh, ensure_ascii=False, separators=(",", ":"))
    kb = os.path.getsize(args.salida) // 1024
    print(f"Listo: {len(datos['players'])} jugadores, {len(datos['games'])} partidos hoy, {kb} KB → {args.salida}")
    if args.subir:
        subir_a_supabase(datos)


if __name__ == "__main__":
    main()
