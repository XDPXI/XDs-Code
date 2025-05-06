@echo off

echo == Updating JavaScript dependencies (pnpm)... ==
start /wait "" cmd /c "@echo off & pnpm update"
start /wait "" cmd /c "@echo off & pnpm install"

echo == All dependencies updated! ==
pause
