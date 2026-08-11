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
      // Store plugin mevcut değilse varsayılanları kullan
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
      setMessage({ type: 'success', text: 'Ayarlar kaydedildi.' });
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setMessage({ type: 'error', text: 'Ayarlar kaydedilemedi (store plugin gerekli).' });
    }
  };

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  return (
    <div className="card">
      <div className="card__header">
        <span className="card__title">Ayarlar</span>
      </div>

      {message && <Message type={message.type} text={message.text} />}

      <div className="grid-2">
        <div className="input-group">
          <label>Varsayılan config yolu</label>
          <input
            className="input"
            type="text"
            value={settings.configPath}
            onChange={(e) => update('configPath', e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>Varsayılan arayüz</label>
          <input
            className="input"
            type="text"
            value={settings.interfaceName}
            onChange={(e) => update('interfaceName', e.target.value)}
            style={{ maxWidth: 120 }}
          />
        </div>
        <div className="input-group">
          <label>Sunucu IP</label>
          <input
            className="input"
            type="text"
            value={settings.serverIp}
            onChange={(e) => update('serverIp', e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>Sunucu portu</label>
          <input
            className="input"
            type="number"
            min={1}
            max={65535}
            value={settings.serverPort}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!isNaN(v) && v > 0 && v <= 65535) update('serverPort', v);
            }}
            style={{ maxWidth: 120 }}
          />
        </div>
      </div>

      <button className="btn btn--primary" onClick={handleSave} style={{ marginTop: 12 }}>
        {saved ? 'Kaydedildi ✓' : 'Kaydet'}
      </button>
    </div>
  );
}
