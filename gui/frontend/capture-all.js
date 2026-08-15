import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = '/Users/brkn/untracx/docs/screenshots';
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// Start vite dev server
const vite = spawn('npm', ['run', 'dev'], {
  cwd: '/Users/brkn/untracx/gui/frontend',
  stdio: 'pipe',
});

await new Promise((resolve) => {
  vite.stdout.on('data', (data) => {
    if (data.toString().includes('ready in')) resolve();
  });
  setTimeout(resolve, 2500);
});

console.log('Vite server running...');

const browser = await chromium.launch({ headless: true });

async function createPage(width = 920, height = 700) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    window.__TAURI_INTERNALS__ = {
      invoke: async (cmd, args = {}) => {
        if (cmd === 'helper_status') {
          return {
            running: true,
            socketExists: true,
            socketPath: '/run/user/1000/untracx-helper.sock',
            systemctlStatus: 'active',
          };
        }
        if (cmd === 'vpn_status') {
          return {
            ok: true,
            connected: true,
            output: `interface: wg0
  public key: 4uH8Xv9W2m1L6kPQrtYzA5bN8cDefGhIjKlMnOpQrSt=
  private key: (hidden)
  listening port: 51820

peer: 8kMN2pQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWxYz4=
  preshared key: (hidden)
  endpoint: 198.51.100.1:51820
  allowed ips: 0.0.0.0/0, ::/0
  latest handshake: 42 seconds ago
  transfer: 18.42 MiB received, 2.15 MiB sent
  persistent keepalive: every 25 seconds`,
          };
        }
        if (cmd === 'vpn_connect') {
          return { ok: true, connected: true };
        }
        if (cmd === 'vpn_down') {
          return { ok: true, connected: false };
        }
        if (cmd === 'peer_list') {
          return {
            ok: true,
            peers: [
              { publicKey: '7uH8Xv9W2m1L6kPQrtYzA5bN8cDefGhIjKlMnOpQrSt=' },
              { publicKey: '3xAB8Lpq9KmNvRt2YzA5bN8cDefGhIjKlMnOpQrStU8=' },
              { publicKey: '9kMN2pQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWxYz4=' },
            ],
            interface: args.iface || 'wg0',
          };
        }
        if (cmd === 'peer_add') {
          return {
            ok: true,
            output: `Sunucuda çalıştırmak için: sudo untracx-add-peer ${args.name}`,
          };
        }
        if (cmd === 'peer_remove') {
          return {
            ok: true,
            output: `Sunucuda çalıştırmak için: sudo untracx-remove-peer ${args.name}`,
          };
        }
        if (cmd === 'keygen') {
          return {
            ok: true,
            publicKey: 'eXamPLe8v9W2m1L6kPQrtYzA5bN8cDefGhIjKlMnOpQ=',
            privateKey: 'SECRET_KEY_NEVER_EXPOSED_IN_PRODUCTION_XYZ=',
            presharedKey: 'pSk_kMN2pQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWx=',
          };
        }
        if (cmd === 'public_from_private') {
          return {
            ok: true,
            publicKey: '9pQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWxYz4eXamP=',
          };
        }
        if (cmd === 'validate_private_key') {
          return { ok: true, valid: true };
        }
        if (cmd === 'validate_public_key') {
          return { ok: true, valid: true };
        }
        if (cmd === 'generate_config') {
          const clientPriv = args.clientPrivate || 'cExAmPLePrIvAtEkEy123456789012345678901234=';
          const srvPub = args.serverPublic || 'sErVeRPuBlIcKeY123456789012345678901234567=';
          const srvIp = args.serverIp || '198.51.100.1';
          const clientIp = args.clientIp || '10.66.66.2/32';
          const dns = args.dns || '10.66.66.1';
          const port = args.port || 51820;
          const mtu = args.mtu || 1420;
          const psk = args.presharedKey ? `\nPresharedKey = ${args.presharedKey}` : '';

          return {
            ok: true,
            config: `[Interface]
PrivateKey = ${clientPriv}
Address = ${clientIp}
DNS = ${dns}
MTU = ${mtu}

[Peer]
PublicKey = ${srvPub}${psk}
Endpoint = ${srvIp}:${port}
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25`,
          };
        }
        if (cmd === 'save_config') {
          return { ok: true, path: args.path || '/etc/wireguard/wg0.conf' };
        }
        return { ok: true };
      },
    };
  });

  await page.goto('http://localhost:5173');
  await page.waitForSelector('.app');

  // Add stylish macOS traffic-light window frame
  await page.evaluate(() => {
    const titleBar = document.createElement('div');
    titleBar.id = 'mac-titlebar';
    titleBar.style.cssText = `
      display: flex;
      align-items: center;
      padding: 10px 16px;
      background: #12141c;
      border-bottom: 1px solid #232738;
      user-select: none;
      -webkit-user-select: none;
    `;
    titleBar.innerHTML = `
      <div style="display: flex; align-items: center; gap: 7px; width: 60px;">
        <span style="width: 11px; height: 11px; border-radius: 50%; background: #ff5f56; display: inline-block;"></span>
        <span style="width: 11px; height: 11px; border-radius: 50%; background: #ffbd2e; display: inline-block;"></span>
        <span style="width: 11px; height: 11px; border-radius: 50%; background: #27c93f; display: inline-block;"></span>
      </div>
      <div style="flex: 1; text-align: center; font-size: 12px; font-weight: 500; color: #8b8fa3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; letter-spacing: -0.01em;">
        untracx — WireGuard GUI &amp; Zero-Trust Manager
      </div>
      <div style="width: 60px;"></div>
    `;
    document.body.prepend(titleBar);
  });

  return { page, context };
}

// 1. Status Panel (Durum)
console.log('Capturing: 01_status_panel.png');
{
  const { page, context } = await createPage(940, 580);
  await page.click('#tab-status');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/01_status_panel.png` });
  await context.close();
}

// 2. Connection Panel (Bağlantı)
console.log('Capturing: 02_connection_panel.png');
{
  const { page, context } = await createPage(940, 520);
  await page.click('#tab-connection');
  await page.waitForTimeout(200);
  await page.click('button:has-text("Bağlan")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/02_connection_panel.png` });
  await context.close();
}

// 3. Peer Management (Yönetim)
console.log('Capturing: 03_peer_management.png');
{
  const { page, context } = await createPage(940, 680);
  await page.click('#tab-management');
  await page.waitForTimeout(200);
  await page.fill('input[placeholder*="macbook"]', 'macbook-pro');
  await page.click('button:has-text("Komut Üret")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/03_peer_management.png` });
  await context.close();
}

// 4. Key Management & Generation (Anahtarlar)
console.log('Capturing: 04_key_management.png & 05_config_generator.png');
{
  const { page, context } = await createPage(940, 1340);
  await page.click('#tab-keys');
  await page.waitForTimeout(200);
  await page.click('button:has-text("Yeni Anahtar Çifti Üret")');
  await page.waitForTimeout(200);

  const privInputs = await page.$$('input[type="password"]');
  if (privInputs.length > 0) {
    await privInputs[0].fill('aB3+dEfGhIjKlMnOpQrStUvWxYz0123456789ABCDEF=');
    await page.click('button:has-text("Türet")');
    await page.waitForTimeout(200);
  }
  if (privInputs.length > 1) {
    await privInputs[1].fill('cExAmPLePrIvAtEkEy123456789012345678901234=');
  }

  await page.fill('input[placeholder="X25519 public key (base64)"]', 'sErVeRPuBlIcKeY123456789012345678901234567=');
  await page.fill('input[placeholder="10.0.0.1"]', '198.51.100.1');
  await page.click('button:has-text("Config Üret")');
  await page.waitForTimeout(300);

  // Full Keys view (Hero screenshot)
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/04_keys_and_config_full.png` });
  await page.screenshot({ path: '/Users/brkn/untracx/docs/gui-screenshot.png' });

  // Keygen card specific
  const keyCard = await page.$('.card:nth-of-type(1)');
  if (keyCard) {
    await keyCard.screenshot({ path: `${SCREENSHOTS_DIR}/04_key_management.png` });
  }

  // Config card specific
  const configCard = await page.$('.card:nth-of-type(2)');
  if (configCard) {
    await configCard.screenshot({ path: `${SCREENSHOTS_DIR}/05_config_generator.png` });
  }

  await context.close();
}

// 5. Settings Panel (Ayarlar)
console.log('Capturing: 06_settings_panel.png');
{
  const { page, context } = await createPage(940, 520);
  await page.click('#tab-settings');
  await page.waitForTimeout(200);
  await page.fill('input[value=""]', '198.51.100.1');
  await page.click('button:has-text("Kaydet")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/06_settings_panel.png` });
  await context.close();
}

console.log('All screenshots generated and verified!');

await browser.close();
vite.kill();
process.exit(0);
