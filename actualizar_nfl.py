"""
Descarga diaria de estadísticas de la NFL para Tribuna (gratis, sin clave: nflverse en GitHub).

Qué hace:
  1. Descarga las estadísticas partido a partido de cada jugador (QB, RB, WR, TE),
     temporada actual y anterior.
  2. Descarga el calendario con resultados (para ganador, hándicap y totales).
  3. Elige los partidos de la jornada (semana) en curso.
  4. Guarda todo en nfl.json con el mismo formato que nba.json.
  5. (Opcional) lo sube a Supabase (snapshots, id 'nfl').

Uso:
  py actualizar_nfl.py              # solo genera nfl.json
  py actualizar_nfl.py --subir      # además lo sube a Supabase
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
from datetime import datetime, timedelta, timezone

from actualizar_nba import cargar_config, con_reintentos

NFLVERSE = "https://github.com/nflverse/nflverse-data/releases/download"
CALENDARIO = "https://github.com/nflverse/nfldata/raw/master/data/games.csv"
POSICIONES = {"QB", "RB", "WR", "TE"}

# Columnas por partido de un jugador. "min" = oportunidades (pases + carreras + targets):
# hace el papel de los minutos de la NBA para saber si jugó de verdad.
LOG_COLS = ["date", "opp", "home", "min", "cmp", "att", "pyd", "ptd", "int",
            "car", "ryd", "rtd", "tgt", "rec", "reyd", "retd", "season"]
TEAM_COLS = ["date", "opp", "home", "pts", "opp_pts", "season"]


def temporadas(hoy: datetime) -> tuple[str, str]:
    """La temporada NFL va de septiembre a febrero: en nov-2026 la actual es 2026."""
    y = hoy.year if hoy.month >= 3 else hoy.year - 1
    return str(y), str(y - 1)


def csv_url(url: str) -> list[dict]:
    import requests
    r = con_reintentos(lambda: requests.get(url, timeout=120))
    if r.status_code == 404:
        return []
    r.raise_for_status()
    return list(csv.DictReader(io.StringIO(r.content.decode("utf-8"))))


def entero(v) -> int:
    try:
        return int(round(float(v or 0)))
    except ValueError:
        return 0


def hora_et(gametime: str) -> str:
    """'20:15' -> '8:15 pm ET' (el formato que entiende la app)."""
    try:
        h, m = (int(x) for x in gametime.split(":")[:2])
    except ValueError:
        return ""
    return f"{(h - 1) % 12 + 1}:{m:02d} {'pm' if h >= 12 else 'am'} ET"


def jornada(calendario: list[dict], actual: str) -> list[dict]:
    """Partidos de la semana en curso: la primera semana con algún partido sin resultado."""
    pend = [g for g in calendario if g["season"] == actual and not g["home_score"]]
    if not pend:
        return []
    clave = min((g["game_type"] != "REG", int(g["week"])) for g in pend)
    semana = [g for g in calendario if g["season"] == actual and (g["game_type"] != "REG", int(g["week"])) == clave]
    semana.sort(key=lambda g: (g["gameday"], g["gametime"]))
    return [{"id": g["game_id"], "home": g["home_team"], "away": g["away_team"], "date": g["gameday"],
             "status": hora_et(g["gametime"]), "espn": g.get("espn") or "", "week": int(g["week"])} for g in semana]


def descargar(hoy: datetime) -> dict:
    actual, anterior = temporadas(hoy)
    print("Descargando calendario y resultados…")
    cal = [g for g in csv_url(CALENDARIO) if g["season"] in (actual, anterior)]
    por_id = {g["game_id"]: g for g in cal}

    equipos: dict[str, list] = {}
    for g in sorted(cal, key=lambda g: (g["gameday"], g["gametime"])):
        if not g["home_score"]:
            continue
        hs, as_ = entero(g["home_score"]), entero(g["away_score"])
        # shortcut: los partidos en campo neutral (Londres, Super Bowl) cuentan como en casa del local.
        equipos.setdefault(g["home_team"], []).append([g["gameday"], g["away_team"], True, hs, as_, g["season"]])
        equipos.setdefault(g["away_team"], []).append([g["gameday"], g["home_team"], False, as_, hs, g["season"]])

    logs: dict[str, list] = {}
    jugadores: dict[str, dict] = {}
    for season in (anterior, actual):
        print(f"Descargando estadísticas de jugadores de {season}…")
        filas = csv_url(f"{NFLVERSE}/stats_player/stats_player_week_{season}.csv")
        filas.sort(key=lambda f: (f["season_type"] != "REG", entero(f["week"])))
        for f in filas:
            g = por_id.get(f["game_id"])
            if f["position"] not in POSICIONES or not g:
                continue
            n = {k: entero(f[k]) for k in ("completions", "attempts", "passing_yards", "passing_tds",
                                          "passing_interceptions", "carries", "rushing_yards", "rushing_tds",
                                          "targets", "receptions", "receiving_yards", "receiving_tds")}
            oport = n["attempts"] + n["carries"] + n["targets"]
            if oport == 0:
                continue
            home = f["team"] == g["home_team"]
            logs.setdefault(f["player_id"], []).append([
                g["gameday"], f["opponent_team"], home, oport,
                n["completions"], n["attempts"], n["passing_yards"], n["passing_tds"], n["passing_interceptions"],
                n["carries"], n["rushing_yards"], n["rushing_tds"],
                n["targets"], n["receptions"], n["receiving_yards"], n["receiving_tds"], season])
            # La foto original pesa ~5 MB: se pide a 200 px de ancho (~9 KB).
            img = (f.get("headshot_url") or "").replace("/upload/f_auto,q_auto/", "/upload/f_auto,q_auto,w_200/")
            jugadores[f["player_id"]] = {"name": f["player_display_name"], "team": f["team"], "pos": f["position"], "img": img}
    for v in logs.values():
        v.sort(key=lambda r: r[0])

    keep = {pid for pid, v in logs.items() if len(v) >= 3 and sum(r[3] for r in v) / len(v) >= 3}
    return {
        "liga": "nfl",
        "updated": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "seasons": [anterior, actual],
        "cols": LOG_COLS,
        "games": jornada(cal, actual),
        "players": {pid: jugadores[pid] for pid in keep},
        "logs": {pid: logs[pid] for pid in keep},
        "team_cols": TEAM_COLS,
        "teams": equipos,
    }


def subir_a_supabase(datos: dict) -> None:
    import requests
    cargar_config()
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.exit("Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY.")
    r = requests.post(f"{url}/rest/v1/snapshots", timeout=60, data=json.dumps({"id": "nfl", "data": datos}),
                      headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
                               "Prefer": "resolution=merge-duplicates"})
    r.raise_for_status()
    print("Subido a Supabase.")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--subir", action="store_true", help="subir el resultado a Supabase")
    ap.add_argument("--salida", default="nfl.json")
    args = ap.parse_args()
    datos = descargar(datetime.now(timezone(timedelta(hours=-5))))
    with open(args.salida, "w", encoding="utf-8") as fh:
        json.dump(datos, fh, ensure_ascii=False, separators=(",", ":"))
    kb = os.path.getsize(args.salida) // 1024
    sem = datos["games"][0]["week"] if datos["games"] else "–"
    print(f"Listo: {len(datos['players'])} jugadores, {len(datos['games'])} partidos (semana {sem}), {kb} KB → {args.salida}")
    if args.subir:
        subir_a_supabase(datos)


if __name__ == "__main__":
    main()
