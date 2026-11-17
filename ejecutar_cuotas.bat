@echo off
rem Descarga cuotas (PropLine, The Odds API, SportsGameOdds) y las sube a Supabase. Uso: ejecutar_cuotas.bat [--props]
rem Cuotas NFL automaticas en pausa hasta tener un plan de creditos (17/11/2026): a las 18:00 solo se suben las bajas NFL.
rem Para volver a activarlas, cambia la ultima linea por:  if "%~1"=="" py actualizar_cuotas.py --liga nfl >> cuotas.log 2>&1
cd /d "%~dp0"
echo ==== %date% %time% %* ==== >> cuotas.log
py actualizar_cuotas.py %* >> cuotas.log 2>&1
if "%~1"=="" py bajas.py --liga nfl --subir >> cuotas.log 2>&1
