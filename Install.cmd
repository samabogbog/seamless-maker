@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install\Install.ps1"
if errorlevel 1 (echo Installation failed. & pause & exit /b 1)
pause
