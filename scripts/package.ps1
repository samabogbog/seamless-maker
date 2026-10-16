$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dist = [IO.Path]::GetFullPath((Join-Path $root 'dist'))
New-Item -ItemType Directory -Path $dist -Force | Out-Null
$stage = [IO.Path]::GetFullPath((Join-Path $dist ('staging-' + [Guid]::NewGuid().ToString('N'))))
if ((Split-Path -Parent $stage) -ne $dist) { throw 'Invalid staging path.' }
New-Item -ItemType Directory -Path $stage | Out-Null
try {
    foreach ($item in @('extension','install','Install.cmd','Uninstall.cmd','README.md','INSTALL.md','CHANGELOG.md','docs')) {
        Copy-Item -LiteralPath (Join-Path $root $item) -Destination $stage -Recurse -Force
    }
    New-Item -ItemType Directory -Path (Join-Path $stage 'tests') | Out-Null
    Copy-Item -LiteralPath (Join-Path $root 'tests\illustrator-smoke.jsx') -Destination (Join-Path $stage 'tests')
    Copy-Item -LiteralPath (Join-Path $root 'tests\illustrator-preview-smoke.jsx') -Destination (Join-Path $stage 'tests')
    $version = (Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
    $zip = Join-Path $dist ("SeamlessMaker-$version-Windows.zip")
    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force
    Write-Host "Package: $zip"
} finally {
    if ((Split-Path -Parent ([IO.Path]::GetFullPath($stage))) -eq $dist) { Remove-Item -LiteralPath $stage -Recurse -Force }
}
