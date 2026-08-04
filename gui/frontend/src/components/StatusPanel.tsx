import React, { useState, useEffect } from 'react';
import { vpnStatus } from '../lib/helper';

export default function StatusPanel() {
  const [wgShow, setWgShow] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const result = await vpnStatus();
      setWgShow(JSON.stringify(result, null, 2));
    } catch (e: any) {
      setWgShow(`Hata: ${e}`);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div style={{ marginTop: '1rem' }}>
      <h2>WireGuard Durumu</h2>
      <button onClick={refresh}>Yenile</button>
      {wgShow && (
        <pre style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f5f5f5', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>
          {wgShow}
        </pre>
      )}
    </div>
  );
}