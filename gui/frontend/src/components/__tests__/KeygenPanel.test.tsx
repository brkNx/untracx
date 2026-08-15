import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../../test/mocks';
import KeygenPanel from '../KeygenPanel';

const mockInvoke = vi.mocked((await import('@tauri-apps/api/core')).invoke);

beforeEach(() => {
  mockInvoke.mockReset();
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });
});

describe('KeygenPanel', () => {
  it('renders key generation controls', () => {
    render(<KeygenPanel />);
    expect(screen.getByText('Anahtar Yönetimi')).toBeInTheDocument();
    expect(screen.getByText('Yeni Anahtar Çifti Üret')).toBeInTheDocument();
  });

  it('generates keypair and copies public key', async () => {
    mockInvoke.mockResolvedValue({
      ok: true,
      publicKey: 'test_generated_public_key==',
      privateKey: 'secret_priv',
      presharedKey: 'psk_123',
    });

    render(<KeygenPanel />);
    fireEvent.click(screen.getByText('Yeni Anahtar Çifti Üret'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('keygen', undefined);
      expect(screen.getByText('test_generated_public_key==')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Kopyala'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test_generated_public_key==');
    expect(screen.getByText('Panoya kopyalandı.')).toBeInTheDocument();
  });

  it('derives public key from private key and validates private key', async () => {
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === 'public_from_private') {
        return { ok: true, publicKey: 'derived_public_key==' };
      }
      if (cmd === 'validate_private_key') {
        return { ok: true, valid: true };
      }
      return { ok: true };
    });

    render(<KeygenPanel />);
    const privInput = screen.getByPlaceholderText('X25519 özel anahtar (base64)');
    fireEvent.change(privInput, { target: { value: 'private_key_xyz' } });

    fireEvent.click(screen.getByText('Türet'));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('public_from_private', {
        privateKey: 'private_key_xyz',
      });
      expect(screen.getByText('derived_public_key==')).toBeInTheDocument();
      expect(screen.getByText('Genel anahtar türetildi.')).toBeInTheDocument();
    });

    const validateButtons = screen.getAllByRole('button', { name: 'Doğrula' });
    fireEvent.click(validateButtons[0]);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('validate_private_key', {
        privateKey: 'private_key_xyz',
      });
      expect(screen.getByText('Özel anahtar geçerli.')).toBeInTheDocument();
    });
  });

  it('validates public key', async () => {
    mockInvoke.mockResolvedValue({ ok: true, valid: true });

    render(<KeygenPanel />);
    const pubInput = screen.getByPlaceholderText('X25519 genel anahtar (base64)');
    fireEvent.change(pubInput, { target: { value: 'public_key_abc' } });

    const validateButtons = screen.getAllByRole('button', { name: 'Doğrula' });
    fireEvent.click(validateButtons[1]); // second validate button is for public key

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('validate_public_key', {
        publicKey: 'public_key_abc',
      });
      expect(screen.getByText('Genel anahtar geçerli.')).toBeInTheDocument();
    });
  });
});
