@echo off
title Vite WiFi Connect Tool

set PORT=5173
if not "%~1"=="" set PORT=%~1

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed! Please install Node.js first.
    pause
    exit /b 1
)

node "%~dp0qr-helper.js" %PORT%

if exist "package.json" (
    call npx vite --host 0.0.0.0 --port %PORT% --clearScreen false
) else (
    echo.
    echo [INFO] package.json was not found in the current directory.
    set /p PROJ_DIR="Enter your Vite project folder path: "
    if defined PROJ_DIR (
        cd /d "%PROJ_DIR%"
        call npx vite --host 0.0.0.0 --port %PORT% --clearScreen false
    ) else (
        echo Operation canceled.
        pause
    )
)
