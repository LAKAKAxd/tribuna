@echo off
rem Descarga cuotas de The Odds API y las sube a Supabase. Uso: ejecutar_cuotas.bat [--props]
cd /d "%~dp0"
echo ==== %date% %time% %* ==== >> cuotas.log
py actualizar_cuotas.py %* >> cuotas.log 2>&1
