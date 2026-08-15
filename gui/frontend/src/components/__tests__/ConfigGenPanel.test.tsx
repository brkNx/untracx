import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../../test/mocks';
import ConfigGenPanel from '../ConfigGenPanel';

const mockInvoke = vi.mocked((await import('@tauri-apps/api/core')).invoke);

beforeEach(() => {
  mockInvoke.mockReset();
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });
});

describe('ConfigGenPanel', () => {
  it('renders all config generator input fields', () => {
    render(<ConfigGenPanel />);
    expect(screen.getByText('Config Üretici')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('X25519 private key (base64)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('X25519 public key (base64)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('10.0.0.1')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('10.66.66.2/32')).toBeInTheDocument();
  });

  it('generates config when required inputs are provided', async () => {
    mockInvoke.mockResolvedValue({
      ok: true,
      config:
        '[Interface]\nPrivateKey = privkey\nAddress = 10.66.66.2/32\n\n[Peer]\nPublicKey = pubkey',
    });

    render(<ConfigGenPanel />);
    fireEvent.change(screen.getByPlaceholderText('X25519 private key (base64)'), {
      target: { value: 'client_priv_key' },
    });
    fireEvent.change(screen.getByPlaceholderText('X25519 public key (base64)'), {
      target: { value: 'server_pub_key' },
    });
    fireEvent.change(screen.getByPlaceholderText('10.0.0.1'), {
      target: { value: '1.2.3.4' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Config Üret' }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('generate_config', {
        clientPrivate: 'client_priv_key',
        serverPublic: 'server_pub_key',
        serverIp: '1.2.3.4',
        clientIp: '10.66.66.2/32',
        dns: '10.66.66.1',
        mtu: 1420,
        port: 51820,
        presharedKey: undefined,
      });
      expect(screen.getByText('Config üretildi.')).toBeInTheDocument();
      expect(screen.getByText(/\[Interface\]/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Panoya Kopyala' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
});
