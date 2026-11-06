@echo off
"%WINDIR%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Zmart\Desktop\blue-plastic\scripts\qb-migrate-alfuraat\export-invoice-0970-full.ps1"
exit /b %ERRORLEVEL%
