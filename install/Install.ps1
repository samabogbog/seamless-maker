$ErrorActionPreference = 'Stop'
if (Get-Process Illustrator -ErrorAction SilentlyContinue) { throw 'Save your work and close all Illustrator versions before installing.' }
$bundleId = 'com.seamlessmaker.panel'
$source = Join-Path (Split-Path -Parent $PSScriptRoot) 'extension'
$parent = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'Adobe\CEP\extensions'))
$target = [IO.Path]::GetFullPath((Join-Path $parent $bundleId))
if ((Split-Path -Parent $target) -ne $parent) { throw 'Invalid extension destination.' }
if (-not (Test-Path -LiteralPath (Join-Path $source 'CSXS\manifest.xml'))) { throw 'Extension files are missing. Extract the complete ZIP first.' }
if (Test-Path -LiteralPath $target) {
    $manifest = Join-Path $target 'CSXS\manifest.xml'
    if (-not (Test-Path -LiteralPath $manifest) -or (Get-Content -LiteralPath $manifest -Raw) -notmatch 'ExtensionBundleId="com\.seamlessmaker\.panel"') { throw 'Existing folder is not a Seamless Maker installation. No files were changed.' }
}
$backup = [IO.Path]::GetFullPath((Join-Path $env:TEMP ('SeamlessMaker-backup-' + [Guid]::NewGuid().ToString('N'))))
if ((Split-Path -Parent $backup) -ne [IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')) { throw 'Invalid backup destination.' }
if (Test-Path -LiteralPath $target) { Move-Item -LiteralPath $target -Destination $backup }
try {
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    Copy-Item -Path (Join-Path $source '*') -Destination $target -Recurse -Force
} catch {
    if ((Split-Path -Parent ([IO.Path]::GetFullPath($target))) -ne $parent) { throw 'Invalid rollback destination.' }
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
    if (Test-Path -LiteralPath $backup) { Move-Item -LiteralPath $backup -Destination $target }
    throw
}
if (Test-Path -LiteralPath $backup) { Write-Host "Previous installation backed up to $backup" }
Write-Host "Installed Seamless Maker files to $target"
if (Test-Path -LiteralPath (Join-Path $source 'META-INF\signatures.xml')) {
    Write-Host 'Signed extension payload installed. Adobe security settings were not changed.'
} else {
    Write-Host 'This development package is unsigned. See README.md for development-mode requirements.'
}
Write-Host 'Restart Illustrator. Open Window > Extensions (or Extensions (Legacy)) > Seamless Maker.'
