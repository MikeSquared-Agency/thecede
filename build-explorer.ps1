# Build the Cortex Explorer with embedded data
# Usage: .\build-explorer.ps1 [-Fetch] to refresh data from VM first

param([switch]$Fetch)

$root = Split-Path $MyInvocation.MyCommand.Path
$jsonFile = Join-Path $root "cortex-export.json"
$templateFile = Join-Path $root "cortex-explorer.html"
$outputFile = Join-Path $root "cortex-live.html"

if ($Fetch -or !(Test-Path $jsonFile)) {
    Write-Host "Fetching fresh Cortex data from VM..." -ForegroundColor Cyan
    $cmd = 'sudo docker exec openclaw-stack-openclaw-gateway-1 cortex export --format json 2>/dev/null'
    gcloud compute ssh openclaw-vm --zone=europe-west2-c --command=$cmd > $jsonFile 2>$null
    Write-Host "  Downloaded $(((Get-Item $jsonFile).Length / 1KB).ToString('N0')) KB" -ForegroundColor Green
}

$jsonData = Get-Content $jsonFile -Raw -Encoding UTF8
$template = Get-Content $templateFile -Raw -Encoding UTF8

# Inject data as a script tag BEFORE the main <script> block
$injection = "<script>var CORTEX_DATA = $jsonData;</script>"
# Insert right before the main app <script> tag
$marker = '<script>'
$idx = $template.IndexOf($marker)
if ($idx -lt 0) {
    Write-Host "ERROR: Could not find <script> marker in template" -ForegroundColor Red
    exit 1
}
$output = $template.Substring(0, $idx) + $injection + "`n" + $template.Substring($idx)

[System.IO.File]::WriteAllText($outputFile, $output, [System.Text.Encoding]::UTF8)
$size = ((Get-Item $outputFile).Length / 1KB).ToString('N0')
Write-Host "Built $outputFile ($size KB)" -ForegroundColor Green
Write-Host "Open in browser: start $outputFile" -ForegroundColor Yellow
