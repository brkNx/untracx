<#
.SYNOPSIS
    untracx Windows kill-switch using Windows Filtering Platform (WFP).
.DESCRIPTION
    Blocks all outbound traffic except through the WireGuard tunnel interface.
    Requires administrator privileges.
#>

param(
    [string]$Action = "ac",
    [string]$WgAdapterName = "WireGuard",
    [string]$ServerEndpointIp = "",
    [int]$WgPort = 51820
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
        Write-Log "Kill-switch aciliyor (WFP / Windows Defender Firewall)..."

        $wgAdapter = Get-NetAdapter -Name $WgAdapterName -ErrorAction SilentlyContinue
        if (-not $wgAdapter) {
            Stop-WithError "WireGuard adaptoru '$WgAdapterName' bulunamadi. Once WireGuard baglantisini baslatin."
        }

        $wgInterfaceIndex = $wgAdapter.ifIndex

        Get-NetFirewallRule -DisplayName "untracx-killswitch*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule

        # 1. Allow WireGuard tunnel interface traffic
        New-NetFirewallRule `
            -DisplayName "untracx-killswitch-allow-tun" `
            -Direction Outbound `
            -Action Allow `
            -InterfaceIndex $wgInterfaceIndex `
            -Description "untracx: WireGuard tunel arayuz trafigine izin ver"

        # 2. Allow Loopback
        New-NetFirewallRule `
            -DisplayName "untracx-killswitch-allow-lo" `
            -Direction Outbound `
            -Action Allow `
            -RemoteAddress "127.0.0.1", "::1" `
            -Description "untracx: Loopback trafigine izin ver"

        # 3. Allow DHCP
        New-NetFirewallRule `
            -DisplayName "untracx-killswitch-allow-dhcp" `
            -Direction Outbound `
            -Action Allow `
            -Protocol UDP `
            -LocalPort 68 `
            -RemotePort 67 `
            -Description "untracx: Yerel DHCP yenilemelerine izin ver"

        # 4. Allow WireGuard Endpoint UDP handshake if specified
        if ($ServerEndpointIp -ne "") {
            New-NetFirewallRule `
                -DisplayName "untracx-killswitch-allow-endpoint" `
                -Direction Outbound `
                -Action Allow `
                -Protocol UDP `
                -RemoteAddress $ServerEndpointIp `
                -RemotePort $WgPort `
                -Description "untracx: Sunucu endpoint handshake trafigine izin ver"
        }

        # 5. Block all other outbound traffic on non-tunnel interfaces
        New-NetFirewallRule `
            -DisplayName "untracx-killswitch-block-all" `
            -Direction Outbound `
            -Action Block `
            -Description "untracx: Tum fiziksel arayuz cikis trafigini engelle"

        Write-Log "Kill-switch AKTIF: Tum fiziki cikislar bloke edildi (tunel: index $wgInterfaceIndex)."
    }

    "kapat" {
        Write-Log "Kill-switch kapatiliyor..."
        Get-NetFirewallRule -DisplayName "untracx-killswitch*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
        Write-Log "Kill-switch kurallari kaldirildi."
    }

    "durum" {
        $rules = Get-NetFirewallRule -DisplayName "untracx-killswitch*" -ErrorAction SilentlyContinue
        if ($rules) {
            Write-Log "Kill-switch ACIK:"
            $rules | Format-Table DisplayName, Action, Direction
        } else {
            Write-Log "Kill-switch KAPALI"
        }
    }

    default {
        Write-Host "Kullanim: .\killswitch-windows.ps1 {ac|kapat|durum} [-WgAdapterName WireGuard] [-ServerEndpointIp <ip>]"
        exit 1
    }
}
