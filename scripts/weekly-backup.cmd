@echo off
setlocal
cd /d "%~dp0\.."
echo [%date% %time%] SOM ERP weekly backup starting...
call pnpm backup:json
set ERR=%ERRORLEVEL%
if %ERR% neq 0 (
  echo [%date% %time%] BACKUP FAILED code %ERR%
  exit /b %ERR%
)
echo [%date% %time%] BACKUP OK — copy newest JSON from Downloads to Drive + USB
exit /b 0
