#
.SYNOPSIS
    check-updates.ps1 - Check for updates to project dependencies

.DESCRIPTION
    Checks for outdated packages in:
    - Composer (PHP/Laravel dependencies)
    - NPM (JavaScript dependencies)
    - Git repository status

.PARAMETER Path
    The path to the project directory (default: current directory)

.PARAMETER All
    Check all dependencies (composer, npm, git)

.EXAMPLE
    .\check-updates.ps1 -Path C:\laragon\www\poly-marketplace

.EXAMPLE
    .\check-updates.ps1 -All
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Path = ".",

    [switch]$All,

    [switch]$ComposerOnly,

    [switch]$NpmOnly
)

# Function to check if a command exists
function Test-CommandExists {
    param([string]$Command)
    try {
        $null = Get-Command $Command -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# Resolve path
$projectPath = Resolve-Path $Path -ErrorAction SilentlyContinue
if (-not $projectPath) {
    Write-Error "Path not found: $Path"
    exit 1
}
$projectPath = $projectPath.Path

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  CHECKING UPDATES" -ForegroundColor Cyan
Write-Host "  Project: $projectPath" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$hasUpdates = $false

# Check Composer
if ($All -or $ComposerOnly -or (-not $NpmOnly)) {
    $composerJson = Join-Path $projectPath "composer.json"
    if (Test-Path $composerJson) {
        Write-Host ">>> Checking Composer packages..." -ForegroundColor Yellow
        if (Test-CommandExists "composer") {
            $outdated = composer outdated --working-dir="$projectPath" 2>&1
            if ($LASTEXITCODE -eq 0) {
                $outdatedLines = $outdated | Where-Object { $_ -match '\|' -and $_ -notmatch '^Package' }
                if ($outdatedLines) {
                    Write-Host "  Found outdated Composer packages:" -ForegroundColor Red
                    $outdatedLines | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
                    $hasUpdates = $true
                } else {
                    Write-Host "  All Composer packages are up to date!" -ForegroundColor Green
                }
            } else {
                Write-Host "  Error checking Composer packages" -ForegroundColor Red
                Write-Host $outdated -ForegroundColor Gray
            }
        } else {
            Write-Host "  Composer not found in PATH. Skipping..." -ForegroundColor DarkGray
        }
        Write-Host ""
    }
}

# Check NPM
if ($All -or $NpmOnly -or (-not $ComposerOnly)) {
    $packageJson = Join-Path $projectPath "package.json"
    if (Test-Path $packageJson) {
        Write-Host ">>> Checking NPM packages..." -ForegroundColor Yellow
        if (Test-CommandExists "npm") {
            Push-Location $projectPath
            try {
                $outdated = npm outdated 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "  All NPM packages are up to date!" -ForegroundColor Green
                } else {
                    if ($outdated) {
                        Write-Host "  Found outdated NPM packages:" -ForegroundColor Red
                        $outdated | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
                        $hasUpdates = $true
                    } else {
                        Write-Host "  All NPM packages are up to date!" -ForegroundColor Green
                    }
                }
            } finally {
                Pop-Location
            }
        } else {
            Write-Host "  NPM not found in PATH. Skipping..." -ForegroundColor DarkGray
        }
        Write-Host ""
    }
}

# Check Git status
if ($All) {
    $gitDir = Join-Path $projectPath ".git"
    if (Test-Path $gitDir) {
        Write-Host ">>> Checking Git repository..." -ForegroundColor Yellow
        if (Test-CommandExists "git") {
            Push-Location $projectPath
            try {
                git fetch --quiet 2>&1 | Out-Null
                $status = git status -uno 2>&1
                if ($status -match "Your branch is behind") {
                    Write-Host "  Branch is behind remote. Run 'git pull' to update." -ForegroundColor Red
                    $hasUpdates = $true
                } elseif ($status -match "Your branch is up to date") {
                    Write-Host "  Git repository is up to date!" -ForegroundColor Green
                } else {
                    Write-Host "  Git status: $status" -ForegroundColor Gray
                }
            } finally {
                Pop-Location
            }
        } else {
            Write-Host "  Git not found in PATH. Skipping..." -ForegroundColor DarkGray
        }
        Write-Host ""
    }
}

# Summary
Write-Host "=========================================" -ForegroundColor Cyan
if ($hasUpdates) {
    Write-Host "  UPDATES AVAILABLE - Run update commands!" -ForegroundColor Yellow
} else {
    Write-Host "  ALL DEPENDENCIES UP TO DATE" -ForegroundColor Green
}
Write-Host "=========================================" -ForegroundColor Cyan

if ($hasUpdates) {
    exit 1
} else {
    exit 0
}
