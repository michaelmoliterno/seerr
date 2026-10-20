import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import TheMovieDb from '@server/api/themoviedb';
import type { TmdbListResponse } from '@server/api/themoviedb/interfaces';
import { getSettings } from '@server/lib/settings';
import { checkUser, isAuthenticated } from '@server/middleware/auth';
import { setupTestDb } from '@server/test/db';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import authRoutes from './auth';
import discoverRoutes from './discover';

const lists: Record<number, TmdbListResponse> = {
  28: {
    id: 28,
    name: 'Best Picture Winners',
    description: '',
    page: 1,
    total_pages: 1,
    total_results: 3,
    items: [
      { id: 550, media_type: 'movie', title: 'Movie' },
      { id: 1399, media_type: 'tv', name: 'Series' },
      { id: 7, media_type: 'person', name: 'Someone' },
    ] as unknown as TmdbListResponse['items'],
  },
};

Object.defineProperty(TheMovieDb.prototype, 'getList', {
  get() {
    return async ({ listId }: { listId: number }) => {
      const list = lists[listId];
      if (!list) {
        throw new Error('[TMDB] Failed to fetch list: 404', {
          cause: { response: { status: 404 } },
        });
      }
      return list;
    };
  },
  set() {},
  configurable: true,
});

let app: Express;

before(() => {
  app = express();
  app.use(express.json());
  app.use(
    session({ secret: 'test-secret', resave: false, saveUninitialized: false })
  );
  app.use(checkUser);
  app.use('/auth', authRoutes);
  app.use('/discover', isAuthenticated(), discoverRoutes);
  app.use(
    (
      err: { status?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) => {
      res.status(err.status ?? 500).json({ message: err.message });
    }
  );
});

setupTestDb();

async function login() {
  getSettings().main.localLogin = true;
  const agent = request.agent(app);
  const res = await agent
    .post('/auth/local')
    .send({ email: 'admin@seerr.dev', password: 'test1234' });
  assert.strictEqual(res.status, 200);
  return agent;
}

describe('GET /discover/list/:listId', () => {
  it('returns the movies and series on the list', async () => {
    const agent = await login();

    const res = await agent.get('/discover/list/28');

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.list, {
      id: 28,
      name: 'Best Picture Winners',
    });
    assert.deepStrictEqual(
      res.body.results.map((r: { id: number; mediaType: string }) => [
        r.id,
        r.mediaType,
      ]),
      [
        [550, 'movie'],
        [1399, 'tv'],
      ]
    );
  });

  it('returns 404 for a missing or private list', async () => {
    const agent = await login();

    const res = await agent.get('/discover/list/999');

    assert.strictEqual(res.status, 404);
  });

  it('rejects an invalid list ID', async () => {
    const agent = await login();

    const res = await agent.get('/discover/list/abc');

    assert.strictEqual(res.status, 400);
  });
});
