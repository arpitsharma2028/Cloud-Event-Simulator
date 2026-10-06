@echo off
setlocal
cd /d "%~dp0"
title Cloud Event Simulator

:: Check for modern PowerShell (pwsh) or built-in Windows PowerShell (powershell)
where pwsh >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
    goto :end
)

where powershell >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
    goto :end
)

echo [ERROR] Neither PowerShell nor pwsh could be found on this system.
pause
exit /b 1

:end
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Launcher encountered an error (code: %ERRORLEVEL%).
    pause
)
