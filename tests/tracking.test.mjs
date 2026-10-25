import test from 'node:test';
import assert from 'node:assert/strict';
import { pinchRatio, nextPinchState, smoothCursor } from '../tracking.js';

test('pinch ratio is normalized to palm width', () => {
  const points = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
  points[5] = { x: 0, y: 0 };
  points[17] = { x: .4, y: 0 };
  points[4] = { x: .12, y: 0 };
  points[8] = { x: .2, y: 0 };
  assert.ok(Math.abs(pinchRatio(points) - .2) < 1e-9);
});

test('a pinch needs two confirming frames', () => {
  let state = nextPinchState(null, .2);
  assert.equal(state.active, false);
  state = nextPinchState(state, .2);
  assert.equal(state.active, true);
});

test('the release threshold has hysteresis and requires confirmation', () => {
  let state = nextPinchState(nextPinchState(null, .18), .18);
  state = nextPinchState(state, .4);
  assert.equal(state.active, true);
  state = nextPinchState(state, .6);
  assert.equal(state.active, true);
  state = nextPinchState(state, .6);
  assert.equal(state.active, false);
});

test('a moving fingertip responds faster than small jitter', () => {
  const prev = { x: .3, y: .3 };
  const small = smoothCursor(prev, { x: .301, y: .3 }, 33, .2);
  const large = smoothCursor(prev, { x: .5, y: .3 }, 33, .2);
  const smallFraction = (small.x - prev.x) / .001;
  const largeFraction = (large.x - prev.x) / .2;
  assert.ok(largeFraction > smallFraction);
  assert.ok(large.x > .3 && large.x < .5);
});
