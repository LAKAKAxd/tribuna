@echo off
rem Descarga cuotas (PropLine, The Odds API, SportsGameOdds) y las sube a Supabase. Uso: ejecutar_cuotas.bat [--props]
rem A las 18:00 (sin --props) tambien baja las de la jornada NFL; a las 21:00 solo NBA, para no gastar creditos de mas.
cd /d "%~dp0"
echo ==== %date% %time% %* ==== >> cuotas.log
py actualizar_cuotas.py %* >> cuotas.log 2>&1
if "%~1"=="" py actualizar_cuotas.py --liga nfl >> cuotas.log 2>&1
