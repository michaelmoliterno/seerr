import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseTmdbListId } from './parseTmdbListId';

describe('parseTmdbListId', () => {
  it('reads the ID from TMDB list URLs', () => {
    assert.strictEqual(
      parseTmdbListId('https://www.themoviedb.org/list/28-best-picture'),
      '28'
    );
    assert.strictEqual(
      parseTmdbListId('https://www.themoviedb.org/list/8204859?language=en'),
      '8204859'
    );
    assert.strictEqual(parseTmdbListId('themoviedb.org/list/42/'), '42');
  });

  it('accepts a bare ID', () => {
    assert.strictEqual(parseTmdbListId(' 28 '), '28');
  });

  it('rejects anything else', () => {
    assert.strictEqual(parseTmdbListId(''), '');
    assert.strictEqual(parseTmdbListId('best-picture'), '');
    assert.strictEqual(
      parseTmdbListId('https://www.themoviedb.org/movie/550'),
      ''
    );
  });
});
