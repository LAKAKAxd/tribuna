@echo off
REM Crea una tarea de Windows que ejecuta la actualizacion cada dia a las 09:00.
REM Si el ordenador esta apagado a esa hora, se ejecuta al encenderlo.
cd /d "%~dp0"
schtasks /Create /F /SC DAILY /ST 09:00 /TN "Tribuna NBA" /TR "\"%~dp0ejecutar_actualizacion.bat\""
powershell -NoProfile -Command "$t = Get-ScheduledTask -TaskName 'Tribuna NBA'; $t.Settings.StartWhenAvailable = $true; Set-ScheduledTask -InputObject $t | Out-Null"
echo.
echo Tarea "Tribuna NBA" creada: se ejecutara cada dia a las 09:00.
echo Para probarla ahora:  schtasks /Run /TN "Tribuna NBA"
pause
