"""Tribuna · cuotas automáticas desde The Odds API (plan gratuito, 500 créditos al mes).

Uso (en el PC del administrador, después de actualizar_nba.py):
    py actualizar_cuotas.py            # ganador, hándicap y total de los partidos de hoy (3 créditos)
    py actualizar_cuotas.py --props    # lo mismo + props de jugadores según los créditos que queden
    py actualizar_cuotas.py --prueba   # no gasta nada: solo dice cuántos créditos quedan y qué haría

Reparto pensado para que los créditos duren todo el mes:
  - 13:00 (Italia): solo partidos.                       ~3 créditos
  - 21:00 (Italia): partidos + props (las casas ya las han publicado).
    Las props se reparten con lo que sobra: primero puntos en todos los partidos,
    luego triples, rebotes, asistencias y P+R+A si hay margen. Nunca toca la reserva
    que hace falta para los partidos de los días que quedan del mes.

Las cuotas se guardan SIN nombre de casa de apuestas: línea más repetida y cuota mediana del mercado.
Si el administrador ha puesto una cuota a mano (fuente 'manual'), el script no la pisa.
La clave ODDS_API_KEY va en config.env, junto a la de Supabase. Nunca la subas a GitHub.
"""
from __future__ import annotations

import argparse
import calendar
import json
import os
import re
import statistics
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone

API = "https://api.the-odds-api.com/v4/sports/basketball_nba"
CARPETA = os.path.dirname(os.path.abspath(__file__))

# Mercados de props en orden de prioridad -> estadística de la app.
PROPS = [
    ("player_points", "pts"),
    ("player_threes", "fg3m"),
    ("player_rebounds", "reb"),
    ("player_assists", "ast"),
    ("player_points_rebounds_assists", "pra"),
]
REGION_PARTIDOS = "eu"   # casas europeas, cuotas decimales como en Italia
REGION_PROPS = "us"      # las props de la NBA solo las publican casas de EE. UU.
COSTE_PARTIDOS = 3       # h2h + spreads + totals, 1 región
MINIMO_SEGURIDAD = 6     # nunca bajar de aquí

EQUIPOS = {
    "Atlanta Hawks": "ATL", "Boston Celtics": "BOS", "Brooklyn Nets": "BKN", "Charlotte Hornets": "CHA",
    "Chicago Bulls": "CHI", "Cleveland Cavaliers": "CLE", "Dallas Mavericks": "DAL", "Denver Nuggets": "DEN",
    "Detroit Pistons": "DET", "Golden State Warriors": "GSW", "Houston Rockets": "HOU", "Indiana Pacers": "IND",
    "Los Angeles Clippers": "LAC", "LA Clippers": "LAC", "Los Angeles Lakers": "LAL", "Memphis Grizzlies": "MEM",
    "Miami Heat": "MIA", "Milwaukee Bucks": "MIL", "Minnesota Timberwolves": "MIN", "New Orleans Pelicans": "NOP",
    "New York Knicks": "NYK", "Oklahoma City Thunder": "OKC", "Orlando Magic": "ORL", "Philadelphia 76ers": "PHI",
    "Phoenix Suns": "PHX", "Portland Trail Blazers": "POR", "Sacramento Kings": "SAC", "San Antonio Spurs": "SAS",
    "Toronto Raptors": "TOR", "Utah Jazz": "UTA", "Washington Wizards": "WAS",
}


# ---------------------------------------------------------------- utilidades
def cargar_config() -> None:
    ruta = os.path.join(CARPETA, "config.env")
    if os.path.exists(ruta):
        with open(ruta, encoding="utf-8") as fh:
            for linea in fh:
                linea = linea.strip()
                if linea and not linea.startswith("#") and "=" in linea:
                    k, v = linea.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"'))


def norm_nombre(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    s = re.sub(r"[.'’\-]", " ", s)
    s = re.sub(r"\b(jr|sr|ii|iii|iv)\b", " ", s)
    return " ".join(s.split())


def consenso(puntos_precios: list[tuple[float | None, float]]) -> tuple[float | None, float | None]:
    """Línea más repetida entre casas y cuota mediana en esa línea."""
    if not puntos_precios:
        return None, None
    lineas = Counter(p for p, _ in puntos_precios)
    top = max(lineas.values())
    candidatas = sorted(p for p, n in lineas.items() if n == top and p is not None) or [None]
    linea = candidatas[len(candidatas) // 2]
    precios = [pr for p, pr in puntos_precios if p == linea and pr and pr > 1]
    return linea, (round(statistics.median(precios), 2) if precios else None)


def presupuesto_props(restantes: int, hoy: datetime) -> int:
    """Créditos que se pueden gastar hoy en props sin poner en riesgo el resto del mes."""
    dias_mes = calendar.monthrange(hoy.year, hoy.month)[1]
    quedan = dias_mes - hoy.day + 1                       # contando hoy
    reserva = 2 * COSTE_PARTIDOS * (quedan - 1) + MINIMO_SEGURIDAD
    libre = restantes - reserva
    return max(0, libre // max(1, quedan))


def plan_props(presupuesto: int, n_partidos: int) -> list[list[str]]:
    """Qué mercados pedir en cada partido. Coste real = mercados devueltos por partido."""
    if presupuesto <= 0 or n_partidos == 0:
        return [[] for _ in range(n_partidos)]
    por_partido = min(len(PROPS), presupuesto // n_partidos)
    if por_partido == 0:   # no llega para todos: puntos en los primeros
        return [["player_points"] if i < presupuesto else [] for i in range(n_partidos)]
    extra = presupuesto - por_partido * n_partidos
    plan = []
    for i in range(n_partidos):
        k = min(len(PROPS), por_partido + (1 if i < extra else 0))
        plan.append([m for m, _ in PROPS[:k]])
    return plan


# ---------------------------------------------------------------- The Odds API
class Odds:
    def __init__(self, key: str):
        import requests
        self.s = requests.Session()
        self.key = key
        self.restantes: int | None = None
        self.gastado = 0

    def get(self, ruta: str, **params):
        params["apiKey"] = self.key
        url = ruta if ruta.startswith("http") else f"{API}{ruta}"
        r = self.s.get(url, params=params, timeout=30)
        if r.status_code == 401:
            sys.exit("The Odds API: la clave ODDS_API_KEY no es válida.")
        if r.status_code == 429:
            sys.exit("The Odds API: créditos del mes agotados o demasiadas consultas seguidas.")
        r.raise_for_status()
        if r.headers.get("x-requests-remaining") is not None:
            self.restantes = int(float(r.headers["x-requests-remaining"]))
            self.gastado += int(float(r.headers.get("x-requests-last", 0) or 0))
        return r.json()


# ---------------------------------------------------------------- transformación
def partidos_de_hoy(nba: dict, eventos: list[dict]) -> list[tuple[dict, dict]]:
    """Empareja los partidos de nba.json con los eventos de The Odds API."""
    por_equipos = {}
    for ev in eventos:
        h, a = EQUIPOS.get(ev.get("home_team")), EQUIPOS.get(ev.get("away_team"))
        if h and a:
            por_equipos.setdefault((a, h), ev)
    return [(g, por_equipos[(g["away"], g["home"])]) for g in nba.get("games", []) if (g["away"], g["home"]) in por_equipos]


def filas_partidos(pares: list[tuple[dict, dict]], odds_por_evento: dict) -> list[dict]:
    filas = []
    for g, ev in pares:
        datos = odds_por_evento.get(ev["id"])
        if not datos:
            continue
        acc = defaultdict(list)   # (mercado, equipo/lado) -> [(punto, precio)]
        for bk in datos.get("bookmakers", []):
            for mk in bk.get("markets", []):
                for o in mk.get("outcomes", []):
                    lado = EQUIPOS.get(o.get("name")) or o.get("name")
                    acc[(mk["key"], lado)].append((o.get("point"), o.get("price")))
        for tm in (g["home"], g["away"]):
            _, p = consenso([(None, pr) for _, pr in acc.get(("h2h", tm), [])])
            if p:
                filas.append({"player_id": "T:" + tm, "stat": "ml", "line": 0, "over_odd": p, "under_odd": None})
            linea, p = consenso(acc.get(("spreads", tm), []))
            if linea is not None:
                filas.append({"player_id": "T:" + tm, "stat": "spread", "line": linea, "over_odd": p, "under_odd": None})
        lo, po = consenso(acc.get(("totals", "Over"), []))
        if lo is not None:
            pu = consenso([x for x in acc.get(("totals", "Under"), []) if x[0] == lo])[1]
            filas.append({"player_id": f"G:{g['away']}@{g['home']}", "stat": "total", "line": lo, "over_odd": po, "under_odd": pu})
    return filas


def indice_jugadores(nba: dict, equipos: set[str]) -> dict[str, str]:
    idx, ambiguos = {}, set()
    for pid, p in nba.get("players", {}).items():
        if p.get("team") not in equipos:
            continue
        for k in {norm_nombre(p["name"]), " ".join(norm_nombre(p["name"]).split()[:1] + norm_nombre(p["name"]).split()[-1:])}:
            if k in idx and idx[k] != pid:
                ambiguos.add(k)
            idx[k] = pid
    for k in ambiguos:
        idx.pop(k, None)
    return idx


def filas_props(nba: dict, eventos_props: list[dict], equipos: set[str]) -> tuple[list[dict], list[str]]:
    idx = indice_jugadores(nba, equipos)
    stat_de = dict(PROPS)
    acc = defaultdict(lambda: {"Over": [], "Under": []})
    sin_emparejar = set()
    for datos in eventos_props:
        for bk in datos.get("bookmakers", []):
            for mk in bk.get("markets", []):
                st = stat_de.get(mk["key"])
                if not st:
                    continue
                for o in mk.get("outcomes", []):
                    nombre = o.get("description") or ""
                    n = norm_nombre(nombre)
                    pid = idx.get(n) or idx.get(" ".join(n.split()[:1] + n.split()[-1:]))
                    if not pid:
                        sin_emparejar.add(nombre)
                        continue
                    if o.get("name") in ("Over", "Under"):
                        acc[(pid, st)][o["name"]].append((o.get("point"), o.get("price")))
    filas = []
    for (pid, st), lados in acc.items():
        linea, po = consenso(lados["Over"])
        if linea is None:
            continue
        pu = consenso([x for x in lados["Under"] if x[0] == linea])[1]
        filas.append({"player_id": pid, "stat": st, "line": linea, "over_odd": po, "under_odd": pu})
    return filas, sorted(sin_emparejar)


# ---------------------------------------------------------------- Supabase
class Supa:
    def __init__(self, url: str, key: str):
        import requests
        self.s, self.url = requests.Session(), url.rstrip("/")
        self.h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    def manuales(self, fecha: str) -> set[tuple[str, str]] | None:
        r = self.s.get(f"{self.url}/rest/v1/odds", headers=self.h, timeout=30,
                       params={"select": "player_id,stat,fuente", "game_date": f"eq.{fecha}"})
        if r.status_code >= 400:   # falta la columna 'fuente' (no se ejecutó supabase_cuotas.sql)
            return None
        return {(x["player_id"], x["stat"]) for x in r.json() if (x.get("fuente") or "manual") == "manual"}

    def subir(self, filas: list[dict], con_fuente: bool) -> None:
        if not filas:
            return
        ahora = datetime.now(timezone.utc).isoformat()
        for f in filas:
            f["updated_at"] = ahora
            if con_fuente:
                f["fuente"] = "auto"
        r = self.s.post(f"{self.url}/rest/v1/odds?on_conflict=player_id,stat,game_date", timeout=60,
                        headers={**self.h, "Prefer": "resolution=merge-duplicates"}, data=json.dumps(filas))
        r.raise_for_status()

    def guardar_creditos(self, info: dict) -> None:
        try:
            self.s.post(f"{self.url}/rest/v1/ajustes", timeout=30, headers={**self.h, "Prefer": "resolution=merge-duplicates"},
                        data=json.dumps({"clave": "creditos_odds", "valor": json.dumps(info)}))
        except Exception:
            pass


# ---------------------------------------------------------------- principal
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--props", action="store_true", help="añadir props de jugadores con los créditos sobrantes")
    ap.add_argument("--prueba", action="store_true", help="no gastar créditos: solo mostrar el plan")
    args = ap.parse_args()

    cargar_config()
    key = os.environ.get("ODDS_API_KEY")
    if not key:
        sys.exit("Falta ODDS_API_KEY en config.env.")
    ruta_nba = os.path.join(CARPETA, "nba.json")
    if not os.path.exists(ruta_nba):
        sys.exit("Falta nba.json: ejecuta antes actualizar_nba.py.")
    with open(ruta_nba, encoding="utf-8") as fh:
        nba = json.load(fh)
    if not nba.get("games"):
        print("Hoy no hay partidos: no se gasta ningún crédito.")
        return
    fecha = nba["games"][0]["date"]

    api = Odds(key)
    eventos = api.get("/events", dateFormat="iso")          # gratis
    pares = partidos_de_hoy(nba, eventos)
    print(f"{len(pares)} de {len(nba['games'])} partidos de hoy encontrados en The Odds API.")
    if not pares:
        return

    hoy = datetime.now()
    if args.prueba:
        # /events no gasta créditos pero tampoco siempre informa del saldo; /sports tampoco gasta.
        api.get("https://api.the-odds-api.com/v4/sports")   # lista de deportes: gratis y devuelve el saldo
        print(f"Créditos restantes: {api.restantes if api.restantes is not None else 'desconocido'}")
        if api.restantes is not None:
            pres = presupuesto_props(api.restantes - COSTE_PARTIDOS, hoy)
            print(f"Props hoy: hasta {pres} créditos · mercados por partido", [len(x) for x in plan_props(pres, len(pares))])
        return

    ids = ",".join(ev["id"] for _, ev in pares)
    lista = api.get("/odds", regions=REGION_PARTIDOS, markets="h2h,spreads,totals", oddsFormat="decimal", eventIds=ids)
    filas = filas_partidos(pares, {ev["id"]: ev for ev in lista})
    print(f"Partidos: {len(filas)} cuotas · créditos restantes {api.restantes}")

    if args.props and api.restantes is not None:
        pres = presupuesto_props(api.restantes, hoy)
        plan = plan_props(pres, len(pares))
        print(f"Props: hasta {pres} créditos hoy · mercados por partido {[len(x) for x in plan]}")
        datos_props = []
        for (g, ev), mercados in zip(pares, plan):
            if not mercados or (api.restantes or 0) - len(mercados) < MINIMO_SEGURIDAD:
                continue
            datos_props.append(api.get(f"/events/{ev['id']}/odds", regions=REGION_PROPS,
                                       markets=",".join(mercados), oddsFormat="decimal"))
        equipos = {t for g, _ in pares for t in (g["home"], g["away"])}
        fp, sin = filas_props(nba, datos_props, equipos)
        filas += fp
        print(f"Props: {len(fp)} cuotas de jugadores · créditos restantes {api.restantes}")
        if sin:
            print(f"  Sin emparejar ({len(sin)}): {', '.join(sin[:12])}{'…' if len(sin) > 12 else ''}")

    url, skey = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not skey:
        sys.exit("Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY en config.env.")
    sb = Supa(url, skey)
    manuales = sb.manuales(fecha)
    if manuales is None:
        print("  Aviso: falta la columna 'fuente' (ejecuta supabase_cuotas.sql); las cuotas a mano se pueden pisar.")
    else:
        antes = len(filas)
        filas = [f for f in filas if (f["player_id"], f["stat"]) not in manuales]
        if antes != len(filas):
            print(f"  Respetadas {antes - len(filas)} cuotas puestas a mano.")
    for f in filas:
        f["game_date"] = fecha
    sb.subir(filas, con_fuente=manuales is not None)
    sb.guardar_creditos({"restantes": api.restantes, "gastado_hoy": api.gastado, "cuando": datetime.now(timezone.utc).isoformat()})
    print(f"Listo: {len(filas)} cuotas subidas para el {fecha}. Créditos restantes este mes: {api.restantes}.")


if __name__ == "__main__":
    main()
