@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

title Alta-Profil Scanner - настройка автообновления

echo =========================================================
echo   Alta-Profil Scanner - настройка автообновления v3
echo =========================================================
echo.
echo Рабочая папка зафиксирована как:
echo C:\Users\Пользователь\Desktop\alta-profil-scanner-main
echo.
echo Этот файл нужно успешно запустить ОДИН раз.
echo После установки Яндекс.Браузер нужно ПОЛНОСТЬЮ закрыть и открыть снова.
echo.

set "ROOT=C:\Users\Пользователь\Desktop\alta-profil-scanner-main"
set "HOSTDIR=%LOCALAPPDATA%\AltaProfilScannerUpdater"
set "HOSTNAME=com.labbo.alta_profil_scanner_updater"
set "MANIFEST=%HOSTDIR%\native-host.json"
set "EXE=%HOSTDIR%\native_updater_host.exe"
set "CFG=%HOSTDIR%\config.txt"
set "IDFILE=%HOSTDIR%\extension-id.txt"

if not exist "%ROOT%\manifest.json" (
  echo ОШИБКА: не найден %ROOT%\manifest.json
  echo Сначала запусти UPDATE_PATH_FIXED.bat и подключи расширение именно из этой папки.
  pause
  exit /b 1
)

if not exist "%HOSTDIR%" mkdir "%HOSTDIR%"

if not exist "%ROOT%\native_updater_host.cs" (
  echo ОШИБКА: в рабочей папке нет native_updater_host.cs
  echo Сначала запусти UPDATE_PATH_FIXED.bat.
  pause
  exit /b 1
)

set "EXTID="

rem Пытаемся найти ID именно расширения, загруженного из фиксированной рабочей папки.
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$target=[IO.Path]::GetFullPath('C:\Users\Пользователь\Desktop\alta-profil-scanner-main').TrimEnd('\\').ToLowerInvariant();" ^
  "$profiles=Join-Path $env:LOCALAPPDATA 'Yandex\YandexBrowser\User Data';" ^
  "Get-ChildItem -Path $profiles -Directory -ErrorAction SilentlyContinue | ForEach-Object {" ^
  " foreach($name in @('Preferences','Secure Preferences')){" ^
  "  $f=Join-Path $_.FullName $name; if(!(Test-Path $f)){continue};" ^
  "  try{$j=Get-Content -LiteralPath $f -Raw | ConvertFrom-Json}catch{continue};" ^
  "  $settings=$j.extensions.settings; if(!$settings){continue};" ^
  "  foreach($p in $settings.PSObject.Properties){" ^
  "   $v=$p.Value; if(!$v.path){continue};" ^
  "   try{$x=[IO.Path]::GetFullPath([string]$v.path).TrimEnd('\\').ToLowerInvariant()}catch{continue};" ^
  "   if($x -eq $target){$p.Name; return}" ^
  "  }" ^
  " }" ^
  "}"`) do if not defined EXTID set "EXTID=%%I"

if defined EXTID (
  echo Автоматически найден ID: !EXTID!
  choice /C YN /N /M "Это ID текущего Alta-Profil Scanner? [Y/N]: "
  if errorlevel 2 set "EXTID="
)

if not defined EXTID (
  echo.
  echo Открой browser://extensions и скопируй ID расширения Alta-Profil Scanner.
  echo ID должен состоять из 32 букв a-p.
  set /p EXTID=Вставь ID сюда: 
)

set "EXTID=%EXTID: =%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "if('%EXTID%' -notmatch '^[a-p]{32}$'){exit 7}"
if errorlevel 1 (
  echo.
  echo ОШИБКА: неверный ID: %EXTID%
  pause
  exit /b 1
)

>"%CFG%" echo %ROOT%
>"%IDFILE%" echo %EXTID%

set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC%" (
  echo ОШИБКА: не найден .NET Framework compiler csc.exe.
  pause
  exit /b 1
)

if exist "%EXE%" del /q "%EXE%"
"%CSC%" /nologo /target:exe /optimize+ /out:"%EXE%" /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll "%ROOT%\native_updater_host.cs"
if errorlevel 1 (
  echo ОШИБКА: native updater не собрался.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$obj=[ordered]@{name='%HOSTNAME%';description='Alta-Profil Scanner GitHub updater';path='%EXE%';type='stdio';allowed_origins=@('chrome-extension://%EXTID%/')};" ^
  "$json=$obj|ConvertTo-Json -Depth 4;" ^
  "[IO.File]::WriteAllText('%MANIFEST%', $json, (New-Object Text.UTF8Encoding($false)))"
if errorlevel 1 (
  echo ОШИБКА: не удалось создать native-host.json.
  pause
  exit /b 1
)

for %%K in (
  "HKCU\SOFTWARE\Yandex\YandexBrowser\NativeMessagingHosts\%HOSTNAME%"
  "HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\%HOSTNAME%"
  "HKCU\SOFTWARE\Chromium\NativeMessagingHosts\%HOSTNAME%"
) do (
  reg add %%K /ve /t REG_SZ /d "%MANIFEST%" /f /reg:64 >nul 2>&1
  reg add %%K /ve /t REG_SZ /d "%MANIFEST%" /f /reg:32 >nul 2>&1
  reg add %%K /ve /t REG_SZ /d "%MANIFEST%" /f >nul 2>&1
)

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
echo Путь расширения: %ROOT%
echo Native host: %EXE%
echo Extension ID: %EXTID%
echo.
echo Теперь ПОЛНОСТЬЮ закрой все окна Яндекс.Браузера и открой снова.
echo Затем нажми в расширении "Проверить обновления".
echo.
pause
