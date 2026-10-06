@echo off
setlocal enabledelayedexpansion

title Cloud Event Simulator - One-Click Launcher

echo ========================================================
echo   CLOUD EVENT SIMULATOR - LOCAL ENVIRONMENT STARTUP
echo ========================================================
echo.

cd /d "%~dp0"

:: Step 1: Ensure Node.js and g++ are in PATH
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Searching for Node.js in local installation directories...
    for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\OpenJS.NodeJS*") do (
        if exist "%%D\node-*-win-x64\node.exe" (
            set "PATH=%%D\node-*-win-x64;!PATH!"
        )
        if exist "%%D\node.exe" (
            set "PATH=%%D;!PATH!"
        )
    )
    if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;!PATH!"
    if exist "C:\Program Files (x86)\nodejs\node.exe" set "PATH=C:\Program Files (x86)\nodejs;!PATH!"
)

where g++ >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    if exist "C:\MinGW\bin\g++.exe" set "PATH=C:\MinGW\bin;!PATH!"
)

:: Verify Node.js is available
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js could not be found. Please ensure Node.js is installed.
    pause
    exit /b 1
)

:: Step 2: Build C++ Simulation Engine if not present
echo [1/4] Checking C++ Simulation Engine binary...
if not exist "simulation-engine\bin" mkdir "simulation-engine\bin"

if not exist "simulation-engine\bin\cloud_sim_engine.exe" (
    echo [INFO] Compiling C++ Discrete Event Simulation Engine...
    where g++ >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        g++ -std=c++14 -O3 "simulation-engine\src\main.cpp" -o "simulation-engine\bin\cloud_sim_engine.exe"
        if %ERRORLEVEL% NEQ 0 (
            echo [ERROR] Failed to compile C++ engine.
            pause
            exit /b 1
        )
        echo [OK] C++ Simulation Engine compiled successfully.
    ) else (
        echo [WARNING] g++ compiler not found in PATH. Make sure cloud_sim_engine.exe is built.
    )
) else (
    echo [OK] C++ Simulation Engine binary is up to date.
)
echo.

:: Step 3: Install backend dependencies if missing
echo [2/4] Verifying Backend API dependencies...
if not exist "backend\node_modules" (
    echo [INFO] Installing backend dependencies (npm install)...
    cd backend
    call npm install
    cd ..
    echo [OK] Backend dependencies installed.
) else (
    echo [OK] Backend dependencies already installed.
)
echo.

:: Step 4: Install frontend dependencies and build production assets if missing
echo [3/4] Verifying Frontend Dashboard...
if not exist "frontend\node_modules" (
    echo [INFO] Installing frontend dependencies (npm install)...
    cd frontend
    call npm install
    cd ..
    echo [OK] Frontend dependencies installed.
) else (
    echo [OK] Frontend dependencies already installed.
)

if not exist "frontend\dist" (
    echo [INFO] Building frontend production bundle...
    cd frontend
    call npm run build
    cd ..
    echo [OK] Frontend dashboard built successfully.
) else (
    echo [OK] Frontend bundle ready.
)
echo.

:: Step 5: Launch Server and Open Browser
echo [4/4] Starting Cloud Event Simulator on http://localhost:5050...
echo.
echo ========================================================
echo   SERVER RUNNING AT: http://localhost:5050
echo   Press CTRL+C anytime to stop the server.
echo ========================================================
echo.

:: Launch default browser after 2 seconds in background
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5050"

:: Start the application server
node backend\src\index.js

pause
