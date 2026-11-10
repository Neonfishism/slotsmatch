export const DEVICE_KEY = 'worlds-draft-device-v1';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function newDeviceId(crypto) {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  if (typeof crypto?.getRandomValues !== 'function') return undefined;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A random browser identifier; it contains no hardware or account information. */
export function getDeviceId(environment = globalThis) {
  try {
    const storage = environment.localStorage;
    const saved = storage.getItem(DEVICE_KEY);
    if (UUID_V4.test(saved || '')) return saved.toLowerCase();
    const generated = newDeviceId(environment.crypto);
    if (!UUID_V4.test(generated || '')) return undefined;
    storage.setItem(DEVICE_KEY, generated.toLowerCase());
    // Read storage afresh on each request so another tab's value is respected.
    const stored = storage.getItem(DEVICE_KEY);
    return UUID_V4.test(stored || '') ? stored.toLowerCase() : undefined;
  } catch {
    // Unavailable storage remains unattributed instead of inventing new devices.
    return undefined;
  }
}
