@echo off
chcp 65001 >nul
rem ===================================================================
rem  Instala o atalho "Chamar TI" na Área de Trabalho de TODOS os
rem  usuários deste computador (C:\Users\Public\Desktop).
rem
rem  Como usar:
rem  1. Abra este arquivo no Bloco de Notas.
rem  2. Troque IP_DO_COMPUTADOR_DA_TI pelo IP do computador do Anderson
rem     (exemplo: 192.168.1.50).
rem  3. Salve, coloque num pendrive e, em cada máquina da UPA,
rem     clique com o BOTÃO DIREITO > "Executar como administrador".
rem ===================================================================

set "IP_DA_TI=IP_DO_COMPUTADOR_DA_TI"
set "PORTA=8080"

if "%IP_DA_TI%"=="IP_DO_COMPUTADOR_DA_TI" (
  echo.
  echo [ATENÇÃO] Você precisa abrir este arquivo no Bloco de Notas e
  echo trocar IP_DO_COMPUTADOR_DA_TI pelo IP do computador da TI.
  echo Exemplo: set "IP_DA_TI=192.168.1.50"
  echo.
  pause
  exit /b 1
)

set "ARQ=%PUBLIC%\Desktop\Chamar TI.url"

echo.
echo Digite o setor deste computador (ex: Consultorio 1, Triagem 2, Recepcao, Farmacia)
echo ou aperte ENTER para deixar livre pro usuario escolher:
set /p "SETOR_PC=Setor: "

if "%SETOR_PC%"=="" (
  set "URL_FINAL=http://%IP_DA_TI%:%PORTA%/"
) else (
  set "URL_FINAL=http://%IP_DA_TI%:%PORTA%/?setor=%SETOR_PC%"
)

(
  echo [InternetShortcut]
  echo URL=%URL_FINAL%
  echo IconFile=%SystemRoot%\System32\shell32.dll
  echo IconIndex=23
) > "%ARQ%"

if exist "%ARQ%" (
  echo.
  echo ==========================================================
  echo   Atalho "Chamar TI" criado com sucesso!
  echo   Ele já está visível na Área de Trabalho de todos os
  echo   usuários desta máquina.
  echo ==========================================================
  echo.
) else (
  echo.
  echo [ERRO] Não consegui criar o atalho.
  echo Você clicou com o botão direito e escolheu "Executar como administrador"?
  echo.
)

pause
