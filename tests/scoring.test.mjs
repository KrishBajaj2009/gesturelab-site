import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, makePath, evaluateDrawing, polylineLength, pointSegmentDistance, samplePolyline } from '../shapes.js';

test('all four target outlines are valid', () => {
  for (const { id } of LEVELS) {
    const path = makePath(id);
    assert.ok(path.length >= 4);
    assert.ok(polylineLength(path) > 450);
    assert.deepEqual(path[0], path.at(-1));
  }
});

test('perfect circle receives a very high score', () => {
  const target = makePath('circle');
  const result = evaluateDrawing(target, target);
  assert.ok(result.score >= 98, JSON.stringify(result));
  assert.ok(result.coverage >= 99);
});

test('half circle scores well below a complete trace', () => {
  const path = makePath('circle');
  const score = evaluateDrawing(path.slice(0, 90), path);
  assert.ok(score.coverage < 65, JSON.stringify(score));
  assert.ok(score.score < 85);
});

test('off-target scribble performs poorly', () => {
  const target = makePath('square');
  const scribble = Array.from({ length: 70 }, (_, i) => ({ x: 35 + i * 2, y: 25 + Math.sin(i) * 15 }));
  assert.ok(evaluateDrawing(scribble, target).score < 25);
});

test('very short trace does not count', () => {
  const score = evaluateDrawing([{x:1,y:1},{x:2,y:2}], makePath('circle'));
  assert.equal(score.enough, false);
  assert.equal(score.score, 0);
});

test('geometry distance helpers', () => {
  assert.equal(pointSegmentDistance({x:5,y:5},{x:0,y:0},{x:10,y:0}),5);
  assert.ok(samplePolyline([{x:0,y:0},{x:24,y:0}],6).length >= 5);
});
