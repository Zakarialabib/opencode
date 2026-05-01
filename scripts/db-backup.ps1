# Database Backup Script for OpenCode
# Creates timestamped backups of SQLite database

param(
    [string]$SourceDB = "C:\opencode\database.sqlite",
    [string]$BackupDir = "C:\opencode\backups",
    [int]$KeepCount = 10  # Number of backups to keep
)

$ErrorActionPreference = "Stop"

Write-Host "🗄️  OpenCode Database Backup" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

# Check if source database exists
if (-not (Test-Path $SourceDB)) {
    Write-Host "❌ Source database not found: $SourceDB" -ForegroundColor Red
    exit 1
}

# Create backup directory if it doesn't exist
if (-not (Test-Path $BackupDir)) {
    New-Item -Path $BackupDir -ItemType Directory -Force | Out-Null
    Write-Host "  ✅ Created backup directory: $BackupDir" -ForegroundColor Green
}

# Generate backup filename with timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupFile = Join-Path $BackupDir "database_$timestamp.sqlite"

# Copy database to backup location
try {
    Copy-Item -Path $SourceDB -Destination $backupFile -Force
    $fileSize = (Get-Item $backupFile).Length / 1KB
    Write-Host "  ✅ Backup created: $backupFile" -ForegroundColor Green
    Write-Host "     Size: $([math]::Round($fileSize, 2)) KB" -ForegroundColor Gray
} catch {
    Write-Host "❌ Backup failed: $_" -ForegroundColor Red
    exit 1
}

# Also create a "latest" copy for easy access
$latestBackup = Join-Path $BackupDir "database_latest.sqlite"
try {
    Copy-Item -Path $SourceDB -Destination $latestBackup -Force
    Write-Host "  ✅ Latest backup updated: $latestBackup" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Failed to update latest backup: $_" -ForegroundColor Yellow
}

# Clean up old backups (keep only the specified number)
Write-Host "`n🧹 Cleaning up old backups..." -ForegroundColor Yellow
try {
    $backups = Get-ChildItem -Path $BackupDir -Filter "database_*.sqlite" | 
               Sort-Object CreationTime -Descending
    
    if ($backups.Count -gt $KeepCount) {
        $oldBackups = $backups | Select-Object -Skip $KeepCount
        foreach ($backup in $oldBackups) {
            Remove-Item $backup.FullName -Force
            Write-Host "  🗑️  Removed: $($backup.Name)" -ForegroundColor Gray
        }
        Write-Host "  ✅ Cleaned up $($oldBackups.Count) old backups" -ForegroundColor Green
    } else {
        Write-Host "  ✅ No cleanup needed (keeping $KeepCount most recent)" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Cleanup failed: $_" -ForegroundColor Yellow
}

# List current backups
Write-Host "`n📂 Current backups:" -ForegroundColor Cyan
$currentBackups = Get-ChildItem -Path $BackupDir -Filter "database_*.sqlite" | 
                  Sort-Object CreationTime -Descending
foreach ($backup in $currentBackups) {
    $size = [math]::Round(($backup.Length / 1KB), 2)
    Write-Host "  - $($backup.Name) ($size KB)" -ForegroundColor White
}

Write-Host "`n✅ Backup complete!" -ForegroundColor Green
Write-Host "📂 Backup location: $BackupDir" -ForegroundColor Cyan
