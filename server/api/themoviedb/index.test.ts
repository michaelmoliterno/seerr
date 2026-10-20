import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import TheMovieDb from '@server/api/themoviedb';
import { User } from '@server/entity/User';
import { UserSettings } from '@server/entity/UserSettings';
import { createTmdbWithRegionLanguage } from '@server/routes/discover';

type Params = Record<string, unknown>;

function mockGet(tmdb: TheMovieDb) {
  return mock.method(
    tmdb as unknown as {
      get: (path: string, config: { params: Params }) => Promise<unknown>;
    },
    'get',
    async () => ({ page: 1, results: [], total_pages: 1, total_results: 0 })
  );
}

async function discoverParams(
  tmdb: TheMovieDb,
  options: { watchProviders?: string; watchRegion?: string } = {}
): Promise<{ movie: Params; tv: Params }> {
  const get = mockGet(tmdb);
  await tmdb.getDiscoverMovies(options);
  await tmdb.getDiscoverTv(options);
  const [movie, tv] = get.mock.calls.map(
    (call) => (call.arguments[1] as { params: Params }).params
  );
  return { movie, tv };
}

describe('TheMovieDb discover watch provider exclusion', () => {
  afterEach(() => mock.restoreAll());

  it('excludes the configured providers in the configured region', async () => {
    const tmdb = new TheMovieDb({
      excludeWatchProviders: [8, 1899, 15],
      excludeWatchRegion: 'GB',
    });

    const { movie, tv } = await discoverParams(tmdb);

    for (const params of [movie, tv]) {
      assert.strictEqual(params.without_watch_providers, '8|1899|15');
      assert.strictEqual(params.watch_region, 'GB');
    }
  });

  it('does not exclude anything when no providers are configured', async () => {
    for (const excludeWatchProviders of [undefined, []]) {
      const tmdb = new TheMovieDb({
        excludeWatchProviders,
        excludeWatchRegion: 'US',
      });

      const { movie, tv } = await discoverParams(tmdb);

      for (const params of [movie, tv]) {
        assert.strictEqual(params.without_watch_providers, undefined);
        assert.strictEqual(params.watch_region, undefined);
      }
      mock.restoreAll();
    }
  });

  it('does not exclude when the request asks for specific providers', async () => {
    const tmdb = new TheMovieDb({
      excludeWatchProviders: [8],
      excludeWatchRegion: 'US',
    });

    const { movie, tv } = await discoverParams(tmdb, {
      watchProviders: '8|337',
      watchRegion: 'CA',
    });

    for (const params of [movie, tv]) {
      assert.strictEqual(params.without_watch_providers, undefined);
      assert.strictEqual(params.with_watch_providers, '8|337');
      assert.strictEqual(params.watch_region, 'CA');
    }
  });

  it('does not exclude when the region is "all"', async () => {
    const tmdb = new TheMovieDb({
      excludeWatchProviders: [8],
      excludeWatchRegion: 'all',
    });

    const { movie, tv } = await discoverParams(tmdb);

    for (const params of [movie, tv]) {
      assert.strictEqual(params.without_watch_providers, undefined);
      assert.strictEqual(params.watch_region, undefined);
    }
  });
});

describe('createTmdbWithRegionLanguage', () => {
  afterEach(() => mock.restoreAll());

  function userWith(settings: Partial<UserSettings>) {
    return new User({ settings: new UserSettings(settings) });
  }

  it("passes the user's services when hiding is on", async () => {
    const tmdb = createTmdbWithRegionLanguage(
      userWith({
        streamingRegion: 'DE',
        streamingServices: [8, 337],
        hideStreamingServices: true,
      })
    );

    const { movie } = await discoverParams(tmdb);

    assert.strictEqual(movie.without_watch_providers, '8|337');
    assert.strictEqual(movie.watch_region, 'DE');
  });

  it('ignores saved services when hiding is off', async () => {
    const tmdb = createTmdbWithRegionLanguage(
      userWith({
        streamingRegion: 'DE',
        streamingServices: [8, 337],
        hideStreamingServices: false,
      })
    );

    const { movie } = await discoverParams(tmdb);

    assert.strictEqual(movie.without_watch_providers, undefined);
  });
});
