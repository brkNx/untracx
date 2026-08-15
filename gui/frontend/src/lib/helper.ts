import { invoke } from '@tauri-apps/api/core';
import type {
  HelperStatus,
  VpnResult,
  VpnStatus,
  PeerListResult,
  PeerActionResult,
  KeyPair,
  PublicKeyResult,
  ValidateResult,
  ConfigResult,
  SaveConfigResult,
} from './types';

async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const res = await invoke<T>(command, args);
    if (res && typeof res === 'object' && 'ok' in res && (res as { ok: boolean }).ok === false) {
      const errObj = res as { error?: string };
      throw new Error(errObj.error || 'İşlem başarısız oldu');
    }
    return res;
  } catch (error) {
    throw new Error(typeof error === 'string' ? error : (error as Error).message || String(error));
  }
}

export async function helperStart(): Promise<string> {
  return invokeCommand<string>('helper_start');
}

export async function helperStop(): Promise<string> {
  return invokeCommand<string>('helper_stop');
}

export async function helperStatus(): Promise<HelperStatus> {
  return invokeCommand<HelperStatus>('helper_status');
}

export async function vpnConnect(configPath: string): Promise<VpnResult> {
  return invokeCommand<VpnResult>('vpn_connect', { configPath });
}

export async function vpnDisconnect(iface: string): Promise<VpnResult> {
  return invokeCommand<VpnResult>('vpn_down', { iface });
}

export async function vpnStatus(): Promise<VpnStatus> {
  return invokeCommand<VpnStatus>('vpn_status');
}

export async function peerList(interfaceName?: string): Promise<PeerListResult> {
  return invokeCommand<PeerListResult>(
    'peer_list',
    interfaceName ? { iface: interfaceName } : undefined,
  );
}

export async function peerAdd(name: string): Promise<PeerActionResult> {
  return invokeCommand<PeerActionResult>('peer_add', { name });
}

export async function peerRemove(name: string): Promise<PeerActionResult> {
  return invokeCommand<PeerActionResult>('peer_remove', { name });
}

export async function keygen(): Promise<KeyPair> {
  return invokeCommand<KeyPair>('keygen');
}

export async function publicFromPrivateKey(privateKey: string): Promise<PublicKeyResult> {
  return invokeCommand<PublicKeyResult>('public_from_private', { privateKey });
}

export async function validatePrivateKey(key: string): Promise<ValidateResult> {
  return invokeCommand<ValidateResult>('validate_private_key', { privateKey: key });
}

export async function validatePublicKey(key: string): Promise<ValidateResult> {
  return invokeCommand<ValidateResult>('validate_public_key', { publicKey: key });
}

export async function generateConfig(
  clientPrivate: string,
  serverPublic: string,
  serverIp: string,
  clientIp: string,
  dns: string,
  mtu: number,
  port: number,
  presharedKey?: string,
): Promise<ConfigResult> {
  return invokeCommand<ConfigResult>('generate_config', {
    clientPrivate,
    serverPublic,
    serverIp,
    clientIp,
    dns,
    mtu,
    port,
    presharedKey: presharedKey || undefined,
  });
}

export async function saveConfig(content: string, path: string): Promise<SaveConfigResult> {
  return invokeCommand<SaveConfigResult>('save_config', { content, path });
}
