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
    expect(screen.getByText(/Sunucu Peer Yönetimi/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('wg0')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByText(/Sunucuda kayıtlı yerel önbellek peer kaydı yok/),
      ).toBeInTheDocument();
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
      if (cmd === 'peer_add')
        return { ok: true, output: 'Sunucuda çalıştırmak için: sudo untracx-add-peer iphone' };
      return { ok: true };
    });

    render(<PeerManager />);
    const input = screen.getByPlaceholderText('cihaz-adı (örn. macbook)');
    fireEvent.change(input, { target: { value: 'iphone' } });
    const buttons = screen.getAllByRole('button', { name: 'Komut Üret' });
    fireEvent.click(buttons[0]);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('peer_add', { name: 'iphone' });
      expect(screen.getByText(/Sunucu komutu hazırlandı: "iphone"/)).toBeInTheDocument();
    });
  });

  it('removes a peer after confirmation', async () => {
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === 'peer_list') return { ok: true, peers: [] };
      if (cmd === 'peer_remove')
        return { ok: true, output: 'Sunucuda çalıştırmak için: sudo untracx-remove-peer laptop' };
      return { ok: true };
    });

    render(<PeerManager />);
    const input = screen.getByPlaceholderText('cihaz-adı (örn. eski-telefon)');
    fireEvent.change(input, { target: { value: 'laptop' } });
    const buttons = screen.getAllByRole('button', { name: 'Komut Üret' });
    fireEvent.click(buttons[1]);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('peer_remove', { name: 'laptop' });
      expect(screen.getByText(/Sunucu kaldırma komutu hazırlandı: "laptop"/)).toBeInTheDocument();
    });
  });
});
