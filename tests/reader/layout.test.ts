import test from 'node:test';
import assert from 'node:assert/strict';
import { afterLayout } from '../../src/reader/layout.ts';

test('layout consumers run after a complete frame, never in the DOM write task', async () => {
  const frames: FrameRequestCallback[] = [];
  const events = ['write chapter'];
  const ready = afterLayout((cb) => frames.push(cb)).then(() => events.push('read layout, scroll, focus'));
  assert.deepEqual(events, ['write chapter']);
  frames.shift()!(0);
  await Promise.resolve();
  assert.deepEqual(events, ['write chapter']);
  frames.shift()!(16);
  await ready;
  assert.deepEqual(events, ['write chapter', 'read layout, scroll, focus']);
});
