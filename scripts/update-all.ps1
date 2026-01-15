# =============================================================================
# Fast Drive - Script de Atualização em Massa
# =============================================================================
# Atualiza múltiplas máquinas remotamente via API ou PowerShell Remoting
#
# Uso:
#   .\update-all.ps1 -Hosts "pc1,pc2,pc3"
#   .\update-all.ps1 -HostsFile "hosts.txt"
#   .\update-all.ps1 -Hosts "pc1,pc2,pc3" -UseApi
# =============================================================================

param(
    [string]$Hosts = "",
    [string]$HostsFile = "",
    [int]$Port = 3000,
    [switch]$UseApi,
    [switch]$CheckOnly,
    [switch]$ForceRestart
)

# Carregar lista de hosts
$hostList = @()

if ($Hosts) {
    $hostList = $Hosts -split ","
} elseif ($HostsFile -and (Test-Path $HostsFile)) {
    $hostList = Get-Content $HostsFile | Where-Object { $_ -and $_ -notmatch "^#" }
} else {
    Write-Host "ERRO: Especifique -Hosts ou -HostsFile" -ForegroundColor Red
    Write-Host ""
    Write-Host "Exemplos:" -ForegroundColor Yellow
    Write-Host "  .\update-all.ps1 -Hosts 'pc1,pc2,pc3'" -ForegroundColor White
    Write-Host "  .\update-all.ps1 -HostsFile 'hosts.txt'" -ForegroundColor White
    Write-Host "  .\update-all.ps1 -Hosts 'pc1' -UseApi -CheckOnly" -ForegroundColor White
    exit 1
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Fast Drive - Atualização em Massa" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Hosts: $($hostList.Count)" -ForegroundColor Yellow
Write-Host "Método: $(if ($UseApi) { 'API REST' } else { 'PowerShell Remoting' })" -ForegroundColor Yellow
Write-Host "Modo: $(if ($CheckOnly) { 'Apenas verificar' } else { 'Atualizar' })" -ForegroundColor Yellow
Write-Host ""

$results = @()

foreach ($hostname in $hostList) {
    $hostname = $hostname.Trim()
    if (-not $hostname) { continue }

    Write-Host "[$hostname] " -NoNewline -ForegroundColor Cyan

    try {
        if ($UseApi) {
            # Método API REST
            $baseUrl = "http://${hostname}:${Port}/api"

            if ($CheckOnly) {
                # Apenas verificar
                $response = Invoke-RestMethod -Uri "$baseUrl/update/check" -TimeoutSec 30
                if ($response.available) {
                    Write-Host "Atualização disponível ($($response.behind) commits)" -ForegroundColor Yellow
                } else {
                    Write-Host "Atualizado" -ForegroundColor Green
                }
                $results += [PSCustomObject]@{
                    Host = $hostname
                    Status = if ($response.available) { "Pendente" } else { "Atualizado" }
                    Version = $response.currentCommit
                    Behind = $response.behind
                }
            } else {
                # Aplicar atualização
                $checkResponse = Invoke-RestMethod -Uri "$baseUrl/update/check" -TimeoutSec 30
                if ($checkResponse.available) {
                    Write-Host "Atualizando... " -NoNewline -ForegroundColor Yellow
                    $updateResponse = Invoke-RestMethod -Uri "$baseUrl/update/apply" -Method POST -TimeoutSec 120
                    if ($updateResponse.success) {
                        Write-Host "OK ($($updateResponse.previousVersion) -> $($updateResponse.newVersion))" -ForegroundColor Green
                        if ($ForceRestart) {
                            Invoke-RestMethod -Uri "$baseUrl/update/restart" -Method POST -TimeoutSec 10
                            Write-Host "  Reiniciando..." -ForegroundColor Yellow
                        }
                    } else {
                        Write-Host "FALHA: $($updateResponse.message)" -ForegroundColor Red
                    }
                    $results += [PSCustomObject]@{
                        Host = $hostname
                        Status = if ($updateResponse.success) { "Atualizado" } else { "Falha" }
                        Message = $updateResponse.message
                    }
                } else {
                    Write-Host "Já atualizado" -ForegroundColor Green
                    $results += [PSCustomObject]@{
                        Host = $hostname
                        Status = "Atualizado"
                        Message = "Já estava na última versão"
                    }
                }
            }
        } else {
            # Método PowerShell Remoting
            $scriptBlock = {
                param($CheckOnly, $InstallDir)

                Set-Location $InstallDir

                # Fetch updates
                git fetch origin 2>&1 | Out-Null

                $localCommit = git rev-parse HEAD
                $remoteCommit = git rev-parse origin/main
                $behind = git rev-list HEAD..origin/main --count

                if ($CheckOnly) {
                    return @{
                        Available = $behind -gt 0
                        Behind = [int]$behind
                        CurrentCommit = $localCommit
                    }
                }

                if ($behind -gt 0) {
                    git pull origin main 2>&1 | Out-Null
                    npm install --production 2>&1 | Out-Null
                    return @{
                        Success = $true
                        Updated = $true
                        Message = "Atualizado com sucesso"
                    }
                } else {
                    return @{
                        Success = $true
                        Updated = $false
                        Message = "Já atualizado"
                    }
                }
            }

            $result = Invoke-Command -ComputerName $hostname -ScriptBlock $scriptBlock -ArgumentList $CheckOnly, "C:\fast-drive"

            if ($CheckOnly) {
                if ($result.Available) {
                    Write-Host "Atualização disponível ($($result.Behind) commits)" -ForegroundColor Yellow
                } else {
                    Write-Host "Atualizado" -ForegroundColor Green
                }
            } else {
                if ($result.Updated) {
                    Write-Host "Atualizado" -ForegroundColor Green
                    if ($ForceRestart) {
                        Invoke-Command -ComputerName $hostname -ScriptBlock { nssm restart FastDriveMonitor }
                        Write-Host "  Reiniciando..." -ForegroundColor Yellow
                    }
                } else {
                    Write-Host "Já atualizado" -ForegroundColor Green
                }
            }

            $results += [PSCustomObject]@{
                Host = $hostname
                Status = if ($result.Success -or -not $result.Available) { "OK" } else { "Pendente" }
                Message = $result.Message
            }
        }
    } catch {
        Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
        $results += [PSCustomObject]@{
            Host = $hostname
            Status = "Erro"
            Message = $_.Exception.Message
        }
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Resumo" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
$results | Format-Table -AutoSize

# Exportar para CSV (opcional)
$exportCsv = Read-Host "Exportar resultados para CSV? (S/N)"
if ($exportCsv -eq "S" -or $exportCsv -eq "s") {
    $csvPath = "update-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').csv"
    $results | Export-Csv -Path $csvPath -NoTypeInformation
    Write-Host "Exportado para: $csvPath" -ForegroundColor Green
}
