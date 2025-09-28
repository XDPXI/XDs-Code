@echo off
setlocal

echo == Updating Bun Dependencies... ==
bun install
if errorlevel 1 echo [!] bun install failed
bun update
if errorlevel 1 echo [!] bun update failed
bun install
if errorlevel 1 echo [!] bun install failed

echo == Updating Rust Dependencies... ==
cd src-tauri || exit /b
cargo update
if errorlevel 1 echo [!] cargo update failed
cd ..

echo == Updating .NET Dependencies... ==
cd installer || exit /b

where dotnet-outdated >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing dotnet-outdated-tool...
    dotnet tool install --global dotnet-outdated-tool
)

dotnet outdated --upgrade
if errorlevel 1 echo [!] dotnet outdated failed
cd ..

echo == All dependencies updated! ==
pause
endlocal