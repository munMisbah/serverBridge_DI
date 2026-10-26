@echo off
title Dynamic Island for Windows 11 - Dev
echo ===================================================
echo   Dynamic Island for Windows 11 - Development Run
echo ===================================================
echo Checking dependencies...
if not exist node_modules (
    echo Installing node dependencies...
    call npm install
)

echo Starting Dynamic Island in Tauri Desktop mode...
call npm run tauri:dev
pause
