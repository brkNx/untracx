import { useState, useEffect, useCallback } from 'react';
import { helperStatus, vpnStatus } from './lib/helper';
import ErrorBoundary from './components/ErrorBoundary';
import StatusIndicator from './components/ui/StatusIndicator';
import StatusPanel from './components/StatusPanel';
import ConnectionPanel from './components/ConnectionPanel';
import PeerManager from './components/PeerManager';
import KeygenPanel from './components/KeygenPanel';
import ConfigGenPanel from './components/ConfigGenPanel';
import SettingsPanel from './components/SettingsPanel';

type Tab = 'status' | 'connection' | 'management' | 'keys' | 'settings';

const TABS: { key: Tab; label: string }[] = [
  { key: 'status', label: 'Durum' },
  { key: 'connection', label: 'Bağlantı' },
  { key: 'management', label: 'Yönetim' },
  { key: 'keys', label: 'Anahtarlar' },
  { key: 'settings', label: 'Ayarlar' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('status');
  const [helperRunning, setHelperRunning] = useState<boolean | null>(null);
  const [vpnConnected, setVpnConnected] = useState<boolean | null>(null);

  const refreshHelper = useCallback(async () => {
    try {
      const result = await helperStatus();
      setHelperRunning(result.running);
    } catch {
      setHelperRunning(false);
    }
  }, []);

  const refreshVpn = useCallback(async () => {
    try {
      const result = await vpnStatus();
      setVpnConnected(result.connected);
    } catch {
      setVpnConnected(null);
    }
  }, []);

  useEffect(() => {
    refreshHelper();
    refreshVpn();
  }, [refreshHelper, refreshVpn]);

  const refreshAll = useCallback(() => {
    refreshHelper();
    refreshVpn();
  }, [refreshHelper, refreshVpn]);

  return (
    <ErrorBoundary>
      <div className="app">
        <header className="app__header">
          <h1>untracx</h1>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <StatusIndicator label="Helper" connected={helperRunning} />
            <StatusIndicator label="VPN" connected={vpnConnected} />
          </div>
        </header>

        <nav className="app__nav">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={activeTab === tab.key ? 'app__nav button--active' : ''}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <main className="app__main">
          {activeTab === 'status' && <StatusPanel />}
          {activeTab === 'connection' && <ConnectionPanel onStatusChange={refreshAll} />}
          {activeTab === 'management' && <PeerManager />}
          {activeTab === 'keys' && (
            <div>
              <KeygenPanel />
              <ConfigGenPanel />
            </div>
          )}
          {activeTab === 'settings' && <SettingsPanel />}
        </main>
      </div>
    </ErrorBoundary>
  );
}
