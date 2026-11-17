@echo off
REM Descarga las estadisticas de la NBA, la NFL y el futbol y las sube a Supabase.
REM Guarda lo que pasa en actualizacion.log (junto a este archivo).
cd /d "%~dp0"
echo ===== %date% %time% ===== >> actualizacion.log
py actualizar_nfl.py --subir >> actualizacion.log 2>&1
if errorlevel 1 echo ERROR NFL: revisa actualizacion.log >> actualizacion.log
py actualizar_futbol.py --subir >> actualizacion.log 2>&1
if errorlevel 1 echo ERROR FUTBOL: revisa actualizacion.log >> actualizacion.log
py actualizar_nba.py --subir >> actualizacion.log 2>&1
if errorlevel 1 (
  echo ERROR: revisa actualizacion.log >> actualizacion.log
  exit /b 1
)
