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
    expect(screen.getByText(/Key Management/)).toBeInTheDocument();
    expect(screen.getByText('Generate New Key Pair')).toBeInTheDocument();
  });

  it('generates keypair and copies public key', async () => {
    mockInvoke.mockResolvedValue({
      ok: true,
      publicKey: 'test_generated_public_key==',
      privateKey: 'secret_priv',
      presharedKey: 'psk_123',
    });

    render(<KeygenPanel />);
    fireEvent.click(screen.getByText('Generate New Key Pair'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('keygen', undefined);
      expect(screen.getByText('test_generated_public_key==')).toBeInTheDocument();
    });

    const copyButtons = screen.getAllByText('Copy');
    fireEvent.click(copyButtons[0]);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test_generated_public_key==');
    expect(screen.getByText('Public key copied to clipboard.')).toBeInTheDocument();
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
    const privInput = screen.getByPlaceholderText('X25519 private key (base64)');
    fireEvent.change(privInput, { target: { value: 'private_key_xyz' } });

    fireEvent.click(screen.getByText('Derive'));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('public_from_private', {
        privateKey: 'private_key_xyz',
      });
      expect(screen.getByText('derived_public_key==')).toBeInTheDocument();
      expect(screen.getByText('Public key derived successfully.')).toBeInTheDocument();
    });

    const validateButtons = screen.getAllByRole('button', { name: 'Validate' });
    fireEvent.click(validateButtons[0]);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('validate_private_key', {
        privateKey: 'private_key_xyz',
      });
      expect(screen.getByText('Private key is valid (32-byte Curve25519).')).toBeInTheDocument();
    });
  });

  it('validates public key', async () => {
    mockInvoke.mockResolvedValue({ ok: true, valid: true });

    render(<KeygenPanel />);
    const pubInput = screen.getByPlaceholderText('X25519 public key (base64)');
    fireEvent.change(pubInput, { target: { value: 'public_key_abc' } });

    const validateButtons = screen.getAllByRole('button', { name: 'Validate' });
    fireEvent.click(validateButtons[1]); // second validate button is for public key

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('validate_public_key', {
        publicKey: 'public_key_abc',
      });
      expect(screen.getByText('Public key is valid (32-byte Curve25519).')).toBeInTheDocument();
    });
  });
});
