import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../../test/mocks';
import PeerManager from '../PeerManager';

const mockInvoke = vi.mocked((await import('@tauri-apps/api/core')).invoke);

beforeEach(() => {
  mockInvoke.mockReset();
});

describe('PeerManager', () => {
  it('renders initial empty peers list and interface input', async () => {
    mockInvoke.mockResolvedValue({ ok: true, peers: [], interface: 'wg0' });
    render(<PeerManager />);
    expect(screen.getByText(/Peer Yönetimi/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('wg0')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Aktif peer yok.')).toBeInTheDocument();
    });
  });

  it('renders peer list from invoke', async () => {
    mockInvoke.mockResolvedValue({
      ok: true,
      peers: [{ publicKey: 'pub_key_12345' }, { publicKey: 'pub_key_67890' }],
    });
    render(<PeerManager />);
    await waitFor(() => {
      expect(screen.getByText('pub_key_12345')).toBeInTheDocument();
      expect(screen.getByText('pub_key_67890')).toBeInTheDocument();
    });
  });

  it('adds a new peer', async () => {
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === 'peer_list') return { ok: true, peers: [] };
      if (cmd === 'peer_add') return { ok: true, output: 'ok' };
      return { ok: true };
    });

    render(<PeerManager />);
    const inputs = screen.getAllByPlaceholderText('cihaz-adı');
    fireEvent.change(inputs[0], { target: { value: 'iphone' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ekle' }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('peer_add', { name: 'iphone' });
      expect(screen.getByText('"iphone" eklendi.')).toBeInTheDocument();
    });
  });

  it('removes a peer after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === 'peer_list') return { ok: true, peers: [] };
      if (cmd === 'peer_remove') return { ok: true, output: 'ok' };
      return { ok: true };
    });

    render(<PeerManager />);
    const inputs = screen.getAllByPlaceholderText('cihaz-adı');
    fireEvent.change(inputs[1], { target: { value: 'laptop' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kaldır' }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('peer_remove', { name: 'laptop' });
      expect(screen.getByText('"laptop" kaldırıldı.')).toBeInTheDocument();
    });
  });
});
