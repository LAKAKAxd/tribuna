"""Bajas de jugadores NBA (lesiones, sanciones) para Tribuna.

Fuente: el parte de lesiones público de ESPN (JSON gratis, sin clave). El parte oficial de la NBA
es un PDF que bloquea las descargas automáticas. Solo para uso privado.

Se ejecuta solo desde actualizar_cuotas.py (18:00 y 21:00). A mano:
    python bajas.py            -> muestra las bajas de hoy
    python bajas.py --subir    -> además las sube a Supabase (snapshots, id 'bajas')
"""
import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone

from actualizar_cuotas import CARPETA, Jugadores, cargar_config, http

URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries"
# Abreviaturas de ESPN que no coinciden con las de NBA.com
ESPN_A_NBA = {"GS": "GSW", "NO": "NOP", "NY": "NYK", "SA": "SAS", "UTAH": "UTA", "WSH": "WAS", "PHO": "PHX"}


def estado(les: dict) -> str | None:
    """out | doubtful | questionable | probable (None = no cuenta)."""
    st = (les.get("status") or "").lower()
    fan = ((les.get("details") or {}).get("fantasyStatus") or {}).get("abbreviation", "").upper()
    txt = (les.get("shortComment") or "").lower()
    if st in ("out", "suspension") or fan in ("OUT", "OFS", "SUSP"):
        return "out"
    if re.search(r"\b(ruled out|will not play|won't play|is out for)\b", txt):
        return "out"
    if "doubtful" in txt:
        return "doubtful"
    if "probable" in txt or "expected to play" in txt:
        return "probable"
    return "questionable"   # Day-To-Day / GTD


def descargar(nba: dict) -> dict:
    datos = http().get(URL, timeout=30).json()
    jug = Jugadores(nba, {p.get("team") for p in nba.get("players", {}).values()})
    salida, sin = {}, []
    for eq in datos.get("injuries") or []:
        for les in eq.get("injuries") or []:
            at = les.get("athlete") or {}
            nombre = at.get("displayName") or ""
            team = (at.get("team") or {}).get("abbreviation", "")
            team = ESPN_A_NBA.get(team, team)
            st = estado(les)
            pid = jug.buscar(nombre)
            if not pid:
                sin.append(nombre)
                continue
            if not st:
                continue
            salida[pid] = {"status": st, "name": nombre, "team": team,
                           "note": (les.get("shortComment") or "")[:220], "date": les.get("date")}
    return {"updated": datetime.now(timezone.utc).isoformat(), "source": "ESPN", "players": salida, "sin_emparejar": sin}


def subir(bajas: dict) -> None:
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY en config.env.")
    r = http().post(f"{url.rstrip('/')}/rest/v1/snapshots", timeout=60,
                    headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
                             "Prefer": "resolution=merge-duplicates"},
                    data=json.dumps({"id": "bajas", "data": bajas}))
    r.raise_for_status()


def actualizar(nba: dict, subir_a_supabase: bool) -> None:
    """Para llamar desde otros scripts: nunca rompe la ejecución."""
    try:
        b = descargar(nba)
        n = {s: sum(1 for x in b["players"].values() if x["status"] == s) for s in ("out", "doubtful", "questionable")}
        print(f"Bajas (ESPN): {n['out']} fuera, {n['doubtful'] + n['questionable']} en duda"
              + (f" · sin emparejar: {', '.join(b['sin_emparejar'][:8])}" if b["sin_emparejar"] else ""))
        if subir_a_supabase:
            subir(b)
    except Exception as e:   # noqa: BLE001
        print(f"Bajas: no se pudieron actualizar ({e})")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--subir", action="store_true")
    args = ap.parse_args()
    cargar_config()
    with open(os.path.join(CARPETA, "nba.json"), encoding="utf-8") as fh:
        nba = json.load(fh)
    b = descargar(nba)
    for pid, x in sorted(b["players"].items(), key=lambda kv: (kv[1]["team"], kv[1]["status"])):
        print(f"{x['team']:4} {x['status']:12} {x['name']}")
    if b["sin_emparejar"]:
        print("Sin emparejar:", ", ".join(b["sin_emparejar"]))
    if args.subir:
        subir(b)
        print("Subido a Supabase.")


if __name__ == "__main__":
    sys.exit(main())
