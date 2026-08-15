@echo off
REM Starts the PMI Bangladesh Expense Management app dev server.
REM Safe to run multiple times - skips if already running on port 3000.

cd /d "%~dp0"

netstat -ano | findstr ":3000" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo Expense Management app is already running on http://localhost:3000
    goto :eof
)

if not exist logs mkdir logs

echo Starting Expense Management app...
start "PMIBD Expense Management" /min cmd /c "npm run dev > logs\dev-server.log 2>&1"

ping -n 4 127.0.0.1 >nul
start "" "http://localhost:3000"
