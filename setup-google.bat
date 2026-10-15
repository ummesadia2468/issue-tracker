@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get the LTS version from https://nodejs.org
  pause
  exit /b 1
)
node server\scripts\setup-google.js %1
echo.
pause
