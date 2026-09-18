@echo off
chcp 65001 >nul
setlocal EnableExtensions

title Alta-Profil Scanner - FIXED updater

set "ROOT=C:\Users\Пользователь\Desktop\alta-profil-scanner-main"
set "TMP=%TEMP%\alta-profil-scanner-fixed-update"
set "ZIP=%TEMP%\alta-profil-scanner-fixed-main.zip"
set "URL=https://github.com/Labbo-star/alta-profil-scanner/archive/refs/heads/main.zip"

echo ========================================================
echo   Alta-Profil Scanner - исправленное обновление
echo ========================================================
echo.
echo Папка расширения:
echo %ROOT%
echo.

if not exist "%ROOT%\manifest.json" (
  echo ОШИБКА: в указанной папке не найден manifest.json
  echo Проверь, что расширение лежит именно здесь:
  echo %ROOT%
  pause
  exit /b 1
)

for /f "tokens=2 delims=:," %%V in ('findstr /i /c:"\"version\"" "%ROOT%\manifest.json"') do set "LOCALVER=%%~V"
set "LOCALVER=%LOCALVER:"=%"
set "LOCALVER=%LOCALVER: =%"
echo Текущая локальная версия: %LOCALVER%
echo.

if exist "%TMP%" rmdir /s /q "%TMP%"
if exist "%ZIP%" del /q "%ZIP%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$root='C:\Users\Пользователь\Desktop\alta-profil-scanner-main';" ^
  "$tmp=Join-Path $env:TEMP 'alta-profil-scanner-fixed-update';" ^
  "$zip=Join-Path $env:TEMP 'alta-profil-scanner-fixed-main.zip';" ^
  "$url='https://github.com/Labbo-star/alta-profil-scanner/archive/refs/heads/main.zip?ts=' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds();" ^
  "Write-Host 'Скачиваю последнюю версию GitHub...';" ^
  "Invoke-WebRequest -UseBasicParsing $url -OutFile $zip;" ^
  "Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force;" ^
  "$manifest=Get-ChildItem -LiteralPath $tmp -Filter manifest.json -File -Recurse | Select-Object -First 1;" ^
  "if(!$manifest){throw 'В архиве GitHub не найден manifest.json'};" ^
  "$src=$manifest.Directory.FullName;" ^
  "$remote=(Get-Content -LiteralPath $manifest.FullName -Raw | ConvertFrom-Json).version;" ^
  "Write-Host ('Версия на GitHub: ' + $remote);" ^
  "Get-ChildItem -LiteralPath $src -File | Where-Object {$_.Name -ne 'UPDATE_PATH_FIXED.bat'} | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $root $_.Name) -Force};" ^
  "$installed=(Get-Content -LiteralPath (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json).version;" ^
  "if($installed -ne $remote){throw ('Проверка версии не прошла. В папке '+$installed+', на GitHub '+$remote)};" ^
  "[IO.File]::WriteAllText((Join-Path $root 'LAST_UPDATE.txt'), ('OK '+(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')+' version '+$installed+' path '+$root), (New-Object Text.UTF8Encoding($false)));" ^
  "Write-Host ''; Write-Host ('ГОТОВО. В папке установлена версия ' + $installed) -ForegroundColor Green;"

if errorlevel 1 (
  echo.
  echo ========================================================
  echo ОШИБКА: файлы не были обновлены корректно.
  echo ========================================================
  pause
  exit /b 1
)

if exist "%TMP%" rmdir /s /q "%TMP%"
if exist "%ZIP%" del /q "%ZIP%"

echo.
echo Теперь ОБЯЗАТЕЛЬНО:
echo 1. Открой browser://extensions
 echo 2. Удали старую Alta-Profil Scanner, если она загружена из другой папки.
echo 3. Нажми "Загрузить распакованное" и выбери:
echo    %ROOT%
echo 4. После этого версия должна совпасть с GitHub.
echo.
pause
