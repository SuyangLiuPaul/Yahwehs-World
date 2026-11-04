/** A second frame lets the browser lay out the DOM written in the current task.
 * The caller checks its render generation after awaiting, before touching layout. */
export function afterLayout(frame: (cb: FrameRequestCallback) => number = requestAnimationFrame): Promise<void> {
  return new Promise((resolve) => { frame(() => { frame(() => resolve()); }); });
}
