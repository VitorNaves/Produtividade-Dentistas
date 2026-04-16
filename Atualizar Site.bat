@echo off
REM Script manual de atalho para atualizar o site

echo ==============================================
echo [Atualizador do Site Metas Fenelon]
echo ==============================================
echo Lendo planilha: "Laudos Diario (1).xlsx"...
echo.

PowerShell.exe -ExecutionPolicy Bypass -Command "& '%~dp0atualizar_dados.ps1'"

echo.
echo Atualizacao Finalizada. Pressione qualquer tecla para fechar.
pause >nul
