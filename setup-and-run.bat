@echo off
title Issue Reporter
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed.
  echo  1. Download the LTS version from https://nodejs.org
  echo  2. Install it with the default options
  echo  3. Run this file again
  echo.
  pause
  exit /b 1
)

echo Using Node.js:
node -v

if not exist "server\.env" copy "server\.env.example" "server\.env" >nul

if not exist "node_modules" (
  echo.
  echo [1/3] Installing tools...
  call npm install --no-fund --no-audit
  if errorlevel 1 goto fail
)
if not exist "server\node_modules" (
  echo.
  echo [2/3] Installing server packages ^(this can take a few minutes the first time^)...
  call npm --prefix server install --no-fund --no-audit
  if errorlevel 1 goto fail
)
if not exist "client\node_modules" (
  echo.
  echo [3/3] Installing website packages...
  call npm --prefix client install --no-fund --no-audit
  if errorlevel 1 goto fail
)

findstr /R /C:"^GOOGLE_CLIENT_ID=.." "server\.env" >nul 2>nul
if errorlevel 1 (
  echo.
  echo  NOTE: Google sign-in is OFF. To turn it on, run setup-google.bat ^(see GOOGLE_SETUP.md^).
)

echo.
echo Starting Issue Reporter...
echo Your browser will open at http://localhost:5173
echo Keep this window open. Press Ctrl+C to stop.
echo.
start "" cmd /c "timeout /t 8 /nobreak >nul & start http://localhost:5173"
call npm run dev
goto :eof

:fail
echo.
echo  Setup failed. Scroll up and read the first line that says "error".
echo  Common fix: install the Node.js LTS version from https://nodejs.org and try again.
echo.
pause
exit /b 1
