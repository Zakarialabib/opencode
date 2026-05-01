# Deploy OpenCode configuration to a target project
# Usage: .\deploy-to-project.ps1 -TargetPath "C:\MyProject"

param(
    [string]$TargetPath = ".",
    [switch]$Symlink
)

$source = "C:\opencode"

Write-Host "Deploying OpenCode config to: $TargetPath" -ForegroundColor Cyan

# Create target directory if it doesn't exist
if (-not (Test-Path $TargetPath)) {
    New-Item -ItemType Directory -Path $TargetPath -Force | Out-Null
    Write-Host "Created directory: $TargetPath"
}

# Files/directories to deploy
$items = @(
    "opencode.json",
    "skills",
    "agents",
    "rules",
    "plugins",
    "workflows",
    "tools"
)

foreach ($item in $items) {
    $sourcePath = Join-Path $source $item
    $targetPathFull = Join-Path $TargetPath $item
    
    if (Test-Path $sourcePath) {
        if ($Symlink) {
            # Create symbolic link
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
            Write-Host "  Copied: $item" -ForegroundColor Green
        }
    } else {
        Write-Host "  Skipped (not found): $item" -ForegroundColor Yellow
    }
}

Write-Host "`nDeployment complete!" -ForegroundColor Green
Write-Host "Now open OpenCode in: $TargetPath" -ForegroundColor Cyan
Write-Host "`nNote: The target project will use the custom agents and skills from this config." -ForegroundColor Yellow
