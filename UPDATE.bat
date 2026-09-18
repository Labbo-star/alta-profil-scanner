@echo off
chcp 65001 >nul
setlocal

title Alta-Profil Scanner Updater

echo ========================================
echo   Alta-Profil Scanner - обновление
echo ========================================
echo.

set "ROOT=%~dp0"
set "TMP=%TEMP%\alta-profil-scanner-update"
set "ZIP=%TEMP%\alta-profil-scanner-main.zip"
set "URL=https://github.com/Labbo-star/alta-profil-scanner/archive/refs/heads/main.zip"

if exist "%TMP%" rmdir /s /q "%TMP%"
if exist "%ZIP%" del /q "%ZIP%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "Write-Host 'Скачиваю последнюю версию с GitHub...';" ^
  "Invoke-WebRequest -UseBasicParsing '%URL%' -OutFile '%ZIP%';" ^
  "Expand-Archive -LiteralPath '%ZIP%' -DestinationPath '%TMP%' -Force;" ^
  "$src=Join-Path '%TMP%' 'alta-profil-scanner-main';" ^
  "Get-ChildItem -LiteralPath $src -File | Where-Object {$_.Name -ne 'UPDATE.bat'} | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination (Join-Path '%ROOT%' $_.Name) -Force};" ^
  "Write-Host '';" ^
  "Write-Host 'Файлы обновлены.' -ForegroundColor Green;"

if errorlevel 1 (
  echo.
  echo ОШИБКА: обновление не выполнено.
  echo Проверь интернет и доступ к GitHub.
  pause
  exit /b 1
)

if exist "%TMP%" rmdir /s /q "%TMP%"
if exist "%ZIP%" del /q "%ZIP%"

echo.
echo Готово.
echo Теперь открой browser://extensions и нажми кнопку обновления у расширения.
echo.
pause
