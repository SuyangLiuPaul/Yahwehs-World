import type { Platform } from '../platform/types.ts';
import { relativePath } from '../platform/web.ts';

export type PackId = 'thumbs' | 'full' | 'editions';
export interface PackInfo { id: PackId; bundled: boolean; path: string; bytes: number; files: [name: string, bytes: number, sha256: string][] }
export interface PacksManifest { v: 1; version: string; host: string; packs: PackInfo[] }
export interface PackStatus {
  state: 'bundled' | 'absent' | 'partial' | 'complete' | 'downloading' | 'error';
  doneFiles: number; doneBytes: number; totalFiles: number; totalBytes: number; error?: string;
}
export interface PackManager {
  info(): PackInfo[];
  status(id: PackId): Promise<PackStatus>;
  download(id: PackId, opts?: { onProgress?(s: PackStatus): void; signal?: AbortSignal; verify?: boolean }): Promise<PackStatus>;
  remove(id: PackId): Promise<void>;
  usage(): Promise<{ usedBytes: number; quotaBytes: number | null }>;
  /** Answered synchronously from the full-file names discovered by refresh(). */
  localFullUrl(id: string): string | null;
  refresh(): Promise<void>;
}

export function parseManifest(json: unknown): PacksManifest {
  const fail = (): never => { throw new Error('Invalid packs manifest'); };
  if (!json || typeof json !== 'object') return fail();
  const m = json as Record<string, unknown>;
  if (m.v !== 1 || typeof m.version !== 'string' || typeof m.host !== 'string' || !Array.isArray(m.packs)) return fail();
  try { const host = new URL(m.host); if (host.protocol !== 'https:' || host.username || host.password || host.search || host.hash) return fail(); } catch { return fail(); }
  const ids = new Set<string>();
  const size = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
  const packs = m.packs.map((value: unknown): PackInfo => {
    if (!value || typeof value !== 'object') return fail();
    const p = value as Record<string, unknown>;
    if (typeof p.id !== 'string' || !['thumbs', 'full', 'editions'].includes(p.id) || ids.has(p.id) || typeof p.bundled !== 'boolean' || typeof p.path !== 'string' || !size(p.bytes) || !Array.isArray(p.files)) return fail();
    ids.add(p.id);
    try { relativePath(p.path); } catch { return fail(); }
    const names = new Set<string>();
    const files = p.files.map((f: unknown): PackInfo['files'][number] => {
      if (!Array.isArray(f) || f.length !== 3 || typeof f[0] !== 'string' || !size(f[1]) || typeof f[2] !== 'string' || !/^[a-f\d]{64}$/i.test(f[2]) || names.has(f[0])) return fail();
      try { relativePath(f[0]); } catch { return fail(); }
      if ((p.path as string).startsWith('pictures/') && /\/|\.\.|\\/.test(f[0])) return fail();
      names.add(f[0]);
      return [f[0], f[1], f[2]];
    });
    if (files.reduce((n, f) => n + f[1], 0) !== p.bytes) return fail();
    return { id: p.id as PackId, bundled: p.bundled, path: p.path, bytes: p.bytes, files };
  });
  return { v: 1, version: m.version, host: m.host.replace(/\/$/, ''), packs };
}

export function formatBytes(n: number, _locale?: string): string {
  return n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} MiB` : `${(n / 1024 ** 3).toFixed(2)} GiB`;
}

export function createPackManager(deps: { platform: Platform; manifest: PacksManifest; sha256?: (b: ArrayBuffer) => Promise<string>; concurrency?: number }): PackManager {
  const { platform, manifest } = deps;
  const concurrency = Math.max(1, Math.floor(deps.concurrency ?? 4) || 1);
  const fullFiles = new Set<string>();
  const states = new Map<PackId, PackStatus>();
  const running = new Map<PackId, Promise<PackStatus>>();
  const hash = deps.sha256 ?? (async (buffer: ArrayBuffer) => {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  });
  function pack(id: PackId) { const p = manifest.packs.find(p => p.id === id); if (!p) throw new Error(`Unknown pack: ${id}`); return p; }
  const bundled = (p: PackInfo) => p.bundled && platform.kind !== 'web';
  /** Names stored for a flat pack (pictures); nested packs (Bible data) have no listing and are checked file by file. */
  async function stored(p: PackInfo): Promise<{ has(name: string): boolean }> {
    if (p.files.some(([name]) => name.includes('/'))) {
      const present = new Set<string>();
      for (const [name] of p.files) if (await platform.files.exists(`${p.path}/${name}`)) present.add(name);
      return present;
    }
    return new Set(await platform.files.list(p.path));
  }
  async function scan(p: PackInfo): Promise<PackStatus> {
    let doneFiles = 0; let doneBytes = 0;
    // one directory listing, not one existence check per file (1,443 IPC calls in a native shell)
    const have = bundled(p) ? null : await stored(p);
    for (const [name, bytes] of p.files) if (!have || have.has(name)) { doneFiles++; doneBytes += bytes; }
    return { state: bundled(p) ? 'bundled' : doneFiles === p.files.length ? 'complete' : doneFiles ? 'partial' : 'absent', doneFiles, doneBytes, totalFiles: p.files.length, totalBytes: p.bytes };
  }
  async function perform(p: PackInfo, opts: Parameters<PackManager['download']>[1] = {}): Promise<PackStatus> {
    if (bundled(p)) return scan(p);
    const s = await scan(p);
    s.state = 'downloading'; states.set(p.id, s);
    const inflight = new Map<string, number>();
    let lastProgress = -Infinity;
    let error: string | undefined;
    function emit(final = false) {
      const now = Date.now();
      if (final || now - lastProgress >= 100) {
        lastProgress = now;
        opts.onProgress?.({ ...s, doneBytes: s.doneBytes + [...inflight.values()].reduce((a, b) => a + b, 0) });
      }
    }
    emit();
    const missing: PackInfo['files'] = [];
    const have = await stored(p);
    for (const f of p.files) if (!have.has(f[0])) missing.push(f);
    let cursor = 0;
    async function worker() {
      while (!opts.signal?.aborted) {
        const file = missing[cursor++]; if (!file) return;
        const [name, size, expected] = file;
        const dest = `${p.path}/${name}`;
        for (let attempt = 0; attempt < 2 && !opts.signal?.aborted; attempt++) {
          try {
            await platform.files.download(`${manifest.host.replace(/\/$/, '')}/${dest}`, dest, progress => {
              inflight.set(name, Math.min(size, progress.loaded)); emit();
            }, opts.signal);
            if (opts.verify) {
              try {
                if (!platform.files.read) throw new Error('File verification unavailable: platform has no readback');
                if ((await hash(await platform.files.read(dest))).toLowerCase() !== expected.toLowerCase()) throw new Error(`SHA-256 mismatch: ${name}`);
              } catch (e) { await platform.files.remove(dest); throw e; }
            }
            inflight.delete(name); s.doneFiles++; s.doneBytes += size; emit();
            break;
          } catch (e) {
            inflight.delete(name);
            if (opts.signal?.aborted || (e as Error)?.name === 'AbortError') return;
            if (attempt === 1) error = e instanceof Error ? e.message : String(e);
          }
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, missing.length) }, worker));
    s.state = opts.signal?.aborted ? 'partial' : error ? 'error' : s.doneFiles === s.totalFiles ? 'complete' : 'partial';
    if (error && !opts.signal?.aborted) s.error = error;
    inflight.clear(); emit(true);
    return { ...s };
  }
  return {
    info: () => manifest.packs,
    async status(id) {
      const remembered = states.get(id);
      if (remembered?.state === 'downloading' || remembered?.state === 'error') return { ...remembered };
      return scan(pack(id));
    },
    download(id, opts) {
      const existing = running.get(id); if (existing) return existing;
      const p = pack(id);
      const promise = perform(p, opts).finally(() => { running.delete(id); });
      running.set(id, promise);
      return promise;
    },
    async remove(id) {
      const p = pack(id);
      if (bundled(p)) return;
      if (running.has(id)) throw new Error('Cancel the download before removing a pack');
      for (const [name] of p.files) { await platform.files.remove(`${p.path}/${name}`); if (p.id === 'full') fullFiles.delete(name); }
      states.delete(id);
    },
    async usage() { const [usedBytes, estimate] = await Promise.all([platform.files.bytesUsed(), platform.files.estimate()]); return { usedBytes, quotaBytes: estimate.quota }; },
    localFullUrl(id) { const name = `${id}.webp`; return fullFiles.has(name) ? platform.files.url(`pictures/full/${name}`) : null; },
    async refresh() { const names = await platform.files.list('pictures/full'); fullFiles.clear(); for (const name of names) fullFiles.add(name); },
  };
}
