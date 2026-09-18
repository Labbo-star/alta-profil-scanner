@echo off
chcp 65001 >nul
setlocal EnableExtensions

title Alta-Profil Scanner - установка автообновления

echo ================================================
echo   Alta-Profil Scanner - автообновление из GitHub
echo ================================================
echo.
echo Это нужно запустить ОДИН раз.
echo После этого обновления можно будет ставить кнопкой внутри расширения.
echo.

set "ROOT=%~dp0"
set "ROOT_NO_SLASH=%ROOT:~0,-1%"
set "HOSTDIR=%LOCALAPPDATA%\AltaProfilScannerUpdater"
set "HOSTNAME=com.labbo.alta_profil_scanner_updater"
set "MANIFEST=%HOSTDIR%\native-host.json"
set "EXE=%HOSTDIR%\native_updater_host.exe"
set "CFG=%HOSTDIR%\config.txt"

if not exist "%HOSTDIR%" mkdir "%HOSTDIR%"

set "EXTID="

rem Попытка автоматически найти ID распакованного расширения в профилях Яндекс.Браузера.
for %%P in ("%LOCALAPPDATA%\Yandex\YandexBrowser\User Data\*\Preferences" "%LOCALAPPDATA%\Yandex\YandexBrowser\User Data\*\Secure Preferences") do (
  for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$target=[IO.Path]::GetFullPath('%ROOT_NO_SLASH%').TrimEnd('\\').ToLowerInvariant();" ^
    "Get-ChildItem -Path '%%~P' -ErrorAction SilentlyContinue | ForEach-Object { try { $j=Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json; $settings=$j.extensions.settings; if($settings){ foreach($p in $settings.PSObject.Properties){ $v=$p.Value; if($v.path){ try{$x=[IO.Path]::GetFullPath([string]$v.path).TrimEnd('\\').ToLowerInvariant()}catch{$x=''}; if($x -eq $target){$p.Name; break} } } } } catch{} }"`) do if not defined EXTID set "EXTID=%%I"
)

if not defined EXTID (
  echo Не удалось автоматически определить ID расширения.
  echo.
  echo Открой browser://extensions ^> Alta-Profil Scanner и скопируй поле "ID".
  set /p EXTID=Вставь ID расширения сюда: 
)

if not defined EXTID (
  echo.
  echo ОШИБКА: ID не указан.
  pause
  exit /b 1
)

echo.
echo Найден ID: %EXTID%
echo Папка расширения: %ROOT_NO_SLASH%
echo.

>"%CFG%" echo %ROOT_NO_SLASH%

set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"

if not exist "%CSC%" (
  echo ОШИБКА: не найден компилятор .NET Framework csc.exe.
  echo Включи компонент .NET Framework 4.x в Windows и запусти установщик снова.
  pause
  exit /b 1
)

if exist "%EXE%" del /q "%EXE%"

"%CSC%" /nologo /target:exe /optimize+ /out:"%EXE%" /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll "%ROOT%native_updater_host.cs"
if errorlevel 1 (
  echo.
  echo ОШИБКА: не удалось собрать native updater.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$obj=[ordered]@{name='%HOSTNAME%';description='Alta-Profil Scanner GitHub updater';path='%EXE:\=\\%';type='stdio';allowed_origins=@('chrome-extension://%EXTID%/')};" ^
  "$json=$obj|ConvertTo-Json -Depth 4;" ^
  "[IO.File]::WriteAllText('%MANIFEST%', $json, (New-Object Text.UTF8Encoding($false)))"

if errorlevel 1 (
  echo ОШИБКА: не удалось создать native-host.json.
  pause
  exit /b 1
)

reg add "HKCU\SOFTWARE\Chromium\NativeMessagingHosts\%HOSTNAME%" /ve /t REG_SZ /d "%MANIFEST%" /f >nul
reg add "HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\%HOSTNAME%" /ve /t REG_SZ /d "%MANIFEST%" /f >nul
reg add "HKCU\SOFTWARE\Yandex\YandexBrowser\NativeMessagingHosts\%HOSTNAME%" /ve /t REG_SZ /d "%MANIFEST%" /f >nul

echo.
echo ================================================
echo Готово. Автообновление установлено.
echo ================================================
echo.
echo 1. Открой browser://extensions
echo 2. Нажми ^<Обновить^> у Alta-Profil Scanner
echo 3. Открой расширение
echo 4. Нажми ^<Проверить обновления^>
echo.
pause
