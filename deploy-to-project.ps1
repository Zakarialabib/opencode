# Deploy OpenCode configuration to a target project
# Usage: .\deploy-to-project.ps1 -TargetPath "C:\MyProject"
# For web client: .\deploy-to-project.ps1 -TargetPath "C:\MyProject" -WebClient

param(
    [string]$TargetPath = ".",
    [switch]$Symlink,
    [switch]$WebClient,
    [string]$ProjectRoot = $PSScriptRoot
)

$source = $ProjectRoot

Write-Host "Deploying OpenCode config to: $TargetPath" -ForegroundColor Cyan
if ($WebClient) {
    Write-Host "  Mode: Web Client (will configure CORS for web access)" -ForegroundColor Yellow
}

# Create target directory if it doesn't exist
if (-not (Test-Path $TargetPath)) {
    New-Item -ItemType Directory -Path $TargetPath -Force | Out-Null
    Write-Host "Created directory: $TargetPath"
}

# Deploy opencode.json to target root, everything else goes into opencode/ subdirectory
$opencodeDir = Join-Path $TargetPath "opencode"
if (-not (Test-Path $opencodeDir)) {
    New-Item -ItemType Directory -Path $opencodeDir -Force | Out-Null
    Write-Host "Created directory: $opencodeDir"
}

# Deploy opencode.json to target root
$items = @(
    "opencode.json"
)

# Deploy these inside opencode/ subdirectory (plugins stay in OpenCode install dir, not copied)
$subdirItems = @(
    "skills",
    "agents",
    "rules",
    "workflows",
    "tools"
)

foreach ($item in $items) {
    $sourcePath = Join-Path $source $item
    $targetPathFull = Join-Path $TargetPath $item
    
    if (Test-Path $sourcePath) {
        if ($Symlink) {
            # Create symbolic link (requires admin privileges)
            if (Test-Path $targetPathFull) {
                Remove-Item $targetPathFull -Recurse -Force
            }
            cmd /c "mklink /D `"$targetPathFull`" `"$sourcePath`""
            Write-Host "  Linked: $item" -ForegroundColor Green
        } else {
            # Copy files
            if (Test-Path $targetPathFull) {
                Remove-Item $targetPathFull -Recurse -Force
            }
            Copy-Item $sourcePath $targetPathFull -Recurse -Force
            
            # Fix paths in opencode.json if copying
            if ($item -eq "opencode.json") {
                $configPath = $targetPathFull
                if (Test-Path $configPath) {
                    $content = Get-Content $configPath -Raw
                    # Plugin paths stay pointing to OpenCode install dir ($source)
                    # Update relative paths to point into opencode/ subdirectory
                    $content = $content -replace "rules/", "opencode/rules/"
                    $content = $content -replace "workflows/", "opencode/workflows/"
                    # Replace filesystem MCP path to use target's opencode/ subdir
                    $content = $content -replace [regex]::Escape("C:\opencode\opencode"), "$TargetPath\opencode"
                    Set-Content -Path $configPath -Value $content -NoNewline
                    Write-Host "  Updated paths in: $item" -ForegroundColor Cyan
                }
            }
            
            Write-Host "  Copied: $item" -ForegroundColor Green
        }
     } else {
        Write-Host "  Skipped (not found): $item" -ForegroundColor Yellow
    }
}

# Deploy items to opencode/ subdirectory
foreach ($item in $subdirItems) {
    $sourcePath = Join-Path $source $item
    $targetPathFull = Join-Path $opencodeDir $item

    if (Test-Path $sourcePath) {
        if ($Symlink) {
            if (Test-Path $targetPathFull) {
                Remove-Item $targetPathFull -Recurse -Force
            }
            cmd /c "mklink /D `"$targetPathFull`" `"$sourcePath`""
            Write-Host "  Linked: opencode/$item" -ForegroundColor Green
        } else {
            if (Test-Path $targetPathFull) {
                Remove-Item $targetPathFull -Recurse -Force
            }
            Copy-Item $sourcePath $targetPathFull -Recurse -Force
            Write-Host "  Copied: opencode/$item" -ForegroundColor Green
        }
    } else {
        Write-Host "  Skipped (not found): $item" -ForegroundColor Yellow
    }
}

# Configure for web client if requested
if ($WebClient) {
    $configPath = Join-Path $TargetPath "opencode.json"
    if (Test-Path $configPath) {
        Write-Host "`nConfiguring for web client..." -ForegroundColor Yellow
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        
        # Ensure CORS allows web client origins
        if (-not $config.server) { $config | Add-Member -NotePropertyName "server" -NotePropertyValue @{} }
        $config.server.cors = @("http://127.0.0.1:8080", "http://localhost:8080", "http://")
        
        # Enable web-friendly settings
        $config | ConvertTo-Json -Depth 10 | Set-Content -Path $configPath
        Write-Host "  Updated CORS settings for web client" -ForegroundColor Green
    }
}

Write-Host "`nDeployment complete!" -ForegroundColor Green
Write-Host "Now open OpenCode in: $TargetPath" -ForegroundColor Cyan

if ($Symlink) {
    Write-Host "`nNote: Using symlinks. Changes in $source will reflect in $TargetPath" -ForegroundColor Yellow
} else {
    Write-Host "`nNote: Files were copied. To sync changes, run this script again." -ForegroundColor Yellow
}
