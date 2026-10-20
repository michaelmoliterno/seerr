import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filtersToQuery, paramsFromDiscoverUrl } from './discoverFilterQuery';

describe('filtersToQuery', () => {
  it('serializes set filters and skips unset ones', () => {
    assert.strictEqual(
      filtersToQuery({ genre: '27', keywords: '1,2', studio: undefined }),
      'genre=27&keywords=1%2C2'
    );
  });
});

describe('paramsFromDiscoverUrl', () => {
  it('reads the params from a Discover URL', () => {
    assert.deepStrictEqual(
      paramsFromDiscoverUrl(
        'https://seerr.example/discover/movies?genre=27&withRuntimeLte=100#top'
      ),
      { genre: '27', withRuntimeLte: '100' }
    );
  });

  it('accepts a bare query string', () => {
    assert.deepStrictEqual(
      paramsFromDiscoverUrl(' ?voteAverageGte=7.3&keywords=1%2C2 '),
      { voteAverageGte: '7.3', keywords: '1,2' }
    );
    assert.deepStrictEqual(paramsFromDiscoverUrl('network=213'), {
      network: '213',
    });
  });

  it('returns nothing for a URL without params', () => {
    assert.deepStrictEqual(
      paramsFromDiscoverUrl('https://seerr.example/discover'),
      {}
    );
  });
});
