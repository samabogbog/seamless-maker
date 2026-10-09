$ErrorActionPreference = 'Stop'
$parent = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'Adobe\CEP\extensions'))
$target = [IO.Path]::GetFullPath((Join-Path $parent 'com.seamlessmaker.panel'))
if ((Split-Path -Parent $target) -ne $parent) { throw 'Invalid extension destination.' }
if (-not (Test-Path -LiteralPath $target)) { Write-Host 'Seamless Maker is not installed for this user.'; exit 0 }
$manifest = Join-Path $target 'CSXS\manifest.xml'
if (-not (Test-Path -LiteralPath $manifest) -or (Get-Content -LiteralPath $manifest -Raw) -notmatch 'ExtensionBundleId="com\.seamlessmaker\.panel"') { throw 'Folder identity check failed. No files were removed.' }
Remove-Item -LiteralPath $target -Recurse -Force
Write-Host 'Seamless Maker removed. Restart Illustrator. Adobe security settings were not changed.'
