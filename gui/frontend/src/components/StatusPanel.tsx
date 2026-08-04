import React, { useState } from 'react';

interface Props {
  onRefresh: () => Promise<void>;
}

export default function StatusPanel({ onRefresh }: Props) {
  const [wgShow, setWgShow] = useState<string | null>(null);

  const refresh = async () => {
    try {
      await onRefresh();
      const result = await (await import('../lib/helper')).vpnStatus();
      setWgShow(JSON.stringify(result, null, 2));
    } catch (e: any) {
      setWgShow(`Hata: ${e}`);
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <h2>WireGuard Durumu</h2>
      <button onClick={refresh}>Yenile</button>
      {wgShow && (
        <pre style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f5f5f5', borderRadius: '4px', whiteSpace: 'pre-wrap', fontSize: '0.85em' }}>
          {wgShow}
        </pre>
      )}
    </div>
  );
}