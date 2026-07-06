param(
  [Parameter(Mandatory = $true)]
  [string]$Key
)

$envPath = Join-Path $PSScriptRoot "..\backend\.env"
if (-not (Test-Path $envPath)) {
  Write-Error "backend/.env が見つかりません"
  exit 1
}

$content = Get-Content $envPath -Raw
if ($content -match "HOTPEPPER_API_KEY=") {
  $content = $content -replace "HOTPEPPER_API_KEY=.*", "HOTPEPPER_API_KEY=$Key"
} else {
  $content += "`nHOTPEPPER_API_KEY=$Key"
}
Set-Content -Path $envPath -Value $content.TrimEnd() -NoNewline
Add-Content -Path $envPath -Value ""
Write-Host "HOTPEPPER_API_KEY を backend/.env に保存しました。バックエンドを再起動してください。"
