import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../../test/mocks';
import ConnectionPanel from '../ConnectionPanel';

const mockInvoke = vi.mocked((await import('@tauri-apps/api/core')).invoke);

beforeEach(() => {
  mockInvoke.mockReset();
});

describe('ConnectionPanel', () => {
  it('renders config path and interface inputs', () => {
    render(<ConnectionPanel onStatusChange={vi.fn()} />);
    expect(screen.getByDisplayValue('/etc/wireguard/wg0.conf')).toBeInTheDocument();
    expect(screen.getByDisplayValue('wg0')).toBeInTheDocument();
  });

  it('shows connect and disconnect buttons', () => {
    render(<ConnectionPanel onStatusChange={vi.fn()} />);
    expect(screen.getByText('Bağlan')).toBeInTheDocument();
    expect(screen.getByText('Bağlantıyı Kes')).toBeInTheDocument();
  });

  it('calls vpnConnect on connect click', async () => {
    mockInvoke.mockResolvedValue({ ok: true });
    const onStatusChange = vi.fn();
    render(<ConnectionPanel onStatusChange={onStatusChange} />);
    fireEvent.click(screen.getByText('Bağlan'));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('vpn_connect', {
        configPath: '/etc/wireguard/wg0.conf',
      });
    });
    await waitFor(() => {
      expect(screen.getByText('VPN bağlantısı kuruldu.')).toBeInTheDocument();
    });
  });
});
