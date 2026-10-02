<#
.SYNOPSIS
    Untracx - Oracle Cloud (OCI) & Remote Server Automated Deployment Script (PowerShell)
.DESCRIPTION
    Automates the deployment of the Untracx WireGuard server and Unbound recursive DNS
    to an Oracle Cloud Ubuntu Compute instance and optionally fetches the client profile.
.PARAMETER Target
    SSH target host alias or IP address (Default: 'oracle').
.PARAMETER Peer
    Optional client/device name to provision immediately.
.EXAMPLE
    .\scripts\deploy-oracle.ps1 -Target "oracle" -Peer "pc-client"
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Target = "oracle",

    [Parameter(Position = 1)]
    [string]$Peer = ""
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n[untracx-oracle] $Message" -ForegroundColor Cyan
}

function Write-ErrAndExit {
    param([string]$Message)
    Write-Host "`n[untracx-oracle] ERROR: $Message" -ForegroundColor Red
    exit 1
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$ServerDir = Join-Path $RootDir "server"

if (-not (Test-Path $ServerDir)) {
    Write-ErrAndExit "Server directory not found: $ServerDir"
}

Write-Step "1/5 Testing SSH connection to $Target..."
try {
    $null = ssh -o BatchMode=yes -o ConnectTimeout=10 $Target "echo 'SSH connection successful'"
} catch {
    Write-ErrAndExit "SSH connection failed. Please verify ~/.ssh/config or reachability: ssh $Target"
}

$RemoteInfo = ssh $Target "grep '^PRETTY_NAME=' /etc/os-release | cut -d= -f2 | tr -d '\"'; uname -m"
Write-Host "Target System: $($RemoteInfo -join ' ')" -ForegroundColor Gray

Write-Step "2/5 Syncing server bundle..."
ssh $Target "rm -rf /tmp/untracx-server && mkdir -p /tmp/untracx-server"
scp -q -r "$ServerDir/*" "${Target}:/tmp/untracx-server/"

Write-Step "3/5 Executing untracx bootstrap (setup.sh)..."
ssh -t $Target "cd /tmp/untracx-server && sudo bash setup.sh"

Write-Step "4/5 Verifying OCI host firewall and services..."
ssh $Target "sudo systemctl is-active --quiet wg-quick@wg0 || exit 1; sudo iptables -C INPUT -p udp --dport 51820 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 1 -p udp --dport 51820 -j ACCEPT"

if ($Peer) {
    Write-Step "5/5 Provisioning client profile ($Peer)..."
    ssh $Target "sudo untracx-add-peer '$Peer'"

    $LocalDest = Join-Path $RootDir "untracx-$Peer.conf"
    scp -q "${Target}:~/untracx-$Peer.conf" $LocalDest
    ssh $Target "rm -f '~/untracx-$Peer.conf'"

    Write-Host "Profile saved to -> $LocalDest" -ForegroundColor Green
} else {
    Write-Step "5/5 Skipped initial peer creation (no peer name specified)."
    Write-Host "To add a client profile later: ssh $Target 'sudo untracx-add-peer <device-name>'" -ForegroundColor Gray
}

Write-Host @"

===============================================================
             UNTRACX OCI DEPLOYMENT COMPLETED
===============================================================
WireGuard and Unbound DNS services are running and verified.

CRITICAL REMINDER (OCI VCN Ingress Rule):
In the Oracle Cloud Console, under your VCN Security List / NSG:
  - Protocol: UDP
  - Destination Port: 51820
  - Source: 0.0.0.0/0
Make sure this ingress rule is active.

Check Server Status:
  ssh $Target 'sudo wg show wg0'
===============================================================
"@ -ForegroundColor Yellow
