# =============================================================================
# Fast Drive - Script de Instalação para Windows
# =============================================================================
# Execute como Administrador:
#   PowerShell -ExecutionPolicy Bypass -File install-windows.ps1
# =============================================================================

param(
    [string]$InstallDir = "C:\fast-drive",
    [string]$ServiceName = "FastDriveMonitor",
    [string]$GitRepo = "https://github.com/markanthony91/fast-drive-monitor.git",
    [string]$NssmPath = "C:\nssm\nssm.exe",
    [int]$Port = 3000
)

# Verificar se está rodando como Admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERRO: Este script precisa ser executado como Administrador!" -ForegroundColor Red
    exit 1
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Fast Drive - Instalação Windows" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Verificar Node.js
Write-Host "[1/7] Verificando Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "ERRO: Node.js não encontrado. Instale em https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "  Node.js $nodeVersion encontrado" -ForegroundColor Green

# Verificar Git
Write-Host "[2/7] Verificando Git..." -ForegroundColor Yellow
$gitVersion = git --version 2>$null
if (-not $gitVersion) {
    Write-Host "ERRO: Git não encontrado. Instale em https://git-scm.com" -ForegroundColor Red
    exit 1
}
Write-Host "  $gitVersion encontrado" -ForegroundColor Green

# Verificar/Baixar NSSM
Write-Host "[3/7] Verificando NSSM..." -ForegroundColor Yellow
if (-not (Test-Path $NssmPath)) {
    Write-Host "  NSSM não encontrado. Baixando..." -ForegroundColor Yellow

    $nssmDir = Split-Path $NssmPath -Parent
    if (-not (Test-Path $nssmDir)) {
        New-Item -ItemType Directory -Path $nssmDir -Force | Out-Null
    }

    # Baixar NSSM
    $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
    $nssmZip = "$env:TEMP\nssm.zip"

    try {
        Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip
        Expand-Archive -Path $nssmZip -DestinationPath "$env:TEMP\nssm" -Force
        Copy-Item "$env:TEMP\nssm\nssm-2.24\win64\nssm.exe" $NssmPath -Force
        Remove-Item $nssmZip -Force
        Remove-Item "$env:TEMP\nssm" -Recurse -Force
        Write-Host "  NSSM instalado em $NssmPath" -ForegroundColor Green
    } catch {
        Write-Host "ERRO: Falha ao baixar NSSM. Baixe manualmente em https://nssm.cc" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  NSSM encontrado em $NssmPath" -ForegroundColor Green
}

# Clonar/Atualizar repositório
Write-Host "[4/7] Configurando repositório..." -ForegroundColor Yellow
if (Test-Path $InstallDir) {
    Write-Host "  Diretório existe. Atualizando..." -ForegroundColor Yellow
    Push-Location $InstallDir
    git pull origin main
    Pop-Location
} else {
    Write-Host "  Clonando repositório..." -ForegroundColor Yellow
    git clone $GitRepo $InstallDir
}
Write-Host "  Repositório configurado em $InstallDir" -ForegroundColor Green

# Instalar dependências
Write-Host "[5/7] Instalando dependências npm..." -ForegroundColor Yellow
Push-Location $InstallDir
npm install --production
Pop-Location
Write-Host "  Dependências instaladas" -ForegroundColor Green

# Criar diretório de dados
Write-Host "[6/7] Criando diretórios..." -ForegroundColor Yellow
$dataDir = "$InstallDir\data"
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
}
Write-Host "  Diretório de dados: $dataDir" -ForegroundColor Green

# Configurar serviço NSSM
Write-Host "[7/7] Configurando serviço Windows..." -ForegroundColor Yellow

# Parar serviço se existir
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "  Parando serviço existente..." -ForegroundColor Yellow
    & $NssmPath stop $ServiceName 2>$null
    & $NssmPath remove $ServiceName confirm 2>$null
    Start-Sleep -Seconds 2
}

# Instalar serviço
$nodePath = (Get-Command node).Source
& $NssmPath install $ServiceName $nodePath "src\api\server.js"
& $NssmPath set $ServiceName AppDirectory $InstallDir
& $NssmPath set $ServiceName DisplayName "Fast Drive Jabra Monitor"
& $NssmPath set $ServiceName Description "Monitor de headsets Jabra Engage 55 com API REST"
& $NssmPath set $ServiceName Start SERVICE_AUTO_START
& $NssmPath set $ServiceName AppStdout "$InstallDir\logs\service.log"
& $NssmPath set $ServiceName AppStderr "$InstallDir\logs\error.log"
& $NssmPath set $ServiceName AppRotateFiles 1
& $NssmPath set $ServiceName AppRotateBytes 1048576

# Criar diretório de logs
$logsDir = "$InstallDir\logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

# Iniciar serviço
& $NssmPath start $ServiceName

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Instalação Concluída!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Serviço: $ServiceName" -ForegroundColor Cyan
Write-Host "Diretório: $InstallDir" -ForegroundColor Cyan
Write-Host "Porta: $Port" -ForegroundColor Cyan
Write-Host ""
Write-Host "Acesse:" -ForegroundColor Yellow
Write-Host "  Interface Web: http://localhost:$Port" -ForegroundColor White
Write-Host "  API REST:      http://localhost:$Port/api" -ForegroundColor White
Write-Host ""
Write-Host "Comandos úteis:" -ForegroundColor Yellow
Write-Host "  Parar:     nssm stop $ServiceName" -ForegroundColor White
Write-Host "  Iniciar:   nssm start $ServiceName" -ForegroundColor White
Write-Host "  Reiniciar: nssm restart $ServiceName" -ForegroundColor White
Write-Host "  Status:    nssm status $ServiceName" -ForegroundColor White
Write-Host "  Logs:      Get-Content $logsDir\service.log -Tail 50" -ForegroundColor White
Write-Host ""

# Configurar firewall (opcional)
$addFirewall = Read-Host "Deseja abrir a porta $Port no firewall? (S/N)"
if ($addFirewall -eq "S" -or $addFirewall -eq "s") {
    netsh advfirewall firewall add rule name="Fast Drive Monitor" dir=in action=allow protocol=tcp localport=$Port
    Write-Host "Regra de firewall adicionada" -ForegroundColor Green
}

Write-Host ""
Write-Host "Instalação finalizada!" -ForegroundColor Green
