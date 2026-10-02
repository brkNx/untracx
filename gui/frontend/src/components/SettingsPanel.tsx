import { useState, useEffect } from 'react';
import Message from './ui/Message';

interface Settings {
  configPath: string;
  interfaceName: string;
  serverIp: string;
  serverPort: number;
}

const DEFAULTS: Settings = {
  configPath: '/etc/wireguard/wg0.conf',
  interfaceName: 'wg0',
  serverIp: '',
  serverPort: 51820,
};

export default function SettingsPanel() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = await Store.load('settings.json');
      const configPath = await store.get<string>('configPath');
      const interfaceName = await store.get<string>('interfaceName');
      const serverIp = await store.get<string>('serverIp');
      const serverPort = await store.get<number>('serverPort');
      setSettings({
        configPath: configPath ?? DEFAULTS.configPath,
        interfaceName: interfaceName ?? DEFAULTS.interfaceName,
        serverIp: serverIp ?? DEFAULTS.serverIp,
        serverPort: serverPort ?? DEFAULTS.serverPort,
      });
    } catch {
      // Fall back to default parameters if store plugin is unavailable
    }
  };

  const handleSave = async () => {
    try {
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = await Store.load('settings.json');
      await store.set('configPath', settings.configPath);
      await store.set('interfaceName', settings.interfaceName);
      await store.set('serverIp', settings.serverIp);
      await store.set('serverPort', settings.serverPort);
      await store.save();
      setSaved(true);
      setMessage({ type: 'success', text: 'Settings saved successfully.' });
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings (store plugin unavailable).' });
    }
  };

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  return (
    <div className="card">
      <div className="card__header">
        <div>
          <span className="card__title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Preferences &amp; Defaults
          </span>
          <div className="card__subtitle">
            Configure default interface names, configuration file locations, and connection fallback endpoints.
          </div>
        </div>
      </div>

      {message && <Message type={message.type} text={message.text} />}

      <div className="grid-2">
        <div className="input-group">
          <label>Default Configuration Path</label>
          <input
            className="input input--mono"
            type="text"
            value={settings.configPath}
            onChange={(e) => update('configPath', e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>Default Interface Name</label>
          <input
            className="input input--mono"
            type="text"
            value={settings.interfaceName}
            onChange={(e) => update('interfaceName', e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>Default Server IP / Hostname</label>
          <input
            className="input input--mono"
            type="text"
            placeholder="e.g. 140.238.x.x"
            value={settings.serverIp}
            onChange={(e) => update('serverIp', e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>Default Port (UDP)</label>
          <input
            className="input input--mono"
            type="number"
            min={1}
            max={65535}
            value={settings.serverPort}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!isNaN(v) && v > 0 && v <= 65535) update('serverPort', v);
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <button className="btn btn--primary" onClick={handleSave}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          {saved ? 'Saved ✓' : 'Save Changes'}
        </button>
      </div>

      <div className="info-callout" style={{ marginTop: 20 }}>
        💡 <strong>Quick Tip:</strong> When using Oracle Cloud Infrastructure (OCI) Free Tier, set the default IP to your Oracle Instance Public IP and keep UDP port <code>51820</code> open in your VCN Ingress Rules.
      </div>
    </div>
  );
}
