import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

async function load() {
  vi.resetModules();
  return import('@/logging/sessionId');
}

describe('sessionId', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('exports the header and cookie names', async () => {
    const mod = await load();
    expect(mod.SESSION_HEADER).toBe('X-Session-Id');
    expect(mod.SESSION_COOKIE_NAME).toBe('client_session_id');
  });

  it('returns a valid id that is stable across calls and module reloads', async () => {
    const first = await load();
    const id = first.getSessionId();
    expect(id).toMatch(ID_PATTERN);
    expect(first.getSessionId()).toBe(id);
    expect(sessionStorage.getItem('calibre.sessionId')).toBe(id);

    const second = await load();
    expect(second.getSessionId()).toBe(id);
  });

  it('replaces an invalid stored value', async () => {
    sessionStorage.setItem('calibre.sessionId', 'bad value!');
    const mod = await load();
    const id = mod.getSessionId();
    expect(id).toMatch(ID_PATTERN);
    expect(sessionStorage.getItem('calibre.sessionId')).toBe(id);
  });

  it('falls back to a stable in-memory id when sessionStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const mod = await load();
    const id = mod.getSessionId();
    expect(id).toMatch(ID_PATTERN);
    expect(mod.getSessionId()).toBe(id);
  });

  it('builds an id without crypto.randomUUID', async () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => arr.fill(7)
    });
    const mod = await load();
    expect(mod.getSessionId()).toMatch(ID_PATTERN);
  });

  it('builds an id without any crypto', async () => {
    vi.stubGlobal('crypto', undefined);
    const mod = await load();
    expect(mod.getSessionId()).toMatch(ID_PATTERN);
  });

  describe('setSignInCookie', () => {
    it('writes the scoped cookie without Secure on http', async () => {
      const setter = vi.spyOn(Document.prototype, 'cookie', 'set');
      const mod = await load();
      const id = mod.getSessionId();
      mod.setSignInCookie();
      expect(setter).toHaveBeenCalledWith(
        `client_session_id=${id}; Max-Age=600; Path=/api/auth/google; SameSite=Lax`
      );
    });

    it('adds Secure on https', async () => {
      vi.stubGlobal('location', { protocol: 'https:' });
      const setter = vi.spyOn(Document.prototype, 'cookie', 'set');
      const mod = await load();
      const id = mod.getSessionId();
      mod.setSignInCookie();
      expect(setter).toHaveBeenCalledWith(
        `client_session_id=${id}; Max-Age=600; Path=/api/auth/google; SameSite=Lax; Secure`
      );
    });

    it('never throws when cookie writes fail', async () => {
      vi.spyOn(Document.prototype, 'cookie', 'set').mockImplementation(() => {
        throw new Error('blocked');
      });
      const mod = await load();
      expect(() => mod.setSignInCookie()).not.toThrow();
    });
  });
});
