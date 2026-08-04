use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use x25519_dalek::{PublicKey, StaticSecret};
use zeroize::Zeroize;

pub struct KeyPair {
    pub private: String,
    pub public: String,
}

pub fn generate() -> KeyPair {
    let secret = StaticSecret::random_from_rng(rand::rngs::OsRng);
    let public = PublicKey::from(&secret);
    KeyPair {
        private: B64.encode(secret.to_bytes()),
        public: B64.encode(public.as_bytes()),
    }
}

pub fn public_from_private(private_b64: &str) -> Result<String, String> {
    let decoded = B64.decode(private_b64.trim()).map_err(|e| e.to_string())?;
    let mut raw_array: [u8; 32] = decoded
        .try_into()
        .map_err(|_| "Anahtar 32 bayt olmalı (base64)".to_string())?;
    let secret = StaticSecret::from(raw_array);
    let public = PublicKey::from(&secret);
    raw_array.zeroize();
    Ok(B64.encode(public.as_bytes()))
}

pub fn validate_public(public_b64: &str) -> Result<(), String> {
    let decoded = B64.decode(public_b64.trim()).map_err(|e| e.to_string())?;
    if decoded.len() != 32 {
        return Err("Genel anahtar 32 bayt olmalı".to_string());
    }
    Ok(())
}
