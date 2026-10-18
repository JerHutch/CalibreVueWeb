import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { sessionContext, attachUserToContext } from '../../src/middleware/sessionContext';
import { getContext } from '../../src/utils/requestContext';

const ID = 'abcd1234-efgh';
const OTHER = 'zzzz9999-yyyy';

function buildApp() {
  const app = express();
  app.use(sessionContext);
  const handler: express.RequestHandler = (_req, res) => {
    setImmediate(() => res.json({ ctx: getContext() ?? null }));
  };
  app.get('/probe', handler);
  app.get('/api/auth/google', handler);
  app.get('/api/auth/google/callback', handler);
  return app;
}

describe('sessionContext', () => {
  it('uses a valid X-Session-Id header', async () => {
    const res = await request(buildApp()).get('/probe').set('X-Session-Id', ID);
    expect(res.body.ctx.sessionId).toBe(ID);
  });

  it('ignores an invalid header', async () => {
    const res = await request(buildApp()).get('/probe').set('X-Session-Id', 'bad id!');
    expect(res.status).toBe(200);
    expect(res.body.ctx.sessionId).toBeUndefined();
  });

  it('uses the cookie on /api/auth/google URLs when no header', async () => {
    const res = await request(buildApp())
      .get('/api/auth/google/callback?code=x')
      .set('Cookie', `foo=bar; client_session_id=${ID}`);
    expect(res.body.ctx.sessionId).toBe(ID);
  });

  it('ignores the cookie on other paths', async () => {
    const res = await request(buildApp()).get('/probe').set('Cookie', `client_session_id=${ID}`);
    expect(res.body.ctx.sessionId).toBeUndefined();
  });

  it('header wins over cookie', async () => {
    const res = await request(buildApp())
      .get('/api/auth/google')
      .set('X-Session-Id', ID)
      .set('Cookie', `client_session_id=${OTHER}`);
    expect(res.body.ctx.sessionId).toBe(ID);
  });

  it('tolerates malformed cookies', async () => {
    const res = await request(buildApp())
      .get('/api/auth/google')
      .set('Cookie', ';;=; client_session_id=%E0%A4%A; =x; novalue');
    expect(res.status).toBe(200);
    expect(res.body.ctx.sessionId).toBeUndefined();
  });
});

describe('attachUserToContext', () => {
  function buildUserApp(user?: { id: number }) {
    const app = express();
    app.use(sessionContext);
    app.use((req, _res, next) => {
      if (user) (req as any).user = user;
      next();
    });
    app.use(attachUserToContext);
    app.get('/probe', (_req, res) => {
      setImmediate(() => res.json({ ctx: getContext() ?? null }));
    });
    return app;
  }

  it('sets userId when authenticated', async () => {
    const res = await request(buildUserApp({ id: 42 })).get('/probe').set('X-Session-Id', ID);
    expect(res.body.ctx).toEqual({ sessionId: ID, userId: '42' });
  });

  it('leaves userId unset when anonymous', async () => {
    const res = await request(buildUserApp()).get('/probe').set('X-Session-Id', ID);
    expect(res.body.ctx.userId).toBeUndefined();
  });

  it('does not throw without an active context', () => {
    let called = false;
    expect(() =>
      attachUserToContext({ user: { id: 1 } } as any, {} as any, () => { called = true; })
    ).not.toThrow();
    expect(called).toBe(true);
  });
});

describe('sessionContext through createApp', () => {
  it('does not break requests carrying a session header', async () => {
    const { createApp } = await import('../../src/app');
    const app = createApp(
      { calibreService: {} as any, authService: {} as any },
      { enableGoogleAuth: false }
    );
    const res = await request(app).get('/api/auth/me').set('X-Session-Id', ID);
    expect(res.status).toBe(200);
  });
});
