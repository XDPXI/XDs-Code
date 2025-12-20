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

echo == All dependencies updated! ==
pause
endlocal
