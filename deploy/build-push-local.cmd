@echo off
REM build-push-local.cmd — ตัวห่อสำหรับ Windows: รัน build-push-local.sh ผ่าน "Git Bash"
REM
REM ทำไมต้องมี: พิมพ์ `bash deploy/build-push-local.sh` ใน PowerShell จะวิ่งเข้า WSL
REM (ซึ่งไม่มี docker/ssh ของเครื่อง) — ไฟล์นี้บังคับใช้ Git Bash ให้เอง
REM
REM วิธีใช้ (PowerShell — ต้องเปิด Docker Desktop ก่อน):
REM   deploy\build-push-local.cmd

setlocal
set "GITBASH=C:\Program Files\Git\bin\bash.exe"
if not exist "%GITBASH%" set "GITBASH=C:\Program Files (x86)\Git\bin\bash.exe"
if not exist "%GITBASH%" (
  echo [FAIL] ไม่พบ Git Bash ที่ "C:\Program Files\Git\bin\bash.exe" — ติดตั้ง Git for Windows ก่อน
  exit /b 1
)

docker version >nul 2>&1
if errorlevel 1 (
  echo [FAIL] docker ไม่ตอบ — เปิด Docker Desktop รอจนขึ้น running แล้วรันใหม่
  exit /b 1
)

"%GITBASH%" "%~dp0build-push-local.sh" %*
exit /b %errorlevel%
