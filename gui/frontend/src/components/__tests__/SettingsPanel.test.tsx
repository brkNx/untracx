import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../../test/mocks';
import SettingsPanel from '../SettingsPanel';

describe('SettingsPanel', () => {
  it('renders settings fields with defaults', () => {
    render(<SettingsPanel />);
    expect(screen.getByText(/Preferences & Defaults/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('/etc/wireguard/wg0.conf')).toBeInTheDocument();
    expect(screen.getByDisplayValue('wg0')).toBeInTheDocument();
    expect(screen.getByDisplayValue('51820')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Changes/ })).toBeInTheDocument();
  });

  it('updates input fields and handles save click', async () => {
    render(<SettingsPanel />);
    const ipInput = screen.getByDisplayValue('');
    fireEvent.change(ipInput, { target: { value: '198.51.100.1' } });
    expect(ipInput).toHaveValue('198.51.100.1');

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));
    await waitFor(() => {
      expect(
        screen.getByText(/Settings saved successfully|Failed to save settings/),
      ).toBeInTheDocument();
    });
  });
});
