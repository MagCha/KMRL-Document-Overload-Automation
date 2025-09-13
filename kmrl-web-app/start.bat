@echo off
title KMRL Fleet Management System - Startup

echo ========================================
echo  KMRL Fleet Management System
echo  Starting Node.js Application...
echo ========================================
echo.

rem Check if .env file exists
if not exist .env (
    echo ERROR: .env file not found!
    echo Please copy .env.example to .env and configure it.
    pause
    exit /b 1
)

rem Check if optimization engine exists
if not exist optimization_engine_v3.py (
    echo ERROR: optimization_engine_v3.py not found!
    echo Please copy the optimization engine to the project root.
    pause
    exit /b 1
)

rem Check if Firebase service account exists
if not exist "src\config\firebase-service-account.json" (
    echo WARNING: Firebase service account key not found!
    echo Please add your Firebase service account key to src\config\
    echo.
)

rem Start the application
echo Starting server...
echo Open http://localhost:3000 in your browser
echo Press Ctrl+C to stop the server
echo.
npm run dev

pause
