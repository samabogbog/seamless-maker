param(
    [Parameter(Mandatory=$true)][string]$SigningTool,
    [Parameter(Mandatory=$true)][string]$Certificate,
    [string]$TimestampUrl = 'http://timestamp.digicert.com'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$tool = (Resolve-Path -LiteralPath $SigningTool).Path
$cert = (Resolve-Path -LiteralPath $Certificate).Path
if (-not $env:SEAMLESS_SIGN_PASSWORD) { throw 'Set SEAMLESS_SIGN_PASSWORD privately before signing.' }
$dist = [IO.Path]::GetFullPath((Join-Path $root 'dist'))
New-Item -ItemType Directory -Path $dist -Force | Out-Null
$stage = Join-Path $dist ('signed-stage-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$zxp = Join-Path $dist "SeamlessMaker-$version-Windows.zxp"
try {
    $files = Get-ChildItem (Join-Path $root 'extension') -Recurse -Force
    if ($files | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw 'Symlinks are not allowed in release files.' }
    if ($files | Where-Object { $_.Name -match '^(node_modules|__MACOSX|\.DS_Store)$' -or $_.Extension -match '^\.(p12|pfx|pem|key)$' }) { throw 'Unexpected private/development files in extension.' }
    & $tool -sign (Join-Path $root 'extension') $zxp $cert $env:SEAMLESS_SIGN_PASSWORD -tsa $TimestampUrl
    if ($LASTEXITCODE -ne 0) { throw 'Signing or timestamp failed. Release was not packaged.' }
    & $tool -verify $zxp -certInfo
    if ($LASTEXITCODE -ne 0) { throw 'ZXP signature verification failed.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $payload = Join-Path $stage 'extension'
    [IO.Compression.ZipFile]::ExtractToDirectory($zxp, $payload)
    & $tool -verify $payload
    if ($LASTEXITCODE -ne 0) { throw 'Extracted signature verification failed.' }
    foreach ($item in @('install','Install.cmd','Uninstall.cmd','README.md','docs')) {
        Copy-Item -LiteralPath (Join-Path $root $item) -Destination $stage -Recurse
    }
    Copy-Item -LiteralPath $zxp -Destination $stage
    New-Item -ItemType Directory -Path (Join-Path $stage 'tests') | Out-Null
    foreach ($smokeFile in @('illustrator-smoke.jsx','illustrator-preview-smoke.jsx')) { Copy-Item -LiteralPath (Join-Path $root ('tests\' + $smokeFile)) -Destination (Join-Path $stage 'tests') }
    $zip = Join-Path $dist "SeamlessMaker-$version-Windows-Signed.zip"
    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force
    Get-FileHash -LiteralPath $zxp,$zip -Algorithm SHA256 | Format-Table -AutoSize
    Write-Host "Signed release: $zip"
} finally {
    if ((Split-Path -Parent ([IO.Path]::GetFullPath($stage))) -eq $dist) { Remove-Item -LiteralPath $stage -Recurse -Force }
}
