@echo off
rem Cuotas automaticas (PropLine; respaldo The Odds API y SportsGameOdds) -> Supabase. Guarda lo que pasa en cuotas.log.
rem Uso (tareas programadas, hora de Italia):
rem   ejecutar_cuotas.bat           18:00  NBA, futbol y NFL de las proximas 48 h
rem   ejecutar_cuotas.bat --props   21:00  props NBA y NFL de esa noche
rem   ejecutar_cuotas.bat futbol    13:30  futbol de las proximas 48 h
rem   ejecutar_cuotas.bat nfl       domingo 17:45  NFL de la jornada (tras los inactivos)
cd /d "%~dp0"
echo ==== %date% %time% %* ==== >> cuotas.log
if "%~1"=="futbol" (
  py actualizar_cuotas.py --liga futbol >> cuotas.log 2>&1
  goto :eof
)
if "%~1"=="nfl" (
  py actualizar_cuotas.py --liga nfl --horas 12 >> cuotas.log 2>&1
  goto :eof
)
if "%~1"=="--props" (
  py actualizar_cuotas.py --props >> cuotas.log 2>&1
  py actualizar_cuotas.py --liga nfl --horas 8 >> cuotas.log 2>&1
  goto :eof
)
py actualizar_cuotas.py >> cuotas.log 2>&1
py actualizar_cuotas.py --liga futbol >> cuotas.log 2>&1
py actualizar_cuotas.py --liga nfl >> cuotas.log 2>&1
