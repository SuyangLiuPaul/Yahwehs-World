import test from 'node:test';
import assert from 'node:assert/strict';
import { followDocumentTitle } from '../../src/shell/title.ts';

test('native title follows initial language, language switches and late scene titles', async () => {
  const calls: string[] = [];
  let notify = () => {};
  let disconnected = false;
  const head = {};
  class Observer {
    constructor(cb: () => void) { notify = cb; }
    observe(target: unknown, options: unknown) {
      assert.equal(target, head);
      assert.deepEqual(options, { childList: true, subtree: true, characterData: true });
    }
    disconnect() { disconnected = true; }
  }
  for (const name of ["Yahweh's World", '雅伟之界', '雅偉之界', "Yahweh's World"]) {
    const doc = { head, title: name };
    const stop = followDocumentTitle(doc as Document, async (title) => { calls.push(title); }, Observer as unknown as typeof MutationObserver);
    assert.equal(calls.at(-1), name);
    doc.title = `${name} · Genesis 1`;
    notify();
    assert.equal(calls.at(-1), doc.title);
    doc.title = '雅偉之界';
    notify();
    assert.equal(calls.at(-1), '雅偉之界');
    stop();
    assert.equal(disconnected, true);
  }
  assert.equal(calls.length, 12);
});

test('a rejected native title call is handled', async (t) => {
  const warnings = t.mock.method(console, 'warn', () => {});
  class Observer { observe() {} disconnect() {} }
  followDocumentTitle({ head: {}, title: '雅伟之界' } as Document, async () => { throw new Error('unavailable'); }, Observer as unknown as typeof MutationObserver);
  await Promise.resolve();
  assert.equal(warnings.mock.calls.length, 1);
});
