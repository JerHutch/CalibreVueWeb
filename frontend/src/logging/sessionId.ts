export const SESSION_HEADER = 'X-Session-Id';
export const SESSION_COOKIE_NAME = 'client_session_id';

const STORAGE_KEY = 'calibre.sessionId';
const ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const COOKIE_MAX_AGE_SECONDS = 600;
const COOKIE_PATH = '/api/auth/google';

let memoryId: string | null = null;

function uuidFromBytes(bytes: ArrayLike<number>): string {
  const hex: string[] = [];
  for (let i = 0; i < 16; i += 1) {
    hex.push((bytes[i] & 0xff).toString(16).padStart(2, '0'));
  }
  // Mark as version 4 / RFC 4122 variant.
  hex[6] = ((parseInt(hex[6], 16) & 0x0f) | 0x40).toString(16).padStart(2, '0');
  hex[8] = ((parseInt(hex[8], 16) & 0x3f) | 0x80).toString(16).padStart(2, '0');
  const h = hex.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function generateId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      return uuidFromBytes(crypto.getRandomValues(new Uint8Array(16)));
    }
  } catch {
    // fall through to Math.random
  }
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  return uuidFromBytes(bytes);
}

export function getSessionId(): string {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && ID_PATTERN.test(stored)) {
      return stored;
    }
    const id = generateId();
    sessionStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    if (!memoryId) {
      memoryId = generateId();
    }
    return memoryId;
  }
}

export function setSignInCookie(): void {
  try {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie =
      `${SESSION_COOKIE_NAME}=${getSessionId()}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; ` +
      `Path=${COOKIE_PATH}; SameSite=Lax${secure}`;
  } catch {
    // Logging correlation is best effort; never break sign-in.
  }
}
