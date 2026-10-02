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

interface TabItem {
  key: Tab;
  label: string;
  icon: JSX.Element;
}

const TABS: TabItem[] = [
  {
    key: 'status',
    label: 'Status',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    key: 'connection',
    label: 'Connection',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    key: 'management',
    label: 'Peers',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    key: 'keys',
    label: 'Keys',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
      </svg>
    ),
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
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
          <div className="brand">
            <div className="brand__logo">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div className="brand__title">
              untracx
              <span className="brand__badge">v0.1.0</span>
            </div>
          </div>
          <div className="header__indicators">
            <StatusIndicator label="Helper" connected={helperRunning} />
            <StatusIndicator label="VPN" connected={vpnConnected} />
          </div>
        </header>

        <div className="nav-container">
          <div className="app__nav" role="tablist" aria-label="Main Navigation" onKeyDown={handleKeyDown}>
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
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
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
