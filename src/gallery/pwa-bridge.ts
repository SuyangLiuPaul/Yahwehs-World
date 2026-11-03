// Talking to the service worker (src/pwa/sw.ts): one question, one answer, on a private channel.
export interface Report { type: 'report'; build: string; caches: Record<string, { bytes: number; files: number; budget: number }> }

export function ask<T = unknown>(to: ServiceWorker | null | undefined, msg: Record<string, unknown>, ms = 4000): Promise<T | null> {
  return new Promise((ok) => {
    if (!to) { ok(null); return; }
    const ch = new MessageChannel();
    const timer = setTimeout(() => ok(null), ms);
    ch.port1.onmessage = (e) => { clearTimeout(timer); ok(e.data as T); };
    try { to.postMessage(msg, [ch.port2]); } catch { clearTimeout(timer); ok(null); }
  });
}
