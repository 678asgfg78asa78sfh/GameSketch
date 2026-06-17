@echo off
setlocal
cd /d "%~dp0"
title GameSketch

rem --- check Node.js ---
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js wurde nicht gefunden.
  echo   Bitte Node.js 20+ installieren: https://nodejs.org
  echo.
  start "" https://nodejs.org/
  pause
  exit /b 1
)

rem --- check git (each project is its own git repo for history/restore) ---
where git >nul 2>nul
if errorlevel 1 (
  echo.
  echo   git wurde nicht gefunden ^(wird fuer die Projekt-Historie gebraucht^).
  echo   Bitte git installieren: https://git-scm.com
  echo.
  start "" https://git-scm.com/download/win
  pause
  exit /b 1
)

rem --- first run: install dependencies (needs internet, one time) ---
if not exist "node_modules" (
  echo.
  echo   [GameSketch] Erster Start: installiere Abhaengigkeiten ^(einmalig, braucht Internet^)...
  echo.
  call npm install
  if errorlevel 1 (
    echo   npm install ist fehlgeschlagen.
    pause
    exit /b 1
  )
)

rem --- build the UI if the prebuilt one is missing ---
if not exist "web\dist\index.html" (
  echo.
  echo   [GameSketch] Baue die Oberflaeche...
  echo.
  call npm run build
  if errorlevel 1 (
    echo   Build ist fehlgeschlagen.
    pause
    exit /b 1
  )
)

rem --- start the server in its own window and open the browser ---
echo.
echo   [GameSketch] Starte auf http://127.0.0.1:4321
echo   ^(Das Server-Fenster offen lassen. Schliessen = GameSketch beenden.^)
echo.
start "GameSketch Server - zum Beenden schliessen" cmd /k "npm start"
timeout /t 3 >nul
start "" http://127.0.0.1:4321
exit /b 0
