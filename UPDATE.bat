@echo off
chcp 65001 >nul
setlocal EnableExtensions

title Alta-Profil Scanner Updater

set "ROOT=C:\Users\Пользователь\Desktop\alta-profil-scanner-main"
set "TMP=%TEMP%\alta-profil-scanner-update"
set "ZIP=%TEMP%\alta-profil-scanner-main.zip"

echo ========================================
echo   Alta-Profil Scanner - обновление
echo ========================================
echo Папка: %ROOT%
echo.

if not exist "%ROOT%\manifest.json" (
  echo ОШИБКА: не найден %ROOT%\manifest.json
  pause
  exit /b 1
)

if exist "%TMP%" rmdir /s /q "%TMP%"
if exist "%ZIP%" del /q "%ZIP%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$root='C:\Users\Пользователь\Desktop\alta-profil-scanner-main';" ^
  "$tmp=Join-Path $env:TEMP 'alta-profil-scanner-update';" ^
  "$zip=Join-Path $env:TEMP 'alta-profil-scanner-main.zip';" ^
  "$url='https://github.com/Labbo-star/alta-profil-scanner/archive/refs/heads/main.zip?ts=' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds();" ^
  "$local=(Get-Content -LiteralPath (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json).version;" ^
  "Write-Host ('Локальная версия: ' + $local);" ^
  "Write-Host 'Скачиваю GitHub...';" ^
  "Invoke-WebRequest -UseBasicParsing $url -OutFile $zip;" ^
  "Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force;" ^
  "$manifest=Get-ChildItem -LiteralPath $tmp -Filter manifest.json -File -Recurse | Select-Object -First 1;" ^
  "if(!$manifest){throw 'В архиве нет manifest.json'};" ^
  "$src=$manifest.Directory.FullName;" ^
  "$remote=(Get-Content -LiteralPath $manifest.FullName -Raw | ConvertFrom-Json).version;" ^
  "Write-Host ('Версия GitHub: ' + $remote);" ^
  "Get-ChildItem -LiteralPath $src -File | Where-Object {$_.Name -ne 'UPDATE.bat'} | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $root $_.Name) -Force};" ^
  "$installed=(Get-Content -LiteralPath (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json).version;" ^
  "if($installed -ne $remote){throw ('После копирования версия '+$installed+', ожидалась '+$remote)};" ^
  "Write-Host ('ГОТОВО. Установлена версия ' + $installed) -ForegroundColor Green;"

if errorlevel 1 (
  echo.
  echo ОШИБКА: обновление не выполнено.
  pause
  exit /b 1
)

if exist "%TMP%" rmdir /s /q "%TMP%"
if exist "%ZIP%" del /q "%ZIP%"

echo.
echo Теперь открой browser://extensions и нажми обновить.
echo Если версия не изменилась, удали расширение и заново загрузи распакованное из:
echo %ROOT%
echo.
pause
