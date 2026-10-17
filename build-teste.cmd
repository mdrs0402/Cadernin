@echo off
cd /d "%~dp0"
echo ===== build ===== > build.log
call npm run build >> build.log 2>&1
echo EXIT %ERRORLEVEL% >> build.log
exit
