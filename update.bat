@echo off

echo == Updating JavaScript dependencies (pnpm)... ==
start /wait "" cmd /c "@echo off & bun install"
start /wait "" cmd /c "@echo off & bun update"
start /wait "" cmd /c "@echo off & bun install"

echo == Updating Rust dependencies (Cargo)... ==
cd src-tauri || exit /b
start /wait "" cmd /c "@echo off & cargo update"
cd ..

echo == Checking for .NET dependency updates... ==
cd installer || exit /b

where dotnet-outdated >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing dotnet-outdated-tool...
    start /wait "" cmd /c "@echo off & dotnet tool install --global dotnet-outdated-tool"
)

start /wait "" cmd /c "@echo off & dotnet outdated --upgrade"
cd ..

echo == All dependencies updated! ==
pause
