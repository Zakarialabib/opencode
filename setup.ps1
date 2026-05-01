# OpenCode Setup Script - Single Launch Setup
# Requirements: Node.js, PHP 8.3+, Composer, SQLite

param(
    [string]$ProjectRoot = "C:\opencode",
    [switch]$Dev,
    [switch]$SkipDeps
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 OpenCode Setup Script" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

# Function to check if command exists
function Test-CommandExists {
    param($Command)
    try { Get-Command $Command -ErrorAction Stop; return $true }
    catch { return $false }
}

# Step 1: Check Prerequisites
Write-Host "`n📋 Checking prerequisites..." -ForegroundColor Yellow

if (-not (Test-CommandExists "node")) {
    Write-Host "❌ Node.js not found. Please install Node.js 18+" -ForegroundColor Red
    exit 1
}
$nodeVersion = (node --version)
Write-Host "  ✅ Node.js: $nodeVersion" -ForegroundColor Green

if (-not (Test-CommandExists "npm")) {
    Write-Host "❌ npm not found" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ npm: $(npm --version)" -ForegroundColor Green

if (-not $SkipDeps) {
    if (-not (Test-CommandExists "php")) {
        Write-Host "⚠️  PHP not found. Install PHP 8.3+ for Laravel features" -ForegroundColor Yellow
    } else {
        $phpVersion = (php --version | Select-Object -First 1)
        Write-Host "  ✅ PHP: $phpVersion" -ForegroundColor Green
    }

    if (-not (Test-CommandExists "composer")) {
        Write-Host "⚠️  Composer not found. Install for PHP dependencies" -ForegroundColor Yellow
    } else {
        Write-Host "  ✅ Composer: $(composer --version)" -ForegroundColor Green
    }
}

# Step 2: Install Node Dependencies
Write-Host "`n📦 Installing Node dependencies..." -ForegroundColor Yellow
Set-Location $ProjectRoot
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Node dependencies installed" -ForegroundColor Green

# Step 3: Setup Database
Write-Host "`n🗄️  Setting up database..." -ForegroundColor Yellow
$dbPath = Join-Path $ProjectRoot "database.sqlite"
if (-not (Test-Path $dbPath)) {
    New-Item -Path $dbPath -ItemType File -Force | Out-Null
    Write-Host "  ✅ Created SQLite database: $dbPath" -ForegroundColor Green
} else {
    Write-Host "  ✅ SQLite database exists" -ForegroundColor Green
}

# Step 4: Initialize OpenCode Config (if needed)
Write-Host "`n⚙️  Checking OpenCode configuration..." -ForegroundColor Yellow
$configPath = Join-Path $ProjectRoot "opencode.json"
if (-not (Test-Path $configPath)) {
    Write-Host "  ⚠️  opencode.json not found. Creating default..." -ForegroundColor Yellow
} else {
    Write-Host "  ✅ opencode.json found" -ForegroundColor Green
}

# Step 5: Run Self-Improver (optional)
if ($Dev) {
    Write-Host "`n🔧 Running self-improver..." -ForegroundColor Yellow
    node $ProjectRoot\self-improver.js $ProjectRoot
}

# Step 6: Launch OpenCode
Write-Host "`n🚀 Launching OpenCode..." -ForegroundColor Cyan
$launchScript = Join-Path $ProjectRoot "opencode-launch.js"
if (Test-Path $launchScript) {
    node $launchScript
} else {
    Write-Host "  ❌ Launch script not found: $launchScript" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Setup complete!" -ForegroundColor Green
