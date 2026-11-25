@echo off
REM Descarga las estadisticas de la NBA, la NFL y el futbol y las sube a Supabase.
REM Guarda lo que pasa en actualizacion.log (junto a este archivo).
cd /d "%~dp0"
rem Al encender el PC las tareas atrasadas arrancan antes de que haya internet: se espera hasta 5 minutos.
set /a intentos=0
:esperar_red
powershell -NoProfile -Command "try{[Net.Dns]::GetHostEntry('site.api.espn.com')|Out-Null;exit 0}catch{exit 1}" >nul 2>&1 && goto red_ok
set /a intentos+=1
if %intentos% lss 30 (timeout /t 10 /nobreak >nul & goto esperar_red)
echo Sin internet tras 5 minutos >> actualizacion.log
:red_ok
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
