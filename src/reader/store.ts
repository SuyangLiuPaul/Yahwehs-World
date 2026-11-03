// Fetching the reader's data (one small file per book), with the states a slow or absent network needs.
//
//   * a book already fetched this session is served from memory; a FAILED fetch is never remembered;
//   * a copy kept in Cache Storage (named for the Words commit, so a data update purges it) serves
//     offline, and serves at once on a slow line while a fresh one is fetched behind it;
//   * a request times out (default 20 s) instead of waiting for ever, and is tried twice;
//   * the error says what happened (`offline`, `http`, `parse`), so the view can say it too.
import type { BookHeadings, BookPara, BookText, HeadingSet } from './types.ts';

export type LoadErrorKind = 'offline' | 'http' | 'parse' | 'timeout';
export class LoadError extends Error {
  kind: LoadErrorKind;
  constructor(kind: LoadErrorKind, msg: string) { super(msg); this.kind = kind; this.name = 'LoadError'; }
}

export interface StoreOptions {
  base?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  attempts?: number;
  cacheName?: string;
  /** set false to skip Cache Storage (tests, or a host that has its own service worker) */
  persist?: boolean;
  onRequest?: (url: string) => void;
}

export class DataStore {
  base: string;
  private f: typeof fetch;
  private timeoutMs: number;
  private attempts: number;
  private cacheName: string;
  private persist: boolean;
  private onRequest?: (url: string) => void;
  private mem = new Map<string, Promise<unknown>>();
  private done = new Map<string, unknown>();
  /** the last load that ended in an error, for the view's status line */
  lastError: LoadError | null = null;

  constructor(o: StoreOptions = {}) {
    this.base = (o.base ?? '/data/reader').replace(/\/$/, '');
    this.f = o.fetch ?? ((...a) => fetch(...a));
    this.timeoutMs = o.timeoutMs ?? 20000;
    this.attempts = o.attempts ?? 2;
    this.cacheName = o.cacheName ?? 'yr-data-v1';
    this.persist = o.persist ?? true;
    this.onRequest = o.onRequest;
  }

  text(edition: string, book: number): Promise<BookText> { return this.get<BookText>(`text/${edition}/${book}.json`); }
  headings(set: HeadingSet, book: number): Promise<BookHeadings> { return this.get<BookHeadings>(`headings/${set}/${book}.json`); }
  para(book: number): Promise<BookPara> { return this.get<BookPara>(`para/${book}.json`); }

  /** What is already in memory, without fetching. */
  peek<T>(rel: string): T | undefined { return this.done.get(rel) as T | undefined; }
  peekText(edition: string, book: number): BookText | undefined { return this.peek(`text/${edition}/${book}.json`); }
  peekHeadings(set: HeadingSet, book: number): BookHeadings | undefined { return this.peek(`headings/${set}/${book}.json`); }
  peekPara(book: number): BookPara | undefined { return this.peek(`para/${book}.json`); }

  private get<T>(rel: string): Promise<T> {
    let p = this.mem.get(rel) as Promise<T> | undefined;
    if (!p) {
      p = this.load<T>(rel).then((v) => { this.done.set(rel, v); this.lastError = null; return v; });
      this.mem.set(rel, p);
      p.catch((e: unknown) => { this.mem.delete(rel); this.lastError = e instanceof LoadError ? e : new LoadError('http', String(e)); });
    }
    return p;
  }

  forget(): void { this.mem.clear(); this.done.clear(); }

  private async cache(): Promise<Cache | null> {
    if (!this.persist || typeof caches === 'undefined') return null;
    try { return await caches.open(this.cacheName); } catch { return null; }
  }

  private async load<T>(rel: string): Promise<T> {
    const url = `${this.base}/${rel}`;
    const cache = await this.cache();
    let cached: Response | undefined;
    try { cached = cache ? await cache.match(url) : undefined; } catch { cached = undefined; }
    if (cached) {
      // Stale-while-revalidate: show what is on the device now, refresh it behind.
      void this.network(url, cache).catch(() => {});
      try { return (await cached.json()) as T; } catch { /* a damaged entry: fall through to the network */ }
    }
    return this.network(url, cache) as Promise<T>;
  }

  private async network(url: string, cache: Cache | null): Promise<unknown> {
    let last: LoadError | null = null;
    for (let i = 0; i < this.attempts; i++) {
      if (i) await new Promise((r) => setTimeout(r, 400 * i));
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), this.timeoutMs);
      try {
        this.onRequest?.(url);
        const res = await this.f(url, { signal: ctl.signal });
        if (!res.ok) {
          last = new LoadError('http', `${url}: HTTP ${res.status}`);
          if (res.status === 404) break; // retrying a missing file does not help
          continue;
        }
        const keep = cache ? res.clone() : null;
        let json: unknown;
        try { json = await res.json(); } catch { throw new LoadError('parse', `${url}: not JSON`); }
        if (cache && keep) { try { await cache.put(url, keep); } catch { /* quota: not fatal */ } }
        return json;
      } catch (e) {
        if (e instanceof LoadError) { last = e; if (e.kind === 'parse') break; continue; }
        const aborted = ctl.signal.aborted;
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        last = new LoadError(aborted ? 'timeout' : offline ? 'offline' : 'offline', `${url}: ${aborted ? 'timed out' : 'network error'}`);
      } finally {
        clearTimeout(timer);
      }
    }
    throw last ?? new LoadError('http', `${url}: failed`);
  }
}
