@echo off
cd /d C:\Users\Zmart\Desktop\qb-alfuraat-export
"%WINDIR%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Zmart\Desktop\blue-plastic\scripts\qb-migrate-alfuraat\export-custom-field-defs.ps1"
exit /b %ERRORLEVEL%
