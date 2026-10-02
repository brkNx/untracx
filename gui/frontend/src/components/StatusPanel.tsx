import { useState, useEffect, useCallback } from 'react';
import { vpnStatus } from '../lib/helper';
import type { VpnStatus } from '../lib/types';
import Spinner from './ui/Spinner';

export default function StatusPanel() {
  const [status, setStatus] = useState<VpnStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await vpnStatus();
      setStatus(result);
    } catch {
      setStatus({ ok: false, connected: false, error: 'Could not retrieve status' });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(refresh, 10000);
    return () => clearInterval(timer);
  }, [autoRefresh, refresh]);

  const copyRaw = () => {
    if (status?.output) {
      navigator.clipboard.writeText(status.output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isConnected = status?.connected === true;

  return (
    <div>
      <div className="card">
        <div className="status-hero">
          <div
            className={`status-beacon ${
              isConnected ? 'status-beacon--connected' : 'status-beacon--disconnected'
            }`}
          >
            {isConnected ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 9.9-1" />
              </svg>
            )}
          </div>
          <div className="status-title">
            {isConnected ? 'WireGuard Tunnel Active' : 'WireGuard Tunnel Inactive'}
          </div>
          <p className="status-desc">
            {isConnected
              ? 'Your network traffic is securely encrypted through the WireGuard tunnel with local Unbound DNS protection.'
              : 'Encrypted tunnel is disconnected. Use the Connection panel or official WireGuard app to start the tunnel.'}
          </p>

          <div className="metric-grid" style={{ width: '100%' }}>
            <div className="metric-chip">
              <span className="metric-label">Status</span>
              <span className="metric-value" style={{ color: isConnected ? 'var(--emerald)' : 'var(--text-muted)' }}>
                {isConnected ? 'Connected' : 'Idle'}
              </span>
            </div>
            <div className="metric-chip">
              <span className="metric-label">Protocol</span>
              <span className="metric-value">WireGuard / Noise IK</span>
            </div>
            <div className="metric-chip">
              <span className="metric-label">DNS Resolver</span>
              <span className="metric-value">10.66.66.1 (Unbound)</span>
            </div>
            <div className="metric-chip">
              <span className="metric-label">Encryption</span>
              <span className="metric-value">ChaCha20-Poly1305</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <div>
            <span className="card__title">WireGuard Status &amp; Diagnostics</span>
            <div className="card__subtitle">Live kernel interface output from wg show</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {loading && <Spinner />}
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh
            </label>
            <button className="btn btn--secondary btn--sm" onClick={refresh} disabled={loading}>
              Refresh
            </button>
            {status?.output && (
              <button className="btn btn--secondary btn--sm" onClick={copyRaw}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            )}
          </div>
        </div>

        {status?.output && <div className="pre-block">{status.output}</div>}

        {status?.error && <div className="message message--error">{status.error}</div>}

        {!status && !loading && (
          <div className="empty-state">No active WireGuard interface state detected.</div>
        )}
      </div>
    </div>
  );
}
