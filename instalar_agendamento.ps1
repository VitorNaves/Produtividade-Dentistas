$ErrorActionPreference = "Stop"

# Requires Admin privileges to create tasks
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "AVISO: Este script precisa ser executado como Administrador para criar a tarefa agendada." -ForegroundColor Yellow
    Write-Host "Tentando elevar privilégios..."
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$taskName = "AtualizadorDiarioMetasFenelon"
$scriptPath = Join-Path $PSScriptRoot "atualizar_dados.ps1"

Write-Host "Configurando agendamento automático do Atualizador do Site: Metas Fenelon..." -ForegroundColor Cyan
Write-Host "Caminho do Script alvo: $scriptPath"

# Check if task already exists and remove it
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Tarefa antiga encontrada. Removendo..."
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Create new scheduled task
# Runs daily at 12:00 PM (noon)
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At 12:00PM
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Updates data.js from Laudos_Diario Excel file automatically." | Out-Null

Write-Host "==========================================" -ForegroundColor Green
Write-Host "Sucesso!" -ForegroundColor Green
Write-Host "A extração automática na planilha do Excel rodará escondida todos os dias."
Write-Host "==========================================" -ForegroundColor Green
Write-Host "Pressione qualquer tecla para sair..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
