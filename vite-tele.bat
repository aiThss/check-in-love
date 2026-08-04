@echo off
title Vite Telegram Project Launcher

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    pause
    exit /b 1
)

node "%~dp0vite-tele.js" %*
if %errorlevel% neq 0 pause
