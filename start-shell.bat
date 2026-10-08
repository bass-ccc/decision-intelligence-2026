@echo off
rem Opens the 3D world "DIVE" (Ghost in the Shell-inspired) in your browser. Keep this window open while you explore; close it to stop.
cd /d "%~dp0"
set "PY=python"
where py >nul 2>nul && set "PY=py"
if exist "%LOCALAPPDATA%\Python\bin\python.exe" set "PY=%LOCALAPPDATA%\Python\bin\python.exe"
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8765/shell/"
echo.
echo   Decision Intelligence 2026 - DIVE is running at http://localhost:8765/shell/
echo   Close this window to stop.
echo.
"%PY%" -m http.server 8765 --bind 127.0.0.1
