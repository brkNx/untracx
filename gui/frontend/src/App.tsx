import { useState, useEffect, useCallback, KeyboardEvent } from 'react';
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

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = TABS.findIndex((t) => t.key === activeTab);
    if (e.key === 'ArrowRight') {
      const nextIndex = (currentIndex + 1) % TABS.length;
      setActiveTab(TABS[nextIndex].key);
    } else if (e.key === 'ArrowLeft') {
      const prevIndex = (currentIndex - 1 + TABS.length) % TABS.length;
      setActiveTab(TABS[prevIndex].key);
    }
  };

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

        <div className="app__nav" role="tablist" aria-label="Ana Menü" onKeyDown={handleKeyDown}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`panel-${tab.key}`}
              tabIndex={activeTab === tab.key ? 0 : -1}
              className={activeTab === tab.key ? 'button--active' : ''}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <main
          className="app__main"
          id={`panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
        >
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
