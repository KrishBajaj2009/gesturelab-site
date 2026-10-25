import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, makePath, evaluateDrawing, polylineLength } from '../shapes.js';
import { masteryCount, unlockedLevels, canOpenLevel } from '../unlocks.js';

test('bonus levels are hidden at first', () => {
  const visible = unlockedLevels(LEVELS, {});
  assert.equal(visible.length, 4);
  assert.equal(LEVELS.length, 8);
  assert.equal(canOpenLevel(LEVELS[4], {}, LEVELS), false);
});

test('one distinct 70% original score unlocks one secret', () => {
  const scores = { circle: 82, star: 40 };
  assert.equal(masteryCount(scores, LEVELS), 1);
  assert.deepEqual(unlockedLevels(LEVELS, scores).map(level => level.id), [
    'circle', 'triangle', 'square', 'star', 'diamond'
  ]);
});

test('all four original levels unlock all four secrets', () => {
  const scores = { circle: 73, triangle: 70, square: 90, star: 81 };
  assert.equal(masteryCount(scores, LEVELS), 4);
  assert.equal(unlockedLevels(LEVELS, scores).length, 8);
  assert.equal(canOpenLevel(LEVELS[7], scores, LEVELS), true);
});

test('bonus level scores cannot unlock other bonuses', () => {
  const scores = { circle: 71, diamond: 100, hexagon: 100 };
  assert.equal(unlockedLevels(LEVELS, scores).length, 5);
});

test('new secret outlines are closed, scoreable paths', () => {
  for (const secret of LEVELS.filter(level => level.secret)) {
    const path = makePath(secret.id);
    assert.deepEqual(path[0], path.at(-1), secret.id);
    assert.ok(polylineLength(path) > 450, secret.id);
    const result = evaluateDrawing(path, path);
    assert.ok(result.score >= 98, secret.id + ': ' + JSON.stringify(result));
    assert.ok(result.coverage >= 99, secret.id);
  }
});
