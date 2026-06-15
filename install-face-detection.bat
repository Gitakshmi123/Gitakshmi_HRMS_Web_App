@echo off
REM Face Validation & Coordinates Fix - Windows Installation Script
REM Run this script to automatically install and configure real face detection

cls
echo.
echo  ========================================
echo  Face Validation Coordinates Setup
echo  ========================================
echo.

REM Check Node.js
echo Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)
echo OK: Node.js found
echo.

REM Navigate to server
echo Navigating to server directory...
cd /d "%~dp0server"
if errorlevel 1 (
    echo ERROR: Cannot find server directory
    pause
    exit /b 1
)
echo OK: In server directory
echo.

REM Install dependencies
echo.
echo Downloading face detection libraries...
echo (This will take 5-10 minutes)
echo.
call npm install @tensorflow/tfjs-core @vladmandic/face-api canvas
if errorlevel 1 (
    echo ERROR: Installation failed
    echo Check internet connection and try again:
    echo npm install @tensorflow/tfjs-core @vladmandic/face-api canvas
    pause
    exit /b 1
)
echo.
echo OK: Dependencies installed
echo.

REM Verify installation
echo Verifying installation...
node -e "require('@vladmandic/face-api'); console.log('OK: face-api loaded')" 2>nul
if errorlevel 1 (
    echo WARNING: Could not verify face-api
    echo Try reinstalling: npm install @vladmandic/face-api
)
echo.

REM Backup controller
echo Creating backup files...
if exist "controllers\face-attendance.controller.js" (
    copy "controllers\face-attendance.controller.js" "controllers\face-attendance.controller.js.backup" >nul
    echo OK: Backup created
) else (
    echo WARNING: Controller file not found
)
echo.

REM Show instructions
echo.
echo ========================================
echo NEXT STEPS (Follow these carefully!)
echo ========================================
echo.
echo 1. Open these files and make the changes from:
echo    SETUP_CHANGES_CHECKLIST.md
echo.
echo    Files to change:
echo    - server\controllers\face-attendance.controller.js
echo    - server\app.js
echo    - client\src\components\FaceAttendanceAdvanced.jsx
echo.
echo 2. Restart the server:
echo    npm run dev
echo.
echo 3. Watch for this message:
echo    "Face detection models loaded successfully"
echo.
echo 4. Test:
echo    a) Register a face
echo    b) Verify attendance
echo    c) Check if similarity score > 0.90
echo.
echo ========================================
echo TROUBLESHOOTING
echo ========================================
echo.
echo If npm install fails:
echo   - Check internet connection
echo   - Run: npm install -g npm
echo   - Try again
echo.
echo If models won't load:
echo   - Check internet connection
echo   - Models download from CDN automatically
echo   - Takes 30-60 seconds first time
echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.

pause
