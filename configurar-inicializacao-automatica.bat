@echo off
chcp 65001 >nul
title Configurar Inicialização Automática - Central TI UPA
cd /d "%~dp0"

echo ==========================================================
echo   Central de Chamados TI - UPA Pediátrica
echo   Configurando Inicialização Automática no Windows (24h)
echo ==========================================================
echo.

set "PASTA_INICIALIZAR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "ATALHO=%PASTA_INICIALIZAR%\Central TI UPA.url"

echo Criando inicializador automático na pasta Startup do Windows...

(
  echo [InternetShortcut]
  echo URL=file:///%~dp0iniciar-central.bat
  echo IconFile=%SystemRoot%\System32\shell32.dll
  echo IconIndex=13
) > "%ATALHO%"

if exist "%ATALHO%" (
  echo.
  echo [SUCESSO!] A Central foi configurada para iniciar automaticamente!
  echo Sempre que este computador (PC 24h) ligar ou reiniciar após queda
  echo de energia, a Central de Chamados vai subir sozinha em segundo plano.
  echo.
) else (
  echo [AVISO] Não foi possível gravar na pasta de inicialização direta.
  echo Copie manualmente o atalho de "iniciar-central.bat" para a pasta "shell:startup".
)

echo.
pause
