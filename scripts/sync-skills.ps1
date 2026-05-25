<#
.SYNOPSIS
    Bridges two skill systems by creating directory junctions from
    ~/.agents/skills/<name> to C:\opencode\skills/<name>.

.DESCRIPTION
    Discovers all skill directories under C:\opencode\skills/ (those containing
    SKILL.md) and ensures corresponding directory junctions exist in the
    System A location (~/.agents/skills/).

    Handles nested skill paths (e.g., android/compose) by converting them to
    flattened names (e.g., android-compose).

.PARAMETER DryRun
    If specified, only lists what would be done without making any changes.

.PARAMETER Verbose
    Enables verbose diagnostic output.

.EXAMPLE
    .\sync-skills.ps1

.EXAMPLE
    .\sync-skills.ps1 -DryRun

.EXAMPLE
    .\sync-skills.ps1 -Verbose
#>

param(
    [switch]$DryRun,
    [switch]$Verbose
)

# ----- Configuration -----
$ProjectSkillsRoot = "C:\opencode\skills"
$AgentSkillsRoot   = Resolve-Path "~/.agents/skills" -ErrorAction Stop

# ----- Helpers -----
function Write-VerboseMsg {
    param([string]$Message)
    if ($Verbose) { Write-Host "VERBOSE: $Message" -ForegroundColor Cyan }
}

function Get-SkillDirectories {
    <#
    .SYNOPSIS
        Recursively finds all directories under $ProjectSkillsRoot that
        directly contain a SKILL.md file.

    .OUTPUTS
        [PSCustomObject[]] with properties:
          - SkillName    : flattened junction name (e.g., "android-compose")
          - RelativePath : relative path from root (e.g., "android/compose")
          - SourcePath   : full source path (e.g., "C:\opencode\skills\android\compose")
    #>
    $results = @()

    # First, get all SKILL.md files recursively
    $skillFiles = Get-ChildItem -LiteralPath $ProjectSkillsRoot -Filter "SKILL.md" -Recurse -ErrorAction Stop

    foreach ($file in $skillFiles) {
        $parentDir = $file.Directory
        $relativePath = $parentDir.FullName.Substring($ProjectSkillsRoot.Length).TrimStart('\').TrimStart('/')

        # Skip root-level SKILL.md (no parent directory name means it's at root)
        if ([string]::IsNullOrEmpty($relativePath)) {
            Write-VerboseMsg "Skipping root-level SKILL.md"
            continue
        }

        # Flatten nested paths: android/compose -> android-compose
        $skillName = $relativePath -replace '[\\/]', '-'

        $results += [PSCustomObject]@{
            SkillName    = $skillName
            RelativePath = $relativePath
            SourcePath   = $parentDir.FullName
        }
    }

    return $results
}

function Test-IsJunction {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $false }
    $item = Get-Item -LiteralPath $Path -Force
    return ($item.LinkType -eq "Junction")
}

function Get-JunctionTarget {
    param([string]$Path)
    if (-not (Test-IsJunction -Path $Path)) { return $null }
    $item = Get-Item -LiteralPath $Path -Force
    return $item.Target
}

# ----- Main -----
Write-Host ""
Write-Host "Skill Sync Report" -ForegroundColor Yellow
Write-Host "=================" -ForegroundColor Yellow
Write-Host ""

# Track actions
$actions = @{
    Created  = @()
    Verified = @()
    Skipped  = @()
    Repaired = @()
    Failed   = @()
}

# Ensure destination root exists
if (-not (Test-Path -LiteralPath $AgentSkillsRoot)) {
    Write-VerboseMsg "Creating destination root: $AgentSkillsRoot"
    if (-not $DryRun) {
        New-Item -ItemType Directory -Path $AgentSkillsRoot -Force -ErrorAction Stop | Out-Null
        Write-Host "  [OK] Created destination root: $AgentSkillsRoot" -ForegroundColor Green
    } else {
        Write-Host "  [DRY-RUN] Would create destination root: $AgentSkillsRoot" -ForegroundColor Cyan
    }
}

# Verify write access
$testPath = Join-Path -Path $AgentSkillsRoot -ChildPath ".write-test.tmp"
try {
    Set-Content -LiteralPath $testPath -Value "test" -ErrorAction Stop | Out-Null
    Remove-Item -LiteralPath $testPath -Force -ErrorAction Stop | Out-Null
    Write-VerboseMsg "Write access confirmed"
} catch {
    Write-Host "  [ERROR] No write access to $AgentSkillsRoot - $_" -ForegroundColor Red
    exit 1
}

# Discover project skills
$projectSkills = Get-SkillDirectories

if ($projectSkills.Count -eq 0) {
    Write-Host "  No skill directories found under $ProjectSkillsRoot" -ForegroundColor Yellow
    exit 0
}

Write-VerboseMsg "Discovered $($projectSkills.Count) skill(s) in $ProjectSkillsRoot"

# Categorize System A existing entries
$sysAExisting = @{}
Get-ChildItem -LiteralPath $AgentSkillsRoot -Directory -ErrorAction Stop | ForEach-Object {
    $sysAExisting[$_.Name] = $_
}

foreach ($skill in $projectSkills) {
    $junctionPath = Join-Path -Path $AgentSkillsRoot -ChildPath $skill.SkillName
    $sourcePath   = $skill.SourcePath
    $skillName    = $skill.SkillName

    Write-VerboseMsg "Processing skill '$skillName' -> junction at '$junctionPath'"

    if (-not (Test-Path -LiteralPath $junctionPath)) {
        # ----- Missing: Create junction -----
        Write-VerboseMsg "  -> Not found in System A, creating junction"
        if (-not $DryRun) {
            try {
                # Clean up any leftover file/conflict at the path
                if (Test-Path -LiteralPath $junctionPath) {
                    Remove-Item -LiteralPath $junctionPath -Force -ErrorAction Stop
                }
                New-Item -ItemType Junction -Path $junctionPath -Target $sourcePath -ErrorAction Stop | Out-Null
                Write-Host "  [OK] Created:   $skillName -> $sourcePath" -ForegroundColor Green
                $actions.Created += $skillName
            } catch {
                Write-Host "  [FAIL] Failed:    $skillName ($($_.Exception.Message))" -ForegroundColor Red
                $actions.Failed += $skillName
            }
        } else {
            Write-Host "  [DRY-RUN] Would create: $skillName -> $sourcePath" -ForegroundColor Cyan
        }
    }
    elseif (Test-IsJunction -Path $junctionPath) {
        # ----- Existing junction: verify target -----
        $currentTarget = Get-JunctionTarget -Path $junctionPath
        if ($currentTarget -eq $sourcePath) {
            Write-VerboseMsg "  -> Junction exists and target matches: $currentTarget"
            Write-Host "  [OK] Verified: $skillName (junction target correct)" -ForegroundColor Green
            $actions.Verified += $skillName
        } else {
            Write-VerboseMsg "  -> Junction target mismatch: expected '$sourcePath', got '$currentTarget'"
            if (-not $DryRun) {
                try {
                    Remove-Item -LiteralPath $junctionPath -Force -ErrorAction Stop
                    New-Item -ItemType Junction -Path $junctionPath -Target $sourcePath -ErrorAction Stop | Out-Null
                    Write-Host "  [REPAIR] Repaired: $skillName (target was stale: $currentTarget)" -ForegroundColor Yellow
                    $actions.Repaired += $skillName
                } catch {
                    Write-Host "  [FAIL] Failed:    $skillName (repair failed: $($_.Exception.Message))" -ForegroundColor Red
                    $actions.Failed += $skillName
                }
            } else {
                Write-Host "  [DRY-RUN] Would repair: $skillName (stale target: $currentTarget -> $sourcePath)" -ForegroundColor Cyan
            }
        }
    }
    else {
        # ----- Real directory: skip (native System A skill) -----
        Write-Host "  [SKIP] Skipped:  $skillName (native System A skill)" -ForegroundColor Magenta
        $actions.Skipped += $skillName
    }
}

# ----- Summary -----
Write-Host ""
$totalCreated = $actions.Created.Count
$totalVerified = $actions.Verified.Count
$totalSkipped = $actions.Skipped.Count
$totalRepaired = $actions.Repaired.Count
$totalFailed = $actions.Failed.Count
Write-Host "Summary: $totalCreated created, $totalVerified verified, $totalSkipped skipped, $totalRepaired repaired, $totalFailed failed" -ForegroundColor Yellow
Write-Host ""

if ($DryRun) {
    Write-Host "DRY-RUN completed. No changes were made." -ForegroundColor Cyan
}

# Exit with error code if any failures
if ($totalFailed -gt 0) {
    exit 1
}
