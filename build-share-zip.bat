@echo off
setlocal
cd /d "%~dp0"
title GameSketch - Share-ZIP bauen

where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js wurde nicht gefunden. Bitte Node.js 20+ installieren: https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo   [1/2] Installiere Abhaengigkeiten ^(einmalig^)...
  call npm install
  if errorlevel 1 ( echo   npm install fehlgeschlagen. & pause & exit /b 1 )
)

echo   [1/2] Baue Frontend...
call npm run build
if errorlevel 1 ( echo   Build fehlgeschlagen. & pause & exit /b 1 )

echo   [2/2] Packe GameSketch-install.zip...
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\pack.ps1"
if errorlevel 1 ( echo   Packen fehlgeschlagen. & pause & exit /b 1 )

echo.
echo   Fertig. Diese GameSketch-install.zip kannst du teilen.
pause
