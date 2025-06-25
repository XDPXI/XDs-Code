@echo off
setlocal enabledelayedexpansion
set ERRLEV=0

:: Build
echo Building for Windows...
call bun run build
if errorlevel 1 (
  echo ❌ Windows build failed
  exit /b 1
)

echo All builds completed!
