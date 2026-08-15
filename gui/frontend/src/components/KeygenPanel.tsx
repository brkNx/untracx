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

  const [showPrivate, setShowPrivate] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const kp = await keygen();
      setKeyPair(kp);
      setMessage({
        type: 'success',
        text: 'Yeni X25519 Curve25519 anahtar çifti ve PSK başarıyla üretildi.',
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
      setMessage({ type: 'success', text: 'Genel anahtar başarıyla türetildi.' });
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
      setMessage({ type: 'success', text: 'Özel anahtar geçerli (32-byte Curve25519).' });
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
      setMessage({ type: 'success', text: 'Genel anahtar geçerli (32-byte Curve25519).' });
    } catch (e) {
      setMessage({ type: 'error', text: `Geçersiz genel anahtar: ${e}` });
    }
    setLoading(false);
  };

  const copyToClipboard = (text: string, label = 'Panoya kopyalandı.') => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'info', text: label });
  };

  return (
    <div className="card">
      <div className="card__header">
        <span className="card__title">Anahtar Yönetimi &amp; Zero-Trust Provizyon</span>
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
        <div
          style={{
            marginBottom: 16,
            background: 'var(--bg-input)',
            padding: 12,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="input-group">
            <label>Genel Anahtar (Public Key — Sunucuya Verilecek):</label>
            <div className="key-display">
              {keyPair.publicKey}
              <button
                className="btn btn--secondary btn--sm key-display__copy"
                onClick={() => copyToClipboard(keyPair.publicKey, 'Genel anahtar kopyalandı.')}
              >
                Kopyala
              </button>
            </div>
          </div>

          {keyPair.privateKey && (
            <div className="input-group" style={{ marginTop: 12 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                <label style={{ margin: 0 }}>Özel Anahtar (Private Key — Gizli Tutulmalı):</label>
                <button
                  className="btn btn--secondary btn--sm"
                  style={{ fontSize: 11, padding: '2px 6px' }}
                  onClick={() => setShowPrivate(!showPrivate)}
                >
                  {showPrivate ? 'Gizle' : 'Göster'}
                </button>
              </div>
              <div className="key-display">
                {showPrivate ? keyPair.privateKey : '••••••••••••••••••••••••••••••••••••••••••••'}
                <button
                  className="btn btn--secondary btn--sm key-display__copy"
                  onClick={() => copyToClipboard(keyPair.privateKey!, 'Özel anahtar kopyalandı.')}
                >
                  Kopyala
                </button>
              </div>
            </div>
          )}

          {keyPair.presharedKey && (
            <div className="input-group" style={{ marginTop: 12 }}>
              <label>Pre-Shared Key (PSK — Kuantum Sonrası Koruma):</label>
              <div className="key-display">
                {keyPair.presharedKey}
                <button
                  className="btn btn--secondary btn--sm key-display__copy"
                  onClick={() => copyToClipboard(keyPair.presharedKey!, 'PSK kopyalandı.')}
                >
                  Kopyala
                </button>
              </div>
            </div>
          )}

          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
            🔒 <strong>Zero-Trust Güvenlik:</strong> Özel anahtarınız cihazınızda üretilmiştir.
            Sunucu yöneticisine yalnızca Genel Anahtarınızı iletin.
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
