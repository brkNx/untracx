<#
.SYNOPSIS
    untracx Windows kill-switch using Windows Filtering Platform (WFP).
.DESCRIPTION
    Blocks all outbound traffic except through the WireGuard tunnel interface.
    Requires administrator privileges.
#>

param(
    [string]$Action = "enable",
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
    Write-Host "[untracx-killswitch] ERROR: $Message" -ForegroundColor Red
    exit 1
}

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Stop-WithError "Administrator privileges required: please launch PowerShell as Administrator."
}

switch ($Action.ToLower()) {
    { $_ -in "enable", "ac" } {
        Write-Log "Enabling kill-switch (WFP / Windows Defender Firewall)..."

        $wgAdapter = Get-NetAdapter -Name $WgAdapterName -ErrorAction SilentlyContinue
        if (-not $wgAdapter) {
            Stop-WithError "WireGuard adapter '$WgAdapterName' not found. Please activate your WireGuard connection first."
        }

        $wgInterfaceIndex = $wgAdapter.ifIndex

        Get-NetFirewallRule -DisplayName "untracx-killswitch*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule

        # 1. Allow WireGuard tunnel interface traffic
        New-NetFirewallRule `
            -DisplayName "untracx-killswitch-allow-tun" `
            -Direction Outbound `
            -Action Allow `
            -InterfaceIndex $wgInterfaceIndex `
            -Description "untracx: Allow WireGuard tunnel interface traffic"

        # 2. Allow Loopback
        New-NetFirewallRule `
            -DisplayName "untracx-killswitch-allow-lo" `
            -Direction Outbound `
            -Action Allow `
            -RemoteAddress "127.0.0.1", "::1" `
            -Description "untracx: Allow Loopback traffic"

        # 3. Allow DHCP
        New-NetFirewallRule `
            -DisplayName "untracx-killswitch-allow-dhcp" `
            -Direction Outbound `
            -Action Allow `
            -Protocol UDP `
            -LocalPort 68 `
            -RemotePort 67 `
            -Description "untracx: Allow DHCP renewal traffic"

        # 4. Allow WireGuard Endpoint UDP handshake if specified
        if ($ServerEndpointIp -ne "") {
            New-NetFirewallRule `
                -DisplayName "untracx-killswitch-allow-endpoint" `
                -Direction Outbound `
                -Action Allow `
                -Protocol UDP `
                -RemoteAddress $ServerEndpointIp `
                -RemotePort $WgPort `
                -Description "untracx: Allow WireGuard handshake endpoint traffic"
        }

        # 5. Block all other outbound traffic on non-tunnel interfaces
        New-NetFirewallRule `
            -DisplayName "untracx-killswitch-block-all" `
            -Direction Outbound `
            -Action Block `
            -Description "untracx: Block all non-tunnel physical outbound traffic"

        Write-Log "Kill-switch ACTIVE: Physical egress blocked (tunnel interface: index $wgInterfaceIndex)."
    }

    { $_ -in "disable", "kapat" } {
        Write-Log "Disabling kill-switch..."
        Get-NetFirewallRule -DisplayName "untracx-killswitch*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
        Write-Log "Kill-switch rules removed."
    }

    { $_ -in "status", "durum" } {
        $rules = Get-NetFirewallRule -DisplayName "untracx-killswitch*" -ErrorAction SilentlyContinue
        if ($rules) {
            Write-Log "Kill-switch ACTIVE:"
            $rules | Format-Table DisplayName, Action, Direction
        } else {
            Write-Log "Kill-switch INACTIVE"
        }
    }

    default {
        Write-Host "Usage: .\killswitch-windows.ps1 {enable|disable|status} [-WgAdapterName WireGuard] [-ServerEndpointIp <ip>]"
        exit 1
    }
}
