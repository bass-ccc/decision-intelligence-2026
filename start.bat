@echo off
rem Opens the 3D book in your browser. Keep this window open while you browse; close it to stop.
cd /d "%~dp0"
set "PY=python"
where py >nul 2>nul && set "PY=py"
if exist "%LOCALAPPDATA%\Python\bin\python.exe" set "PY=%LOCALAPPDATA%\Python\bin\python.exe"
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8765/tower/"
echo.
echo   Decision Intelligence 2026 is running at http://localhost:8765/tower/
echo   Close this window to stop.
echo.
"%PY%" -m http.server 8765 --bind 127.0.0.1
