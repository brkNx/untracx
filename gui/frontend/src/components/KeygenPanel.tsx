import { useState } from 'react';
import { keygen, publicFromPrivateKey, validatePrivateKey, validatePublicKey } from '../lib/helper';
import type { KeyPair, PublicKeyResult } from '../lib/types';
import Spinner from './ui/Spinner';
import Message from './ui/Message';

export default function KeygenPanel() {
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [derivedPublic, setDerivedPublic] = useState<PublicKeyResult | null>(null);
  const [privInput, setPrivInput] = useState('');
  const [pubInput, setPubInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setMessage(null);
    try {
      // SECURITY: keygen() now only returns the public key.
      // The private key is NOT returned to the frontend to prevent leakage.
      // Users must generate keys via the CLI for private key access.
      const kp = await keygen();
      setKeyPair(kp);
      setMessage({
        type: 'info',
        text: 'Yeni anahtar çifti üretildi. Özel anahtar CLI ile korunur. Public key panoya kopyalayın.',
      });
    } catch (e) {
      setMessage({ type: 'error', text: `Üretim hatası: ${e}` });
    }
    setLoading(false);
  };

  const handleDerive = async () => {
    if (!privInput.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await publicFromPrivateKey(privInput.trim());
      setDerivedPublic(result);
      setMessage({ type: 'success', text: 'Genel anahtar türetildi.' });
    } catch (e) {
      setMessage({ type: 'error', text: `Türetme hatası: ${e}` });
    }
    setLoading(false);
  };

  const handleValidatePrivate = async () => {
    if (!privInput.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      await validatePrivateKey(privInput.trim());
      setMessage({ type: 'success', text: 'Özel anahtar geçerli.' });
    } catch (e) {
      setMessage({ type: 'error', text: `Geçersiz özel anahtar: ${e}` });
    }
    setLoading(false);
  };

  const handleValidatePublic = async () => {
    if (!pubInput.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      await validatePublicKey(pubInput.trim());
      setMessage({ type: 'success', text: 'Genel anahtar geçerli.' });
    } catch (e) {
      setMessage({ type: 'error', text: `Geçersiz genel anahtar: ${e}` });
    }
    setLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'info', text: 'Panoya kopyalandı.' });
  };

  return (
    <div className="card">
      <div className="card__header">
        <span className="card__title">Anahtar Yönetimi</span>
        {loading && <Spinner />}
      </div>

      {message && <Message type={message.type} text={message.text} />}

      {/* Üret */}
      <div style={{ marginBottom: 16 }}>
        <button className="btn btn--primary" onClick={handleGenerate} disabled={loading}>
          Yeni Anahtar Çifti Üret
        </button>
      </div>

      {keyPair && (
        <div style={{ marginBottom: 16 }}>
          <div className="input-group">
            <label>Genel Anahtar</label>
            <div className="key-display">
              {keyPair.publicKey}
              <button
                className="btn btn--secondary btn--sm key-display__copy"
                onClick={() => copyToClipboard(keyPair.publicKey)}
              >
                Kopyala
              </button>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
            Özel anahtar CLI üzerinden güvenle yönetilir. GUI'de özel anahtar görüntülenmez.
          </p>
        </div>
      )}

      {/* Özel anahtardan türetme */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
        <div className="input-group">
          <label>Özel anahtardan genel anahtar türet</label>
          <div className="input-row">
            <input
              className="input"
              type="password"
              placeholder="X25519 özel anahtar (base64)"
              value={privInput}
              onChange={(e) => setPrivInput(e.target.value)}
            />
            <button
              className="btn btn--secondary btn--sm"
              onClick={handleDerive}
              disabled={loading || !privInput.trim()}
            >
              Türet
            </button>
            <button
              className="btn btn--secondary btn--sm"
              onClick={handleValidatePrivate}
              disabled={loading || !privInput.trim()}
            >
              Doğrula
            </button>
          </div>
        </div>

        {derivedPublic && (
          <div className="input-group">
            <label>Türetilen Genel Anahtar</label>
            <div className="key-display">
              {derivedPublic.publicKey}
              <button
                className="btn btn--secondary btn--sm key-display__copy"
                onClick={() => copyToClipboard(derivedPublic.publicKey)}
              >
                Kopyala
              </button>
            </div>
          </div>
        )}

        <div className="input-group">
          <label>Genel anahtar doğrula</label>
          <div className="input-row">
            <input
              className="input"
              type="text"
              placeholder="X25519 genel anahtar (base64)"
              value={pubInput}
              onChange={(e) => setPubInput(e.target.value)}
            />
            <button
              className="btn btn--secondary btn--sm"
              onClick={handleValidatePublic}
              disabled={loading || !pubInput.trim()}
            >
              Doğrula
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
