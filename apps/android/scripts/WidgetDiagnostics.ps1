[CmdletBinding()]
param(
    [string]$Serial,
    [string]$PackageName = 'com.example.lovecheck'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-Adb {
    $command = Get-Command adb -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $candidates = @()
    foreach ($sdkRoot in @($env:ANDROID_SDK_ROOT, $env:ANDROID_HOME)) {
        if (-not [string]::IsNullOrWhiteSpace($sdkRoot)) {
            $candidate = Join-Path $sdkRoot 'platform-tools\adb.exe'
            if (Test-Path -LiteralPath $candidate -PathType Leaf) {
                $candidates += $candidate
            }
        }
    }

    if ($candidates.Count -gt 0) {
        return $candidates[0]
    }

    throw 'Không tìm thấy adb. Cài Android SDK Platform-Tools hoặc thêm adb vào PATH.'
}

$adb = Resolve-Adb

function Invoke-Adb {
    param([string[]]$Arguments)

    if ($Serial) {
        $result = & $adb -s $Serial @Arguments 2>&1
    } else {
        $result = & $adb @Arguments 2>&1
    }

    if ($LASTEXITCODE -ne 0) {
        throw "adb $($Arguments -join ' ') failed:`n$($result -join [Environment]::NewLine)"
    }

    return $result
}

Invoke-Adb @('wait-for-device') | Out-Null
$device = (Invoke-Adb @('shell', 'getprop', 'ro.product.model')).Trim()
$sdk = (Invoke-Adb @('shell', 'getprop', 'ro.build.version.sdk')).Trim()
$apkPath = Invoke-Adb @('shell', 'pm', 'path', $PackageName)

if (-not $apkPath -or -not ($apkPath -join "`n").Contains('package:')) {
    throw "Chưa cài $PackageName trên thiết bị. Hãy cài debug APK rồi chạy lại script."
}

$packageDump = Invoke-Adb @('shell', 'dumpsys', 'package', $PackageName)
$versionLine = $packageDump | Select-String -Pattern 'versionName=|versionCode=' | Select-Object -First 2
$widgetDump = Invoke-Adb @('shell', 'dumpsys', 'appwidget')
$widgetLines = $widgetDump | Select-String -Pattern ([regex]::Escape($PackageName))

Write-Output "Device: $device (API $sdk)"
Write-Output "Package: $PackageName"
Write-Output 'Version:'
$versionLine | ForEach-Object { Write-Output "  $($_.Line.Trim())" }
Write-Output 'Installed APK:'
$apkPath | ForEach-Object { Write-Output "  $_" }
Write-Output 'Widget host bindings:'

if ($widgetLines) {
    $widgetLines | ForEach-Object { Write-Output "  $($_.Line.Trim())" }
} else {
    Write-Output '  Chưa có widget instance trong launcher. Thêm widget từ widget picker rồi chạy lại.'
}

Write-Output ''
Write-Output 'Kiểm tra thủ công: thêm cả “Check IN Love” và “Check-in nhanh”, resize mọi chiều, mở deep link và gửi một FCM/check-in test.'
