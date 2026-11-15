@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 or newer first.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:3000 after the server starts.
node --env-file-if-exists=.env backend/server.mjs
pause
