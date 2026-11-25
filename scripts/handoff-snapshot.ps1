# Ghi snapshot trạng thái repo vào docs/redesign-v2/PROGRESS.md để AI kế nhiệm biết repo đang ở đâu.
# Dùng: powershell -File scripts\handoff-snapshot.ps1
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

$progress = 'docs/redesign-v2/PROGRESS.md'
$time = Get-Date -Format 'yyyy-MM-dd HH:mm'
$status = @(git status --short | ForEach-Object { "  $_" })
if ($status.Count -eq 0) { $status = @('  (sạch)') }
$backendDiff = (git diff --stat -- apps/api packages | Out-String).Trim()
if (-not $backendDiff) { $backendDiff = 'rỗng (OK)' }

$block = @(
  '',
  "### Snapshot tự động $time",
  "- Nhánh: $(git branch --show-current)",
  "- Commit cuối: $(git log -1 --oneline)",
  '- File thay đổi chưa commit:'
) + $status + @(
  "- Diff apps/api + packages (phải rỗng): $backendDiff"
)

Add-Content -Path $progress -Value ($block -join "`n") -Encoding utf8
Write-Host "Đã ghi snapshot vào $progress"
