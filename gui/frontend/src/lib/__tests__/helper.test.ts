import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../../test/mocks';
import {
  helperStart,
  helperStop,
  helperStatus,
  vpnConnect,
  vpnDisconnect,
  vpnStatus,
  peerList,
  peerAdd,
  peerRemove,
  keygen,
  publicFromPrivateKey,
  generateConfig,
  saveConfig,
} from '../helper';

const mockInvoke = vi.mocked((await import('@tauri-apps/api/core')).invoke);

beforeEach(() => {
  mockInvoke.mockReset();
});

describe('helper', () => {
  it('helperStart calls correct command', async () => {
    mockInvoke.mockResolvedValue('Helper servisi başlatıldı');
    const result = await helperStart();
    expect(mockInvoke).toHaveBeenCalledWith('helper_start', undefined);
    expect(result).toBe('Helper servisi başlatıldı');
  });

  it('helperStop calls correct command', async () => {
    mockInvoke.mockResolvedValue('Helper servisi durduruldu');
    await helperStop();
    expect(mockInvoke).toHaveBeenCalledWith('helper_stop', undefined);
  });

  it('helperStatus returns typed result', async () => {
    mockInvoke.mockResolvedValue({
      running: true,
      socketExists: true,
      socketPath: '/tmp/test.sock',
      systemctlStatus: 'active',
    });
    const result = await helperStatus();
    expect(result.running).toBe(true);
    expect(result.systemctlStatus).toBe('active');
  });

  it('vpnConnect passes configPath', async () => {
    mockInvoke.mockResolvedValue({ ok: true });
    await vpnConnect('/etc/wireguard/wg0.conf');
    expect(mockInvoke).toHaveBeenCalledWith('vpn_connect', {
      configPath: '/etc/wireguard/wg0.conf',
    });
  });

  it('vpnDisconnect passes iface', async () => {
    mockInvoke.mockResolvedValue({ ok: true });
    await vpnDisconnect('wg0');
    expect(mockInvoke).toHaveBeenCalledWith('vpn_down', { iface: 'wg0' });
  });

  it('vpnStatus returns typed result', async () => {
    mockInvoke.mockResolvedValue({
      ok: true,
      connected: true,
      output: 'interface: wg0',
    });
    const result = await vpnStatus();
    expect(result.connected).toBe(true);
    expect(result.output).toBe('interface: wg0');
  });

  it('peerList returns peers array', async () => {
    mockInvoke.mockResolvedValue({
      ok: true,
      peers: [{ publicKey: 'abc123' }],
    });
    const result = await peerList();
    expect(result.peers).toHaveLength(1);
    expect(result.peers[0].publicKey).toBe('abc123');
  });

  it('peerAdd passes name', async () => {
    mockInvoke.mockResolvedValue({ ok: true });
    await peerAdd('telefonum');
    expect(mockInvoke).toHaveBeenCalledWith('peer_add', { name: 'telefonum' });
  });

  it('peerRemove passes name', async () => {
    mockInvoke.mockResolvedValue({ ok: true });
    await peerRemove('eski-cihaz');
    expect(mockInvoke).toHaveBeenCalledWith('peer_remove', {
      name: 'eski-cihaz',
    });
  });

  it('keygen returns key pair (public key only)', async () => {
    // SECURITY: keygen now returns only the public key, not the private key
    mockInvoke.mockResolvedValue({
      ok: true,
      publicKey: 'pub456',
    });
    const result = await keygen();
    expect(result.publicKey).toBe('pub456');
  });

  it('publicFromPrivateKey passes key', async () => {
    mockInvoke.mockResolvedValue({ ok: true, publicKey: 'derived' });
    const result = await publicFromPrivateKey('mykey');
    expect(result.publicKey).toBe('derived');
    expect(mockInvoke).toHaveBeenCalledWith('public_from_private', {
      privateKey: 'mykey',
    });
  });

  it('generateConfig passes all params', async () => {
    mockInvoke.mockResolvedValue({ ok: true, config: '[Interface]\n...' });
    const result = await generateConfig(
      'priv',
      'pub',
      '1.2.3.4',
      '10.0.0.2/32',
      '10.0.0.1',
      1420,
      51820,
    );
    expect(result.config).toContain('[Interface]');
    expect(mockInvoke).toHaveBeenCalledWith('generate_config', {
      clientPrivate: 'priv',
      serverPublic: 'pub',
      serverIp: '1.2.3.4',
      clientIp: '10.0.0.2/32',
      dns: '10.0.0.1',
      mtu: 1420,
      port: 51820,
    });
  });

  it('saveConfig passes content and path', async () => {
    mockInvoke.mockResolvedValue({ ok: true, path: '/tmp/test.conf' });
    const result = await saveConfig('[Interface]\n...', '/tmp/test.conf');
    expect(result.path).toBe('/tmp/test.conf');
  });

  it('throws on invoke error', async () => {
    mockInvoke.mockRejectedValue('bağlantı hatası');
    await expect(helperStart()).rejects.toThrow('bağlantı hatası');
  });
});
