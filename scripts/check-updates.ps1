# Check for Package Updates Script
# Checks npm, composer, and system packages for available updates

$ErrorActionPreference = "Continue"

Write-Host "🔍 Checking for Package Updates" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

# Check Node.js packages
Write-Host "`n📦 Checking Node.js packages..." -ForegroundColor Yellow
if (Get-Command "npm" -ErrorAction SilentlyContinue) {
    Write-Host "  Running: npm outdated..." -ForegroundColor Gray
    npm outdated
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ All Node.js packages are up to date" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Some packages have updates available" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ❌ npm not found" -ForegroundColor Red
}

# Check PHP packages (if composer exists)
Write-Host "`n📦 Checking PHP packages..." -ForegroundColor Yellow
if (Get-Command "composer" -ErrorAction SilentlyContinue) {
    if (Test-Path "composer.json") {
        Write-Host "  Running: composer outdated..." -ForegroundColor Gray
        composer outdated
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ All PHP packages are up to date" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Some packages have updates available" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ⚠️  No composer.json found in current directory" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ❌ Composer not found" -ForegroundColor Red
}

# Check global npm packages
Write-Host "`n📦 Checking global npm packages..." -ForegroundColor Yellow
if (Get-Command "npm" -ErrorAction SilentlyContinue) {
    Write-Host "  Running: npm outdated -g..." -ForegroundColor Gray
    npm outdated -g
}

# Check Laravel installer (if installed)
Write-Host "`n📦 Checking Laravel installer..." -ForegroundColor Yellow
if (Get-Command "laravel" -ErrorAction SilentlyContinue) {
    $laravelVersion = (laravel --version)
    Write-Host "  ✅ Laravel installer: $laravelVersion" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Laravel installer not found" -ForegroundColor Yellow
}

# Check PHP version (for Laravel 13 compatibility)
Write-Host "`n📋 Checking PHP version..." -ForegroundColor Yellow
if (Get-Command "php" -ErrorAction SilentlyContinue) {
    $phpVersion = (php --version | Select-Object -First 1)
    Write-Host "  PHP: $phpVersion" -ForegroundColor Green
    
    if ($phpVersion -match "8\.[3-5]") {
        Write-Host "  ✅ PHP version compatible with Laravel 13" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  PHP 8.3+ required for Laravel 13" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ❌ PHP not found" -ForegroundColor Red
}

# Summary
Write-Host "`n📊 Update Check Summary" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host "Run the following to update:" -ForegroundColor White
Write-Host "  npm update" -ForegroundColor Gray
Write-Host "  composer update" -ForegroundColor Gray
Write-Host "`nFor Laravel 13 upgrade:" -ForegroundColor White
Write-Host "  composer require laravel/framework:^13.0" -ForegroundColor Gray
Write-Host "  composer require livewire/livewire:^4.0" -ForegroundColor Gray
Write-Host "  composer require laravel/boost:^2.0 --dev" -ForegroundColor Gray
Write-Host "`n✅ Update check complete!" -ForegroundColor Green
