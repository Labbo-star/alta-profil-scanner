@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

title Alta-Profil Scanner - настройка автообновления

echo =========================================================
echo   Alta-Profil Scanner - настройка автообновления v2
echo =========================================================
echo.
echo Этот файл нужно успешно запустить ОДИН раз.
echo После установки Яндекс.Браузер нужно ПОЛНОСТЬЮ закрыть и открыть снова.
echo.

set "ROOT=%~dp0"
set "ROOT_NO_SLASH=%ROOT:~0,-1%"
set "HOSTDIR=%LOCALAPPDATA%\AltaProfilScannerUpdater"
set "HOSTNAME=com.labbo.alta_profil_scanner_updater"
set "MANIFEST=%HOSTDIR%\native-host.json"
set "EXE=%HOSTDIR%\native_updater_host.exe"
set "CFG=%HOSTDIR%\config.txt"
set "IDFILE=%HOSTDIR%\extension-id.txt"

if not exist "%HOSTDIR%" mkdir "%HOSTDIR%"

if not exist "%ROOT%native_updater_host.cs" (
  echo ОШИБКА: рядом с INSTALL_UPDATER.bat нет файла native_updater_host.cs
  echo Сначала запусти UPDATE.bat, затем повтори установку.
  pause
  exit /b 1
)

set "EXTID="

rem Пытаемся определить ID расширения по пути распакованного расширения.
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$target=[IO.Path]::GetFullPath('%ROOT_NO_SLASH%').TrimEnd('\\').ToLowerInvariant();" ^
  "$root=Join-Path $env:LOCALAPPDATA 'Yandex\YandexBrowser\User Data';" ^
  "Get-ChildItem -Path $root -Directory -ErrorAction SilentlyContinue | ForEach-Object {" ^
  "  foreach($name in @('Preferences','Secure Preferences')){" ^
  "    $f=Join-Path $_.FullName $name; if(!(Test-Path $f)){continue};" ^
  "    try{$j=Get-Content -LiteralPath $f -Raw | ConvertFrom-Json}catch{continue};" ^
  "    $settings=$j.extensions.settings; if(!$settings){continue};" ^
  "    foreach($p in $settings.PSObject.Properties){" ^
  "      $v=$p.Value; if(!$v.path){continue};" ^
  "      try{$x=[IO.Path]::GetFullPath([string]$v.path).TrimEnd('\\').ToLowerInvariant()}catch{continue};" ^
  "      if($x -eq $target){$p.Name; return}" ^
  "    }" ^
  "  }" ^
  "}"`) do if not defined EXTID set "EXTID=%%I"

if defined EXTID (
  echo Автоматически найден ID: !EXTID!
  echo.
  choice /C YN /N /M "Это ID расширения Alta-Profil Scanner? [Y/N]: "
  if errorlevel 2 set "EXTID="
)

if not defined EXTID (
  echo.
  echo Открой browser://extensions и найди Alta-Profil - Tilda Scanner.
  echo Скопируй ПОЛНЫЙ ID расширения - 32 буквы.
  echo.
  set /p EXTID=Вставь ID сюда: 
)

set "EXTID=%EXTID: =%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "if('%EXTID%' -notmatch '^[a-p]{32}$'){exit 7}"
if errorlevel 1 (
  echo.
  echo ОШИБКА: ID должен состоять ровно из 32 букв a-p.
  echo Получено: %EXTID%
  pause
  exit /b 1
)

echo.
echo ID расширения: %EXTID%
echo Папка расширения: %ROOT_NO_SLASH%
echo Папка updater: %HOSTDIR%
echo.

>"%CFG%" echo %ROOT_NO_SLASH%
>"%IDFILE%" echo %EXTID%

set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"

if not exist "%CSC%" (
  echo ОШИБКА: не найден .NET Framework compiler csc.exe.
  pause
  exit /b 1
)

if exist "%EXE%" del /q "%EXE%"

"%CSC%" /nologo /target:exe /optimize+ /out:"%EXE%" /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll "%ROOT%native_updater_host.cs"
if errorlevel 1 (
  echo.
  echo ОШИБКА: native updater не собрался.
  pause
  exit /b 1
)

if not exist "%EXE%" (
  echo ОШИБКА: после компиляции не найден %EXE%
  pause
  exit /b 1
)

rem PowerShell сам корректно экранирует обратные слэши при ConvertTo-Json.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$obj=[ordered]@{name='%HOSTNAME%';description='Alta-Profil Scanner GitHub updater';path='%EXE%';type='stdio';allowed_origins=@('chrome-extension://%EXTID%/')};" ^
  "$json=$obj|ConvertTo-Json -Depth 4;" ^
  "[IO.File]::WriteAllText('%MANIFEST%', $json, (New-Object Text.UTF8Encoding($false)))"
if errorlevel 1 (
  echo ОШИБКА: не удалось создать native-host.json.
  pause
  exit /b 1
)

rem Регистрируем во всех Chromium-ветках. Yandex - основная.
for %%K in (
  "HKCU\SOFTWARE\Yandex\YandexBrowser\NativeMessagingHosts\%HOSTNAME%"
  "HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\%HOSTNAME%"
  "HKCU\SOFTWARE\Chromium\NativeMessagingHosts\%HOSTNAME%"
) do (
  reg add %%K /ve /t REG_SZ /d "%MANIFEST%" /f /reg:64 >nul 2>&1
  reg add %%K /ve /t REG_SZ /d "%MANIFEST%" /f /reg:32 >nul 2>&1
  reg add %%K /ve /t REG_SZ /d "%MANIFEST%" /f >nul 2>&1
)

echo.
echo Проверяю установку...
set "FAILED=0"
if not exist "%MANIFEST%" set "FAILED=1"
if not exist "%EXE%" set "FAILED=1"
if not exist "%CFG%" set "FAILED=1"
reg query "HKCU\SOFTWARE\Yandex\YandexBrowser\NativeMessagingHosts\%HOSTNAME%" /ve >nul 2>&1
if errorlevel 1 set "FAILED=1"

if "%FAILED%"=="1" (
  echo.
  echo ОШИБКА: проверка установки не пройдена.
  echo Запусти CHECK_UPDATER.bat и пришли результат.
  pause
  exit /b 1
)

echo.
echo =========================================================
echo УСТАНОВКА УСПЕШНА
echo =========================================================
echo Native host: %EXE%
echo Manifest:    %MANIFEST%
echo Extension ID: %EXTID%
echo.
echo ВАЖНО: сейчас ПОЛНОСТЬЮ закрой Яндекс.Браузер.
echo Не просто вкладку - закрой все окна браузера.
echo Затем открой его заново и нажми в расширении "Проверить обновления".
echo.
pause
