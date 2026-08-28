# Ride-For-You Development Startup Script
# Run this in a NEW PowerShell terminal AFTER starting the emulator from Android Studio

Write-Host "=== Ride-For-You Dev Environment Setup ===" -ForegroundColor Cyan

# Set environment variables for this session
$env:ANDROID_HOME = "D:\Android\Sdk"
$env:ANDROID_SDK_ROOT = "D:\Android\Sdk"
$env:PATH = "D:\Android\Sdk\platform-tools;D:\Android\Sdk\emulator;" + $env:PATH

# Verify emulator is running
Write-Host "`n[1] Checking emulator..." -ForegroundColor Yellow
$devices = & "D:\Android\Sdk\platform-tools\adb.exe" devices 2>&1
Write-Host $devices

if ($devices -notmatch "emulator-\d+\s+device") {
    Write-Host "[!] No emulator detected. Start emulator from Android Studio first." -ForegroundColor Red
} else {
    Write-Host "[OK] Emulator is running!" -ForegroundColor Green
}

Write-Host "[3] ANDROID_HOME: $env:ANDROID_HOME" -ForegroundColor Yellow

# Start Expo
Write-Host "`n[4] Starting Expo Metro bundler..." -ForegroundColor Cyan
Set-Location "C:\Users\madte\ride-for-you\mobile"
npm start
