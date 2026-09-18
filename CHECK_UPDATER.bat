@echo off
chcp 65001 >nul
setlocal EnableExtensions

title Alta-Profil Scanner - диагностика автообновления

set "HOSTDIR=%LOCALAPPDATA%\AltaProfilScannerUpdater"
set "HOSTNAME=com.labbo.alta_profil_scanner_updater"
set "MANIFEST=%HOSTDIR%\native-host.json"
set "EXE=%HOSTDIR%\native_updater_host.exe"
set "CFG=%HOSTDIR%\config.txt"
set "IDFILE=%HOSTDIR%\extension-id.txt"
set "REPORT=%USERPROFILE%\Desktop\alta-updater-diagnostic.txt"

(
 echo Alta-Profil Scanner updater diagnostic
 echo ======================================
 echo Date: %DATE% %TIME%
 echo.
 echo HOSTDIR=%HOSTDIR%
 echo.
 echo [FILES]
 if exist "%EXE%" (echo EXE=OK: %EXE%) else (echo EXE=MISSING)
 if exist "%MANIFEST%" (echo MANIFEST=OK: %MANIFEST%) else (echo MANIFEST=MISSING)
 if exist "%CFG%" (echo CONFIG=OK: & type "%CFG%") else (echo CONFIG=MISSING)
 if exist "%IDFILE%" (echo EXTENSION_ID= & type "%IDFILE%") else (echo EXTENSION_ID_FILE=MISSING)
 echo.
 echo [MANIFEST CONTENT]
 if exist "%MANIFEST%" type "%MANIFEST%"
 echo.
 echo [REGISTRY YANDEX DEFAULT]
 reg query "HKCU\SOFTWARE\Yandex\YandexBrowser\NativeMessagingHosts\%HOSTNAME%" /ve 2^>^&1
 echo.
 echo [REGISTRY YANDEX 64]
 reg query "HKCU\SOFTWARE\Yandex\YandexBrowser\NativeMessagingHosts\%HOSTNAME%" /ve /reg:64 2^>^&1
 echo.
 echo [REGISTRY YANDEX 32]
 reg query "HKCU\SOFTWARE\Yandex\YandexBrowser\NativeMessagingHosts\%HOSTNAME%" /ve /reg:32 2^>^&1
 echo.
 echo [REGISTRY CHROME]
 reg query "HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\%HOSTNAME%" /ve 2^>^&1
 echo.
 echo [Yandex process]
 tasklist /FI "IMAGENAME eq browser.exe" 2^>^&1
) > "%REPORT%"

echo.
echo Диагностика сохранена:
echo %REPORT%
echo.
echo Открою файл. Пришли мне его содержимое, если автообновление всё ещё не работает.
start "" notepad.exe "%REPORT%"
pause
