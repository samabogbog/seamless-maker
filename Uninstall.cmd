@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install\Uninstall.ps1"
if errorlevel 1 (echo Uninstallation failed. & pause & exit /b 1)
pause
