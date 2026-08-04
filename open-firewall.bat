@echo off
title Opening Windows Firewall Ports for Vite Local Dev

:: Check for Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Requesting Administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ======================================================
echo  Opening Windows Firewall Ports (5173, 5174, 3000, 8080)
echo ======================================================
echo.

powershell -Command "Remove-NetFirewallRule -DisplayName 'Vite Local Dev Server Ports' -ErrorAction SilentlyContinue"
powershell -Command "New-NetFirewallRule -DisplayName 'Vite Local Dev Server Ports' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5173,5174,3000,8080 -Profile Any"

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] Ports 5173, 5174, 3000, 8080 opened successfully!
) else (
    echo.
    echo [ERROR] Failed to configure Windows Firewall.
)

echo.
pause
