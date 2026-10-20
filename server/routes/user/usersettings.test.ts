import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';

import JellyfinAPI from '@server/api/jellyfin';
import { MediaServerType } from '@server/constants/server';
import { UserType } from '@server/constants/user';
import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { getSettings } from '@server/lib/settings';
import { checkUser, isAuthenticated } from '@server/middleware/auth';
import authRoutes from '@server/routes/auth';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import userRoutes from '.';

const defaultAuthenticateResponse = {
  User: {
    Id: 'jf-link-user-001',
    Name: 'linkeduser',
    ServerId: 'server-1',
    Policy: { IsAdministrator: false },
  },
  AccessToken: 'fake-qc-access-token',
};

const authenticateQCMock = mock.method(
  JellyfinAPI.prototype,
  'authenticateQuickConnect',
  async () => ({ ...defaultAuthenticateResponse })
);

let app: Express;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use(checkUser);
  app.use('/auth', authRoutes);
  app.use('/user', isAuthenticated(), userRoutes);
  app.use(
    (
      err: { status?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) => {
      res
        .status(err.status ?? 500)
        .json({ status: err.status ?? 500, message: err.message });
    }
  );
  return app;
}

before(async () => {
  app = createApp();
});

setupTestDb();

function configureJellyfin() {
  const settings = getSettings();
  settings.main.mediaServerType = MediaServerType.JELLYFIN;
  settings.jellyfin.ip = 'localhost';
  settings.jellyfin.port = 8096;
  settings.jellyfin.useSsl = false;
  settings.jellyfin.urlBase = '';
}

async function loginAs(email: string, password: string) {
  const settings = getSettings();
  settings.main.localLogin = true;

  const agent = request.agent(app);
  const res = await agent.post('/auth/local').send({ email, password });

  assert.strictEqual(res.status, 200);
  return { agent, userId: res.body.id as number };
}

describe('POST /user/:id/settings/linked-accounts/jellyfin/quickconnect', () => {
  beforeEach(() => {
    authenticateQCMock.mock.resetCalls();
    authenticateQCMock.mock.mockImplementation(async () => ({
      ...defaultAuthenticateResponse,
    }));
    configureJellyfin();
  });

  it('links the account when the media server is Jellyfin', async () => {
    const { agent, userId } = await loginAs('demo@seerr.dev', 'test1234');

    const res = await agent
      .post(`/user/${userId}/settings/linked-accounts/jellyfin/quickconnect`)
      .send({ secret: 'abc123def456abc123def456' });

    assert.strictEqual(res.status, 204);
    assert.strictEqual(authenticateQCMock.mock.callCount(), 1);

    const user = await getRepository(User).findOneOrFail({
      where: { id: userId },
    });
    assert.strictEqual(user.jellyfinUserId, 'jf-link-user-001');
    assert.strictEqual(user.userType, UserType.JELLYFIN);
  });

  it('returns 403 when the media server is Emby', async () => {
    const { agent, userId } = await loginAs('demo@seerr.dev', 'test1234');
    getSettings().main.mediaServerType = MediaServerType.EMBY;

    const res = await agent
      .post(`/user/${userId}/settings/linked-accounts/jellyfin/quickconnect`)
      .send({ secret: 'abc123def456abc123def456' });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(authenticateQCMock.mock.callCount(), 0);

    const user = await getRepository(User).findOneOrFail({
      where: { id: userId },
    });
    assert.strictEqual(user.jellyfinUserId, null);
  });
});

describe('POST /user/:id/settings/main streaming services', () => {
  async function postMain(body: Record<string, unknown>) {
    const { agent, userId } = await loginAs('demo@seerr.dev', 'test1234');
    const current = await agent.get(`/user/${userId}/settings/main`);
    const res = await agent
      .post(`/user/${userId}/settings/main`)
      .send({ ...current.body, ...body });
    return { agent, userId, res };
  }

  it('saves de-duplicated services and the toggle', async () => {
    const { agent, userId, res } = await postMain({
      streamingServices: [8, 1899, 8, 15],
      hideStreamingServices: true,
    });

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.streamingServices, [8, 1899, 15]);
    assert.strictEqual(res.body.hideStreamingServices, true);

    const saved = await agent.get(`/user/${userId}/settings/main`);
    assert.deepStrictEqual(saved.body.streamingServices, [8, 1899, 15]);
    assert.strictEqual(saved.body.hideStreamingServices, true);
  });

  it('keeps saved services when a client omits the fields', async () => {
    const { agent, userId } = await postMain({
      streamingServices: [8],
      hideStreamingServices: true,
    });
    const current = await agent.get(`/user/${userId}/settings/main`);
    const rest = { ...current.body };
    delete rest.streamingServices;
    delete rest.hideStreamingServices;

    const res = await agent.post(`/user/${userId}/settings/main`).send(rest);

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.streamingServices, [8]);
    assert.strictEqual(res.body.hideStreamingServices, true);
  });

  for (const [label, streamingServices] of [
    ['non-integer IDs', [8.5]],
    ['zero or negative IDs', [0, -3]],
    ['strings', ['8']],
    ['a non-array', 8],
    ['too many IDs', Array.from({ length: 51 }, (_, i) => i + 1)],
  ] as const) {
    it(`rejects ${label}`, async () => {
      const { agent, userId, res } = await postMain({ streamingServices });

      assert.strictEqual(res.status, 400);
      const saved = await agent.get(`/user/${userId}/settings/main`);
      assert.deepStrictEqual(saved.body.streamingServices, []);
    });
  }

  it('rejects a non-boolean toggle', async () => {
    const { res } = await postMain({ hideStreamingServices: 'yes' });

    assert.strictEqual(res.status, 400);
  });
});
