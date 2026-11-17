"""Tribuna · cuotas automáticas de tres APIs gratuitas, cada una con su papel.

  1. PropLine (1.000 consultas al día)      -> fuente principal: ganador, hándicap, totales,
                                               puntos por equipo y todas las props de jugadores.
  2. The Odds API (500 créditos al mes)      -> rellena huecos de partido; con --props, también
                                               props de los partidos que PropLine no traiga.
  3. SportsGameOdds (2.500 eventos al mes)   -> última red: solo para lo que siga faltando.
  Lo que no traiga ninguna lo pone el administrador a mano en la pestaña Cuotas (y tiene prioridad).

Uso (en el PC del administrador, después de actualizar_nba.py / actualizar_nfl.py):
    py actualizar_cuotas.py              # 18:00
    py actualizar_cuotas.py --liga nfl   # cuotas de la jornada NFL (después de actualizar_nfl.py)
    py actualizar_cuotas.py --props      # 21:00 (además permite gastar créditos de The Odds API en props)
    py actualizar_cuotas.py --prueba     # no sube nada; dice qué trae cada fuente y lo que queda de cada plan
    py actualizar_cuotas.py --solo sgo   # probar una sola fuente (propline | oddsapi | sgo)

Las cuotas se guardan SIN nombre de casa: línea más repetida y cuota mediana del mercado.
Claves en config.env: PROPLINE_API_KEY, ODDS_API_KEY, SGO_API_KEY (las que falten se saltan).
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
from datetime import datetime, timedelta, timezone

CARPETA = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- mercados
# Estadísticas de la app -> clave en PropLine / statID en SportsGameOdds
STATS_APP = {
    "pts": ("player_points", "points"),
    "reb": ("player_rebounds", "rebounds"),
    "ast": ("player_assists", "assists"),
    "fg3m": ("player_threes", "threePointersMade"),
    "fg3a": ("player_threes_attempted", "threePointersAttempted"),
    "pra": ("player_points_rebounds_assists", "points+rebounds+assists"),
    "pr": ("player_points_rebounds", "points+rebounds"),
    "pa": ("player_points_assists", "points+assists"),
    "ra": ("player_rebounds_assists", "rebounds+assists"),
    "stl": ("player_steals", "steals"),
    "blk": ("player_blocks", "blocks"),
    "sb": ("player_blocks_steals", "blocks+steals"),
    "tov": ("player_turnovers", "turnovers"),
    "fgm": ("player_field_goals_made", "fieldGoalsMade"),
    "fga": ("player_field_goals_attempted", "fieldGoalsAttempted"),
    "ftm": ("player_free_throws_made", "freeThrowsMade"),
    "fta": ("player_free_throws_attempted", "freeThrowsAttempted"),
    "dd": ("player_double_double", "doubleDouble"),
    "td": ("player_triple_double", "tripleDouble"),
}
# NFL: mismas fuentes, otros mercados. "td" = anota touchdown (sí/no).
STATS_NFL = {
    "pyd": ("player_pass_yds", "passing_yards"),
    "ptd": ("player_pass_tds", "passing_touchdowns"),
    "cmp": ("player_pass_completions", "passing_completions"),
    "att": ("player_pass_attempts", "passing_attempts"),
    "int": ("player_pass_interceptions", "passing_interceptions"),
    "ryd": ("player_rush_yds", "rushing_yards"),
    "car": ("player_rush_attempts", "rushing_attempts"),
    "rec": ("player_receptions", "receiving_receptions"),
    "reyd": ("player_reception_yds", "receiving_yards"),
    "rry": ("player_rush_reception_yds", "rushing+receiving_yards"),
    "pry": ("player_pass_rush_yds", "passing+rushing_yards"),
    "td": ("player_anytime_td", "touchdowns"),
}
PL_STAT = {pl: st for st, (pl, _) in STATS_APP.items()}
SGO_STAT = {sg: st for st, (_, sg) in STATS_APP.items()}
SI_NO = {"dd", "td"}   # mercados sí/no: línea 0,5, "más" = sí

# Aplicaciones de fantasía (no son cuotas de verdad): fuera del consenso.
DFS = {"prizepicks", "underdog", "sleeper", "betr", "dabble", "parlayplay", "chalkboard", "pick6",
       "draftkings_pick6", "fliff", "boom", "hotstreak", "ownersbox", "rebet_dfs", "splash"}

# The Odds API (respaldo)
ODDS_API = "https://api.the-odds-api.com/v4/sports/basketball_nba"
ODDS_PROPS = ["player_points", "player_threes", "player_rebounds", "player_assists", "player_points_rebounds_assists"]
COSTE_PARTIDOS = 3
MINIMO_SEGURIDAD = 6

PROPLINE = "https://api.prop-line.com/v1/sports/basketball_nba"
SGO = "https://api.sportsgameodds.com/v2"

EQUIPOS_NFL = {
    "Arizona Cardinals": "ARI", "Atlanta Falcons": "ATL", "Baltimore Ravens": "BAL", "Buffalo Bills": "BUF",
    "Carolina Panthers": "CAR", "Chicago Bears": "CHI", "Cincinnati Bengals": "CIN", "Cleveland Browns": "CLE",
    "Dallas Cowboys": "DAL", "Denver Broncos": "DEN", "Detroit Lions": "DET", "Green Bay Packers": "GB",
    "Houston Texans": "HOU", "Indianapolis Colts": "IND", "Jacksonville Jaguars": "JAX", "Kansas City Chiefs": "KC",
    "Las Vegas Raiders": "LV", "Los Angeles Chargers": "LAC", "Los Angeles Rams": "LA", "Miami Dolphins": "MIA",
    "Minnesota Vikings": "MIN", "New England Patriots": "NE", "New Orleans Saints": "NO", "New York Giants": "NYG",
    "New York Jets": "NYJ", "Philadelphia Eagles": "PHI", "Pittsburgh Steelers": "PIT", "San Francisco 49ers": "SF",
    "Seattle Seahawks": "SEA", "Tampa Bay Buccaneers": "TB", "Tennessee Titans": "TEN", "Washington Commanders": "WAS",
}
# Lo que cambia de una liga a otra. Las cuotas NFL se guardan con el prefijo "nfl:" para no
# mezclarse con las de la NBA (hay equipos con las mismas siglas, como DAL o MIA).
LIGA = {"nombre": "nba", "archivo": "nba.json", "prefijo": "", "sgo": "NBA", "creditos": "creditos_odds"}


def usar_liga(liga: str) -> None:
    global STATS_APP, PL_STAT, SGO_STAT, EQUIPOS, ODDS_API, PROPLINE, ODDS_PROPS
    if liga != "nfl":
        return
    LIGA.update(nombre="nfl", archivo="nfl.json", prefijo="nfl:", sgo="NFL", creditos="creditos_odds_nfl")
    STATS_APP = STATS_NFL
    PL_STAT = {pl: st for st, (pl, _) in STATS_APP.items()}
    SGO_STAT = {sg: st for st, (_, sg) in STATS_APP.items()}
    EQUIPOS = EQUIPOS_NFL
    ODDS_API = "https://api.the-odds-api.com/v4/sports/americanfootball_nfl"
    PROPLINE = "https://api.prop-line.com/v1/sports/americanfootball_nfl"
    ODDS_PROPS = ["player_pass_yds", "player_rush_yds", "player_reception_yds", "player_receptions", "player_anytime_td"]


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
        with open(ruta, encoding="utf-8-sig") as fh:
            for linea in fh:
                linea = linea.strip()
                if linea and not linea.startswith("#") and "=" in linea:
                    k, v = linea.split("=", 1)
                    if v.strip():
                        os.environ.setdefault(k.strip(), v.strip().strip('"'))


def norm_nombre(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    s = re.sub(r"[.'’\-]", " ", s)
    s = re.sub(r"\b(jr|sr|ii|iii|iv)\b", " ", s)
    return " ".join(s.split())


def a_decimal(americana) -> float | None:
    """Cuota americana (-110, '+250') a decimal (1,91 · 3,50)."""
    try:
        a = float(str(americana).replace("+", ""))
    except (TypeError, ValueError):
        return None
    if abs(a) < 100:
        return None
    return round(1 + a / 100, 3) if a > 0 else round(1 + 100 / -a, 3)


def num(x) -> float | None:
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


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


class Acumulador:
    """Junta las cuotas de todas las casas de UNA fuente y calcula el consenso."""

    def __init__(self):
        self.d = defaultdict(lambda: {"over": [], "under": []})

    def add(self, entidad: str, stat: str, lado: str, punto, precio_dec) -> None:
        if precio_dec and precio_dec > 1:
            self.d[(entidad, stat)][lado].append((punto, precio_dec))

    def filas(self) -> dict[tuple[str, str], dict]:
        out = {}
        for (ent, st), lados in self.d.items():
            if st == "ml":
                _, p = consenso([(None, pr) for _, pr in lados["over"]])
                if p:
                    out[(ent, st)] = {"player_id": ent, "stat": st, "line": 0, "over_odd": p, "under_odd": None}
                continue
            base = lados["over"] or lados["under"]
            linea, _ = consenso(base)
            if linea is None:
                continue
            po = consenso([x for x in lados["over"] if x[0] == linea])[1]
            pu = None if st == "spread" else consenso([x for x in lados["under"] if x[0] == linea])[1]
            if po or pu:
                out[(ent, st)] = {"player_id": ent, "stat": st, "line": linea, "over_odd": po, "under_odd": pu}
        return out


class Jugadores:
    """Empareja jugadores por id de la NBA o, si no, por nombre."""

    def __init__(self, nba: dict, equipos: set[str]):
        self.ids = {pid for pid, p in nba.get("players", {}).items()}
        self.equipo = {pid: p.get("team") for pid, p in nba.get("players", {}).items()}
        self.idx, ambiguos = {}, set()
        for pid, p in nba.get("players", {}).items():
            if p.get("team") not in equipos:
                continue
            n = norm_nombre(p["name"])
            for k in {n, " ".join(n.split()[:1] + n.split()[-1:])}:
                if k in self.idx and self.idx[k] != pid:
                    ambiguos.add(k)
                self.idx[k] = pid
        for k in ambiguos:
            self.idx.pop(k, None)
        self.sin = set()

    def buscar(self, nombre: str, nba_id: str | None = None) -> str | None:
        if nba_id and nba_id in self.ids:
            return nba_id
        n = norm_nombre(nombre)
        pid = self.idx.get(n) or self.idx.get(" ".join(n.split()[:1] + n.split()[-1:]))
        if not pid and nombre:
            self.sin.add(nombre)
        return pid


def huecos(filas: dict, partidos: list[dict], jug: Jugadores) -> tuple[list[dict], list[dict]]:
    """Partidos a los que les falta el mercado de partido / no tienen ninguna prop."""
    sin_partido, sin_props = [], []
    con_props = {jug.equipo.get(pid) for (pid, st) in filas if not pid.startswith(("T:", "G:"))}
    for g in partidos:
        claves = [(f"T:{g['home']}", "ml"), (f"T:{g['away']}", "ml"), (f"G:{g['away']}@{g['home']}", "total")]
        if any(k not in filas for k in claves):
            sin_partido.append(g)
        if g["home"] not in con_props or g["away"] not in con_props:
            sin_props.append(g)
    return sin_partido, sin_props


def http():
    import requests
    return requests.Session()


# ---------------------------------------------------------------- 1. PropLine
class PropLine:
    nombre = "PropLine"

    def __init__(self, key: str):
        self.s, self.key = http(), key
        self.restantes: int | None = None
        self.consultas = 0

    def get(self, ruta: str, **params):
        r = self.s.get(PROPLINE + ruta, params=params, headers={"X-API-Key": self.key}, timeout=60)
        self.consultas += 1
        if r.headers.get("x-daily-remaining") is not None:
            self.restantes = int(float(r.headers["x-daily-remaining"]))
        if r.status_code in (401, 403):
            raise RuntimeError("PropLine: la clave PROPLINE_API_KEY no es válida.")
        if r.status_code == 429:
            raise RuntimeError("PropLine: límite diario agotado.")
        r.raise_for_status()
        return r.json()

    def recoger(self, partidos: list[dict], jug: Jugadores) -> dict:
        eventos = self.get("/events")
        por_equipos = {}
        for ev in eventos:
            h, a = EQUIPOS.get(ev.get("home_team")), EQUIPOS.get(ev.get("away_team"))
            if h and a:
                por_equipos.setdefault((a, h), ev)   # vienen ordenados por fecha: el primero es el de hoy
        mercados = ",".join(["h2h", "spreads", "totals"] + [pl for pl, _ in STATS_APP.values()])
        acc = Acumulador()
        for g in partidos:
            ev = por_equipos.get((g["away"], g["home"]))
            if not ev:
                continue
            datos = self.get(f"/events/{ev['id']}/odds", markets=mercados)
            self.leer(datos, g, acc, jug)
        return acc.filas()

    @staticmethod
    def leer(datos: dict, g: dict, acc: Acumulador, jug: Jugadores) -> None:
        juego = f"G:{g['away']}@{g['home']}"
        for bk in datos.get("bookmakers") or []:
            if bk.get("key") in DFS:
                continue
            for mk in bk.get("markets") or []:
                if mk.get("period") or mk.get("suspended_at") or (mk.get("line_type") or "main") != "main":
                    continue
                k = mk.get("key")
                for o in mk.get("outcomes") or []:
                    if o.get("dfs_odds_type") or o.get("payout_multiplier"):
                        continue
                    precio, punto = a_decimal(o.get("price")), num(o.get("point"))
                    nombre = (o.get("name") or "").lower()
                    if k in ("h2h", "spreads"):
                        tm = g["home"] if o.get("side") == "home" else g["away"] if o.get("side") == "away" else None
                        if tm:
                            acc.add(f"T:{tm}", "ml" if k == "h2h" else "spread", "over", None if k == "h2h" else punto, precio)
                    elif k == "totals":
                        lado = "over" if nombre == "over" else "under" if nombre == "under" else None
                        if not lado:
                            continue
                        if mk.get("team"):
                            tm = EQUIPOS.get(mk["team"])
                            if tm in (g["home"], g["away"]):
                                acc.add(f"T:{tm}", "pts", lado, punto, precio)
                        else:
                            acc.add(juego, "total", lado, punto, precio)
                    elif k in PL_STAT:
                        st = PL_STAT[k]
                        lado = "over" if nombre in ("over", "yes", "si", "sí") else "under" if nombre in ("under", "no") else None
                        if not lado:
                            continue
                        nba_id = ((o.get("player_id") or "").replace("nba:", "") or None) if LIGA["nombre"] == "nba" else None
                        pid = jug.buscar(o.get("description") or "", nba_id)
                        if pid:
                            acc.add(pid, st, lado, 0.5 if st in SI_NO else punto, precio)


# ---------------------------------------------------------------- 2. The Odds API
class OddsAPI:
    nombre = "The Odds API"

    def __init__(self, key: str):
        self.s, self.key = http(), key
        self.restantes: int | None = None
        self.gastado = 0

    def get(self, ruta: str, **params):
        params["apiKey"] = self.key
        url = ruta if ruta.startswith("http") else f"{ODDS_API}{ruta}"
        r = self.s.get(url, params=params, timeout=30)
        if r.status_code == 401:
            raise RuntimeError("The Odds API: la clave ODDS_API_KEY no es válida.")
        if r.status_code == 429:
            raise RuntimeError("The Odds API: créditos del mes agotados.")
        r.raise_for_status()
        if r.headers.get("x-requests-remaining") is not None:
            self.restantes = int(float(r.headers["x-requests-remaining"]))
            self.gastado += int(float(r.headers.get("x-requests-last", 0) or 0))
        return r.json()

    def saldo(self) -> int | None:
        self.get("https://api.the-odds-api.com/v4/sports")   # gratis y devuelve el saldo
        return self.restantes

    @staticmethod
    def presupuesto_props(restantes: int, hoy: datetime) -> int:
        """Créditos que se pueden gastar hoy en props sin poner en riesgo el resto del mes."""
        quedan = calendar.monthrange(hoy.year, hoy.month)[1] - hoy.day + 1
        reserva = 2 * COSTE_PARTIDOS * (quedan - 1) + MINIMO_SEGURIDAD
        return max(0, (restantes - reserva) // max(1, quedan))

    def recoger(self, sin_partido: list[dict], sin_props: list[dict], jug: Jugadores, con_props: bool) -> dict:
        if not sin_partido and not (con_props and sin_props):
            return {}
        eventos = self.get("/events", dateFormat="iso")   # gratis
        por_equipos = {}
        for ev in eventos:
            h, a = EQUIPOS.get(ev.get("home_team")), EQUIPOS.get(ev.get("away_team"))
            if h and a:
                por_equipos.setdefault((a, h), ev)
        acc = Acumulador()
        pares = [(g, por_equipos[(g["away"], g["home"])]) for g in sin_partido if (g["away"], g["home"]) in por_equipos]
        if pares:
            lista = self.get("/odds", regions="eu", markets="h2h,spreads,totals", oddsFormat="decimal",
                             eventIds=",".join(ev["id"] for _, ev in pares))
            datos = {ev["id"]: ev for ev in lista}
            for g, ev in pares:
                self.leer(datos.get(ev["id"]) or {}, g, acc, jug)
        if con_props and self.restantes is not None:
            pres = self.presupuesto_props(self.restantes, datetime.now())
            for g in sin_props:
                ev = por_equipos.get((g["away"], g["home"]))
                k = min(len(ODDS_PROPS), pres)
                if not ev or k <= 0 or (self.restantes or 0) - k < MINIMO_SEGURIDAD:
                    continue
                datos = self.get(f"/events/{ev['id']}/odds", regions="us", markets=",".join(ODDS_PROPS[:k]), oddsFormat="decimal")
                pres -= k
                self.leer(datos, g, acc, jug)
        return acc.filas()

    @staticmethod
    def leer(datos: dict, g: dict, acc: Acumulador, jug: Jugadores) -> None:
        juego = f"G:{g['away']}@{g['home']}"
        for bk in datos.get("bookmakers", []):
            for mk in bk.get("markets", []):
                k = mk.get("key")
                for o in mk.get("outcomes", []):
                    precio, punto, nombre = num(o.get("price")), num(o.get("point")), o.get("name")
                    if k in ("h2h", "spreads"):
                        tm = EQUIPOS.get(nombre)
                        if tm in (g["home"], g["away"]):
                            acc.add(f"T:{tm}", "ml" if k == "h2h" else "spread", "over", None if k == "h2h" else punto, precio)
                    elif k == "totals" and nombre in ("Over", "Under"):
                        acc.add(juego, "total", nombre.lower(), punto, precio)
                    elif k in PL_STAT and nombre in ("Over", "Under"):
                        pid = jug.buscar(o.get("description") or "")
                        if pid:
                            acc.add(pid, PL_STAT[k], nombre.lower(), punto, precio)


# ---------------------------------------------------------------- 3. SportsGameOdds
class SportsGameOdds:
    nombre = "SportsGameOdds"

    def __init__(self, key: str):
        self.s, self.key = http(), key
        self.objetos = 0

    def recoger(self, partidos: list[dict], jug: Jugadores, inicio: datetime, fin: datetime) -> dict:
        if not partidos:
            return {}
        r = self.s.get(f"{SGO}/events/", headers={"x-api-key": self.key}, timeout=60, params={
            "leagueID": LIGA["sgo"], "oddsAvailable": "true", "limit": 20,
            "startsAfter": inicio.strftime("%Y-%m-%dT%H:%M:%SZ"), "startsBefore": fin.strftime("%Y-%m-%dT%H:%M:%SZ")})
        if r.status_code in (401, 403):
            raise RuntimeError("SportsGameOdds: la clave SGO_API_KEY no es válida.")
        if r.status_code == 429:
            raise RuntimeError("SportsGameOdds: límite del mes agotado.")
        r.raise_for_status()
        eventos = r.json().get("data") or []
        self.objetos += len(eventos)
        quiero = {(g["away"], g["home"]): g for g in partidos}
        acc = Acumulador()
        for ev in eventos:
            t = ev.get("teams") or {}
            h = (t.get("home", {}).get("names") or {}).get("short")
            a = (t.get("away", {}).get("names") or {}).get("short")
            h = EQUIPOS.get((t.get("home", {}).get("names") or {}).get("long"), h)
            a = EQUIPOS.get((t.get("away", {}).get("names") or {}).get("long"), a)
            g = quiero.get((a, h))
            if g:
                self.leer(ev, g, acc, jug)
        return acc.filas()

    @staticmethod
    def leer(ev: dict, g: dict, acc: Acumulador, jug: Jugadores) -> None:
        juego = f"G:{g['away']}@{g['home']}"
        nombres = {pid: (p or {}).get("name") or "" for pid, p in (ev.get("players") or {}).items()}
        for o in (ev.get("odds") or {}).values():
            if o.get("periodID") != "game" or not o.get("bookOddsAvailable", True) or o.get("started"):
                continue
            stat, ent, tipo, lado = o.get("statID"), o.get("statEntityID"), o.get("betTypeID"), o.get("sideID")
            precio = a_decimal(o.get("bookOdds"))
            if ent in ("home", "away", "all") and stat == "points":
                tm = g["home"] if ent == "home" else g["away"]
                if tipo == "ml" and ent != "all":
                    acc.add(f"T:{tm}", "ml", "over", None, precio)
                elif tipo == "sp" and ent != "all":
                    acc.add(f"T:{tm}", "spread", "over", num(o.get("bookSpread")), precio)
                elif tipo == "ou" and lado in ("over", "under"):
                    acc.add(juego if ent == "all" else f"T:{tm}", "total" if ent == "all" else "pts", lado,
                            num(o.get("bookOverUnder")), precio)
            elif o.get("playerID") and stat in SGO_STAT:
                st = SGO_STAT[stat]
                lado = {"over": "over", "under": "under", "yes": "over", "no": "under"}.get(lado)
                pid = jug.buscar(nombres.get(o["playerID"]) or "")
                if pid and lado:
                    acc.add(pid, st, lado, 0.5 if st in SI_NO else num(o.get("bookOverUnder")), precio)


# ---------------------------------------------------------------- Supabase
class Supa:
    def __init__(self, url: str, key: str):
        self.s, self.url = http(), url.rstrip("/")
        self.h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    def manuales(self, fecha: str) -> set[tuple[str, str]] | None:
        # Supabase devuelve como mucho 1.000 filas por consulta: se piden por páginas.
        filas, i = [], 0
        while True:
            r = self.s.get(f"{self.url}/rest/v1/odds", headers={**self.h, "Range": f"{i}-{i + 999}"}, timeout=30,
                           params={"select": "player_id,stat,fuente", "game_date": f"eq.{fecha}", "order": "player_id,stat"})
            if r.status_code >= 400 and r.status_code != 416:   # falta la columna 'fuente' (no se ejecutó supabase_cuotas.sql)
                return None
            pagina = r.json() if r.status_code != 416 else []
            filas += pagina
            if len(pagina) < 1000:
                break
            i += 1000
        return {(x["player_id"], x["stat"]) for x in filas if (x.get("fuente") or "manual") == "manual"}

    def subir(self, filas: list[dict], con_fuente: bool) -> None:
        if not filas:
            return
        ahora = datetime.now(timezone.utc).isoformat()
        for f in filas:
            f["updated_at"] = ahora
            if con_fuente:
                f["fuente"] = "auto"
        for i in range(0, len(filas), 500):
            r = self.s.post(f"{self.url}/rest/v1/odds?on_conflict=player_id,stat,game_date", timeout=60,
                            headers={**self.h, "Prefer": "resolution=merge-duplicates"}, data=json.dumps(filas[i:i + 500]))
            r.raise_for_status()

    def guardar_creditos(self, info: dict) -> None:
        try:
            self.s.post(f"{self.url}/rest/v1/ajustes", timeout=30, headers={**self.h, "Prefer": "resolution=merge-duplicates"},
                        data=json.dumps({"clave": LIGA["creditos"], "valor": json.dumps(info)}))
        except Exception:
            pass


# ---------------------------------------------------------------- principal
def ventana_utc(fecha: str) -> tuple[datetime, datetime]:
    """Partidos de la jornada NBA `fecha` (hora del este): de 15:00 UTC de ese día a 12:00 UTC del siguiente."""
    d = datetime.strptime(fecha, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return d + timedelta(hours=15), d + timedelta(hours=36)


def resumen(filas: dict) -> str:
    partido = sum(1 for (e, _) in filas if e.startswith(("T:", "G:")))
    return f"{partido} de partido + {len(filas) - partido} de jugadores"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--props", action="store_true", help="permitir gastar créditos de The Odds API en props que falten")
    ap.add_argument("--prueba", action="store_true", help="no sube nada a Supabase")
    ap.add_argument("--solo", choices=["propline", "oddsapi", "sgo"], help="usar una sola fuente (para probar)")
    ap.add_argument("--liga", choices=["nba", "nfl"], default="nba")
    args = ap.parse_args()

    cargar_config()
    usar_liga(args.liga)
    ruta_nba = os.path.join(CARPETA, LIGA["archivo"])
    if not os.path.exists(ruta_nba):
        sys.exit(f"Falta {LIGA['archivo']}: ejecuta antes actualizar_{args.liga}.py.")
    with open(ruta_nba, encoding="utf-8") as fh:
        nba = json.load(fh)
    partidos = nba.get("games") or []
    from bajas import actualizar as actualizar_bajas
    actualizar_bajas(nba, subir_a_supabase=not args.prueba, liga=args.liga)
    if not partidos:
        print("Hoy no hay partidos: no se consulta ninguna API.")
        return
    fecha = partidos[0]["date"]   # NFL: toda la jornada se guarda con la fecha de su primer partido
    jug = Jugadores(nba, {t for g in partidos for t in (g["home"], g["away"])})
    usar = (lambda f: args.solo in (None, f))
    claves = {"propline": os.environ.get("PROPLINE_API_KEY"), "oddsapi": os.environ.get("ODDS_API_KEY"),
              "sgo": os.environ.get("SGO_API_KEY")}
    filas: dict[tuple[str, str], dict] = {}
    origen = Counter()
    pl = oa = sg = None

    def juntar(nuevas: dict, fuente: str) -> None:
        n = 0
        for k, f in nuevas.items():
            if k not in filas:
                filas[k] = f
                n += 1
        origen[fuente] += n

    # 1. PropLine: todo lo que pueda
    if usar("propline") and claves["propline"]:
        pl = PropLine(claves["propline"])
        try:
            nuevas = pl.recoger(partidos, jug)
            juntar(nuevas, "propline")
            print(f"PropLine: {resumen(nuevas)} · consultas hoy restantes {pl.restantes}")
        except Exception as e:
            print(f"PropLine falló: {e}")

    # 2. The Odds API: huecos de partido (y props con --props)
    sin_partido, sin_props = huecos(filas, partidos, jug)
    if usar("oddsapi") and claves["oddsapi"]:
        oa = OddsAPI(claves["oddsapi"])
        try:
            nuevas = oa.recoger(sin_partido, sin_props, jug, args.props or args.solo == "oddsapi")
            juntar(nuevas, "oddsapi")
            if nuevas:
                print(f"The Odds API: {resumen(nuevas)} nuevas · créditos restantes {oa.restantes}")
            oa.saldo()
        except Exception as e:
            print(f"The Odds API falló: {e}")

    # 3. SportsGameOdds: lo que siga faltando
    sin_partido, sin_props = huecos(filas, partidos, jug)
    faltan = [g for g in partidos if g in sin_partido or g in sin_props]
    if usar("sgo") and claves["sgo"] and faltan:
        sg = SportsGameOdds(claves["sgo"])
        try:
            nuevas = sg.recoger(faltan, jug, ventana_utc(fecha)[0], ventana_utc(partidos[-1]["date"])[1])
            juntar(nuevas, "sgo")
            print(f"SportsGameOdds: {resumen(nuevas)} nuevas · {sg.objetos} eventos gastados")
        except Exception as e:
            print(f"SportsGameOdds falló: {e}")

    sin_partido, sin_props = huecos(filas, partidos, jug)
    for g in sin_partido:
        print(f"  Sin cuotas de partido: {g['away']}@{g['home']} (ponlas a mano)")
    for g in sin_props:
        print(f"  Sin props: {g['away']}@{g['home']}")
    if jug.sin:
        s = sorted(jug.sin)
        print(f"  Jugadores sin emparejar ({len(s)}): {', '.join(s[:12])}{'…' if len(s) > 12 else ''}")

    lista = list(filas.values())
    creditos = {
        "restantes": oa.restantes if oa else None,
        "propline_restantes": pl.restantes if pl else None,
        "sgo_eventos": sg.objetos if sg else 0,
        "origen": dict(origen),
        "cuando": datetime.now(timezone.utc).isoformat(),
    }
    print(f"Total: {resumen(filas)} · origen {dict(origen)}")
    if args.prueba:
        print("Modo prueba: no se sube nada.")
        return

    url, skey = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not skey:
        sys.exit("Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY en config.env.")
    sb = Supa(url, skey)
    for f in lista:
        f["player_id"] = LIGA["prefijo"] + f["player_id"]
    manuales = sb.manuales(fecha)
    if manuales is None:
        print("  Aviso: falta la columna 'fuente' (ejecuta supabase_cuotas.sql); las cuotas a mano se pueden pisar.")
    else:
        antes = len(lista)
        lista = [f for f in lista if (f["player_id"], f["stat"]) not in manuales]
        if antes != len(lista):
            print(f"  Respetadas {antes - len(lista)} cuotas puestas a mano.")
    for f in lista:
        f["game_date"] = fecha
    sb.subir(lista, con_fuente=manuales is not None)
    sb.guardar_creditos(creditos)
    print(f"Listo: {len(lista)} cuotas {args.liga.upper()} subidas para el {fecha}.")


if __name__ == "__main__":
    main()
