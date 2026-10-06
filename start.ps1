# Cloud Event Simulator - All-in-One Startup Script (PowerShell)
param (
    [switch]$Dev = $false
)

$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  CLOUD EVENT SIMULATOR - LOCAL ENVIRONMENT STARTUP     " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $rootDir

# 1. PATH Detection
Write-Host "[1/5] Verifying toolchain environment..." -ForegroundColor Yellow

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","User") + ";" + [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";$env:LOCALAPPDATA\Programs;C:\MinGW\bin"

# Locate Node if still not in path
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $wingetNode = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter "node.exe" -Recurse -Depth 3 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($wingetNode) {
        $env:Path = $wingetNode.DirectoryName + ";" + $env:Path
    }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js not found in PATH." -ForegroundColor Red
    exit 1
}

Write-Host "  -> Node.js version: $(node -v)" -ForegroundColor Green
Write-Host "  -> npm version:     $(npm -v)" -ForegroundColor Green

# 2. C++ Simulation Engine
Write-Host "`n[2/5] Checking C++ simulation engine binary..." -ForegroundColor Yellow
$binDir = Join-Path $rootDir "simulation-engine\bin"
$engineExe = Join-Path $binDir "cloud_sim_engine.exe"

if (-not (Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir -Force | Out-Null
}

if (-not (Test-Path $engineExe)) {
    Write-Host "  -> Compiling C++ Discrete Event Simulation Engine..." -ForegroundColor Cyan
    if (Get-Command g++ -ErrorAction SilentlyContinue) {
        & g++ -std=c++14 -O3 (Join-Path $rootDir "simulation-engine\src\main.cpp") -o $engineExe
        Write-Host "  -> C++ engine compiled successfully." -ForegroundColor Green
    } else {
        Write-Host "  -> [WARNING] g++ compiler not found. Please compile cloud_sim_engine.exe." -ForegroundColor Yellow
    }
} else {
    Write-Host "  -> C++ engine binary is ready." -ForegroundColor Green
}

# 3. Backend Dependencies
Write-Host "`n[3/5] Verifying Backend API dependencies..." -ForegroundColor Yellow
$backendModules = Join-Path $rootDir "backend\node_modules"
if (-not (Test-Path $backendModules)) {
    Write-Host "  -> Installing backend packages (npm install)..." -ForegroundColor Cyan
    Push-Location (Join-Path $rootDir "backend")
    npm install
    Pop-Location
    Write-Host "  -> Backend dependencies installed." -ForegroundColor Green
} else {
    Write-Host "  -> Backend dependencies are up to date." -ForegroundColor Green
}

# 4. Frontend Dependencies & Build
Write-Host "`n[4/5] Verifying Frontend Dashboard..." -ForegroundColor Yellow
$frontendModules = Join-Path $rootDir "frontend\node_modules"
$frontendDist = Join-Path $rootDir "frontend\dist"

if (-not (Test-Path $frontendModules)) {
    Write-Host "  -> Installing frontend packages (npm install)..." -ForegroundColor Cyan
    Push-Location (Join-Path $rootDir "frontend")
    npm install
    Pop-Location
    Write-Host "  -> Frontend dependencies installed." -ForegroundColor Green
} else {
    Write-Host "  -> Frontend dependencies are up to date." -ForegroundColor Green
}

if (-not (Test-Path $frontendDist)) {
    Write-Host "  -> Building frontend production bundle..." -ForegroundColor Cyan
    Push-Location (Join-Path $rootDir "frontend")
    npm run build
    Pop-Location
    Write-Host "  -> Frontend bundle built successfully." -ForegroundColor Green
} else {
    Write-Host "  -> Frontend production bundle ready." -ForegroundColor Green
}

# 5. Launch
Write-Host "`n[5/5] Launching Cloud Event Simulator..." -ForegroundColor Yellow

if ($Dev) {
    Write-Host "Starting in DEVELOPMENT mode (Backend watch + Frontend Vite)..." -ForegroundColor Cyan
    Write-Host "Backend API:  http://localhost:5050" -ForegroundColor Green
    Write-Host "Frontend App: http://localhost:5173" -ForegroundColor Green
    Write-Host ""
    
    # Open browser to Vite dev port
    Start-Process "http://localhost:5173"
    
    # Run backend in background and frontend in foreground
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$rootDir\backend'; node --watch src/index.js"
    cd "$rootDir\frontend"
    npm run dev
} else {
    Write-Host "Starting UNIFIED server on http://localhost:5050..." -ForegroundColor Green
    Write-Host "Serving both REST API and React UI." -ForegroundColor Green
    Write-Host "Press CTRL+C anytime to stop." -ForegroundColor DarkGray
    Write-Host ""

    # Open default browser
    Start-Process "http://localhost:5050"

    # Run unified backend server
    cd "$rootDir"
    node backend/src/index.js
}
