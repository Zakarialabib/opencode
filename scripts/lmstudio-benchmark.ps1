# LM Studio Parameter Benchmark
# Tests context_length, GPU offload, flash_attention, and speculative decoding

$LM_URL = "http://192.168.1.12:1234"

function Get-Models {
    $r = Invoke-RestMethod -Uri "$LM_URL/api/v1/models" -Method GET
    return $r.models
}

function Load-Model {
    param([string]$ModelKey, [int]$CtxLen = 512, [bool]$OffloadKV = $true, [bool]$FlashAttn = $true)

    $body = @{
        model = $ModelKey
        context_length = $CtxLen
        offload_kv_cache_to_gpu = $OffloadKV
        flash_attention = $FlashAttn
        echo_load_config = $true
    } | ConvertTo-Json

    $r = Invoke-RestMethod -Uri "$LM_URL/api/v1/models/load" -Method POST -ContentType "application/json" -Body $body
    return $r
}

function Unload-Model {
    param([string]$InstanceId)
    $body = @{ instance_id = $InstanceId } | ConvertTo-Json
    Invoke-RestMethod -Uri "$LM_URL/api/v1/models/unload" -Method POST -ContentType "application/json" -Body $body | Out-Null
}

function Test-Embedding {
    param([string]$Model, [string[]]$Texts, [int]$CtxLen, [bool]$OffloadKV)

    $load = Load-Model -ModelKey $Model -CtxLen $CtxLen -OffloadKV $OffloadKV
    if ($load.error) {
        Write-Host "  [ERROR] $($load.error.message)" -ForegroundColor Red
        return $null
    }

    Write-Host "  Load time: $([math]::Round($load.load_time_seconds, 2))s | Config: ctx=$($load.load_config.context_length), offload=$($load.load_config.offload_kv_cache_to_gpu)" -ForegroundColor Cyan

    $times = @()
    for ($i = 0; $i -lt 5; $i++) {
        $sw = [Diagnostics.Stopwatch]::StartNew()
        $r = Invoke-RestMethod -Uri "$LM_URL/v1/embeddings" -Method POST -ContentType "application/json" -Body (@{ model = $Model; input = $Texts } | ConvertTo-Json)
        $sw.Stop()
        if ($r.error) {
            Write-Host "  [ERROR] $($r.error.message)" -ForegroundColor Red
            continue
        }
        $times += $sw.ElapsedMilliseconds
        $dims = if ($r.data[0].embedding) { $r.data[0].embedding.Count } else { 0 }
        Write-Host "  Run $($i+1): $($sw.ElapsedMilliseconds)ms ($($r.data.Count) emb, $dims dims)"
    }

    Unload-Model -InstanceId $load.instance_id

    if ($times.Count -eq 0) { return $null }
    $avg = ($times | Measure-Object -Average).Average
    Write-Host "  AVG: $([math]::Round($avg, 0))ms" -ForegroundColor Green
    return @{ LoadTime = $load.load_time_seconds; AvgTime = $avg; Config = $load.load_config }
}

function Test-Speculative {
    param([string]$MainModel, [string]$DraftModel, [string[]]$Messages)

    Write-Host "`n  [WITHOUT speculative decoding]" -ForegroundColor Yellow
    $m1 = Load-Model -ModelKey $MainModel
    if ($m1.error) { Write-Host "  [ERROR] $($m1.error.message)"; return }

    $t0 = [DateTime]::Now
    $r1 = Invoke-RestMethod -Uri "$LM_URL/v1/chat/completions" -Method POST -ContentType "application/json" -Body (@{
        model = $MainModel
        messages = $Messages
        max_tokens = 100
        temperature = 0.7
    } | ConvertTo-Json)
    $t1 = ([DateTime]::Now - $t0).TotalMilliseconds
    Unload-Model -InstanceId $m1.instance_id

    if ($r1.error) { Write-Host "  [ERROR] $($r1.error.message)"; return }
    Write-Host "  Time: $([math]::Round($t1, 0))ms | Tokens: $($r1.usage.completion_tokens)"

    Write-Host "`n  [WITH speculative decoding]" -ForegroundColor Yellow
    $m2 = Load-Model -ModelKey $MainModel
    $d2 = Load-Model -ModelKey $DraftModel
    if ($m2.error -or $d2.error) { Write-Host "  [ERROR] Loading failed"; return }

    $t2 = [DateTime]::Now
    $r2 = Invoke-RestMethod -Uri "$LM_URL/v1/chat/completions" -Method POST -ContentType "application/json" -Body (@{
        model = $MainModel
        messages = $Messages
        max_tokens = 100
        temperature = 0.7
        draft_model = $DraftModel
    } | ConvertTo-Json)
    $t3 = ([DateTime]::Now - $t2).TotalMilliseconds
    Unload-Model -InstanceId $m2.instance_id
    Unload-Model -InstanceId $d2.instance_id

    if ($r2.error) { Write-Host "  [ERROR] $($r2.error.message)"; return }
    Write-Host "  Time: $([math]::Round($t3, 0))ms | Tokens: $($r2.usage.completion_tokens)"

    $speedup = $t1 / $t3
    $speedLabel = if ($speedup -gt 1) { "faster" } else { "slower" }
    Write-Host "`n  Speedup: $([math]::Round($speedup, 2))x $speedLabel" -ForegroundColor Green
}

# Main
Write-Host "==============================================" -ForegroundColor Magenta
Write-Host "LM Studio Parameter Benchmark" -ForegroundColor Magenta
Write-Host "==============================================" -ForegroundColor Magenta

$models = Get-Models
Write-Host "`nAvailable models: $($models.Count)"
$models | ForEach-Object { Write-Host "  [$($_.type)] $($_.key) ($([math]::Round($_.size_bytes/1MB, 0))MB, ctx=$($_.max_context_length))" }

$embedModels = $models | Where-Object { $_.type -eq "embedding" }
$llms = $models | Where-Object { $_.type -eq "llm" }

# Embedding Tests
Write-Host "`n==============================================" -ForegroundColor Magenta
Write-Host "EMBEDDING MODEL TESTS" -ForegroundColor Magenta
Write-Host "=============================================="

$testTexts = @(
    "function auth() { return true; }",
    "const user = { name: 'test' };",
    "SELECT * FROM users",
    "class Controller { }"
)

foreach ($embed in $embedModels) {
    Write-Host "`n--- $($embed.key) ---" -ForegroundColor Cyan
    Write-Host "Size: $([math]::Round($embed.size_bytes/1MB, 0))MB | Max ctx: $($embed.max_context_length)"

    # Test different context lengths
    foreach ($ctx in @(256, 512, 1024)) {
        if ($ctx -gt $embed.max_context_length) { continue }
        Write-Host "`nContext length: $ctx" -ForegroundColor White
        $r = Test-Embedding -Model $embed.key -Texts $testTexts -CtxLen $ctx -OffloadKV $true
    }

    # Test with/without GPU offload
    Write-Host "`nGPU Offload comparison:" -ForegroundColor White
    Write-Host "With offload:" -NoNewline; $r1 = Test-Embedding -Model $embed.key -Texts $testTexts -CtxLen 512 -OffloadKV $true
    Write-Host "Without offload:" -NoNewline; $r2 = Test-Embedding -Model $embed.key -Texts $testTexts -CtxLen 512 -OffloadKV $false
}

# Speculative Decoding Tests
Write-Host "`n==============================================" -ForegroundColor Magenta
Write-Host "SPECULATIVE DECODING TESTS" -ForegroundColor Magenta
Write-Host "=============================================="

$mainModel = $llms | Where-Object { $_.key -match "4b" } | Select-Object -First 1
$draftModel = $llms | Where-Object { $_.key -match "0\.8b" -or $_.key -match "1b" -or $_.key -match "2b" } | Select-Object -First 1

if ($mainModel -and $draftModel) {
    Write-Host "`nMain model: $($mainModel.key)" -ForegroundColor Cyan
    Write-Host "Draft model: $($draftModel.key)" -ForegroundColor Cyan

    $messages = @(
        @{ role = "system"; content = "You are a helpful assistant." },
        @{ role = "user"; content = "What is authentication?" }
    )

    Test-Speculative -MainModel $mainModel.key -DraftModel $draftModel.key -Messages $messages
}

Write-Host "`n==============================================" -ForegroundColor Magenta
Write-Host "Benchmark Complete!" -ForegroundColor Magenta
Write-Host "=============================================="
