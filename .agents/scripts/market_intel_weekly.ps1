param(
  [string]$OutDir = "reports/market-intelligence",
  [switch]$UseFirecrawl
)

$ErrorActionPreference = "Stop"
$today = Get-Date -Format "yyyy-MM-dd"
$stamp = Get-Date -Format "yyyy-MM-ddTHH-mm-ss"
$outPath = Join-Path $OutDir "$today-weekly-sweep.md"

$targets = @(
  "https://www.gov.br/ans/pt-br/assuntos/noticias",
  "https://www.gov.br/susep/pt-br/assuntos/noticias",
  "https://cnseg.org.br/",
  "https://www.fenasaude.org.br/",
  "https://www.amil.com.br/",
  "https://www.portoseguro.com.br/",
  "https://www.hapvida.com.br/"
)

New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

function Get-PageStatus {
  param([string]$Url)
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri $Url -MaximumRedirection 5 -TimeoutSec 30
    $title = if ($resp.Content -match "<title[^>]*>(.*?)</title>") {
      ($matches[1] -replace "\s+", " ").Trim()
    } else {
      "N/A"
    }
    [PSCustomObject]@{
      Url = $Url
      Status = [int]$resp.StatusCode
      Title = $title
      LastModified = $resp.Headers["Last-Modified"]
      CheckedAt = (Get-Date).ToString("s")
      Error = ""
    }
  } catch {
    [PSCustomObject]@{
      Url = $Url
      Status = "ERROR"
      Title = "N/A"
      LastModified = ""
      CheckedAt = (Get-Date).ToString("s")
      Error = $_.Exception.Message
    }
  }
}

$results = foreach ($url in $targets) {
  Get-PageStatus -Url $url
}

$firecrawlAvailable = $false
if ($UseFirecrawl) {
  $firecrawlCmd = Get-Command firecrawl -ErrorAction SilentlyContinue
  if ($firecrawlCmd) {
    $firecrawlAvailable = $true
  }
}

$lines = @()
$lines += "# Weekly Market Intelligence Sweep"
$lines += ""
$lines += "Date: $today"
$lines += "Generated: $stamp"
$lines += ""
$lines += "## Source Checks"
$lines += ""

foreach ($r in $results) {
  $lines += "- $($r.Url)"
  $lines += "  - status: $($r.Status)"
  $lines += "  - title: $($r.Title)"
  if ($r.LastModified) { $lines += "  - last-modified: $($r.LastModified)" }
  $lines += "  - checked: $($r.CheckedAt)"
  if ($r.Error) { $lines += "  - error: $($r.Error)" }
}

$lines += ""
$lines += "## Firecrawl Mode"
$lines += ""
if ($firecrawlAvailable) {
  $lines += "- enabled: yes"
  $lines += "- note: run deep-crawl commands for ANS/SUSEP/operator updates as next step."
} else {
  $lines += "- enabled: no"
  $lines += "- note: install/authenticate Firecrawl CLI to unlock deep-crawl evidence mode."
}

$lines += ""
$lines += "## Action Checklist"
$lines += ""
$lines += "1. Review regulator pages first (ANS, SUSEP)."
$lines += "2. Validate operator page updates (Amil, Porto, Hapvida)."
$lines += "3. Mark any volatile claim in guides with source URL + date."
$lines += "4. Open content update PR only after evidence is attached."

Set-Content -Path $outPath -Value ($lines -join "`r`n") -Encoding UTF8
Write-Output "Weekly sweep generated: $outPath"
