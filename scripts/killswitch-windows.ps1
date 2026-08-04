<#
.SYNOPSIS
    untracx Windows kill-switch using Windows Filtering Platform (WFP).
.DESCRIPTION
    Blocks all outbound traffic except through the WireGuard tunnel interface.
    Requires administrator privileges.
#>

param(
    [string]$Action = "ac",
    [string]$WgAdapterName = "WireGuard"
)

function Write-Log {
    param([string]$Message)
    Write-Host "[untracx-killswitch] $Message"
}

function Stop-WithError {
    param([string]$Message)
    Write-Host "[untracx-killswitch] HATA: $Message" -ForegroundColor Red
    exit 1
}

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Stop-WithError "Yonetici haklari gerekli: PowerShell'i 'Run as Administrator' ile calistirin."
}

switch ($Action.ToLower()) {
    "ac" {
        Write-Log "Kill-switch aciliyor (WFP)..."

        $wgAdapter = Get-NetAdapter -Name $WgAdapterName -ErrorAction SilentlyContinue
        if (-not $wgAdapter) {
            Stop-WithError "WireGuard adaptoru '$WgAdapterName' bulunamadi. Adaptor adini kontrol edin."
        }

        $wgInterfaceIndex = $wgAdapter.ifIndex

        $existingRule = Get-NetFirewallRule -DisplayName "untracx-killswitch" -ErrorAction SilentlyContinue
        if ($existingRule) {
            Write-Log "Mevcut kill-switch kurali bulundu, once kaldiriliyor..."
            $existingRule | Remove-NetFirewallRule
        }

        New-NetFirewallRule `
            -DisplayName "untracx-killswitch" `
            -Direction Outbound `
            -Action Block `
            -InterfaceIndex $wgInterfaceIndex `
            -Description "untracx VPN kill-switch: tum dis trafik WG tuneli uzerinden gitsin"

        New-NetFirewallRule `
            -DisplayName "untracx-killswitch-allow-wg" `
            -Direction Outbound `
            -Action Allow `
            -InterfaceIndex $wgInterfaceIndex `
            -Description "untracx: WireGuard tunnel trafikine izin ver"

        Write-Log "Kill-switch aktif: Dis trafik WG adaptoru (index $wgInterfaceIndex) uzerinden gidecek."
    }

    "kapat" {
        Write-Log "Kill-switch kapatiliyor..."
        Get-NetFirewallRule -DisplayName "untracx-killswitch*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
        Write-Log "Kill-switch kuralari kaldirildi."
    }

    "durum" {
        $rules = Get-NetFirewallRule -DisplayName "untracx-killswitch*" -ErrorAction SilentlyContinue
        if ($rules) {
            Write-Log "Kill-switch ACIK:"
            $rules | Format-Table DisplayName, Action, Direction, InterfaceIndex
        } else {
            Write-Log "Kill-switch KAPALI"
        }
    }

    default {
        Write-Host "Kullanim: .\killswitch-windows.ps1 {ac|kapat|durum} [-WgAdapterName WireGuard]"
        exit 1
    }
}