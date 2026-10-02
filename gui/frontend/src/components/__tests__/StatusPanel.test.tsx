import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '../../test/mocks';
import StatusPanel from '../StatusPanel';

const mockInvoke = vi.mocked((await import('@tauri-apps/api/core')).invoke);

beforeEach(() => {
  mockInvoke.mockReset();
});

describe('StatusPanel', () => {
  it('renders with loading state then shows status', async () => {
    mockInvoke.mockResolvedValue({
      ok: true,
      connected: true,
      output: 'interface: wg0',
    });
    render(<StatusPanel />);
    await waitFor(() => {
      expect(screen.getByText('interface: wg0')).toBeInTheDocument();
    });
  });

  it('shows error message on failure', async () => {
    mockInvoke.mockRejectedValue('Connection error');
    render(<StatusPanel />);
    await waitFor(() => {
      expect(screen.getByText('Could not retrieve status')).toBeInTheDocument();
    });
  });

  it('has auto-refresh checkbox', async () => {
    mockInvoke.mockResolvedValue({ ok: true, connected: false });
    render(<StatusPanel />);
    await waitFor(() => {
      expect(screen.getByText('Auto-refresh')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });
  });
});
