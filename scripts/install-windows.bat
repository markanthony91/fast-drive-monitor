@echo off
:: =============================================================================
:: Fast Drive - Instalação Rápida Windows
:: =============================================================================
:: Execute como Administrador
:: =============================================================================

echo.
echo ============================================
echo   Fast Drive - Instalacao Rapida
echo ============================================
echo.

:: Verificar Admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERRO: Execute como Administrador!
    echo Clique com botao direito e escolha "Executar como administrador"
    pause
    exit /b 1
)

:: Executar script PowerShell
powershell -ExecutionPolicy Bypass -File "%~dp0install-windows.ps1"

pause
