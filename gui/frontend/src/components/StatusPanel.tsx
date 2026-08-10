import { useState, useEffect, useCallback } from 'react';
import { vpnStatus } from '../lib/helper';
import type { VpnStatus } from '../lib/types';
import Spinner from './ui/Spinner';

export default function StatusPanel() {
  const [status, setStatus] = useState<VpnStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await vpnStatus();
      setStatus(result);
    } catch {
      setStatus({ ok: false, connected: false, error: 'Durum alınamadı' });
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

  return (
    <div className="card">
      <div className="card__header">
        <span className="card__title">WireGuard Durumu</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading && <Spinner />}
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ marginRight: 4 }}
            />
            Otomatik yenile
          </label>
          <button className="btn btn--secondary btn--sm" onClick={refresh} disabled={loading}>
            Yenile
          </button>
        </div>
      </div>

      {status?.output && <div className="pre-block">{status.output}</div>}

      {status?.error && <div className="message message--error">{status.error}</div>}

      {!status && !loading && <div className="empty">Henüz durum alınmadı.</div>}
    </div>
  );
}
