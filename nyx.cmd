@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found in PATH.
    echo         Install Node.js 20.11+ from https://nodejs.org/ and retry.
    pause
    exit /b 1
)

if not exist "node_modules\.bin\tsx.cmd" (
    echo First run: installing CLI dependencies ^(tsx, commander, figlet^)...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed. Check your network connection and retry.
        pause
        exit /b 1
    )
)

call npm run nytx
pause
