<#
.SYNOPSIS
    Untracx - Oracle Cloud (OCI) & Uzak Sunucu Otomatik Dagitim Scripti (PowerShell)
.DESCRIPTION
    Oracle Cloud uzerindeki Ubuntu sunucunuza Untracx WireGuard ve Unbound DNS sunucusunu
    otomatik olarak yukler, servisleri baslatir ve opsiyonel olarak ilk cihaz profilini uretir.
.PARAMETER Target
    SSH hedef host adi veya IP adresi (Varsayilan: 'oracle').
.PARAMETER Peer
    Kurulum sonrasi otomatik olusturulacak cihaz/istemci adi (Opsiyonel).
.EXAMPLE
    .\scripts\deploy-oracle.ps1 -Target "oracle" -Peer "pc-brk"
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
    Write-Host "`n[untracx-oracle] HATA: $Message" -ForegroundColor Red
    exit 1
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$ServerDir = Join-Path $RootDir "server"

if (-not (Test-Path $ServerDir)) {
    Write-ErrAndExit "Server dizini bulunamadi: $ServerDir"
}

Write-Step "1/5 SSH baglantisi test ediliyor ($Target)..."
try {
    $null = ssh -o BatchMode=yes -o ConnectTimeout=10 $Target "echo 'SSH baglantisi basarili'"
} catch {
    Write-ErrAndExit "SSH baglantisi kurulamadi. Lutfen ~/.ssh/config veya erisimi kontrol edin: ssh $Target"
}

$RemoteInfo = ssh $Target "grep '^PRETTY_NAME=' /etc/os-release | cut -d= -f2 | tr -d '\"'; uname -m"
Write-Host "Hedef Sistem: $($RemoteInfo -join ' ')" -ForegroundColor Gray

Write-Step "2/5 Sunucu bilesenleri aktariliyor..."
ssh $Target "rm -rf /tmp/untracx-server && mkdir -p /tmp/untracx-server"
scp -q -r "$ServerDir/*" "${Target}:/tmp/untracx-server/"

Write-Step "3/5 Untracx bootstrap (setup.sh) calistiriliyor..."
ssh -t $Target "cd /tmp/untracx-server && sudo bash setup.sh"

Write-Step "4/5 OCI iptables ve servis durumlari dogrulaniyor..."
ssh $Target "sudo systemctl is-active --quiet wg-quick@wg0 || exit 1; sudo iptables -C INPUT -p udp --dport 51820 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 1 -p udp --dport 51820 -j ACCEPT"

if ($Peer) {
    Write-Step "5/5 Cihaz profili olusturuluyor ($Peer)..."
    ssh $Target "sudo untracx-add-peer '$Peer'"

    $LocalDest = Join-Path $RootDir "untracx-$Peer.conf"
    scp -q "${Target}:~/untracx-$Peer.conf" $LocalDest
    ssh $Target "rm -f '~/untracx-$Peer.conf'"

    Write-Host "Profil basariyla indirildi -> $LocalDest" -ForegroundColor Green
} else {
    Write-Step "5/5 Ilk peer olusturma adimi atlandi (peer parametresi verilmedi)."
    Write-Host "Yeni bir cihaz eklemek icin: ssh $Target 'sudo untracx-add-peer <cihaz-adi>'" -ForegroundColor Gray
}

Write-Host @"

===============================================================
           UNTRACX ORACLE CLOUD KURULUMU TAMAMLANDI
===============================================================
Sunucu WireGuard ve Unbound DNS servisleri hazir ve calisiyor.

ONEMLI HATIRLATMA (OCI VCN Ingress Kurali):
Oracle Cloud Web Konsolu'nda VCN Security List veya NSG uzerinde:
  - Protokol: UDP
  - Hedef Port: 51820
  - Kaynak: 0.0.0.0/0
kuralinin acik oldugundan emin olun.

Sunucu Durumu:
  ssh $Target 'sudo wg show wg0'
===============================================================
"@ -ForegroundColor Yellow
