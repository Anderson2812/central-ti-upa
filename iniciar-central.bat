@echo off
chcp 65001 >nul
title Central de Chamados TI - UPA Pediátrica
cd /d "%~dp0"

echo ==========================================================
echo   Central de Chamados TI - UPA Pediátrica
echo   Iniciando servidor local...
echo ==========================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERRO] O Node.js não foi encontrado neste computador.
  echo Instale o Node.js 18 ou superior em: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

echo Iniciando na porta configurada no config.json...
echo Para fechar a Central, feche esta janela.
echo.

node server.js

if %errorlevel% neq 0 (
  echo.
  echo [AVISO] O servidor foi encerrado.
  pause
)
